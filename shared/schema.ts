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
  mediaUrl: z.string().optional(),
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
  accountId: varchar("account_id"),
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
  accountId: varchar("account_id"),
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
  accountId: varchar("account_id"),
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
  accountId: varchar("account_id"),
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
  lastSyncedAt: string | null;
}


// WhatsApp Account/Number table
export const whatsappAccounts = pgTable("whatsapp_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  phoneNumber: varchar("phone_number", { length: 50 }).notNull(),
  phoneNumberId: varchar("phone_number_id", { length: 100 }).notNull(),
  businessAccountId: varchar("business_account_id", { length: 100 }).notNull(),
  accessToken: text("access_token").notNull(),
  status: varchar("status", { length: 20 }).notNull().default("connected"),
  qualityRating: varchar("quality_rating", { length: 20 }).default("UNKNOWN"),
  messagingLimit: integer("messaging_limit").default(1000),
  messagingUsed: integer("messaging_used").default(0),
  metaSentCount: integer("meta_sent_count").default(0),
  metaDeliveredCount: integer("meta_delivered_count").default(0),
  metaTotalCost: text("meta_total_cost").default("0"),
  lastSyncedAt: timestamp("last_synced_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertWhatsAppAccountSchema = createInsertSchema(whatsappAccounts).omit({
  id: true,
  createdAt: true,
});

export type InsertWhatsAppAccount = z.infer<typeof insertWhatsAppAccountSchema>;
export type WhatsAppAccount = typeof whatsappAccounts.$inferSelect;

// Contact Lists
export const contactLists = pgTable("contact_lists", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  contactCount: integer("contact_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContactListSchema = createInsertSchema(contactLists).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContactList = z.infer<typeof insertContactListSchema>;
export type ContactList = typeof contactLists.$inferSelect;

// Contact Tags
export const contactTags = pgTable("contact_tags", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  name: varchar("name", { length: 100 }).notNull(),
  color: varchar("color", { length: 20 }).notNull(),
  contactCount: integer("contact_count").default(0),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertContactTagSchema = createInsertSchema(contactTags).omit({
  id: true,
  createdAt: true,
});

export type InsertContactTag = z.infer<typeof insertContactTagSchema>;
export type ContactTag = typeof contactTags.$inferSelect;

// Contacts
export const contacts = pgTable("contacts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  phone: varchar("phone", { length: 20 }).notNull(),
  name: varchar("name", { length: 255 }),
  email: varchar("email", { length: 255 }),
  status: varchar("status", { length: 20 }).notNull().default("subscribed"),
  listIds: jsonb("list_ids").$type<string[]>().default([]),
  tagIds: jsonb("tag_ids").$type<string[]>().default([]),
  customFields: jsonb("custom_fields").$type<Record<string, string>>(),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const insertContactSchema = createInsertSchema(contacts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertContact = z.infer<typeof insertContactSchema>;
export type Contact = typeof contacts.$inferSelect;

// Conversations
export const conversations = pgTable("conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  contactId: varchar("contact_id").notNull().default(""),
  contactPhone: varchar("contact_phone", { length: 20 }).notNull(),
  contactName: varchar("contact_name", { length: 255 }),
  lastMessage: text("last_message"),
  lastMessageAt: timestamp("last_message_at"),
  unreadCount: integer("unread_count").default(0),
  status: varchar("status", { length: 20 }).notNull().default("open"),
  windowEndsAt: timestamp("window_ends_at"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertConversationSchema = createInsertSchema(conversations).omit({
  id: true,
  createdAt: true,
});

export type InsertConversation = z.infer<typeof insertConversationSchema>;
export type Conversation = typeof conversations.$inferSelect;

// Conversation Messages
export const conversationMessages = pgTable("conversation_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  conversationId: varchar("conversation_id").notNull(),
  direction: varchar("direction", { length: 10 }).notNull(),
  type: varchar("type", { length: 20 }).notNull().default("text"),
  content: text("content").notNull(),
  mediaUrl: text("media_url"),
  templateName: varchar("template_name", { length: 255 }),
  status: varchar("status", { length: 20 }),
  sentAt: timestamp("sent_at").defaultNow(),
  deliveredAt: timestamp("delivered_at"),
  readAt: timestamp("read_at"),
});

export const insertConversationMessageSchema = createInsertSchema(conversationMessages).omit({
  id: true,
  sentAt: true,
});

export type InsertConversationMessage = z.infer<typeof insertConversationMessageSchema>;
export type ConversationMessage = typeof conversationMessages.$inferSelect;

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

// Notifications/Broadcasts
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  status: varchar("status", { length: 20 }).notNull().default("draft"),
  templateId: varchar("template_id").notNull(),
  listIds: jsonb("list_ids").$type<string[]>().default([]),
  excludeTags: jsonb("exclude_tags").$type<string[]>(),
  includeTags: jsonb("include_tags").$type<string[]>(),
  scheduledAt: timestamp("scheduled_at"),
  sentAt: timestamp("sent_at"),
  completedAt: timestamp("completed_at"),
  totalRecipients: integer("total_recipients").default(0),
  sentCount: integer("sent_count").default(0),
  deliveredCount: integer("delivered_count").default(0),
  readCount: integer("read_count").default(0),
  failedCount: integer("failed_count").default(0),
  templateVariables: jsonb("template_variables").$type<Record<string, string>>(),
  headerMediaUrl: text("header_media_url"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
});

export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type Notification = typeof notifications.$inferSelect;

// Activities
export const activities = pgTable("activities", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id"),
  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  description: text("description").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  metadata: jsonb("metadata").$type<Record<string, unknown>>(),
});

export type ActivityItem = typeof activities.$inferSelect;

// API Settings
export const apiSettings = pgTable("api_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accessToken: text("access_token").notNull(),
  phoneNumberId: varchar("phone_number_id", { length: 100 }).notNull(),
  businessAccountId: varchar("business_account_id", { length: 100 }).notNull(),
  webhookVerifyToken: text("webhook_verify_token").notNull(),
  apiVersion: varchar("api_version", { length: 20 }).notNull().default("v18.0"),
});

export type ApiSettings = typeof apiSettings.$inferSelect;

// Active Account Mapping (persisted per user)
export const activeAccounts = pgTable("active_accounts", {
  userId: varchar("user_id").primaryKey(),
  accountId: varchar("account_id").notNull(),
});

// Team Members (account sharing)
export const teamMembers = pgTable("team_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  accountId: varchar("account_id").notNull(),
  ownerUserId: varchar("owner_user_id").notNull(),
  memberEmail: varchar("member_email", { length: 255 }).notNull(),
  memberUserId: varchar("member_user_id", { length: 255 }),
  role: varchar("role", { length: 20 }).notNull().default("member"),
  status: varchar("status", { length: 20 }).notNull().default("pending"),
  invitedAt: timestamp("invited_at").defaultNow(),
  acceptedAt: timestamp("accepted_at"),
});

export const insertTeamMemberSchema = createInsertSchema(teamMembers).omit({
  id: true,
  invitedAt: true,
  acceptedAt: true,
});

export type InsertTeamMember = z.infer<typeof insertTeamMemberSchema>;
export type TeamMember = typeof teamMembers.$inferSelect;

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
