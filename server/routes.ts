import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTemplateSchema, insertCampaignSchema, insertMessageSchema, type WhatsAppAccount, teamMembers } from "@shared/schema";
import { db } from "@db";
import { eq, and, desc, gte, sql as sqlOp } from "drizzle-orm";
import { z } from "zod";
import { authStorage } from "./auth/storage";
import { isAuthenticated } from "./auth/localAuth";
import { requireActiveSubscription, hasActiveSubscription, SUBSCRIPTION_REQUIRED_MESSAGE, requireVerifiedEmail, EMAIL_VERIFICATION_REQUIRED_MESSAGE } from "./subscriptionGate";
import { pageViews, users } from "@shared/models/auth";
import * as razorpayApi from "./razorpay";
import { sendVerificationEmail } from "./email";
import crypto from "crypto";
import multer from "multer";
import path from "path";
import fs from "fs";
import * as whatsappApi from "./whatsapp-api";

// Configure multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// WhatsApp media type limits
const whatsappMediaLimits: Record<string, number> = {
  "image/jpeg": 5 * 1024 * 1024,      // 5MB for images
  "image/png": 5 * 1024 * 1024,        // 5MB for images
  "image/webp": 5 * 1024 * 1024,       // 5MB for images
  "video/mp4": 16 * 1024 * 1024,       // 16MB for videos
  "video/quicktime": 16 * 1024 * 1024, // 16MB for videos
  "application/pdf": 100 * 1024 * 1024, // 100MB for documents (WhatsApp limit)
};

const allowedExtensions: Record<string, string[]> = {
  "image/jpeg": [".jpg", ".jpeg"],
  "image/png": [".png"],
  "image/webp": [".webp"],
  "video/mp4": [".mp4"],
  "video/quicktime": [".mov"],
  "application/pdf": [".pdf"],
};

// Conversation previews and message threads used to store a literal
// "[Template: name]" placeholder for outbound template sends instead of the
// actual message content, so the inbox never showed what was really sent.
// Render the template's real body text (with variables substituted where
// provided) so it reads like an actual conversation.
function renderTemplatePreview(template: { name: string; components: unknown } | null | undefined, bodyParams?: { type: string; text?: string }[]): string {
  if (!template) return "[Message sent]";
  const components = (template.components as any[]) || [];
  const bodyComp = components.find((c: any) => c.type === "BODY");
  let text = bodyComp?.text as string | undefined;
  if (!text) return `[Template: ${template.name}]`;

  if (bodyParams && bodyParams.length > 0) {
    text = text.replace(/\{\{(\d+)\}\}/g, (_match, index) => {
      const param = bodyParams[Number(index) - 1];
      return param?.text ?? `{{${index}}}`;
    });
  }
  return text;
}

// Meta requires header media to be either a publicly-reachable URL or an
// uploaded media ID - a locally-stored /uploads/... path is neither, so
// resolve it to a real Meta media ID before it's ever used in a send call.
async function resolveHeaderMediaParam(
  mediaUrl: string,
  mediaType: "image" | "video" | "document",
  phoneNumberId: string,
  accessToken: string
): Promise<any> {
  if (/^https?:\/\//i.test(mediaUrl)) {
    return { type: mediaType, [mediaType]: { link: mediaUrl } };
  }

  const localPath = mediaUrl.startsWith("/uploads/")
    ? path.join(uploadDir, path.basename(mediaUrl))
    : null;

  if (!localPath || !fs.existsSync(localPath)) {
    throw new Error(`Header media file not found: ${mediaUrl}`);
  }

  const fileBuffer = fs.readFileSync(localPath);
  const ext = path.extname(localPath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp",
    ".mp4": "video/mp4", ".mov": "video/quicktime",
    ".pdf": "application/pdf", ".doc": "application/msword",
    ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  };
  const mimeType = mimeMap[ext] || "application/octet-stream";

  const uploadResult = await whatsappApi.uploadMedia(phoneNumberId, accessToken, fileBuffer, mimeType, path.basename(localPath));
  if (!uploadResult.success || !uploadResult.data?.id) {
    throw new Error(`Failed to upload header media to Meta: ${uploadResult.error?.message || "Unknown error"}`);
  }

  return { type: mediaType, [mediaType]: { id: uploadResult.data.id } };
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, uniqueSuffix + ext);
    },
  }),
  limits: {
    fileSize: 100 * 1024 * 1024, // 100MB max (documents), actual check done in fileFilter
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = Object.keys(whatsappMediaLimits);
    const ext = path.extname(file.originalname).toLowerCase();
    
    // Check MIME type
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new Error("Invalid file type. Allowed: JPEG, PNG, WebP, MP4, MOV, PDF"));
      return;
    }
    
    // Verify extension matches MIME type
    const validExtensions = allowedExtensions[file.mimetype] || [];
    if (!validExtensions.includes(ext)) {
      cb(new Error(`File extension ${ext} doesn't match content type ${file.mimetype}`));
      return;
    }
    
    cb(null, true);
  },
});

// WebSocket clients for real-time updates
const wsClients = new Set<WebSocket>();

// In-memory upload metadata tracking (maps filename to userId)
// Note: In production, this should be stored in the database
const uploadMetadata = new Map<string, { userId: string; uploadedAt: Date }>();

// Broadcast to all connected clients
function broadcast(event: string, data: any) {
  const message = JSON.stringify({ event, data, timestamp: new Date().toISOString() });
  wsClients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

async function getActiveAccount(req: any): Promise<{ userId: string; accountId: string; account: WhatsAppAccount | undefined } | null> {
  const userId = req.user?.claims?.sub;
  if (!userId) return null;
  const accountId = await storage.getActiveAccountId(userId);
  if (!accountId) return null;
  const account = await storage.getAccount(accountId);
  return { userId, accountId, account: account || undefined };
}

// Schema for update operations
const updateTemplateSchema = z.object({
  name: z.string().max(512).optional(),
  category: z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]).optional(),
  language: z.string().max(10).optional(),
  status: z.enum(["PENDING", "APPROVED", "REJECTED", "DISABLED", "PAUSED"]).optional(),
  qualityScore: z.enum(["GREEN", "YELLOW", "RED", "UNKNOWN"]).optional(),
  rejectionReason: z.string().nullable().optional(),
  components: z.array(z.any()).optional(),
  lastSyncedAt: z.coerce.date().nullable().optional(),
});

const updateCampaignSchema = z.object({
  name: z.string().max(255).optional(),
  description: z.string().nullable().optional(),
  templateId: z.string().optional(),
  status: z.enum(["draft", "scheduled", "running", "completed", "paused", "failed"]).optional(),
  scheduledAt: z.coerce.date().nullable().optional(),
  startedAt: z.coerce.date().nullable().optional(),
  completedAt: z.coerce.date().nullable().optional(),
  recipients: z.array(z.string()).nullable().optional(),
});

const updateMessageSchema = z.object({
  status: z.enum(["queued", "sent", "delivered", "read", "failed"]).optional(),
  sentAt: z.coerce.date().nullable().optional(),
  deliveredAt: z.coerce.date().nullable().optional(),
  readAt: z.coerce.date().nullable().optional(),
  errorCode: z.string().nullable().optional(),
  errorDescription: z.string().nullable().optional(),
});

const apiSettingsSchema = z.object({
  accessToken: z.string().min(1, "Access token is required"),
  phoneNumberId: z.string().min(1, "Phone number ID is required"),
  businessAccountId: z.string().min(1, "Business account ID is required"),
  webhookVerifyToken: z.string().min(1, "Webhook verify token is required"),
  apiVersion: z.string().default("v18.0"),
});

