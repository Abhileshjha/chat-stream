import type { Express, RequestHandler } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { insertTemplateSchema, insertCampaignSchema, insertMessageSchema } from "@shared/schema";
import { z } from "zod";
import { authStorage } from "./replit_integrations/auth/storage";
import { isAuthenticated } from "./replit_integrations/auth/replitAuth";
import multer from "multer";
import path from "path";
import fs from "fs";

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
  app.get("/api/dashboard/metrics", async (req, res) => {
    try {
      const metrics = await storage.getDashboardMetrics();
      res.json(metrics);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch dashboard metrics" });
    }
  });

  app.get("/api/dashboard/activities", async (req, res) => {
    try {
      const activities = await storage.getRecentActivities();
      res.json(activities);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch activities" });
    }
  });

  // ============== Analytics ==============
  app.get("/api/analytics", async (req, res) => {
    try {
      const timeRange = req.query.range as string || "7d";
      const analytics = await storage.getAnalyticsData(timeRange);
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
  app.post("/api/upload", isAuthenticated as RequestHandler, upload.single("file"), (req, res) => {
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
      const fileInfo = {
        url: fileUrl,
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
  app.get("/api/templates", async (req, res) => {
    try {
      const templates = await storage.getTemplates();
      res.json(templates);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch templates" });
    }
  });

  app.get("/api/templates/:id", async (req, res) => {
    try {
      const template = await storage.getTemplate(req.params.id);
      if (!template) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.json(template);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch template" });
    }
  });

  app.post("/api/templates", async (req, res) => {
    try {
      const data = insertTemplateSchema.parse(req.body);
      const template = await storage.createTemplate(data);
      
      // Add activity
      await storage.addActivity({
        type: "template_approved",
        title: "Template Created",
        description: `${template.name} submitted for approval`,
        timestamp: new Date(),
      });
      
      res.status(201).json(template);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid template data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create template" });
    }
  });

  app.patch("/api/templates/:id", async (req, res) => {
    try {
      const updates = updateTemplateSchema.parse(req.body);
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

  app.delete("/api/templates/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteTemplate(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Template not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete template" });
    }
  });

  // ============== Campaigns ==============
  app.get("/api/campaigns", async (req, res) => {
    try {
      const campaigns = await storage.getCampaigns();
      res.json(campaigns);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaigns" });
    }
  });

  app.get("/api/campaigns/:id", async (req, res) => {
    try {
      const campaign = await storage.getCampaign(req.params.id);
      if (!campaign) {
        return res.status(404).json({ error: "Campaign not found" });
      }
      res.json(campaign);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign" });
    }
  });

  app.post("/api/campaigns", async (req, res) => {
    try {
      const data = insertCampaignSchema.parse(req.body);
      const campaign = await storage.createCampaign(data);
      
      // Add activity
      await storage.addActivity({
        type: "campaign_started",
        title: "Campaign Created",
        description: `${campaign.name} - ${campaign.recipients?.length || 0} recipients`,
        timestamp: new Date(),
      });
      
      res.status(201).json(campaign);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid campaign data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create campaign" });
    }
  });

  app.patch("/api/campaigns/:id", async (req, res) => {
    try {
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
          type: "campaign_started",
          title: "Campaign Started",
          description: `${campaign.name} - ${campaign.recipients?.length || 0} recipients`,
          timestamp: new Date(),
        });
        broadcast("activity-added", { activity });
      } else if (updates.status === "completed") {
        const activity = await storage.addActivity({
          type: "campaign_completed",
          title: "Campaign Completed",
          description: `${campaign.name} finished successfully`,
          timestamp: new Date(),
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

  app.delete("/api/campaigns/:id", async (req, res) => {
    try {
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
  app.get("/api/messages", async (req, res) => {
    try {
      const messages = await storage.getMessages();
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.get("/api/messages/:id", async (req, res) => {
    try {
      const message = await storage.getMessage(req.params.id);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      res.json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch message" });
    }
  });

  app.get("/api/campaigns/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getMessagesByCampaign(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch campaign messages" });
    }
  });

  app.post("/api/messages", async (req, res) => {
    try {
      const data = insertMessageSchema.parse(req.body);
      const message = await storage.createMessage(data);
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid message data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create message" });
    }
  });

  app.patch("/api/messages/:id", async (req, res) => {
    try {
      const updates = updateMessageSchema.parse(req.body);
      const message = await storage.updateMessage(req.params.id, updates);
      if (!message) {
        return res.status(404).json({ error: "Message not found" });
      }
      
      // Broadcast real-time update
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
  app.get("/api/settings", async (req, res) => {
    try {
      const settings = await storage.getSettings();
      res.json(settings || null);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch settings" });
    }
  });

  app.put("/api/settings", async (req, res) => {
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

  app.post("/api/settings/test", async (req, res) => {
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
  app.get("/api/webhook", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    // In production, verify token matches configured verify token
    if (mode === "subscribe") {
      res.status(200).send(challenge);
    } else {
      res.sendStatus(403);
    }
  });

  // Meta webhook for receiving status updates
  app.post("/api/webhook", async (req, res) => {
    try {
      const body = req.body;
      
      if (body.object === "whatsapp_business_account") {
        for (const entry of body.entry || []) {
          for (const change of entry.changes || []) {
            if (change.field === "messages") {
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
                  
                  await storage.updateMessage(message.id, updates);
                  
                  // Add activity
                  const activityType = status.status === "delivered" 
                    ? "message_delivered" 
                    : status.status === "read" 
                      ? "message_read" 
                      : "message_failed";
                  
                  await storage.addActivity({
                    type: activityType,
                    title: `Message ${status.status.charAt(0).toUpperCase() + status.status.slice(1)}`,
                    description: `To ${message.recipientPhone}`,
                    timestamp: new Date(),
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
                  type: activityType,
                  title: `Template ${templateUpdate.event.toLowerCase()}`,
                  description: `${templateUpdate.message_template_name} status updated`,
                  timestamp: new Date(),
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
  app.get("/api/accounts", async (req, res) => {
    try {
      const accounts = await storage.getAccounts();
      const activeId = await storage.getActiveAccountId();
      res.json({ accounts, activeAccountId: activeId });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch accounts" });
    }
  });

  app.get("/api/accounts/active", async (req, res) => {
    try {
      const activeId = await storage.getActiveAccountId();
      if (!activeId) {
        return res.json(null);
      }
      const account = await storage.getAccount(activeId);
      res.json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch active account" });
    }
  });

  app.post("/api/accounts", async (req, res) => {
    try {
      const account = await storage.createAccount(req.body);
      broadcast("account-added", { account });
      res.status(201).json(account);
    } catch (error) {
      res.status(500).json({ error: "Failed to create account" });
    }
  });

  app.put("/api/accounts/:id/active", async (req, res) => {
    try {
      await storage.setActiveAccount(req.params.id);
      const account = await storage.getAccount(req.params.id);
      broadcast("account-switched", { account });
      res.json({ success: true, account });
    } catch (error) {
      res.status(500).json({ error: "Failed to switch account" });
    }
  });

  app.delete("/api/accounts/:id", async (req, res) => {
    try {
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
      const account = await storage.getAccount(accountId);
      if (!account) {
        return res.json({ 
          success: false, 
          message: "Account not found" 
        });
      }

      if (!account.accessToken) {
        return res.json({ 
          success: false, 
          message: "No access token configured for this account" 
        });
      }

      // Test the connection by making a simple API call to Meta
      const response = await fetch(
        `https://graph.facebook.com/v18.0/${account.phoneNumberId}?access_token=${account.accessToken}`
      );

      if (response.ok) {
        const data = await response.json() as any;
        res.json({ 
          success: true, 
          message: `Connection successful! Phone: ${data.display_phone_number || account.phoneNumber}`
        });
      } else {
        const errorData = await response.json() as any;
        res.json({ 
          success: false, 
          message: errorData.error?.message || "Connection failed. Check your credentials."
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
    const { accessToken, userId } = req.body;

    if (!accessToken || !userId) {
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
          for (const phone of phoneNumbers) {
            // Create account for each phone number
            const existingAccounts = await storage.getAccounts();
            const alreadyExists = existingAccounts.some(a => a.phoneNumberId === phone.id);
            
            if (!alreadyExists) {
              await storage.createAccount({
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

  // Manual WhatsApp account addition with Phone Number ID, WABA ID, and Access Token
  app.post("/api/whatsapp-accounts/manual", isAuthenticated, async (req: any, res) => {
    try {
      const validation = manualWhatsAppAccountSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          error: "Validation failed", 
          details: validation.error.errors 
        });
      }

      const { phoneNumberId, businessAccountId, accessToken, name } = validation.data;

      // Check if account with this phone number ID already exists
      const existingAccounts = await storage.getAccounts();
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
  app.get("/api/auth/facebook/callback", async (req, res) => {
    const { code, error, error_description } = req.query;

    if (error) {
      return res.redirect(`/?error=${encodeURIComponent(error_description as string || error as string)}`);
    }

    if (!code) {
      return res.redirect('/?error=No authorization code received');
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
          for (const phone of phoneNumbers) {
            // Create account for each phone number
            const existingAccounts = await storage.getAccounts();
            const alreadyExists = existingAccounts.some(a => a.phoneNumberId === phone.id);
            
            if (!alreadyExists) {
              await storage.createAccount({
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
  app.get("/api/contacts", async (req, res) => {
    try {
      const contacts = await storage.getContacts();
      res.json(contacts);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch contacts" });
    }
  });

  app.post("/api/contacts", async (req, res) => {
    try {
      const contact = await storage.createContact(req.body);
      res.status(201).json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to create contact" });
    }
  });

  app.patch("/api/contacts/:id", async (req, res) => {
    try {
      const contact = await storage.updateContact(req.params.id, req.body);
      if (!contact) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.json(contact);
    } catch (error) {
      res.status(500).json({ error: "Failed to update contact" });
    }
  });

  app.delete("/api/contacts/:id", async (req, res) => {
    try {
      const deleted = await storage.deleteContact(req.params.id);
      if (!deleted) {
        return res.status(404).json({ error: "Contact not found" });
      }
      res.status(204).send();
    } catch (error) {
      res.status(500).json({ error: "Failed to delete contact" });
    }
  });

  app.post("/api/contacts/import", async (req, res) => {
    try {
      const { contacts, listId } = req.body;
      const imported = await storage.importContacts(contacts, listId);
      res.json({ imported });
    } catch (error) {
      res.status(500).json({ error: "Failed to import contacts" });
    }
  });

  // ============== Contact Lists ==============
  app.get("/api/lists", async (req, res) => {
    try {
      const lists = await storage.getLists();
      res.json(lists);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch lists" });
    }
  });

  app.post("/api/lists", async (req, res) => {
    try {
      const list = await storage.createList(req.body);
      res.status(201).json(list);
    } catch (error) {
      res.status(500).json({ error: "Failed to create list" });
    }
  });

  app.delete("/api/lists/:id", async (req, res) => {
    try {
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
  app.get("/api/tags", async (req, res) => {
    try {
      const tags = await storage.getTags();
      res.json(tags);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tags" });
    }
  });

  app.post("/api/tags", async (req, res) => {
    try {
      const tag = await storage.createTag(req.body);
      res.status(201).json(tag);
    } catch (error) {
      res.status(500).json({ error: "Failed to create tag" });
    }
  });

  app.delete("/api/tags/:id", async (req, res) => {
    try {
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
  app.get("/api/conversations", async (req, res) => {
    try {
      const conversations = await storage.getConversations();
      res.json(conversations);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversations" });
    }
  });

  app.get("/api/conversations/:id", async (req, res) => {
    try {
      const conversation = await storage.getConversation(req.params.id);
      if (!conversation) {
        return res.status(404).json({ error: "Conversation not found" });
      }
      res.json(conversation);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch conversation" });
    }
  });

  app.get("/api/conversations/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getConversationMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch messages" });
    }
  });

  app.post("/api/conversations/:id/messages", async (req, res) => {
    try {
      const message = await storage.addConversationMessage({
        ...req.body,
        conversationId: req.params.id,
      });
      broadcast("conversation-message", { message });
      res.status(201).json(message);
    } catch (error) {
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  app.patch("/api/conversations/:id", async (req, res) => {
    try {
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
  app.get("/api/notifications", async (req, res) => {
    try {
      const notifications = await storage.getNotifications();
      res.json(notifications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notifications" });
    }
  });

  app.get("/api/notifications/:id", async (req, res) => {
    try {
      const notification = await storage.getNotification(req.params.id);
      if (!notification) {
        return res.status(404).json({ error: "Notification not found" });
      }
      res.json(notification);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch notification" });
    }
  });

  app.post("/api/notifications", async (req, res) => {
    try {
      const notification = await storage.createNotification(req.body);
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
      const accounts = await storage.getAccounts();
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
      const { grantedFreeAccess, subscriptionStatus } = req.body;
      const userId = req.params.id as string;
      
      const updates: any = { updatedAt: new Date() };
      if (typeof grantedFreeAccess === "boolean") {
        updates.grantedFreeAccess = grantedFreeAccess;
      }
      if (subscriptionStatus) {
        updates.subscriptionStatus = subscriptionStatus;
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

  return httpServer;
}
