import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Template status types
export const templateStatusEnum = z.enum(["PENDING", "APPROVED", "REJECTED", "DISABLED", "PAUSED"]);
export type TemplateStatus = z.infer<typeof templateStatusEnum>;

// Template quality score types
export const qualityScoreEnum = z.enum(["GREEN", "YELLOW", "RED", "UNKNOWN"]);
export type QualityScore = z.infer<typeof qualityScoreEnum>;

// Template category types
export const templateCategoryEnum = z.enum(["MARKETING", "UTILITY", "AUTHENTICATION"]);
export type TemplateCategory = z.infer<typeof templateCategoryEnum>;

// Message status types
export const messageStatusEnum = z.enum(["queued", "sent", "delivered", "read", "failed"]);
export type MessageStatus = z.infer<typeof messageStatusEnum>;

// Campaign status types
export const campaignStatusEnum = z.enum(["draft", "scheduled", "running", "completed", "paused", "failed"]);
export type CampaignStatus = z.infer<typeof campaignStatusEnum>;

// Template component type
export const templateComponentSchema = z.object({
  type: z.enum(["HEADER", "BODY", "FOOTER", "BUTTONS"]),
  format: z.string().optional(),
  text: z.string().optional(),
  buttons: z.array(z.object({
    type: z.string(),
    text: z.string(),
    url: z.string().optional(),
    phoneNumber: z.string().optional(),
  })).optional(),
});

export type TemplateComponent = z.infer<typeof templateComponentSchema>;

// Templates
export const templates = pgTable("templates", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  metaTemplateId: varchar("meta_template_id"),
  name: varchar("name", { length: 512 }).notNull(),
  category: varchar("category", { length: 50 }).notNull(),
  language: varchar("language", { length: 10 }).notNull().default("en"),
  status: varchar("status", { length: 20 }).notNull().default("PENDING"),
  qualityScore: varchar("quality_score", { length: 20 }).default("UNKNOWN"),
  rejectionReason: text("rejection_reason"),
  components: jsonb("components").$type<TemplateComponent[]>(),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertTemplateSchema = createInsertSchema(templates).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertTemplate = z.infer<typeof insertTemplateSchema>;
export type Template = typeof templates.$inferSelect;

// Campaigns
export const campaigns = pgTable("campaigns", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  templateId: varchar("template_id").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  scheduledAt: timestamp("scheduled_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  recipients: jsonb("recipients").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertCampaignSchema = createInsertSchema(campaigns).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCampaign = z.infer<typeof insertCampaignSchema>;
export type Campaign = typeof campaigns.$inferSelect;

// Messages
export const messages = pgTable("messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  whatsappMessageId: varchar("whatsapp_message_id"),
  campaignId: varchar("campaign_id"),
  templateId: varchar("template_id"),
  recipientPhone: varchar("recipient_phone", { length: 20 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("queued"),
  queuedAt: timestamp("queued_at").defaultNow(),
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
  errorCode: varchar("error_code", { length: 50 }),
  errorDescription: text("error_description"),
  cost: decimal("cost", { precision: 10, scale: 4 }),
  metadata: jsonb("metadata"),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  queuedAt: true,
});

export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// Campaign Metrics
export const campaignMetrics = pgTable("campaign_metrics", {
  campaignId: varchar("campaign_id").primaryKey(),
  totalMessages: integer("total_messages").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  readCount: integer("read_count").default(0),
  failedCount: integer("failed_count").default(0),
  totalCost: decimal("total_cost", { precision: 10, scale: 2 }).default("0"),
  lastUpdatedAt: timestamp("last_updated_at").defaultNow(),
});

export const insertCampaignMetricsSchema = createInsertSchema(campaignMetrics);

export type InsertCampaignMetrics = z.infer<typeof insertCampaignMetricsSchema>;
export type CampaignMetrics = typeof campaignMetrics.$inferSelect;

// Dashboard metrics type (computed, not stored)
export interface DashboardMetrics {
  totalMessages: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  deliveryRate: number;
  readRate: number;
  totalCost: number;
  activeCampaigns: number;
  approvedTemplates: number;
  pendingTemplates: number;
  messagingLimit: number;
  messagingUsed: number;
  qualityRating: QualityScore;
  apiStatus: "connected" | "disconnected" | "error";
}

// Activity feed item type
export interface ActivityItem {
  id: string;
  type: "message_sent" | "message_delivered" | "message_read" | "message_failed" | "template_approved" | "template_rejected" | "campaign_started" | "campaign_completed";
  title: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

// API Settings type
export interface ApiSettings {
  accessToken: string;
  phoneNumberId: string;
  businessAccountId: string;
  webhookVerifyToken: string;
  apiVersion: string;
}