// Schema for manual WhatsApp account addition
const manualWhatsAppAccountSchema = z.object({
  phoneNumberId: z.string().min(1, "Phone Number ID is required"),
  businessAccountId: z.string().min(1, "WABA ID is required"),
  accessToken: z.string().min(1, "Access Token is required"),
  name: z.string().optional(),
});

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  
  // ============== WebSocket Setup ==============
  const wss = new WebSocketServer({ server: httpServer, path: "/ws" });
  
  wss.on("connection", (ws) => {
    wsClients.add(ws);
    console.log("WebSocket client connected");
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({ event: "connected", data: { message: "Connected to real-time updates" } }));
    
    ws.on("close", () => {
      wsClients.delete(ws);
      console.log("WebSocket client disconnected");
    });
    
    ws.on("error", (error) => {
      console.error("WebSocket error:", error);
      wsClients.delete(ws);
    });
  });

  // ============== Dashboard ==============
  app.get("/api/dashboard/metrics", async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) {
        return res.json({
          totalMessages: 0, sentCount: 0, deliveredCount: 0, readCount: 0, failedCount: 0,
          deliveryRate: 0, readRate: 0, totalCost: 0, activeCampaigns: 0,
          approvedTemplates: 0, pendingTemplates: 0, messagingLimit: 0, messagingUsed: 0,
          qualityRating: "UNKNOWN", apiStatus: "disconnected", lastSyncedAt: null,
        });
      }
      const metrics = await storage.getDashboardMetrics(active.accountId);
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  app.post("/api/dashboard/sync", async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) {
        return res.status(400).json({ error: "No active WhatsApp account selected" });
      }

      const account = await storage.getAccount(active.accountId);
      if (!account?.accessToken || !account?.phoneNumberId) {
        return res.status(400).json({ error: "Account missing API credentials. Please configure in Settings." });
      }

      const syncResults: any = {
        phoneAnalytics: null,
        wabaAnalytics: null,
        conversationAnalytics: null,
        templateSync: null,
        errors: [],
      };

      try {
        const phoneRes = await whatsappApi.getPhoneNumberAnalytics(account.phoneNumberId, account.accessToken);
        if (phoneRes.success && phoneRes.data) {
          const limitTierMap: Record<string, number> = {
            "TIER_NOT_SET": 0, "TIER_50": 50, "TIER_250": 250,
            "TIER_1K": 1000, "TIER_2K": 2000,
            "TIER_10K": 10000, "TIER_100K": 100000, "TIER_UNLIMITED": 999999,
          };
          const qr = phoneRes.data.quality_rating || account.qualityRating;
          const limitTier = phoneRes.data.messaging_limit_tier;
          const newLimit = limitTierMap[limitTier] || account.messagingLimit;
          // Meta returns this field UPPERCASE (e.g. "CONNECTED", "PENDING") while the
          // rest of the app's status checks are lowercase - normalize to match.
          const normalizedStatus = phoneRes.data.status?.toLowerCase() || account.status;
          await storage.updateAccount(active.accountId, {
            qualityRating: qr,
            messagingLimit: newLimit,
            status: normalizedStatus,
          });
          syncResults.phoneAnalytics = {
            qualityRating: qr,
            messagingLimit: newLimit,
            verifiedName: phoneRes.data.verified_name,
            displayPhoneNumber: phoneRes.data.display_phone_number,
            status: phoneRes.data.status,
          };
        } else {
          syncResults.errors.push(`Phone analytics: ${phoneRes.error?.message || "Unknown error"}`);
        }
      } catch (e: any) {
        syncResults.errors.push(`Phone analytics: ${e.message}`);
      }

      let metaSent = 0;
      let metaDelivered = 0;
      try {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const wabaRes = await whatsappApi.getWabaAnalytics(
          account.businessAccountId, account.accessToken, thirtyDaysAgo, now
        );
        if (wabaRes.success && wabaRes.data?.analytics) {
          const analytics = wabaRes.data.analytics;
          if (analytics.data_points) {
            for (const dp of analytics.data_points) {
              metaSent += dp.sent || 0;
              metaDelivered += dp.delivered || 0;
            }
          } else if (analytics.data) {
            for (const item of analytics.data) {
              if (item.data_points) {
                for (const dp of item.data_points) {
                  metaSent += dp.sent || 0;
                  metaDelivered += dp.delivered || 0;
                }
              }
            }
          }
          await storage.updateAccount(active.accountId, {
            metaSentCount: metaSent,
            metaDeliveredCount: metaDelivered,
          });
          syncResults.wabaAnalytics = { sent: metaSent, delivered: metaDelivered };
        } else {
          syncResults.errors.push(`WABA analytics: ${wabaRes.error?.message || "No data returned"}`);
        }
      } catch (e: any) {
        syncResults.errors.push(`WABA analytics: ${e.message}`);
      }

      let totalConversations = 0;
      let totalCost = 0;
      try {
        const now = Math.floor(Date.now() / 1000);
        const thirtyDaysAgo = now - (30 * 24 * 60 * 60);
        const convRes = await whatsappApi.getConversationAnalytics(
          account.businessAccountId, account.accessToken, thirtyDaysAgo, now
        );
        if (convRes.success && convRes.data) {
          const rawData = convRes.data;
          const convData = rawData.conversation_analytics || rawData;

          const extractFromDataPoints = (points: any[]) => {
            for (const dp of points) {
              totalConversations += dp.conversation || dp.count || 0;
              totalCost += dp.cost || 0;
            }
          };

          if (convData.data && Array.isArray(convData.data)) {
            for (const item of convData.data) {
              if (item.data_points && Array.isArray(item.data_points)) {
                extractFromDataPoints(item.data_points);
              }
            }
          } else if (convData.data_points && Array.isArray(convData.data_points)) {
            extractFromDataPoints(convData.data_points);
          }

          console.log(`[Sync] Conversation analytics: ${totalConversations} conversations, cost: ${totalCost}`);
          await storage.updateAccount(active.accountId, {
            messagingUsed: totalConversations,
            metaTotalCost: totalCost.toFixed(2),
          });
          syncResults.conversationAnalytics = { totalConversations, totalCost };
        } else {
          syncResults.errors.push(`Conversation analytics: ${convRes.error?.message || "No data returned"}`);
        }
      } catch (e: any) {
        syncResults.errors.push(`Conversation analytics: ${e.message}`);
      }

      try {
        const metaTemplates = await whatsappApi.getTemplates(account.businessAccountId, account.accessToken);
        if (metaTemplates.success && metaTemplates.data?.data) {
          const localTemplates = await storage.getTemplates(active.accountId);
          let synced = 0;
          for (const metaT of metaTemplates.data.data) {
            const local = localTemplates.find(
              (lt) => lt.metaTemplateId === metaT.id || lt.name?.toLowerCase() === metaT.name?.toLowerCase()
            );
            if (local) {
              const updates: any = { status: metaT.status, lastSyncedAt: new Date() };
              if (metaT.id && !local.metaTemplateId) {
                updates.metaTemplateId = metaT.id;
              }
              if (metaT.quality_score?.score) {
                updates.qualityScore = metaT.quality_score.score;
              }
              if (metaT.rejected_reason) {
                updates.rejectionReason = metaT.rejected_reason;
              }
              await storage.updateTemplate(local.id, updates);
              synced++;
            }
          }
          syncResults.templateSync = {
            metaTemplateCount: metaTemplates.data.data.length,
            localSynced: synced,
          };
        } else {
          syncResults.errors.push(`Template sync: ${metaTemplates.error?.message || "No data returned"}`);
        }
      } catch (e: any) {
        syncResults.errors.push(`Template sync: ${e.message}`);
      }

      const syncedAt = new Date();
      await storage.updateAccount(active.accountId, { lastSyncedAt: syncedAt });

      await storage.addActivity({
        accountId: active.accountId,
        type: "sync_completed",
        title: "Dashboard Synced",
        description: `Synced with Meta API${syncResults.errors.length > 0 ? ` (${syncResults.errors.length} warnings)` : ""}`,
        timestamp: syncedAt,
        metadata: null,
      });

      const updatedMetrics = await storage.getDashboardMetrics(active.accountId);
      if (syncResults.phoneAnalytics) {
        updatedMetrics.qualityRating = syncResults.phoneAnalytics.qualityRating;
        updatedMetrics.messagingLimit = syncResults.phoneAnalytics.messagingLimit;
      }
      if (totalCost > 0) {
        updatedMetrics.totalCost = totalCost;
      }

      res.json({
        success: true,
        metrics: updatedMetrics,
        syncResults,
        syncedAt: syncedAt.toISOString(),
      });
    } catch (error: any) {
      console.error("Dashboard sync error:", error);
      res.status(500).json({ error: "Sync failed: " + (error.message || "Unknown error") });
    }
  });

  app.get("/api/dashboard/chart-data", async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) {
        return res.json({ messageVolume: [], statusDistribution: [] });
      }
      const chartData = await storage.getDashboardChartData(active.accountId);
      res.json(chartData);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch chart data" });
    }
  });

  app.get("/api/dashboard/activities", async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.json([]);
      const activities = await storage.getRecentActivities(active.accountId);
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // ============== Analytics ==============
  app.get("/api/analytics", async (req: any, res) => {
    try {
      const timeRange = req.query.range as string || "7d";
      const active = await getActiveAccount(req);
      if (!active) {
        return res.json({
          dailyData: [], hourlyData: [], categoryData: [], errorData: [], costData: [],
          summary: { totalMessages: 0, totalDelivered: 0, totalRead: 0, totalFailed: 0, deliveryRate: 0, readRate: 0, totalCost: 0 },
        });
      }
      const analytics = await storage.getAnalyticsData(timeRange, active.accountId);
      res.json(analytics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch analytics" });
    }
  });

  // ============== File Uploads ==============
  // Serve uploaded files statically
  const express = await import("express");
  app.use("/uploads", (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    next();
  }, express.default.static(uploadDir));

  // File upload endpoint
  app.post("/api/upload", isAuthenticated as RequestHandler, upload.single("file"), async (req: any, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      // Enforce per-type size limits on server side
      const maxSize = whatsappMediaLimits[req.file.mimetype];
      if (maxSize && req.file.size > maxSize) {
        // Delete the uploaded file since it exceeds the limit
        const filePath = path.join(uploadDir, req.file.filename);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
        const limitMB = Math.round(maxSize / (1024 * 1024));
        return res.status(400).json({
          error: `File too large. Maximum size for ${req.file.mimetype.split('/')[0]}s is ${limitMB}MB.`
        });
      }

      // Store upload metadata with user association
      const user = (req as any).user;
      const userId = user?.id || user?.claims?.sub || "anonymous";

      // Track this upload for ownership verification
      uploadMetadata.set(req.file.filename, {
        userId,
        uploadedAt: new Date(),
      });

      const fileUrl = `/uploads/${req.file.filename}`;

      // Immediately push this to Meta's resumable upload API and keep the
      // resulting handle, so template submission never depends on the local
      // file still existing later - hosts like Render wipe local disk on
      // every restart/redeploy, which otherwise silently breaks header media
      // between upload and submit time.
      let mediaHandle: string | undefined;
      try {
        const active = await getActiveAccount(req);
        const facebookAppId = process.env.FACEBOOK_APP_ID;
        if (active?.account?.accessToken && facebookAppId) {
          const uploadResult = await whatsappApi.uploadSessionMedia(
            facebookAppId,
            active.account.accessToken,
            req.file.buffer || fs.readFileSync(path.join(uploadDir, req.file.filename)),
            req.file.mimetype,
            req.file.originalname
          );
          if (uploadResult.success && uploadResult.data?.handle) {
            mediaHandle = uploadResult.data.handle;
          } else {
            console.warn("[Upload] Meta media pre-upload failed, will retry from local disk at submit time:", uploadResult.error?.message);
          }
        }
      } catch (metaUploadErr: any) {
        console.warn("[Upload] Meta media pre-upload error, will retry from local disk at submit time:", metaUploadErr.message);
      }

      const fileInfo = {
        url: fileUrl,
        mediaHandle,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimetype: req.file.mimetype,
        size: req.file.size,
        uploadedBy: userId,
        uploadedAt: new Date().toISOString(),
      };

      res.json(fileInfo);
    } catch (error) {
      console.error("Upload error:", error);
      res.status(500).json({ error: "Failed to upload file" });
    }
  });

  // Delete uploaded file
  app.delete("/api/upload/:filename", isAuthenticated as RequestHandler, (req, res) => {
    try {
      const filename = req.params.filename as string;
      const user = (req as any).user;
      const currentUserId = user?.id || user?.claims?.sub;
      const isSuperAdmin = user?.role === "super_admin";
      
      // Sanitize filename - prevent path traversal attacks
      const sanitizedFilename = path.basename(filename);
      if (sanitizedFilename !== filename || filename.includes("..") || filename.includes("/") || filename.includes("\\")) {
        return res.status(400).json({ error: "Invalid filename" });
      }
      
      // Validate filename format (timestamp-random.ext)
      if (!/^\d+-\d+\.\w+$/.test(sanitizedFilename)) {
        return res.status(400).json({ error: "Invalid filename format" });
      }
      
      const filePath = path.join(uploadDir, sanitizedFilename);
      
      // Ensure the resolved path is still within uploadDir
      const resolvedPath = path.resolve(filePath);
      const resolvedUploadDir = path.resolve(uploadDir);
      if (!resolvedPath.startsWith(resolvedUploadDir)) {
        return res.status(400).json({ error: "Invalid file path" });
      }
      
      // Check ownership (super_admin can delete any file)
      const metadata = uploadMetadata.get(sanitizedFilename);
      if (metadata && !isSuperAdmin && metadata.userId !== currentUserId) {
        return res.status(403).json({ error: "Not authorized to delete this file" });
      }
      
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        uploadMetadata.delete(sanitizedFilename); // Clean up metadata
        res.json({ message: "File deleted successfully" });
      } else {
        // Also clean up stale metadata
        uploadMetadata.delete(sanitizedFilename);
        res.status(404).json({ error: "File not found" });
      }
    } catch (error) {
      console.error("Delete error:", error);
      res.status(500).json({ error: "Failed to delete file" });
    }
  });

  // ============== Templates ==============
  app.get("/api/templates", async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.json([]);
      const templates = await storage.getTemplates(active.accountId);
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      if (template.accountId && template.accountId !== active.accountId) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const saveAsDraft = req.body.saveAsDraft === true;
      const data = insertTemplateSchema.parse(req.body);
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const activeAccount = active.account;

      const bodyComp = (data.components as any[])?.find((c: any) => c.type === "BODY");
      if (!bodyComp?.text?.trim()) {
        return res.status(400).json({
          error: "Template body text is required",
          details: "Please add body text before submitting the template.",
        });
      }

      const headerComp = (data.components as any[])?.find((c: any) => c.type === "HEADER");
      if (!saveAsDraft && headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format)) {
        if (!headerComp.mediaUrl) {
          return res.status(400).json({
            error: `A ${headerComp.format.toLowerCase()} is required for this header`,
            details: "WhatsApp requires a sample media file for media headers - please upload one before submitting.",
          });
        }
        // Uploaded files live on local disk, which can be wiped by a server
        // restart/redeploy between upload and submission - fail clearly here
        // instead of silently submitting to Meta with no media at all.
        if (headerComp.mediaUrl.startsWith("/uploads/")) {
          const localPath = path.join(uploadDir, path.basename(headerComp.mediaUrl));
          if (!fs.existsSync(localPath)) {
            return res.status(400).json({
              error: "Uploaded image is no longer available",
              details: "The server storage was reset since you uploaded this file. Please re-upload the header image and submit again right away.",
            });
          }
        }
      }

      const normalizedName = data.name.toLowerCase().replace(/[^a-z0-9_]/g, "_");
      let metaTemplateId: string | null = null;
      let templateStatus = "DRAFT";
      let metaError: string | null = null;

      if (!saveAsDraft && activeAccount?.accessToken && activeAccount?.businessAccountId) {
        const facebookAppId = process.env.FACEBOOK_APP_ID || undefined;

        const metaResult = await whatsappApi.createTemplate(
          activeAccount.businessAccountId,
          activeAccount.accessToken,
          normalizedName,
          data.category,
          data.language || "en",
          (data.components || []) as any[],
          facebookAppId
        );

        if (metaResult.success && metaResult.data?.id) {
          metaTemplateId = metaResult.data.id;
          templateStatus = metaResult.data.status || "PENDING";
          console.log("Template submitted to Meta API successfully:", metaResult.data);
        } else {
          console.error("Meta API template creation failed:", metaResult.error);
          metaError = metaResult.error?.message || "Unknown error from Meta API";
          templateStatus = "DRAFT";
        }
      } else if (!saveAsDraft) {
        metaError = "No connected WhatsApp account. Template saved as draft.";
      }

      const template = await storage.createTemplate({
        ...data,
        name: normalizedName,
        accountId: active.accountId,
        metaTemplateId,
        status: templateStatus,
      });

      const activityType = metaTemplateId ? "template_submitted" : "template_created";
      const activityDesc = metaTemplateId
        ? `${template.name} submitted to WhatsApp for approval`
        : `${template.name} saved as draft`;

      await storage.addActivity({
        accountId: active.accountId,
        type: activityType,
        title: metaTemplateId ? "Template Submitted" : "Template Saved",
        description: activityDesc,
        timestamp: new Date(),
        metadata: null,
      });

      const response: any = { ...template };
      if (metaError) {
        response.metaWarning = metaError;
      }

      res.status(201).json(response);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      console.error("Template creation error:", error);
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/templates/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getTemplate(req.params.id);
      if (!existing) return res.status(404).json({ error: "Template not found" });
      if (existing.accountId && existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "Template not found" });
      }
      const updates = updateTemplateSchema.parse(req.body);

      // WhatsApp template names are immutable once submitted to Meta - Meta
      // still only recognizes the original name, so renaming the local copy
      // silently breaks every future send with "template name does not
      // exist" while looking fine in the UI.
      if (updates.name && updates.name !== existing.name && existing.metaTemplateId) {
        return res.status(400).json({
          error: "Can't rename a template that's already been submitted to WhatsApp",
          details: "WhatsApp template names can't be changed after submission. Duplicate this template instead if you need a different name.",
        });
      }

      const template = await storage.updateTemplate(req.params.id, updates);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }

      // Broadcast real-time update
      broadcast("template-updated", { template });

      res.json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update template" });
    }
  });

  app.delete("/api/templates/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      if (template.accountId && template.accountId !== active.accountId) {
        return res.status(404).json({ error: "Template not found" });
      }

      if (active.account?.accessToken && active.account?.businessAccountId && template.metaTemplateId) {
        const metaResult = await whatsappApi.deleteTemplate(
          active.account.businessAccountId,
          active.account.accessToken,
          template.name
        );
        if (!metaResult.success) {
          console.error("Meta API template deletion warning:", metaResult.error);
        }
      }

      const deleted = await storage.deleteTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      console.error("Template deletion error:", error);
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // Submit a draft template to Meta
  app.post("/api/templates/:id/submit", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const account = active.account;

      const template = await storage.getTemplate(req.params.id);
      if (!template) return res.status(404).json({ error: "Template not found" });
      if (template.accountId && template.accountId !== active.accountId) {
        return res.status(404).json({ error: "Template not found" });
      }

      if (template.metaTemplateId) {
        return res.status(400).json({ error: "Template is already submitted to Meta" });
      }

      if (!account?.accessToken || !account?.businessAccountId) {
        return res.status(400).json({ error: "No connected WhatsApp account" });
      }

      const bodyComp = (template.components as any[])?.find((c: any) => c.type === "BODY");
      if (!bodyComp?.text?.trim()) {
        return res.status(400).json({ error: "Template body text is required" });
      }

      const facebookAppId = process.env.FACEBOOK_APP_ID || undefined;
      const metaResult = await whatsappApi.createTemplate(
        account.businessAccountId,
        account.accessToken,
        template.name,
        template.category,
        template.language || "en",
        (template.components || []) as any[],
        facebookAppId
      );

      if (metaResult.success && metaResult.data?.id) {
        const updated = await storage.updateTemplate(template.id, {
          metaTemplateId: metaResult.data.id,
          status: metaResult.data.status || "PENDING",
          lastSyncedAt: new Date(),
        });
        console.log(`[Template] Draft "${template.name}" submitted to Meta: ${metaResult.data.id}`);
        broadcast("template-updated", { template: updated });
        res.json(updated);
      } else {
        console.error(`[Template] Submit failed for "${template.name}":`, metaResult.error);
        res.status(400).json({
          error: "Failed to submit template to Meta",
          details: metaResult.error?.message,
        });
      }
    } catch (error) {
      console.error("Template submit error:", error);
      res.status(500).json({ error: "Failed to submit template" });
    }
  });

  app.post("/api/templates/sync", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });

      const account = await storage.getAccount(active.accountId);
      if (!account?.accessToken || !account?.businessAccountId) {
        return res.status(400).json({ error: "No connected WhatsApp account found" });
      }

      console.log(`[Sync] Fetching templates from Meta for WABA ${account.businessAccountId}...`);
      const metaResult = await whatsappApi.getTemplates(
        account.businessAccountId,
        account.accessToken
      );

      if (!metaResult.success) {
        console.error(`[Sync] Failed to fetch templates:`, metaResult.error);
        return res.status(400).json({
          error: "Failed to fetch templates from WhatsApp",
          details: metaResult.error?.message,
        });
      }

      const metaTemplates = metaResult.data?.data || [];
      console.log(`[Sync] Got ${metaTemplates.length} templates from Meta: ${metaTemplates.map((t: any) => `${t.name}(${t.status})`).join(", ")}`);
      let synced = 0;
      let created = 0;

      const localTemplates = await storage.getTemplates(account.id);
      const templatesByMetaId = new Map(localTemplates.filter(t => t.metaTemplateId).map(t => [t.metaTemplateId, t]));
      const templatesByName = new Map(localTemplates.map(t => [t.name, t]));

      for (const mt of metaTemplates) {
        const existing = templatesByMetaId.get(mt.id) || templatesByName.get(mt.name);

        if (existing) {
          const updateData: any = {
            status: mt.status,
            qualityScore: mt.quality_score?.score || mt.quality_score || "UNKNOWN",
            rejectionReason: mt.rejected_reason || null,
            lastSyncedAt: new Date(),
          };
          if (!existing.metaTemplateId && mt.id) {
            updateData.metaTemplateId = mt.id;
          }
          await storage.updateTemplate(existing.id, updateData);
          synced++;
        } else {
          const components = (mt.components || []).map((c: any) => ({
            type: c.type,
            format: c.format,
            text: c.text,
            buttons: c.buttons,
            example: c.example,
          }));

          await storage.createTemplate({
            accountId: account.id,
            metaTemplateId: mt.id,
            name: mt.name,
            category: mt.category,
            language: mt.language,
            status: mt.status,
            qualityScore: mt.quality_score?.score || mt.quality_score || "UNKNOWN",
            components,
            lastSyncedAt: new Date(),
          });
          created++;
        }
      }

      console.log(`[Sync] Complete: ${synced} updated, ${created} created from ${metaTemplates.length} Meta templates`);
      res.json({ synced: synced + created, total: metaTemplates.length, updated: synced, created });
    } catch (error) {
      console.error("Template sync error:", error);
      res.status(500).json({ error: "Failed to sync templates" });
    }
  });

  // ============== Campaigns ==============
  app.get("/api/campaigns", async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.json([]);
      const campaigns = await storage.getCampaigns(active.accountId);
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      if (campaign.accountId && campaign.accountId !== active.accountId) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const data = insertCampaignSchema.parse(req.body);
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const campaign = await storage.createCampaign({ ...data, accountId: active.accountId });
      
      await storage.addActivity({
        accountId: active.accountId,
        type: "campaign_started",
        title: "Campaign Created",
        description: `${campaign.name} - ${campaign.recipients?.length || 0} recipients`,
        timestamp: new Date(),
        metadata: null,
      });
      
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid campaign data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getCampaign(req.params.id);
      if (!existing) return res.status(404).json({ error: "Campaign not found" });
      if (existing.accountId && existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const updates = updateCampaignSchema.parse(req.body);
      const campaign = await storage.updateCampaign(req.params.id, updates);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      
      // Broadcast real-time update
      broadcast("campaign-updated", { campaign });
      
      // Add activity for status changes
      if (updates.status === "running") {
        const activity = await storage.addActivity({
          accountId: campaign.accountId || null,
          type: "campaign_started",
          title: "Campaign Started",
          description: `${campaign.name} - ${campaign.recipients?.length || 0} recipients`,
          timestamp: new Date(),
          metadata: null,
        });
        broadcast("activity-added", { activity });
      } else if (updates.status === "completed") {
        const activity = await storage.addActivity({
          accountId: campaign.accountId || null,
          type: "campaign_completed",
          title: "Campaign Completed",
          description: `${campaign.name} finished successfully`,
          timestamp: new Date(),
          metadata: null,
        });
        broadcast("activity-added", { activity });
      }
      
      res.json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update campaign" });
    }
  });

  app.post("/api/campaigns/:id/execute", isAuthenticated as RequestHandler, requireVerifiedEmail, requireActiveSubscription, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      if (campaign.accountId && campaign.accountId !== active.accountId) {
        return res.status(404).json({ error: "Campaign not found" });
      }

      const template = await storage.getTemplate(campaign.templateId);
      if (!template) {
        return res.status(400).json({ error: "Campaign template not found" });
      }

      if (template.status !== "APPROVED") {
        return res.status(400).json({ error: "Template must be approved by WhatsApp before sending messages" });
      }

      const activeAccount = active.account;

      if (!activeAccount?.accessToken || !activeAccount?.phoneNumberId) {
        return res.status(400).json({ error: "No connected WhatsApp account with valid credentials" });
      }

      const recipients = campaign.recipients || [];
      if (recipients.length === 0) {
        return res.status(400).json({ error: "No recipients specified for this campaign" });
      }

      await storage.updateCampaign(campaign.id, {
        status: "running",
        startedAt: new Date(),
      });
      broadcast("campaign-updated", { campaign: { ...campaign, status: "running" } });

      res.json({ message: `Campaign started. Sending to ${recipients.length} recipients.` });

      let sentCount = 0;
      let failedCount = 0;

      for (const recipientPhone of recipients) {
        try {
          const result = await whatsappApi.sendTemplateMessage(
            activeAccount.phoneNumberId,
            activeAccount.accessToken,
            recipientPhone,
            template.name,
            template.language || "en"
          );

          if (result.success && result.data?.messages?.[0]) {
            const waMessageId = result.data.messages[0].id;
            await storage.createMessage({
              accountId: activeAccount.id,
              campaignId: campaign.id,
              templateId: template.id,
              recipientPhone,
              whatsappMessageId: waMessageId,
              status: "sent",
              sentAt: new Date(),
            });
            sentCount++;

            try {
              let conv = await storage.getConversationByPhone(recipientPhone, activeAccount.id);
              const outboundMsg = renderTemplatePreview(template);
              if (!conv) {
                conv = await storage.createConversation(recipientPhone, undefined, activeAccount.id);
              }
              await storage.updateConversation(conv.id, {
                lastMessage: outboundMsg,
                lastMessageAt: new Date(),
                status: "open",
              });
              await storage.addConversationMessage({
                conversationId: conv.id,
                content: outboundMsg,
                direction: "outbound",
                type: "template",
                status: "sent",
              });
              broadcast("conversation-updated", { conversationId: conv.id });
            } catch (convErr: any) {
              console.error(`Failed to create conversation for ${recipientPhone}:`, convErr.message);
            }
          } else {
            await storage.createMessage({
              accountId: activeAccount.id,
              campaignId: campaign.id,
              templateId: template.id,
              recipientPhone,
              status: "failed",
              errorCode: String(result.error?.code || ""),
              errorDescription: result.error?.message || "Unknown error",
            });
            failedCount++;
          }

          broadcast("campaign-updated", {
            campaign: { id: campaign.id, sentCount, failedCount },
          });

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error(`Failed to send to ${recipientPhone}:`, err.message);
          try {
            await storage.createMessage({
              accountId: activeAccount.id,
              campaignId: campaign.id,
              templateId: template.id,
              recipientPhone,
              status: "failed",
              errorCode: "EXCEPTION",
              errorDescription: err.message || "Unexpected error while sending",
            });
          } catch (persistErr: any) {
            console.error(`Also failed to record the failure for ${recipientPhone}:`, persistErr.message);
          }
          failedCount++;
        }
      }

      await storage.updateCampaign(campaign.id, {
        status: "completed",
        completedAt: new Date(),
      });

      const activity = await storage.addActivity({
        accountId: activeAccount.id,
        type: "campaign_completed",
        title: "Campaign Completed",
        description: `${campaign.name}: ${sentCount} sent, ${failedCount} failed`,
        timestamp: new Date(),
        metadata: null,
      });
      broadcast("campaign-updated", { campaign: { ...campaign, status: "completed" } });
      broadcast("activity-added", { activity });
    } catch (error) {
      console.error("Campaign execution error:", error);
    }
  });

  app.delete("/api/campaigns/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getCampaign(req.params.id);
      if (!existing) return res.status(404).json({ error: "Campaign not found" });
      if (existing.accountId && existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const deleted = await storage.deleteCampaign(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete campaign" });
    }
  });

  // ============== Messages ==============
  app.get("/api/messages", async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.json([]);
      const messages = await storage.getMessages(active.accountId);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/failed", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.json([]);
      const { campaignId } = req.query;
      const allMessages = await storage.getMessages(active.accountId);
      let failedMessages = allMessages.filter(m => m.status === "failed");
      if (campaignId) failedMessages = failedMessages.filter(m => m.campaignId === campaignId);
      res.json(failedMessages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch failed messages" });
    }
  });

  app.get("/api/messages/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const message = await storage.getMessage(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      if (message.accountId && message.accountId !== active.accountId) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch message" });
    }
  });

  app.get("/api/campaigns/:id/messages", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) return res.status(404).json({ error: "Campaign not found" });
      if (campaign.accountId && campaign.accountId !== active.accountId) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      const messages = await storage.getMessagesByCampaign(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign messages" });
    }
  });

  app.post("/api/messages", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const data = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage({ ...data, accountId: active.accountId });
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.patch("/api/messages/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getMessage(req.params.id);
      if (!existing) return res.status(404).json({ error: "Message not found" });
      if (existing.accountId && existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "Message not found" });
      }
      const updates = updateMessageSchema.parse(req.body);
      const message = await storage.updateMessage(req.params.id, updates);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      broadcast("message-status-update", { message });
      
      res.json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid update data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to update message" });
    }
  });

  // ============== Settings ==============
  app.get("/api/settings", isAuthenticated as RequestHandler, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", isAuthenticated as RequestHandler, async (req, res) => {
    try {
      const validatedSettings = apiSettingsSchema.parse(req.body);
      const settings = await storage.saveSettings(validatedSettings);

      // Broadcast settings update
      broadcast("settings-updated", { connected: true });

      res.json(settings);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid settings", details: error.errors });
      }
      res.status(500).json({ error: "Failed to save settings" });
    }
  });

  app.post("/api/settings/test", isAuthenticated as RequestHandler, async (req, res) => {
    try {
      const settings = await storage.getSettings();
      if (!settings || !settings.accessToken) {
        return res.json({ 
          success: false, 
          message: "No API credentials configured" 
        });
      }
      
      // Simulate API test (in real app, would call Meta API)
      res.json({ 
        success: true, 
        message: "Connection successful. API is operational." 
      });
    } catch (error) {
      res.status(500).json({ 
        success: false, 
        message: "Connection test failed" 
      });
    }
  });

  // ============== Webhooks ==============
  // Meta webhook verification
  app.get("/api/webhook", async (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    if (mode === "subscribe") {
      const settings = await storage.getSettings();
      const configuredToken = settings?.webhookVerifyToken;
      if (configuredToken && token !== configuredToken) {
        console.log(`[Webhook] Verify token mismatch: received "${token}", expected "${configuredToken}"`);
        return res.sendStatus(403);
      }
      console.log("[Webhook] Verification successful");
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  // Meta webhook for receiving status updates
  app.post("/api/webhook", async (req, res) => {
    try {
      const body = req.body;
      console.log("[Webhook] Received:", JSON.stringify(body).substring(0, 500));
      
      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === "messages") {
              const incomingMessages = change.value?.messages || [];
              const contacts = change.value?.contacts || [];
              const phoneNumberId = change.value?.metadata?.phone_number_id;

              for (const incoming of incomingMessages) {
                const rawFrom = incoming.from;
                const from = rawFrom.startsWith("+") ? rawFrom : `+${rawFrom}`;
                const contactInfo = contacts.find((c: any) => c.wa_id === rawFrom);
                const contactName = contactInfo?.profile?.name || from;
                console.log(`[Webhook] Incoming ${incoming.type} message from ${from} (${contactName}), phoneNumberId: ${phoneNumberId}`);

                const accounts = await storage.getAccounts();
                const account = accounts.find(a => a.phoneNumberId === phoneNumberId);

                if (!account) {
                  console.error(
                    `[Webhook] DROPPED incoming message from ${from}: no connected account has phoneNumberId="${phoneNumberId}". ` +
                    `Known account phoneNumberIds: ${accounts.map(a => a.phoneNumberId).join(", ") || "(none connected)"}. ` +
                    `This message will NOT appear anywhere in the app - check Settings for a phoneNumberId mismatch.`
                  );
                  continue;
                }
                const accountId = account.id;
                console.log(`[Webhook] Matched account: ${account.name} (id: ${accountId})`);

                let msgContent = "";
                if (incoming.type === "text") {
                  msgContent = incoming.text?.body || "";
                } else if (incoming.type === "interactive") {
                  const interactive = incoming.interactive;
                  if (interactive?.type === "button_reply") {
                    msgContent = interactive.button_reply?.title || interactive.button_reply?.id || "[Button Click]";
                  } else if (interactive?.type === "list_reply") {
                    msgContent = interactive.list_reply?.title || interactive.list_reply?.id || "[List Selection]";
                  } else {
                    msgContent = interactive?.body?.text || `[${interactive?.type || "interactive"}]`;
                  }
                } else if (incoming.type === "button") {
                  msgContent = incoming.button?.text || incoming.button?.payload || "[Quick Reply]";
                } else if (incoming.type === "image") {
                  msgContent = incoming.image?.caption || "[Image]";
                } else if (incoming.type === "video") {
                  msgContent = incoming.video?.caption || "[Video]";
                } else if (incoming.type === "document") {
                  msgContent = incoming.document?.caption || incoming.document?.filename || "[Document]";
                } else if (incoming.type === "audio") {
                  msgContent = "[Audio]";
                } else if (incoming.type === "location") {
                  msgContent = `[Location: ${incoming.location?.latitude}, ${incoming.location?.longitude}]`;
                } else if (incoming.type === "sticker") {
                  msgContent = "[Sticker]";
                } else if (incoming.type === "contacts") {
                  msgContent = "[Contact Card]";
                } else {
                  msgContent = incoming.text?.body || incoming.caption || `[${incoming.type}]`;
                }
                if (!msgContent) msgContent = "[Unsupported message]";

                let conversation = await storage.getConversationByPhone(from, accountId);
                if (!conversation) {
                  conversation = await storage.createConversation(from, contactName, accountId);
                  await storage.updateConversation(conversation.id, {
                    lastMessage: msgContent,
                    lastMessageAt: new Date(),
                    unreadCount: 1,
                    windowEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                  });
                } else {
                  await storage.updateConversation(conversation.id, {
                    lastMessage: msgContent,
                    lastMessageAt: new Date(),
                    unreadCount: (conversation.unreadCount ?? 0) + 1,
                    windowEndsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
                    contactName: contactName,
                    status: "open",
                  });
                }

                console.log(`[Webhook] Conversation ${conversation.id} updated with message: ${msgContent}`);

                await storage.addConversationMessage({
                  conversationId: conversation.id,
                  content: msgContent,
                  direction: "inbound",
                  type: incoming.type === "text" ? "text" : incoming.type,
                  status: "received",
                });

                broadcast("conversation-message", { conversationId: conversation.id });
                broadcast("conversation-updated", { conversationId: conversation.id });
              }

              const statuses = change.value?.statuses || [];
              
              for (const status of statuses) {
                const message = await storage.getMessagesByWhatsappId(status.id);
                if (message) {
                  const updates: any = { status: status.status };
                  
                  if (status.status === "delivered") {
                    updates.deliveredAt = new Date(parseInt(status.timestamp) * 1000);
                  } else if (status.status === "read") {
                    updates.readAt = new Date(parseInt(status.timestamp) * 1000);
                  } else if (status.status === "failed") {
                    updates.errorCode = status.errors?.[0]?.code;
                    updates.errorDescription = status.errors?.[0]?.message;
                  }
                  
                  const previousStatus = message.status;
                  await storage.updateMessage(message.id, updates);

                  if (message.campaignId && previousStatus !== status.status) {
                    try {
                      const notif = await storage.getNotification(message.campaignId);
                      if (notif) {
                        const notifUpdates: any = {};
                        if (status.status === "delivered" && previousStatus !== "delivered" && previousStatus !== "read") {
                          notifUpdates.deliveredCount = (notif.deliveredCount || 0) + 1;
                        } else if (status.status === "read" && previousStatus !== "read") {
                          notifUpdates.readCount = (notif.readCount || 0) + 1;
                          if (previousStatus !== "delivered") {
                            notifUpdates.deliveredCount = (notif.deliveredCount || 0) + 1;
                          }
                        } else if (status.status === "failed" && previousStatus !== "failed") {
                          notifUpdates.failedCount = (notif.failedCount || 0) + 1;
                        }
                        if (Object.keys(notifUpdates).length > 0) {
                          await storage.updateNotification(notif.id, notifUpdates);
                        }
                      }
                    } catch (e) {
                      console.error("[Webhook] Failed to update notification counts:", e);
                    }
                  }
                  
                  const activityType = status.status === "delivered" 
                    ? "message_delivered" 
                    : status.status === "read" 
                      ? "message_read" 
                      : "message_failed";
                  
                  await storage.addActivity({
                    accountId: message.accountId || null,
                    type: activityType,
                    title: `Message ${status.status.charAt(0).toUpperCase() + status.status.slice(1)}`,
                    description: `To ${message.recipientPhone}`,
                    timestamp: new Date(),
                    metadata: null,
                  });
                }
              }
            } else if (change.field === "message_template_status_update") {
              const templateUpdate = change.value;
              const templates = await storage.getTemplates();
              const template = templates.find(
                (t) => t.metaTemplateId === templateUpdate.message_template_id
              );
              
              if (template) {
                await storage.updateTemplate(template.id, {
                  status: templateUpdate.event,
                  rejectionReason: templateUpdate.reason || null,
                  lastSyncedAt: new Date(),
                });
                
                // Add activity
                const activityType = templateUpdate.event === "APPROVED" 
                  ? "template_approved" 
                  : "template_rejected";
                
                await storage.addActivity({
                  accountId: template.accountId || null,
                  type: activityType,
                  title: `Template ${templateUpdate.event.toLowerCase()}`,
                  description: `${templateUpdate.message_template_name} status updated`,
                  timestamp: new Date(),
                  metadata: null,
                });
              }
            }
          }
        }
      }
      
      res.sendStatus(200);
    } catch (error) {
      console.error("Webhook error:", error);
      res.sendStatus(500);
    }
  });

  // ============== Campaign Metrics ==============
  app.get("/api/campaigns/:id/metrics", async (req, res) => {
    try {
      const metrics = await storage.getCampaignMetrics(req.params.id);
      if (!metrics) {
        // Calculate metrics from messages
        const messages = await storage.getMessagesByCampaign(req.params.id);
        const calculated = {
          campaignId: req.params.id,
          totalMessages: messages.length,
          sentCount: messages.filter((m) => m.status !== "queued").length,
          deliveredCount: messages.filter((m) => m.status === "delivered" || m.status === "read").length,
          readCount: messages.filter((m) => m.status === "read").length,
          failedCount: messages.filter((m) => m.status === "failed").length,
          totalCost: messages.reduce((sum, m) => sum + parseFloat(m.cost || "0"), 0).toFixed(2),
          lastUpdatedAt: new Date(),
        };
        return res.json(calculated);
      }
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign metrics" });
    }
  });

  // ============== WhatsApp Accounts ==============
  app.get("/api/accounts", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userEmail = req.user?.claims?.email;
      if (userEmail) {
        const pendingInvites = await db.select().from(teamMembers)
          .where(and(eq(teamMembers.memberEmail, userEmail.toLowerCase()), eq(teamMembers.status, "pending")));
        for (const invite of pendingInvites) {
          await storage.acceptTeamInvite(invite.id, userId);
        }
      }

      const accounts = await storage.getAccountsByUser(userId);
      const activeId = await storage.getActiveAccountId(userId);
      res.json({ accounts, activeAccountId: activeId });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.get("/api/accounts/active", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.json(null);
      }
      const activeId = await storage.getActiveAccountId(userId);
      if (!activeId) {
        // Get the first account as default
        const accounts = await storage.getAccountsByUser(userId);
        if (accounts.length > 0) {
          await storage.setActiveAccount(userId, accounts[0].id);
          return res.json(accounts[0]);
        }
        return res.json(null);
      }
      const account = await storage.getAccount(activeId);
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active account" });
    }
  });

  app.post("/api/accounts", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const account = await storage.createAccount({ ...req.body, userId });
      broadcast("account-added", { account });
      res.status(201).json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.put("/api/accounts/:id/active", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      const account = await storage.getAccount(req.params.id);
      if (!account || account.userId !== userId) {
        return res.status(403).json({ error: "Account not found or does not belong to you" });
      }
      await storage.setActiveAccount(userId, req.params.id);
      broadcast("account-switched", { account });
      res.json({ success: true, account });
    } catch (error) {
      res.status(500).json({ error: "Failed to switch account" });
    }
  });

  app.delete("/api/accounts/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const account = await storage.getAccount(req.params.id);
      if (!account || account.userId !== userId) {
        return res.status(404).json({ error: "Account not found" });
      }
      const deleted = await storage.deleteAccount(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Account not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete account" });
    }
  });

  // Test connection for a specific WhatsApp account
  app.post("/api/whatsapp-accounts/:id/test", isAuthenticated as RequestHandler, async (req, res) => {
    try {
      const accountId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
      console.log("Testing connection for account:", accountId);
      
      const account = await storage.getAccount(accountId);
      if (!account) {
        console.log("Account not found:", accountId);
        return res.json({ 
          success: false, 
          message: "Account not found" 
        });
      }

      console.log("Account found:", { 
        id: account.id, 
        name: account.name, 
        phoneNumberId: account.phoneNumberId,
        hasToken: !!account.accessToken,
        tokenLength: account.accessToken?.length || 0
      });

      if (!account.accessToken) {
        return res.json({ 
          success: false, 
          message: "No access token configured for this account" 
        });
      }

      if (!account.phoneNumberId) {
        return res.json({ 
          success: false, 
          message: "No Phone Number ID configured for this account" 
        });
      }

      // Test the connection by making a simple API call to Meta
      const apiUrl = `https://graph.facebook.com/v21.0/${account.phoneNumberId}?access_token=${account.accessToken}`;
      console.log("Testing Meta API with phoneNumberId:", account.phoneNumberId);
      
      const response = await fetch(apiUrl);
      const responseText = await response.text();
      console.log("Meta API response status:", response.status);

      if (response.ok) {
        const data = JSON.parse(responseText) as any;
        await storage.updateAccount(accountId, { status: "connected" });
        res.json({
          success: true,
          message: `Connection successful! Phone: ${data.display_phone_number || account.phoneNumber}`
        });
      } else {
        let errorMessage = "Connection failed. Check your credentials.";
        try {
          const errorData = JSON.parse(responseText) as any;
          console.log("Meta API error:", errorData);
          errorMessage = errorData.error?.message || errorMessage;
        } catch (e) {
          console.log("Meta API raw error response:", responseText);
        }
        await storage.updateAccount(accountId, { status: "disconnected" });
        res.json({
          success: false,
          message: errorMessage
        });
      }
    } catch (error) {
      console.error("Test connection error:", error);
      res.json({ 
        success: false, 
        message: "Connection test failed. Please check your credentials."
      });
    }
  });

  // ============== Facebook OAuth for WhatsApp Business ==============
  const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID;
  const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET;

  // Return Facebook App ID for SDK initialization (frontend needs this)
  // Protected to ensure only authenticated users can connect accounts
  app.get("/api/auth/facebook/config", isAuthenticated, (req: any, res) => {
    if (!FACEBOOK_APP_ID) {
      return res.status(500).json({ 
        error: "Facebook App ID not configured",
        message: "Please add FACEBOOK_APP_ID to your secrets"
      });
    }
    res.json({ appId: FACEBOOK_APP_ID });
  });

  // Handle Embedded Signup response from Facebook SDK
  // Protected - only authenticated users can add WhatsApp accounts
  app.post("/api/auth/facebook/embedded-signup", isAuthenticated, async (req: any, res) => {
    const { accessToken, userId: fbUserId } = req.body;
    const userId = req.user?.claims?.sub;

    if (!accessToken || !fbUserId || !userId) {
      return res.status(400).json({ error: "Missing access token or user ID" });
    }

    try {
      // Get WhatsApp Business Accounts using the access token
      // First try the direct shared WABA endpoint for embedded signup
      const wabaResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?` +
        `fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}` +
        `&access_token=${accessToken}`
      );

      if (!wabaResponse.ok) {
        const errorData = await wabaResponse.json() as any;
        console.error('WABA fetch failed:', errorData);
        
        // Return more detailed error information
        const errorMessage = errorData.error?.message || "Failed to fetch WhatsApp Business accounts";
        const errorCode = errorData.error?.code;
        
        return res.status(400).json({ 
          error: errorMessage,
          code: errorCode,
          details: "Please ensure you have granted all required permissions during the signup flow."
        });
      }

      const wabaData = await wabaResponse.json() as any;
      
      // Find WhatsApp Business Accounts
      let accountsCreated = 0;
      for (const business of wabaData.data || []) {
        const wabas = business.owned_whatsapp_business_accounts?.data || [];
        for (const waba of wabas) {
          const phoneNumbers = waba.phone_numbers?.data || [];

          try {
            const subResult = await whatsappApi.subscribeAppToWaba(waba.id, accessToken);
            console.log(`[Webhook] Subscribed app to WABA ${waba.id}:`, subResult.success ? "OK" : subResult.error?.message);
          } catch (subErr: any) {
            console.error(`[Webhook] Failed to subscribe to WABA ${waba.id}:`, subErr.message);
          }

          for (const phone of phoneNumbers) {
            // Create account for each phone number
            const existingAccounts = await storage.getAccountsByUser(userId);
            const alreadyExists = existingAccounts.some(a => a.phoneNumberId === phone.id);
            
            if (!alreadyExists) {
              await storage.createAccount({
                userId,
                name: phone.verified_name || waba.name || business.name,
                phoneNumber: phone.display_phone_number,
                phoneNumberId: phone.id,
                businessAccountId: waba.id,
                accessToken: accessToken,
              });
              accountsCreated++;
            }
          }
        }
      }

      if (accountsCreated > 0) {
        broadcast("accounts-updated", { count: accountsCreated });
        res.json({ success: true, message: `Connected ${accountsCreated} WhatsApp account(s)` });
      } else {
        res.json({ success: true, message: "No new WhatsApp Business numbers found. You may have already connected this account." });
      }

    } catch (error) {
      console.error('Embedded signup error:', error);
      res.status(500).json({ error: "Failed to connect WhatsApp account. Please try again." });
    }
  });

  // Auto-detect phone numbers from a WABA
  app.post("/api/whatsapp-accounts/detect-numbers", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const { businessAccountId, accessToken } = req.body;
      if (!businessAccountId || !accessToken) {
        return res.status(400).json({ error: "WABA ID and Access Token are required" });
      }

      const response = await fetch(
        `https://graph.facebook.com/v21.0/${businessAccountId}/phone_numbers?access_token=${accessToken}`
      );

      if (!response.ok) {
        const errorData = await response.json() as any;
        return res.status(400).json({
          error: "Failed to fetch phone numbers",
          message: errorData.error?.message || "Could not retrieve phone numbers from this WABA. Check your WABA ID and Access Token."
        });
      }

      const data = await response.json() as any;
      const phoneNumbers = (data.data || []).map((pn: any) => ({
        id: pn.id,
        displayPhoneNumber: pn.display_phone_number,
        verifiedName: pn.verified_name,
        qualityRating: pn.quality_rating,
        status: pn.code_verification_status || "unknown",
      }));

      res.json({ phoneNumbers });
    } catch (error) {
      console.error("Detect numbers error:", error);
      res.status(500).json({ error: "Failed to detect phone numbers" });
    }
  });

  // Manual WhatsApp account addition with Phone Number ID, WABA ID, and Access Token
  app.post("/api/whatsapp-accounts/manual", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const validation = manualWhatsAppAccountSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validation.error.errors 
        });
      }

      const { phoneNumberId, businessAccountId, accessToken, name } = validation.data;

      // Check if account with this phone number ID already exists
      const existingAccounts = await storage.getAccountsByUser(userId);
      const alreadyExists = existingAccounts.some(a => a.phoneNumberId === phoneNumberId);
      
      if (alreadyExists) {
        return res.status(400).json({ 
          error: "Account already exists",
          message: "A WhatsApp account with this Phone Number ID is already connected."
        });
      }

      // Verify the credentials by making a test API call to Meta
      try {
        const verifyResponse = await fetch(
          `https://graph.facebook.com/v18.0/${phoneNumberId}?access_token=${accessToken}`
        );
        
        if (!verifyResponse.ok) {
          const errorData = await verifyResponse.json() as any;
          return res.status(400).json({ 
            error: "Invalid credentials",
            message: errorData.error?.message || "Failed to verify WhatsApp Business API credentials. Please check your Phone Number ID and Access Token."
          });
        }
        
        const phoneData = await verifyResponse.json() as any;
        
        // Create the account with verified info
        const account = await storage.createAccount({
          userId,
          name: name || phoneData.verified_name || phoneData.display_phone_number || `WhatsApp ${phoneNumberId}`,
          phoneNumber: phoneData.display_phone_number || "",
          phoneNumberId,
          businessAccountId,
          accessToken,
        });

        // Update status to connected since we verified successfully
        await storage.updateAccount(account.id, { status: "connected" });

        broadcast("accounts-updated", { count: 1 });
        res.json({ 
          success: true, 
          message: "WhatsApp account connected successfully!",
          account: {
            id: account.id,
            name: account.name,
            phoneNumber: account.phoneNumber
          }
        });
        
      } catch (fetchError) {
        console.error('Meta API verification error:', fetchError);
        return res.status(400).json({ 
          error: "Verification failed",
          message: "Could not verify credentials with Meta API. Please ensure your Access Token has the required permissions."
        });
      }

    } catch (error) {
      console.error('Manual account creation error:', error);
      res.status(500).json({ error: "Failed to add WhatsApp account. Please try again." });
    }
  });

  // Generate the OAuth URL for Facebook login (legacy - keeping for compatibility)
  app.get("/api/auth/facebook", (req, res) => {
    if (!FACEBOOK_APP_ID) {
      return res.status(500).json({ 
        error: "Facebook App ID not configured",
        message: "Please add FACEBOOK_APP_ID to your secrets in Settings"
      });
    }

    // Get the base URL from the request
    const protocol = req.headers['x-forwarded-proto'] || req.protocol;
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const baseUrl = `${protocol}://${host}`;
    const redirectUri = `${baseUrl}/api/auth/facebook/callback`;

    // Required permissions for WhatsApp Business API
    const scopes = [
      'whatsapp_business_management',
      'whatsapp_business_messaging',
      'business_management'
    ].join(',');

    const authUrl = `https://www.facebook.com/v18.0/dialog/oauth?` +
      `client_id=${FACEBOOK_APP_ID}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      `&scope=${encodeURIComponent(scopes)}` +
      `&response_type=code` +
      `&state=${Date.now()}`;

    res.json({ authUrl });
  });

  // Handle OAuth callback
  app.get("/api/auth/facebook/callback", isAuthenticated, async (req: any, res) => {
    const { code, error, error_description } = req.query;
    const userId = req.user?.claims?.sub;

    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code) {
      return res.redirect('/?error=No authorization code received');
    }

    if (!userId) {
      return res.redirect('/?error=Please login first');
    }

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      return res.redirect('/?error=Facebook credentials not configured');
    }

    try {
      // Get the base URL for redirect URI
      const protocol = req.headers['x-forwarded-proto'] || req.protocol;
      const host = req.headers['x-forwarded-host'] || req.headers.host;
      const baseUrl = `${protocol}://${host}`;
      const redirectUri = `${baseUrl}/api/auth/facebook/callback`;

      // Exchange code for access token
      const tokenResponse = await fetch(
        `https://graph.facebook.com/v18.0/oauth/access_token?` +
        `client_id=${FACEBOOK_APP_ID}` +
        `&client_secret=${FACEBOOK_APP_SECRET}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&code=${code}`
      );

      if (!tokenResponse.ok) {
        const errorData = await tokenResponse.json();
        console.error('Token exchange failed:', errorData);
        return res.redirect('/?error=Failed to exchange authorization code');
      }

      const tokenData = await tokenResponse.json() as { access_token: string };
      const accessToken = tokenData.access_token;

      // Get WhatsApp Business Accounts
      const wabaResponse = await fetch(
        `https://graph.facebook.com/v18.0/me/businesses?` +
        `fields=id,name,owned_whatsapp_business_accounts{id,name,phone_numbers{id,display_phone_number,verified_name}}` +
        `&access_token=${accessToken}`
      );

      if (!wabaResponse.ok) {
        const errorData = await wabaResponse.json();
        console.error('WABA fetch failed:', errorData);
        return res.redirect('/?error=Failed to fetch WhatsApp Business accounts');
      }

      const wabaData = await wabaResponse.json() as any;
      
      // Find WhatsApp Business Accounts
      let accountsCreated = 0;
      for (const business of wabaData.data || []) {
        const wabas = business.owned_whatsapp_business_accounts?.data || [];
        for (const waba of wabas) {
          const phoneNumbers = waba.phone_numbers?.data || [];

          try {
            const subResult = await whatsappApi.subscribeAppToWaba(waba.id, accessToken);
            console.log(`[Webhook] Subscribed app to WABA ${waba.id} (OAuth):`, subResult.success ? "OK" : subResult.error?.message);
          } catch (subErr: any) {
            console.error(`[Webhook] Failed to subscribe to WABA ${waba.id}:`, subErr.message);
          }

          for (const phone of phoneNumbers) {
            // Create account for each phone number
            const existingAccounts = await storage.getAccountsByUser(userId);
            const alreadyExists = existingAccounts.some(a => a.phoneNumberId === phone.id);
            
            if (!alreadyExists) {
              await storage.createAccount({
                userId,
                name: phone.verified_name || waba.name || business.name,
                phoneNumber: phone.display_phone_number,
                phoneNumberId: phone.id,
                businessAccountId: waba.id,
                accessToken: accessToken,
              });
              accountsCreated++;
            }
          }
        }
      }

      if (accountsCreated > 0) {
        broadcast("accounts-updated", { count: accountsCreated });
        res.redirect('/?success=WhatsApp account connected successfully');
      } else {
        res.redirect('/?error=No new WhatsApp Business numbers found');
      }

    } catch (error) {
      console.error('OAuth callback error:', error);
      res.redirect('/?error=Failed to connect WhatsApp account');
    }
  });

  // ============== Contacts ==============
  app.get("/api/contacts", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const contacts = await storage.getContacts(active.accountId);
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const contact = await storage.createContact({ ...req.body, accountId: active.accountId });
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getContact(req.params.id);
      if (!existing || existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "Contact not found" });
      }
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getContact(req.params.id);
      if (!existing || existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "Contact not found" });
      }
      const deleted = await storage.deleteContact(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  app.post("/api/contacts/bulk-delete", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: "No contact IDs provided" });
      }
      // Scoped to the active account and done as one query - deleting large
      // selections one row at a time was both slow and let any authenticated
      // user delete contacts from a different account by ID.
      const deletedCount = await storage.bulkDeleteContacts(ids, active.accountId);
      res.json({ deleted: deletedCount });
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contacts" });
    }
  });

  app.post("/api/contacts/import", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const { contacts, listId } = req.body;
      const contactsWithAccount = (contacts || []).map((c: any) => ({ ...c, accountId: active.accountId }));
      const { imported, updated } = await storage.importContacts(contactsWithAccount, listId);
      res.json({ imported, updated });
    } catch (error: any) {
      console.error("Contact import error:", error);
      res.status(500).json({ error: "Failed to import contacts", details: error.message });
    }
  });

  // ============== Contact Lists ==============
  app.get("/api/lists", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const lists = await storage.getLists(active.accountId);
      res.json(lists);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lists" });
    }
  });

  app.post("/api/lists", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const list = await storage.createList({ ...req.body, accountId: active.accountId });
      res.status(201).json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to create list" });
    }
  });

  app.delete("/api/lists/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getList(req.params.id);
      if (!existing || existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "List not found" });
      }
      const deleted = await storage.deleteList(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "List not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete list" });
    }
  });

  // ============== Contact Tags ==============
  app.get("/api/tags", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const tags = await storage.getTags(active.accountId);
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.post("/api/tags", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const tag = await storage.createTag({ ...req.body, accountId: active.accountId });
      res.status(201).json(tag);
    } catch (error) {
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  app.delete("/api/tags/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getTag(req.params.id);
      if (!existing || existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "Tag not found" });
      }
      const deleted = await storage.deleteTag(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Tag not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete tag" });
    }
  });

  // ============== Conversations ==============
  app.get("/api/conversations", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const filter = req.query.filter as string;
      const allConversations = await storage.getConversations(active.accountId);

      if (filter === "replied") {
        const repliedIds = await storage.getRepliedConversationIds(active.accountId);
        return res.json(allConversations.filter((conv) => repliedIds.has(conv.id)));
      }

      res.json(allConversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (conversation.accountId && conversation.accountId !== active.accountId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      if (conversation.accountId && conversation.accountId !== active.accountId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const messages = await storage.getConversationMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }

      const userId = req.user?.claims?.sub;
      const accounts = userId ? await storage.getAccountsByUser(userId) : await storage.getAccounts();
      // Always use the account this conversation belongs to - never substitute
      // a different connected account, or the reply can go out from the wrong
      // WhatsApp number entirely.
      const activeAccount = accounts.find(a => a.id === conversation.accountId);
      const isOutbound = req.body.direction === "outbound" || req.body.direction === "outgoing";

      if (isOutbound && userId) {
        const sender = await authStorage.getUser(userId);
        if (sender && sender.role !== "super_admin" && !sender.emailVerified) {
          return res.status(403).json({ error: "email_verification_required", message: EMAIL_VERIFICATION_REQUIRED_MESSAGE });
        }
        if (!(await hasActiveSubscription(userId))) {
          return res.status(402).json({ error: "subscription_required", message: SUBSCRIPTION_REQUIRED_MESSAGE });
        }
      }

      if (isOutbound && (!activeAccount?.accessToken || !activeAccount?.phoneNumberId)) {
        return res.status(400).json({ error: "This conversation's WhatsApp account is missing API credentials. Please reconnect it in Settings." });
      }

      if (isOutbound && activeAccount?.accessToken && activeAccount?.phoneNumberId && conversation.contactPhone) {
        let metaResult;

        if (req.body.type === "template" && req.body.templateName) {
          const template = await storage.getTemplateByName(req.body.templateName, activeAccount.id);
          const lang = template?.language || "en";
          const components = (template?.components as any[]) || [];
          const headerComp = components.find((c: any) => c.type === "HEADER");

          let headerParams: any[] | undefined;
          if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format || "")) {
            const mediaUrl = headerComp.mediaUrl;
            if (mediaUrl) {
              const mediaType = headerComp.format === "IMAGE" ? "image" : headerComp.format === "VIDEO" ? "video" : "document";
              headerParams = [await resolveHeaderMediaParam(mediaUrl, mediaType, activeAccount.phoneNumberId, activeAccount.accessToken)];
            }
          }

          metaResult = await whatsappApi.sendTemplateMessage(
            activeAccount.phoneNumberId,
            activeAccount.accessToken,
            conversation.contactPhone,
            req.body.templateName,
            lang,
            headerParams
          );
        } else {
          metaResult = await whatsappApi.sendTextMessage(
            activeAccount.phoneNumberId,
            activeAccount.accessToken,
            conversation.contactPhone,
            req.body.content
          );
        }

        if (!metaResult.success) {
          console.error("Failed to send WhatsApp message:", metaResult.error);
          return res.status(400).json({
            error: "Failed to send message via WhatsApp",
            details: metaResult.error?.message,
          });
        }

        const waMessageId = metaResult.data?.messages?.[0]?.id;
        req.body.status = "sent";
      }

      const message = await storage.addConversationMessage({
        ...req.body,
        conversationId: req.params.id,
      });
      broadcast("conversation-message", { message });
      res.status(201).json(message);
    } catch (error) {
      console.error("Send message error:", error);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.patch("/api/conversations/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const existing = await storage.getConversation(req.params.id);
      if (!existing) return res.status(404).json({ error: "Conversation not found" });
      if (existing.accountId && existing.accountId !== active.accountId) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      const conversation = await storage.updateConversation(req.params.id, req.body);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to update conversation" });
    }
  });

  // ============== Notifications/Broadcasts ==============
  app.get("/api/notifications", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const notificationList = await storage.getNotifications(active.accountId);
      const allMessages = await storage.getMessages(active.accountId);

      const enriched = notificationList.map(n => {
        const msgs = allMessages.filter(m => m.campaignId === n.id);
        if (msgs.length === 0) return n;
        const sent = msgs.filter(m => m.status === "sent" || m.status === "delivered" || m.status === "read").length;
        const delivered = msgs.filter(m => m.status === "delivered" || m.status === "read").length;
        const read = msgs.filter(m => m.status === "read").length;
        const failed = msgs.filter(m => m.status === "failed").length;
        return { ...n, sentCount: sent, deliveredCount: delivered, readCount: read, failedCount: failed };
      });

      res.json(enriched);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/:id/report", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const notification = await storage.getNotification(req.params.id);
      if (!notification) return res.status(404).json({ error: "Notification not found" });

      const allMessages = await storage.getMessages(active.accountId);
      const notificationMessages = allMessages.filter(m => m.campaignId === notification.id);

      const msgSent = notificationMessages.filter(m => m.status === "sent").length;
      const msgDelivered = notificationMessages.filter(m => m.status === "delivered").length;
      const msgRead = notificationMessages.filter(m => m.status === "read").length;
      const msgFailed = notificationMessages.filter(m => m.status === "failed").length;
      const msgQueued = notificationMessages.filter(m => m.status === "queued").length;
      const hasMessages = notificationMessages.length > 0;

      const statusBreakdown = {
        total: notification.totalRecipients || notificationMessages.length,
        sent: hasMessages ? (msgSent + msgDelivered + msgRead) : (notification.sentCount || 0),
        delivered: hasMessages ? (msgDelivered + msgRead) : (notification.deliveredCount || 0),
        read: hasMessages ? msgRead : (notification.readCount || 0),
        failed: hasMessages ? msgFailed : (notification.failedCount || 0),
        queued: hasMessages ? msgQueued : 0,
      };

      const failedMessages = notificationMessages
        .filter(m => m.status === "failed")
        .map(m => ({
          id: m.id,
          phone: m.recipientPhone,
          errorCode: m.errorCode,
          errorDescription: m.errorDescription,
          sentAt: m.sentAt || m.queuedAt,
        }));

      const templates = await storage.getTemplates(active.accountId);
      const template = templates.find(t => t.id === notification.templateId);

      res.json({
        notification,
        template: template ? { name: template.name, category: template.category } : null,
        statusBreakdown,
        failedMessages,
        messages: notificationMessages.map(m => ({
          id: m.id,
          phone: m.recipientPhone,
          status: m.status,
          errorCode: m.errorCode,
          errorDescription: m.errorDescription,
          sentAt: m.sentAt,
          deliveredAt: m.deliveredAt,
          readAt: m.readAt,
        })),
      });
    } catch (error) {
      console.error("Report error:", error);
      res.status(500).json({ error: "Failed to generate report" });
    }
  });

  app.get("/api/notifications/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const notification = await storage.getNotification(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      if (notification.accountId && notification.accountId !== active.accountId) {
        return res.status(404).json({ error: "Notification not found" });
      }
      const allMessages = await storage.getMessages(active.accountId);
      const msgs = allMessages.filter(m => m.campaignId === notification.id);
      if (msgs.length > 0) {
        const sent = msgs.filter(m => m.status === "sent" || m.status === "delivered" || m.status === "read").length;
        const delivered = msgs.filter(m => m.status === "delivered" || m.status === "read").length;
        const read = msgs.filter(m => m.status === "read").length;
        const failed = msgs.filter(m => m.status === "failed").length;
        return res.json({ ...notification, sentCount: sent, deliveredCount: delivered, readCount: read, failedCount: failed });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notification" });
    }
  });

  app.post("/api/notifications", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const notification = await storage.createNotification({ ...req.body, accountId: active.accountId });
      broadcast("notification-created", { notification });
      res.status(201).json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to create notification" });
    }
  });

  app.patch("/api/notifications/:id", async (req, res) => {
    try {
      const notification = await storage.updateNotification(req.params.id, req.body);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      broadcast("notification-updated", { notification });
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to update notification" });
    }
  });

  app.delete("/api/notifications/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteNotification(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete notification" });
    }
  });

  app.post("/api/notifications/:id/send", isAuthenticated as RequestHandler, requireVerifiedEmail, requireActiveSubscription, async (req: any, res) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }

      const template = await storage.getTemplate(notification.templateId);
      if (!template) {
        return res.status(400).json({ error: "Notification template not found" });
      }

      if (template.status !== "APPROVED") {
        return res.status(400).json({ error: "Template must be approved by WhatsApp before sending messages" });
      }

      const userId = req.user?.claims?.sub;
      const accounts = userId ? await storage.getAccountsByUser(userId) : await storage.getAccounts();
      // Always send from the account this notification was created for - never
      // silently substitute a different connected account, or a message can go
      // out from the wrong WhatsApp number entirely.
      const activeAccount = accounts.find(a => a.id === notification.accountId);

      if (!activeAccount) {
        return res.status(400).json({ error: "The WhatsApp account this notification belongs to was not found." });
      }
      if (!activeAccount.accessToken || !activeAccount.phoneNumberId) {
        return res.status(400).json({ error: `${activeAccount.name} is missing API credentials. Please reconnect it in Settings.` });
      }

      const listIds = notification.listIds || [];
      if (listIds.length === 0) {
        return res.status(400).json({ error: "No recipient lists selected for this notification" });
      }

      const notificationAccountId = notification.accountId || activeAccount.id;
      const allContacts = await storage.getContacts(notificationAccountId);
      const recipientPhones: string[] = [];
      const seen = new Set<string>();
      for (const contact of allContacts) {
        const contactListIds = (contact.listIds as string[]) || [];
        if (contactListIds.some(lid => listIds.includes(lid))) {
          if (contact.phone && contact.status === "subscribed" && !seen.has(contact.phone)) {
            recipientPhones.push(contact.phone);
            seen.add(contact.phone);
          }
        }
      }

      if (recipientPhones.length === 0) {
        return res.status(400).json({ error: "No subscribed contacts found in the selected lists" });
      }

      const components = (template.components as any[]) || [];
      const headerComp = components.find((c: any) => c.type === "HEADER");
      const bodyComp = components.find((c: any) => c.type === "BODY");

      let headerParams: any[] | undefined;
      if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format || "")) {
        // Prefer the template's own approved header media - it's what Meta
        // reviewed and approved. Only fall back to a manually-attached
        // notification image when the template itself has none.
        const mediaUrl = headerComp.mediaUrl || notification.headerMediaUrl;
        if (!mediaUrl) {
          return res.status(400).json({
            error: `This template requires a ${headerComp.format.toLowerCase()} in the header. Please provide a media URL in the notification editor.`,
          });
        }
        const mediaType = headerComp.format === "IMAGE" ? "image" :
                         headerComp.format === "VIDEO" ? "video" : "document";
        try {
          headerParams = [await resolveHeaderMediaParam(mediaUrl, mediaType, activeAccount.phoneNumberId, activeAccount.accessToken)];
        } catch (mediaErr: any) {
          return res.status(400).json({ error: mediaErr.message || "Failed to prepare header media for sending" });
        }
      } else if (headerComp && headerComp.format === "TEXT" && headerComp.text?.includes("{{")) {
        const varCount = (headerComp.text.match(/\{\{\d+\}\}/g) || []).length;
        if (varCount > 0) {
          const templateVars = notification.templateVariables || {};
          headerParams = Array(varCount).fill(null).map((_, i) => ({
            type: "text",
            text: templateVars[`header_${i + 1}`] || "N/A",
          }));
        }
      }

      let bodyParams: any[] | undefined;
      if (bodyComp?.text?.includes("{{")) {
        const varCount = (bodyComp.text.match(/\{\{\d+\}\}/g) || []).length;
        if (varCount > 0) {
          const templateVars = notification.templateVariables || {};
          bodyParams = Array(varCount).fill(null).map((_, i) => ({
            type: "text",
            text: templateVars[`body_${i + 1}`] || "N/A",
          }));
        }
      }

      await storage.updateNotification(notification.id, {
        status: "sending",
        sentAt: new Date(),
        totalRecipients: recipientPhones.length,
      });
      broadcast("notification-updated", { notification: { ...notification, status: "sending" } });

      res.json({ message: `Notification sending started. Sending to ${recipientPhones.length} recipients.` });

      let sentCount = 0;
      let failedCount = 0;

      const phoneArray = Array.from(recipientPhones);
      for (const recipientPhone of phoneArray) {
        try {
          const result = await whatsappApi.sendTemplateMessage(
            activeAccount.phoneNumberId,
            activeAccount.accessToken,
            recipientPhone,
            template.name,
            template.language || "en",
            headerParams,
            bodyParams
          );

          if (result.success && result.data?.messages?.[0]) {
            const waMessageId = result.data.messages[0].id;
            await storage.createMessage({
              accountId: activeAccount.id,
              campaignId: notification.id,
              templateId: template.id,
              recipientPhone,
              whatsappMessageId: waMessageId,
              status: "sent",
              sentAt: new Date(),
            });
            sentCount++;

            try {
              let conv = await storage.getConversationByPhone(recipientPhone, activeAccount.id);
              const outboundMsg = renderTemplatePreview(template, bodyParams);
              if (!conv) {
                conv = await storage.createConversation(recipientPhone, undefined, activeAccount.id);
              }
              await storage.updateConversation(conv.id, {
                lastMessage: outboundMsg,
                lastMessageAt: new Date(),
                status: "open",
              });
              await storage.addConversationMessage({
                conversationId: conv.id,
                content: outboundMsg,
                direction: "outbound",
                type: "template",
                status: "sent",
              });
              broadcast("conversation-updated", { conversationId: conv.id });
            } catch (convErr: any) {
              console.error(`Failed to create conversation for ${recipientPhone}:`, convErr.message);
            }
          } else {
            console.error(`Message send failed to ${recipientPhone}:`, result.error?.message || "Unknown error", `(code: ${result.error?.code})`);
            await storage.createMessage({
              accountId: activeAccount.id,
              campaignId: notification.id,
              templateId: template.id,
              recipientPhone,
              status: "failed",
              errorCode: String(result.error?.code || ""),
              errorDescription: result.error?.message || "Unknown error",
            });
            failedCount++;
          }

          broadcast("notification-updated", {
            notification: { id: notification.id, sentCount, failedCount, totalRecipients: phoneArray.length },
          });

          await new Promise(resolve => setTimeout(resolve, 100));
        } catch (err: any) {
          console.error(`Failed to send to ${recipientPhone}:`, err.message);
          try {
            await storage.createMessage({
              accountId: activeAccount.id,
              campaignId: notification.id,
              templateId: template.id,
              recipientPhone,
              status: "failed",
              errorCode: "EXCEPTION",
              errorDescription: err.message || "Unexpected error while sending",
            });
          } catch (persistErr: any) {
            console.error(`Also failed to record the failure for ${recipientPhone}:`, persistErr.message);
          }
          failedCount++;
        }
      }

      const finalStatus = sentCount === 0 && failedCount > 0 ? "failed" : "completed";
      await storage.updateNotification(notification.id, {
        status: finalStatus,
        completedAt: new Date(),
        sentCount,
        failedCount,
        deliveredCount: sentCount,
      });

      const activity = await storage.addActivity({
        accountId: activeAccount.id,
        type: "notification_completed",
        title: finalStatus === "failed" ? "Notification Failed" : "Notification Completed",
        description: `${notification.name}: ${sentCount} sent, ${failedCount} failed out of ${recipientPhones.length}`,
        timestamp: new Date(),
        metadata: null,
      });
      broadcast("notification-updated", { notification: { ...notification, status: finalStatus, sentCount, failedCount } });
      broadcast("activity-added", { activity });
    } catch (error) {
      console.error("Notification send error:", error);
    }
  });

  // ============== Subscribe to Webhook Events ==============
  app.post("/api/webhook/subscribe", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });

      const account = await storage.getAccount(active.accountId);
      if (!account) return res.status(404).json({ error: "Account not found" });

      if (!account.businessAccountId || !account.accessToken) {
        return res.status(400).json({ error: "Account missing Business Account ID or access token" });
      }

      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;
      
      const results: string[] = [];
      let hasError = false;

      // Step 1: Register webhook URL with Meta App (requires app ID and secret)
      if (appId && appSecret) {
        const host = req.get("host") || req.headers["x-forwarded-host"];
        const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
        const webhookUrl = `${protocol}://${host}/api/webhook`;
        const verifyToken = `whatsapp_verify_${appId}`;

        // Store verify token in settings so webhook verification works
        let settings = await storage.getSettings();
        if (!settings) {
          settings = await storage.saveSettings({
            webhookVerifyToken: verifyToken,
            apiVersion: "v21.0",
            accessToken: "",
            phoneNumberId: "",
            businessAccountId: "",
          });
        } else if (settings.webhookVerifyToken !== verifyToken) {
          const { id: _id, ...rest } = settings;
          await storage.saveSettings({ ...rest, webhookVerifyToken: verifyToken });
        }

        console.log(`[Webhook] Registering webhook URL: ${webhookUrl}`);
        const registerResult = await whatsappApi.registerWebhookWithMeta(appId, appSecret, webhookUrl, verifyToken);
        if (registerResult.success) {
          results.push("Webhook URL registered with Meta");
          console.log(`[Webhook] Successfully registered webhook URL: ${webhookUrl}`);
        } else {
          results.push(`Webhook URL registration failed: ${registerResult.error?.message}`);
          console.error(`[Webhook] URL registration failed:`, registerResult.error);
          hasError = true;
        }
      } else {
        results.push("Facebook App ID/Secret not configured - cannot auto-register webhook URL");
        hasError = true;
      }

      // Step 2: Subscribe app to WABA events
      const wabaResult = await whatsappApi.subscribeAppToWaba(account.businessAccountId, account.accessToken);
      if (wabaResult.success) {
        results.push("App subscribed to WABA events");
        console.log(`[Webhook] Subscribed app to WABA ${account.businessAccountId}`);
      } else {
        results.push(`WABA subscription failed: ${wabaResult.error?.message}`);
        console.error(`[Webhook] WABA subscribe failed:`, wabaResult.error);
        hasError = true;
      }

      const allFailed = results.every(r => r.toLowerCase().includes("failed") || r.toLowerCase().includes("not configured"));
      if (allFailed) {
        res.status(400).json({ error: results.join(". "), details: results });
      } else {
        res.json({ 
          success: !allFailed, 
          message: results.join(". "), 
          details: results,
          partialFailure: hasError,
        });
      }
    } catch (error: any) {
      console.error("Webhook subscribe error:", error);
      res.status(500).json({ error: "Failed to subscribe to webhook events" });
    }
  });

  // Webhook status/diagnostics
  app.get("/api/webhook/status", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const appId = process.env.FACEBOOK_APP_ID;
      const appSecret = process.env.FACEBOOK_APP_SECRET;

      if (!appId || !appSecret) {
        return res.json({ configured: false, message: "Facebook App ID/Secret not configured" });
      }

      const subsResult = await whatsappApi.getWebhookSubscriptions(appId, appSecret);
      const settings = await storage.getSettings();
      
      const host = req.get("host") || req.headers["x-forwarded-host"];
      const protocol = req.headers["x-forwarded-proto"] || req.protocol || "https";
      const expectedUrl = `${protocol}://${host}/api/webhook`;

      let webhookRegistered = false;
      let registeredUrl = "";
      if (subsResult.success && subsResult.data?.data) {
        const whatsappSub = subsResult.data.data.find((s: any) => s.object === "whatsapp_business_account");
        if (whatsappSub) {
          webhookRegistered = true;
          registeredUrl = whatsappSub.callback_url || "";
        }
      }

      res.json({
        configured: true,
        webhookRegistered,
        registeredUrl,
        expectedUrl,
        urlMatch: registeredUrl === expectedUrl,
        verifyTokenConfigured: !!settings?.webhookVerifyToken,
        subscriptions: subsResult.data?.data || [],
      });
    } catch (error: any) {
      res.status(500).json({ error: "Failed to check webhook status" });
    }
  });

  // ============== Backfill Conversations from Sent Messages ==============
  app.post("/api/conversations/backfill", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });

      const messages = await storage.getMessages(active.accountId);
      const sentMessages = messages.filter(m => m.status === "sent" && m.recipientPhone);

      const phoneMap: Record<string, typeof sentMessages> = {};
      for (const msg of sentMessages) {
        const phone = msg.recipientPhone;
        if (!phoneMap[phone]) phoneMap[phone] = [];
        phoneMap[phone].push(msg);
      }

      let created = 0;
      let updated = 0;
      for (const phone of Object.keys(phoneMap)) {
        const msgs = phoneMap[phone];
        const lastMsg = msgs.sort((a: any, b: any) => (b.sentAt?.getTime() || 0) - (a.sentAt?.getTime() || 0))[0];
        const template = lastMsg.templateId ? await storage.getTemplate(lastMsg.templateId) : null;
        const outboundMsg = renderTemplatePreview(template);

        let conv = await storage.getConversationByPhone(phone, active.accountId);
        if (!conv) {
          conv = await storage.createConversation(phone, undefined, active.accountId);
          await storage.updateConversation(conv.id, {
            lastMessage: outboundMsg,
            lastMessageAt: lastMsg.sentAt || new Date(),
            status: "open",
          });
          await storage.addConversationMessage({
            conversationId: conv.id,
            content: outboundMsg,
            direction: "outbound",
            type: "template",
            status: "sent",
          });
          created++;
        } else if (!conv.lastMessage || !conv.lastMessageAt) {
          await storage.updateConversation(conv.id, {
            lastMessage: conv.lastMessage || outboundMsg,
            lastMessageAt: conv.lastMessageAt || lastMsg.sentAt || new Date(),
            status: conv.status || "open",
          });
          updated++;
        }
      }

      res.json({ message: `Backfilled ${created} conversations from ${sentMessages.length} sent messages` });
    } catch (error) {
      console.error("Backfill error:", error);
      res.status(500).json({ error: "Failed to backfill conversations" });
    }
  });

  // ============== Team Members (Account Sharing) ==============
  app.get("/api/team-members", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const members = await storage.getTeamMembers(active.accountId);
      res.json(members);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch team members" });
    }
  });

  app.post("/api/team-members", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const userId = req.user?.claims?.sub;
      if (!userId) return res.status(401).json({ error: "Unauthorized" });

      const { email, role } = req.body;
      if (!email) return res.status(400).json({ error: "Email is required" });

      const existing = await storage.getTeamMemberByEmail(email, active.accountId);
      if (existing) return res.status(400).json({ error: "This email is already a team member" });

      const member = await storage.addTeamMember({
        accountId: active.accountId,
        ownerUserId: userId,
        memberEmail: email.toLowerCase().trim(),
        role: role || "member",
        status: "pending",
      });

      res.json(member);
    } catch (error) {
      res.status(500).json({ error: "Failed to add team member" });
    }
  });

  app.delete("/api/team-members/:id", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const active = await getActiveAccount(req);
      if (!active) return res.status(401).json({ error: "No active account" });
      const removed = await storage.removeTeamMember(req.params.id);
      if (!removed) return res.status(404).json({ error: "Team member not found" });
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to remove team member" });
    }
  });

  app.post("/api/team-members/accept", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      if (!userId || !userEmail) return res.status(401).json({ error: "Unauthorized" });

      const pendingInvites = await storage.getSharedAccountsForUser(userEmail);
      const pending = pendingInvites.filter(m => m.status === "pending");

      const accepted = [];
      for (const invite of pending) {
        const updated = await storage.acceptTeamInvite(invite.id, userId);
        if (updated) accepted.push(updated);
      }

      const active = await storage.getSharedAccountsForUser(userEmail);
      res.json({ accepted: accepted.length, activeShares: active.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to accept invites" });
    }
  });

  // Auto-accept pending invites on login
  app.post("/api/team-members/check-invites", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user?.claims?.sub;
      const userEmail = req.user?.claims?.email;
      if (!userId || !userEmail) return res.json({ accepted: 0 });

      const allInvites = await db.select().from(teamMembers)
        .where(and(eq(teamMembers.memberEmail, userEmail.toLowerCase()), eq(teamMembers.status, "pending")));

      let acceptedCount = 0;
      for (const invite of allInvites) {
        await storage.acceptTeamInvite(invite.id, userId);
        acceptedCount++;
      }

      res.json({ accepted: acceptedCount });
    } catch (error) {
      res.json({ accepted: 0 });
    }
  });

  // ============== User Account Deletion (GDPR) ==============
  
  app.delete("/api/user/delete-account", isAuthenticated, async (req: any, res) => {
    try {
      const user = req.user;
      if (!user?.claims?.sub) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const userId = user.claims.sub;
      
      // Get the user from database to verify they exist
      const dbUser = await authStorage.getUser(userId);
      if (!dbUser) {
        return res.status(404).json({ error: "User not found" });
      }

      // Delete all user-associated data
      // 1. Get all accounts belonging to this user and delete associated data
      const accounts = await storage.getAccountsByUser(userId);
      for (const account of accounts) {
        // Delete contacts for this account
        const contacts = await storage.getContactsByAccount(account.id);
        for (const contact of contacts) {
          await storage.deleteContact(contact.id);
        }
        
        // Delete contact lists for this account
        const lists = await storage.getContactListsByAccount(account.id);
        for (const list of lists) {
          await storage.deleteContactList(list.id);
        }
        
        // Delete tags for this account
        const tags = await storage.getContactTagsByAccount(account.id);
        for (const tag of tags) {
          await storage.deleteContactTag(tag.id);
        }
        
        // Delete conversations for this account
        const conversations = await storage.getConversationsByAccount(account.id);
        for (const conversation of conversations) {
          await storage.deleteConversation(conversation.id);
        }
        
        // Delete notifications for this account
        const notifications = await storage.getNotificationsByAccount(account.id);
        for (const notification of notifications) {
          await storage.deleteNotification(notification.id);
        }
        
        // Delete the account itself
        await storage.deleteAccount(account.id);
      }

      // 2. Delete templates
      const templates = await storage.getTemplates();
      for (const template of templates) {
        await storage.deleteTemplate(template.id);
      }

      // 3. Delete campaigns and messages
      const campaigns = await storage.getCampaigns();
      for (const campaign of campaigns) {
        const messages = await storage.getMessagesByCampaign(campaign.id);
        for (const message of messages) {
          await storage.deleteMessage(message.id);
        }
        await storage.deleteCampaign(campaign.id);
      }

      // 4. Delete API settings
      const settings = await storage.getApiSettings();
      if (settings) {
        await storage.deleteApiSettings();
      }

      // 5. Finally, delete the user account
      await authStorage.deleteUser(userId);

      console.log(`User account deleted: ${userId}`);
      res.json({ success: true, message: "Account and all associated data have been deleted" });
    } catch (error) {
      console.error("Failed to delete user account:", error);
      res.status(500).json({ error: "Failed to delete account. Please contact support." });
    }
  });

  // ============== Admin Routes ==============
  
  // Middleware to check if user is super_admin
  const requireSuperAdmin: RequestHandler = async (req, res, next) => {
    const user = req.user as any;
    if (!req.isAuthenticated() || !user?.claims?.sub) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    
    const dbUser = await authStorage.getUser(user.claims.sub);
    if (!dbUser || dbUser.role !== "super_admin") {
      return res.status(403).json({ error: "Forbidden: Super admin access required" });
    }
    
    next();
  };

  // Get all users (super_admin only)
  app.get("/api/admin/users", requireSuperAdmin, async (req, res) => {
    try {
      const users = await authStorage.getAllUsers();
      res.json(users);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch users" });
    }
  });

  // Update user role (super_admin only)
  app.patch("/api/admin/users/:id/role", requireSuperAdmin, async (req, res) => {
    try {
      const { role } = req.body;
      const userId = req.params.id as string;
      if (!["super_admin", "admin", "user"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      
      // Prevent demoting the last super_admin
      if (role !== "super_admin") {
        const allUsers = await authStorage.getAllUsers();
        const superAdmins = allUsers.filter(u => u.role === "super_admin");
        const targetUser = allUsers.find(u => u.id === userId);
        
        if (targetUser?.role === "super_admin" && superAdmins.length <= 1) {
          return res.status(400).json({ error: "Cannot demote the last super admin" });
        }
      }
      
      const user = await authStorage.updateUserRole(userId, role);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user role" });
    }
  });

  // Grant/revoke free access (super_admin only)
  app.patch("/api/admin/users/:id/access", requireSuperAdmin, async (req, res) => {
    try {
      const { grantedFreeAccess, subscriptionStatus, hasPaid } = req.body;
      const userId = req.params.id as string;

      const updates: any = { updatedAt: new Date() };
      if (typeof grantedFreeAccess === "boolean") {
        updates.grantedFreeAccess = grantedFreeAccess;
      }
      if (subscriptionStatus) {
        updates.subscriptionStatus = subscriptionStatus;
      }
      if (typeof hasPaid === "boolean") {
        updates.hasPaid = hasPaid;
        // Manually marking someone paid/premium should actually unlock
        // sending (hasActiveSubscription requires status "active" too).
        if (hasPaid && !subscriptionStatus) {
          updates.subscriptionStatus = "active";
        }
      }

      const user = await authStorage.updateUserSubscription(userId, updates);
      if (!user) {
        return res.status(404).json({ error: "User not found" });
      }
      res.json(user);
    } catch (error) {
      res.status(500).json({ error: "Failed to update user access" });
    }
  });

  // Get admin dashboard stats (super_admin only)
  app.get("/api/admin/stats", requireSuperAdmin, async (req, res) => {
    try {
      const users = await authStorage.getAllUsers();
      const totalUsers = users.length;
      const activeUsers = users.filter(u => u.subscriptionStatus === "active" || u.grantedFreeAccess).length;
      const trialUsers = users.filter(u => u.subscriptionStatus === "trial").length;
      const paidUsers = users.filter(u => u.hasPaid).length;
      
      res.json({
        totalUsers,
        activeUsers,
        trialUsers,
        paidUsers,
        pendingApproval: users.filter(u => u.subscriptionStatus === "inactive" && !u.grantedFreeAccess).length,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch admin stats" });
    }
  });

  // ============== Visitor Analytics ==============
  // No auth required - this fires from the public landing page too, before
  // anyone has logged in, so we can see the full visitor funnel.
  app.post("/api/analytics/pageview", async (req: any, res) => {
    try {
      const { path: pagePath, sessionId, referrer } = req.body || {};
      if (!pagePath || !sessionId) {
        return res.status(400).json({ error: "path and sessionId are required" });
      }
      const userId = req.user?.claims?.sub || null;
      await db.insert(pageViews).values({
        path: String(pagePath).slice(0, 500),
        sessionId: String(sessionId).slice(0, 200),
        referrer: referrer ? String(referrer).slice(0, 500) : null,
        userAgent: req.headers["user-agent"]?.slice(0, 500) || null,
        userId,
      });
      res.sendStatus(204);
    } catch (error) {
      res.status(500).json({ error: "Failed to record page view" });
    }
  });

  app.get("/api/admin/visitors", requireSuperAdmin, async (req, res) => {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
      const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [last24h] = await db
        .select({ count: sqlOp<number>`count(distinct ${pageViews.sessionId})` })
        .from(pageViews)
        .where(gte(pageViews.timestamp, since24h));

      const [last7d] = await db
        .select({ count: sqlOp<number>`count(distinct ${pageViews.sessionId})` })
        .from(pageViews)
        .where(gte(pageViews.timestamp, since7d));

      const [allTime] = await db
        .select({ count: sqlOp<number>`count(distinct ${pageViews.sessionId})` })
        .from(pageViews);

      const recent = await db
        .select()
        .from(pageViews)
        .orderBy(desc(pageViews.timestamp))
        .limit(100);

      res.json({
        visitors24h: Number(last24h?.count || 0),
        visitors7d: Number(last7d?.count || 0),
        visitorsAllTime: Number(allTime?.count || 0),
        recentViews: recent,
      });
    } catch (error) {
      console.error("Visitor analytics error:", error);
      res.status(500).json({ error: "Failed to fetch visitor analytics" });
    }
  });

  // ============== Email Verification ==============
  app.get("/api/verify-email", async (req, res) => {
    try {
      const token = req.query.token as string;
      if (!token) {
        return res.redirect("/?verify=missing-token");
      }
      const [user] = await db.select().from(users).where(eq(users.emailVerificationToken, token));
      if (!user) {
        return res.redirect("/?verify=invalid");
      }
      await authStorage.updateUserSubscription(user.id, {
        emailVerified: true,
        emailVerificationToken: null,
      } as any);
      res.redirect("/?verify=success");
    } catch (error) {
      console.error("Email verification error:", error);
      res.redirect("/?verify=error");
    }
  });

  app.post("/api/resend-verification", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.emailVerified) {
        return res.json({ message: "Email already verified" });
      }
      const token = crypto.randomBytes(32).toString("hex");
      await authStorage.updateUserSubscription(userId, { emailVerificationToken: token } as any);
      await sendVerificationEmail(user.email || "", token, user.firstName || undefined);
      res.json({ message: "Verification email sent" });
    } catch (error) {
      console.error("Resend verification error:", error);
      res.status(500).json({ error: "Failed to resend verification email" });
    }
  });

  // ============== Subscription / Razorpay ==============
  app.get("/api/subscription/status", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({
        subscriptionStatus: user.subscriptionStatus,
        hasPaid: user.hasPaid,
        grantedFreeAccess: user.grantedFreeAccess,
        trialEndsAt: user.trialEndsAt,
        emailVerified: user.emailVerified,
        isActive: await hasActiveSubscription(userId),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch subscription status" });
    }
  });

  app.post("/api/subscription/create", isAuthenticated as RequestHandler, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await authStorage.getUser(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      if (!process.env.RAZORPAY_KEY_ID) {
        return res.status(500).json({ error: "Payments are not configured yet. Please try again later." });
      }

      const subscription = await razorpayApi.createSubscription(
        user.email || "",
        `${user.firstName || ""} ${user.lastName || ""}`.trim() || user.email || "Customer"
      );

      await authStorage.updateUserSubscription(userId, {
        razorpaySubscriptionId: subscription.id,
      });

      res.json({
        subscriptionId: subscription.id,
        keyId: process.env.RAZORPAY_KEY_ID,
      });
    } catch (error: any) {
      console.error("Failed to create Razorpay subscription:", error);
      res.status(500).json({ error: "Failed to start subscription. Please try again." });
    }
  });

  // Razorpay calls this directly - no user session exists, verified by
  // webhook signature instead. Uses the raw request body captured in
  // index.ts, since re-serialized JSON won't match the signed bytes.
  app.post("/api/webhooks/razorpay", async (req: any, res) => {
    try {
      const signature = req.headers["x-razorpay-signature"] as string;
      const rawBody = req.rawBody?.toString() || "";

      if (!razorpayApi.verifyWebhookSignature(rawBody, signature)) {
        console.error("[Razorpay Webhook] Invalid signature");
        return res.sendStatus(400);
      }

      const event = req.body.event;
      const payload = req.body.payload;
      console.log(`[Razorpay Webhook] Received event: ${event}`);

      const subscriptionId = payload?.subscription?.entity?.id;

      if (event === "subscription.activated" || event === "subscription.charged") {
        if (subscriptionId) {
          const [user] = await db.select().from(users).where(eq(users.razorpaySubscriptionId, subscriptionId));
          if (user) {
            await authStorage.updateUserSubscription(user.id, {
              hasPaid: true,
              subscriptionStatus: "active",
            });
            console.log(`[Razorpay Webhook] User ${user.email} marked active/paid`);
          }
        }
      } else if (["subscription.cancelled", "subscription.halted", "subscription.completed"].includes(event)) {
        if (subscriptionId) {
          const [user] = await db.select().from(users).where(eq(users.razorpaySubscriptionId, subscriptionId));
          if (user) {
            await authStorage.updateUserSubscription(user.id, { subscriptionStatus: "cancelled" });
            console.log(`[Razorpay Webhook] User ${user.email} subscription cancelled`);
          }
        }
      } else if (event === "payment.failed") {
        console.error("[Razorpay Webhook] Payment failed:", JSON.stringify(payload?.payment?.entity));
      }

      res.sendStatus(200);
    } catch (error) {
      console.error("[Razorpay Webhook] Error:", error);
      res.sendStatus(500);
    }
  });

  // Bootstrap super admin (first authenticated user when no super_admin exists)
  // This is protected by requiring authentication and only works once
  app.post("/api/admin/bootstrap", async (req, res) => {
    try {
      const user = req.user as any;
      if (!req.isAuthenticated() || !user?.claims?.sub) {
        return res.status(401).json({ error: "Unauthorized" });
      }
      
      // Check if any super_admin exists (atomic check)
      const allUsers = await authStorage.getAllUsers();
      const existingSuperAdmins = allUsers.filter(u => u.role === "super_admin");
      
      if (existingSuperAdmins.length > 0) {
        return res.status(400).json({ error: "Super admin already exists. Bootstrap disabled." });
      }
      
      // Verify the requesting user exists in database
      const requestingUser = await authStorage.getUser(user.claims.sub);
      if (!requestingUser) {
        return res.status(400).json({ error: "User not found in database" });
      }
      
      // Make the current user super_admin
      const updatedUser = await authStorage.updateUserRole(user.claims.sub, "super_admin");
      console.log(`Super admin bootstrapped: ${requestingUser.email} (${user.claims.sub})`);
      res.json({ message: "You are now a super admin", user: updatedUser });
    } catch (error) {
      console.error("Bootstrap error:", error);
      res.status(500).json({ error: "Failed to bootstrap super admin" });
    }
  });

  // Check if bootstrap is available (for UI to show bootstrap button)
  app.get("/api/admin/bootstrap-available", async (req, res) => {
    try {
      const allUsers = await authStorage.getAllUsers();
      const existingSuperAdmin = allUsers.find(u => u.role === "super_admin");
      res.json({ available: !existingSuperAdmin });
    } catch (error) {
      res.status(500).json({ error: "Failed to check bootstrap status" });
    }
  });

  // Auto-subscribe all WABAs to webhook events on startup
  setTimeout(async () => {
    try {
      const accounts = await storage.getAccounts();
      for (const account of accounts) {
        if (account.businessAccountId && account.accessToken) {
          console.log(`[Startup] Auto-subscribing WABA ${account.businessAccountId} (${account.name}) to webhook events...`);
          const result = await whatsappApi.subscribeAppToWaba(account.businessAccountId, account.accessToken);
          if (result.success) {
            console.log(`[Startup] WABA ${account.businessAccountId} subscribed successfully`);
          } else {
            console.error(`[Startup] WABA ${account.businessAccountId} subscription failed:`, result.error?.message);
          }
        }
      }
    } catch (err) {
      console.error("[Startup] Auto-subscribe error:", err);
    }

    try {
      await storage.backfillMessageCampaignIds();
    } catch (err) {
      console.error("[Startup] Message backfill error:", err);
    }
  }, 3000);

  return httpServer;
}
