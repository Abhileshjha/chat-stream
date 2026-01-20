import { sql } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, decimal, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Re-export auth models (users and sessions tables)
export * from "./models/auth";

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

// WhatsApp Account/Number type
export interface WhatsAppAccount {
  id: string;
  name: string;
  phoneNumber: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
  status: "connected" | "disconnected" | "pending";
  qualityRating: QualityScore;
  messagingLimit: number;
  messagingUsed: number;
  createdAt: Date;
}

export interface InsertWhatsAppAccount {
  name: string;
  phoneNumber: string;
  phoneNumberId: string;
  businessAccountId: string;
  accessToken: string;
}

// Contact Lists
export interface ContactList {
  id: string;
  accountId: string;
  name: string;
  description?: string;
  contactCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertContactList {
  name: string;
  description?: string;
}

// Contact Tags
export interface ContactTag {
  id: string;
  accountId: string;
  name: string;
  color: string;
  contactCount: number;
  createdAt: Date;
}

export interface InsertContactTag {
  name: string;
  color: string;
}

// Contacts
export interface Contact {
  id: string;
  accountId: string;
  phone: string;
  name?: string;
  email?: string;
  status: "subscribed" | "unsubscribed";
  listIds: string[];
  tagIds: string[];
  customFields?: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

export interface InsertContact {
  phone: string;
  name?: string;
  email?: string;
  status?: "subscribed" | "unsubscribed";
  listIds?: string[];
  tagIds?: string[];
  customFields?: Record<string, string>;
}

// Conversation
export interface Conversation {
  id: string;
  accountId: string;
  contactId: string;
  contactPhone: string;
  contactName?: string;
  lastMessage?: string;
  lastMessageAt?: Date;
  unreadCount: number;
  status: "open" | "active" | "closed";
  windowEndsAt?: Date;
  createdAt: Date;
}

export interface ConversationMessage {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "video" | "document" | "template";
  content: string;
  mediaUrl?: string;
  templateName?: string;
  status?: MessageStatus;
  sentAt: Date;
  deliveredAt?: Date;
  readAt?: Date;
}

export interface InsertConversationMessage {
  conversationId: string;
  direction: "inbound" | "outbound";
  type: "text" | "image" | "video" | "document" | "template";
  content: string;
  mediaUrl?: string;
  templateName?: string;
}

// Enhanced Template with header media and buttons
export interface TemplateButton {
  type: "QUICK_REPLY" | "PHONE_NUMBER" | "URL";
  text: string;
  phoneNumber?: string;
  url?: string;
}

export interface TemplateHeader {
  type: "NONE" | "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  mediaUrl?: string;
}

export interface EnhancedTemplateData {
  header?: TemplateHeader;
  body: string;
  footer?: string;
  buttons?: TemplateButton[];
}

// Notification/Broadcast
export interface Notification {
  id: string;
  accountId: string;
  name: string;
  status: "draft" | "scheduled" | "sending" | "completed" | "failed";
  templateId: string;
  listIds: string[];
  excludeTags?: string[];
  includeTags?: string[];
  scheduledAt?: Date;
  sentAt?: Date;
  completedAt?: Date;
  totalRecipients: number;
  sentCount: number;
  deliveredCount: number;
  readCount: number;
  failedCount: number;
  templateVariables?: Record<string, string>;
  createdAt: Date;
}

export interface InsertNotification {
  name: string;
  templateId: string;
  listIds: string[];
  excludeTags?: string[];
  includeTags?: string[];
  scheduledAt?: string;
  templateVariables?: Record<string, string>;
}

// Content Library Media
export interface MediaAsset {
  id: string;
  name: string;
  type: "image" | "video" | "document";
  url: string;
  size: number;
  mimeType: string;
  createdAt: Date;
}
