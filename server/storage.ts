import { 
  type Template, type InsertTemplate, templates,
  type Campaign, type InsertCampaign, campaigns,
  type Message, type InsertMessage, messages,
  type CampaignMetrics, type InsertCampaignMetrics, campaignMetrics,
  type DashboardMetrics,
  type ActivityItem, activities,
  type ApiSettings, apiSettings,
  type WhatsAppAccount, type InsertWhatsAppAccount, whatsappAccounts,
  type Contact, type InsertContact, contacts,
  type ContactList, type InsertContactList, contactLists,
  type ContactTag, type InsertContactTag, contactTags,
  type Conversation, type InsertConversation, conversations,
  type ConversationMessage, type InsertConversationMessage, conversationMessages,
  type Notification, type InsertNotification, notifications,
  type TeamMember, type InsertTeamMember, teamMembers,
  activeAccounts,
  type QualityScore,
} from "@shared/schema";
import { db } from "@db";
import { eq, desc, and, or, isNull, sql as dsql } from "drizzle-orm";

export interface IStorage {
  getTemplates(accountId?: string): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  getTemplateByName(name: string, accountId: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, updates: Partial<Template>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<boolean>;

  getCampaigns(accountId?: string): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  getMessages(accountId?: string): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesByWhatsappId(whatsappId: string): Promise<Message | undefined>;
  getMessagesByCampaign(campaignId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;
  deleteMessage(id: string): Promise<boolean>;

  getCampaignMetrics(campaignId: string): Promise<CampaignMetrics | undefined>;
  upsertCampaignMetrics(metrics: InsertCampaignMetrics): Promise<CampaignMetrics>;

  getDashboardMetrics(accountId?: string): Promise<DashboardMetrics>;
  getDashboardChartData(accountId: string): Promise<{ messageVolume: any[]; statusDistribution: any[] }>;
  getRecentActivities(accountId?: string): Promise<ActivityItem[]>;
  addActivity(activity: Omit<ActivityItem, "id">): Promise<ActivityItem>;

  getSettings(): Promise<ApiSettings | undefined>;
  saveSettings(settings: Omit<ApiSettings, "id">): Promise<ApiSettings>;
  backfillMessageCampaignIds(): Promise<void>;

  getAnalyticsData(timeRange: string, accountId?: string): Promise<AnalyticsData>;

  getAccountsByUser(userId: string): Promise<WhatsAppAccount[]>;
  getAccounts(): Promise<WhatsAppAccount[]>;
  getAccount(id: string): Promise<WhatsAppAccount | undefined>;
  createAccount(account: InsertWhatsAppAccount): Promise<WhatsAppAccount>;
  updateAccount(id: string, updates: Partial<WhatsAppAccount>): Promise<WhatsAppAccount | undefined>;
  deleteAccount(id: string): Promise<boolean>;
  setActiveAccount(userId: string, accountId: string): Promise<void>;
  getActiveAccountId(userId: string): Promise<string | undefined>;

  getContacts(accountId: string): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  importContacts(contactsData: InsertContact[], listId?: string): Promise<number>;

  getLists(accountId: string): Promise<ContactList[]>;
  getList(id: string): Promise<ContactList | undefined>;
  createList(list: InsertContactList): Promise<ContactList>;
  updateList(id: string, updates: Partial<ContactList>): Promise<ContactList | undefined>;
  deleteList(id: string): Promise<boolean>;
  deleteContactList(id: string): Promise<boolean>;
  getContactListsByAccount(accountId: string): Promise<ContactList[]>;

  getTags(accountId: string): Promise<ContactTag[]>;
  getTag(id: string): Promise<ContactTag | undefined>;
  createTag(tag: InsertContactTag): Promise<ContactTag>;
  deleteTag(id: string): Promise<boolean>;
  deleteContactTag(id: string): Promise<boolean>;
  getContactTagsByAccount(accountId: string): Promise<ContactTag[]>;

  getConversations(accountId: string): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByPhone(phone: string, accountId: string): Promise<Conversation | undefined>;
  createConversation(phone: string, name: string | undefined, accountId: string): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationsByAccount(accountId: string): Promise<Conversation[]>;
  deleteConversation(id: string): Promise<boolean>;

  getNotifications(accountId: string): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: string, updates: Partial<Notification>): Promise<Notification | undefined>;
  deleteNotification(id: string): Promise<boolean>;
  getNotificationsByAccount(accountId: string): Promise<Notification[]>;

  getContactsByAccount(accountId: string): Promise<Contact[]>;

  getApiSettings(): Promise<ApiSettings | undefined>;
  deleteApiSettings(): Promise<boolean>;

  getTeamMembers(accountId: string): Promise<TeamMember[]>;
  addTeamMember(member: InsertTeamMember): Promise<TeamMember>;
  removeTeamMember(id: string): Promise<boolean>;
  getTeamMemberByEmail(email: string, accountId: string): Promise<TeamMember | undefined>;
  getSharedAccountsForUser(userEmail: string): Promise<TeamMember[]>;
  acceptTeamInvite(id: string, userId: string): Promise<TeamMember | undefined>;
}

export interface AnalyticsData {
  dailyData: Array<{ date: string; sent: number; delivered: number; read: number; failed: number }>;
  hourlyData: Array<{ hour: string; messages: number }>;
  categoryData: Array<{ name: string; value: number; color: string }>;
  errorData: Array<{ code: string; description: string; count: number }>;
  costData: Array<{ date: string; cost: number }>;
  summary: {
    totalMessages: number;
    totalDelivered: number;
    totalRead: number;
    totalFailed: number;
    deliveryRate: number;
    readRate: number;
    totalCost: number;
  };
}

export class DatabaseStorage implements IStorage {

  // Templates
  async getTemplates(accountId?: string): Promise<Template[]> {
    if (accountId) {
      return db.select().from(templates).where(eq(templates.accountId, accountId)).orderBy(desc(templates.createdAt));
    }
    return db.select().from(templates).orderBy(desc(templates.createdAt));
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    const rows = await db.select().from(templates).where(eq(templates.id, id));
    return rows[0];
  }

  async getTemplateByName(name: string, accountId: string): Promise<Template | undefined> {
    const rows = await db.select().from(templates)
      .where(and(eq(templates.name, name), eq(templates.accountId, accountId)));
    return rows[0];
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const rows = await db.insert(templates).values(template as any).returning();
    return rows[0];
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template | undefined> {
    const { id: _id, ...rest } = updates as any;
    const rows = await db.update(templates).set({ ...rest, updatedAt: new Date() }).where(eq(templates.id, id)).returning();
    return rows[0];
  }

  async deleteTemplate(id: string): Promise<boolean> {
    const result = await db.delete(templates).where(eq(templates.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Campaigns
  async getCampaigns(accountId?: string): Promise<Campaign[]> {
    if (accountId) {
      return db.select().from(campaigns).where(eq(campaigns.accountId, accountId)).orderBy(desc(campaigns.createdAt));
    }
    return db.select().from(campaigns).orderBy(desc(campaigns.createdAt));
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    const rows = await db.select().from(campaigns).where(eq(campaigns.id, id));
    return rows[0];
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const rows = await db.insert(campaigns).values(campaign as any).returning();
    return rows[0];
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const { id: _id, ...rest } = updates as any;
    const rows = await db.update(campaigns).set({ ...rest, updatedAt: new Date() }).where(eq(campaigns.id, id)).returning();
    return rows[0];
  }

  async deleteCampaign(id: string): Promise<boolean> {
    const result = await db.delete(campaigns).where(eq(campaigns.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Messages
  async getMessages(accountId?: string): Promise<Message[]> {
    if (accountId) {
      return db.select().from(messages).where(eq(messages.accountId, accountId)).orderBy(desc(messages.queuedAt));
    }
    return db.select().from(messages).orderBy(desc(messages.queuedAt));
  }

  async getMessage(id: string): Promise<Message | undefined> {
    const rows = await db.select().from(messages).where(eq(messages.id, id));
    return rows[0];
  }

  async getMessagesByWhatsappId(whatsappId: string): Promise<Message | undefined> {
    const rows = await db.select().from(messages).where(eq(messages.whatsappMessageId, whatsappId));
    return rows[0];
  }

  async getMessagesByCampaign(campaignId: string): Promise<Message[]> {
    return db.select().from(messages).where(eq(messages.campaignId, campaignId));
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const rows = await db.insert(messages).values(message).returning();
    return rows[0];
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const { id: _id, ...rest } = updates as any;
    const rows = await db.update(messages).set(rest).where(eq(messages.id, id)).returning();
    return rows[0];
  }

  async deleteMessage(id: string): Promise<boolean> {
    const result = await db.delete(messages).where(eq(messages.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Campaign Metrics
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics | undefined> {
    const rows = await db.select().from(campaignMetrics).where(eq(campaignMetrics.campaignId, campaignId));
    return rows[0];
  }

  async upsertCampaignMetrics(metrics: InsertCampaignMetrics): Promise<CampaignMetrics> {
    const rows = await db.insert(campaignMetrics)
      .values({ ...metrics, lastUpdatedAt: new Date() })
      .onConflictDoUpdate({
        target: campaignMetrics.campaignId,
        set: { ...metrics, lastUpdatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }

  // Dashboard
  async getDashboardMetrics(accountId?: string): Promise<DashboardMetrics> {
    const allMessages = accountId
      ? await db.select().from(messages).where(eq(messages.accountId, accountId))
      : await db.select().from(messages);
    const allTemplates = accountId
      ? await db.select().from(templates).where(eq(templates.accountId, accountId))
      : await db.select().from(templates);
    const allCampaigns = accountId
      ? await db.select().from(campaigns).where(eq(campaigns.accountId, accountId))
      : await db.select().from(campaigns);
    const allAccounts = accountId
      ? await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.id, accountId))
      : await db.select().from(whatsappAccounts);

    const sentCount = allMessages.filter(m => m.status === "sent" || m.status === "delivered" || m.status === "read").length;
    const deliveredCount = allMessages.filter(m => m.status === "delivered" || m.status === "read").length;
    const readCount = allMessages.filter(m => m.status === "read").length;
    const failedCount = allMessages.filter(m => m.status === "failed").length;
    const totalCost = allMessages.reduce((sum, m) => sum + parseFloat(m.cost || "0"), 0);

    const totalMessagingLimit = allAccounts.reduce((sum, a) => sum + (a.messagingLimit || 0), 0);
    const totalMessagingUsed = allAccounts.reduce((sum, a) => sum + (a.messagingUsed || 0), 0);

    return {
      totalMessages: allMessages.length,
      sentCount,
      deliveredCount,
      readCount,
      failedCount,
      deliveryRate: sentCount > 0 ? (deliveredCount / sentCount) * 100 : 0,
      readRate: deliveredCount > 0 ? (readCount / deliveredCount) * 100 : 0,
      totalCost,
      activeCampaigns: allCampaigns.filter(c => c.status === "running").length,
      approvedTemplates: allTemplates.filter(t => t.status === "APPROVED").length,
      pendingTemplates: allTemplates.filter(t => t.status === "PENDING").length,
      messagingLimit: totalMessagingLimit || 100000,
      messagingUsed: totalMessagingUsed || allMessages.length,
      qualityRating: (allAccounts[0]?.qualityRating as QualityScore) || "GREEN",
      apiStatus: allAccounts.length > 0 ? "connected" : "disconnected",
    };
  }

  async getDashboardChartData(accountId: string): Promise<{ messageVolume: any[]; statusDistribution: any[] }> {
    const allMessages = await db.select().from(messages).where(eq(messages.accountId, accountId));

    const now = new Date();
    const hourlyMap = new Map<string, { time: string; sent: number; delivered: number; read: number }>();
    for (let i = 23; i >= 0; i--) {
      const h = new Date(now);
      h.setHours(now.getHours() - i, 0, 0, 0);
      const label = h.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      hourlyMap.set(label, { time: label, sent: 0, delivered: 0, read: 0 });
    }

    for (const msg of allMessages) {
      const sentTime = msg.sentAt || msg.queuedAt;
      if (!sentTime) continue;
      const msgDate = new Date(sentTime);
      const hoursDiff = (now.getTime() - msgDate.getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 24) continue;
      const label = msgDate.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false });
      const bucket = hourlyMap.get(label);
      if (bucket) {
        bucket.sent++;
        if (msg.status === "delivered" || msg.status === "read") bucket.delivered++;
        if (msg.status === "read") bucket.read++;
      }
    }

    const messageVolume = Array.from(hourlyMap.values());

    const sentOnly = allMessages.filter(m => m.status === "sent").length;
    const delivered = allMessages.filter(m => m.status === "delivered").length;
    const read = allMessages.filter(m => m.status === "read").length;
    const failed = allMessages.filter(m => m.status === "failed").length;
    const statusDistribution = [
      { name: "Delivered", value: delivered },
      { name: "Read", value: read },
      { name: "Sent", value: sentOnly },
      { name: "Failed", value: failed },
    ].filter(s => s.value > 0);

    return { messageVolume, statusDistribution };
  }

  async getRecentActivities(accountId?: string): Promise<ActivityItem[]> {
    if (accountId) {
      return db.select().from(activities).where(eq(activities.accountId, accountId)).orderBy(desc(activities.timestamp)).limit(20);
    }
    return db.select().from(activities).orderBy(desc(activities.timestamp)).limit(20);
  }

  async addActivity(activity: Omit<ActivityItem, "id">): Promise<ActivityItem> {
    const rows = await db.insert(activities).values(activity).returning();
    return rows[0];
  }

  // Settings
  async getSettings(): Promise<ApiSettings | undefined> {
    const rows = await db.select().from(apiSettings).limit(1);
    return rows[0];
  }

  async saveSettings(settings: Omit<ApiSettings, "id">): Promise<ApiSettings> {
    const existing = await this.getSettings();
    if (existing) {
      const rows = await db.update(apiSettings).set(settings).where(eq(apiSettings.id, existing.id)).returning();
      return rows[0];
    }
    const rows = await db.insert(apiSettings).values(settings).returning();
    return rows[0];
  }

  async getApiSettings(): Promise<ApiSettings | undefined> {
    return this.getSettings();
  }

  async deleteApiSettings(): Promise<boolean> {
    const existing = await this.getSettings();
    if (!existing) return false;
    const result = await db.delete(apiSettings).where(eq(apiSettings.id, existing.id));
    return (result.rowCount ?? 0) > 0;
  }

  // Analytics
  async getAnalyticsData(timeRange: string, accountId?: string): Promise<AnalyticsData> {
    const allMessages = accountId
      ? await db.select().from(messages).where(eq(messages.accountId, accountId))
      : await db.select().from(messages);
    const allTemplates = accountId
      ? await db.select().from(templates).where(eq(templates.accountId, accountId))
      : await db.select().from(templates);

    const now = new Date();
    const daysMap: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[timeRange] || 7;

    const dailyMap = new Map<string, { sent: number; delivered: number; read: number; failed: number }>();
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyMap.set(dateStr, { sent: 0, delivered: 0, read: 0, failed: 0 });
    }

    allMessages.forEach(msg => {
      if (!msg.queuedAt) return;
      const msgDate = new Date(msg.queuedAt);
      const daysDiff = Math.floor((now.getTime() - msgDate.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff < days) {
        const dateStr = msgDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
        const dayData = dailyMap.get(dateStr);
        if (dayData) {
          dayData.sent++;
          if (msg.status === "delivered" || msg.status === "read") dayData.delivered++;
          if (msg.status === "read") dayData.read++;
          if (msg.status === "failed") dayData.failed++;
        }
      }
    });

    const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({ date, ...data }));

    const hourlyMap = new Map<string, number>();
    for (let h = 0; h < 24; h += 2) {
      hourlyMap.set(`${h.toString().padStart(2, "0")}:00`, 0);
    }
    allMessages.forEach(msg => {
      if (!msg.queuedAt) return;
      const hour = new Date(msg.queuedAt).getHours();
      const hourKey = `${(Math.floor(hour / 2) * 2).toString().padStart(2, "0")}:00`;
      hourlyMap.set(hourKey, (hourlyMap.get(hourKey) || 0) + 1);
    });
    const hourlyData = Array.from(hourlyMap.entries()).map(([hour, msgs]) => ({ hour, messages: msgs }));

    const categoryCount = new Map<string, number>();
    allTemplates.forEach(t => {
      categoryCount.set(t.category, (categoryCount.get(t.category) || 0) + 1);
    });
    const categoryColors: Record<string, string> = {
      MARKETING: "hsl(var(--chart-1))",
      UTILITY: "hsl(var(--chart-2))",
      AUTHENTICATION: "hsl(var(--chart-4))",
    };
    const categoryData = Array.from(categoryCount.entries()).map(([name, value]) => ({
      name,
      value,
      color: categoryColors[name] || "hsl(var(--chart-3))",
    }));

    const errorMap = new Map<string, { description: string; count: number }>();
    allMessages.forEach(msg => {
      if (msg.status === "failed" && msg.errorCode) {
        const existing = errorMap.get(msg.errorCode);
        if (existing) existing.count++;
        else errorMap.set(msg.errorCode, { description: msg.errorDescription || "Unknown error", count: 1 });
      }
    });
    const errorData = Array.from(errorMap.entries())
      .map(([code, { description, count }]) => ({ code, description, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const costMap = new Map<string, number>();
    dailyMap.forEach((_, date) => costMap.set(date, 0));
    allMessages.forEach(msg => {
      if (!msg.queuedAt) return;
      const dateStr = new Date(msg.queuedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (costMap.has(dateStr)) {
        costMap.set(dateStr, (costMap.get(dateStr) || 0) + parseFloat(msg.cost || "0"));
      }
    });
    const costData = Array.from(costMap.entries()).map(([date, cost]) => ({
      date,
      cost: Math.round(cost * 100) / 100,
    }));

    const totalMessages = allMessages.length;
    const totalDelivered = allMessages.filter(m => m.status === "delivered" || m.status === "read").length;
    const totalRead = allMessages.filter(m => m.status === "read").length;
    const totalFailed = allMessages.filter(m => m.status === "failed").length;
    const totalCost = allMessages.reduce((sum, m) => sum + parseFloat(m.cost || "0"), 0);

    return {
      dailyData,
      hourlyData,
      categoryData,
      errorData,
      costData,
      summary: {
        totalMessages,
        totalDelivered,
        totalRead,
        totalFailed,
        deliveryRate: totalMessages > 0 ? (totalDelivered / totalMessages) * 100 : 0,
        readRate: totalDelivered > 0 ? (totalRead / totalDelivered) * 100 : 0,
        totalCost: Math.round(totalCost * 100) / 100,
      },
    };
  }

  // WhatsApp Accounts
  async getAccountsByUser(userId: string): Promise<WhatsAppAccount[]> {
    const ownAccounts = await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.userId, userId));
    const sharedMemberships = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.memberUserId, userId), eq(teamMembers.status, "active")));
    const sharedAccountIds = sharedMemberships.map(m => m.accountId).filter(id => !ownAccounts.some(a => a.id === id));
    const sharedAccounts: WhatsAppAccount[] = [];
    for (const accId of sharedAccountIds) {
      const acc = await this.getAccount(accId);
      if (acc) sharedAccounts.push(acc);
    }
    return [...ownAccounts, ...sharedAccounts];
  }

  async getAccounts(): Promise<WhatsAppAccount[]> {
    return db.select().from(whatsappAccounts);
  }

  async getAccount(id: string): Promise<WhatsAppAccount | undefined> {
    const rows = await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.id, id));
    return rows[0];
  }

  async createAccount(account: InsertWhatsAppAccount): Promise<WhatsAppAccount> {
    const rows = await db.insert(whatsappAccounts).values({
      ...account,
      status: "connected",
      qualityRating: "UNKNOWN",
      messagingLimit: 1000,
      messagingUsed: 0,
    }).returning();
    return rows[0];
  }

  async updateAccount(id: string, updates: Partial<WhatsAppAccount>): Promise<WhatsAppAccount | undefined> {
    const { id: _id, ...rest } = updates as any;
    const rows = await db.update(whatsappAccounts).set(rest).where(eq(whatsappAccounts.id, id)).returning();
    return rows[0];
  }

  async deleteAccount(id: string): Promise<boolean> {
    const result = await db.delete(whatsappAccounts).where(eq(whatsappAccounts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async setActiveAccount(userId: string, accountId: string): Promise<void> {
    await db.insert(activeAccounts)
      .values({ userId, accountId })
      .onConflictDoUpdate({
        target: activeAccounts.userId,
        set: { accountId },
      });
  }

  async getActiveAccountId(userId: string): Promise<string | undefined> {
    const rows = await db.select().from(activeAccounts).where(eq(activeAccounts.userId, userId));
    if (rows[0]) return rows[0].accountId;
    const userAccounts = await this.getAccountsByUser(userId);
    if (userAccounts.length > 0) {
      const first = userAccounts.find(a => a.status === "connected") || userAccounts[0];
      await this.setActiveAccount(userId, first.id);
      return first.id;
    }
    return undefined;
  }

  // Contacts
  async getContacts(accountId: string): Promise<Contact[]> {
    return db.select().from(contacts).where(eq(contacts.accountId, accountId)).orderBy(desc(contacts.createdAt));
  }

  async getContact(id: string): Promise<Contact | undefined> {
    const rows = await db.select().from(contacts).where(eq(contacts.id, id));
    return rows[0];
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const rows = await db.insert(contacts).values(contact as any).returning();
    return rows[0];
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const { id: _id, ...rest } = updates as any;
    const rows = await db.update(contacts).set({ ...rest, updatedAt: new Date() }).where(eq(contacts.id, id)).returning();
    return rows[0];
  }

  async deleteContact(id: string): Promise<boolean> {
    const result = await db.delete(contacts).where(eq(contacts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async importContacts(contactsData: InsertContact[], listId?: string): Promise<number> {
    let imported = 0;
    for (const contact of contactsData) {
      const existing = await db.select().from(contacts)
        .where(and(eq(contacts.phone, contact.phone), eq(contacts.accountId, contact.accountId!)));
      if (existing.length === 0) {
        const insertData = {
          ...contact,
          listIds: listId ? [listId] : (contact.listIds || []),
        };
        await db.insert(contacts).values(insertData as any);
        imported++;
      }
    }
    if (listId && imported > 0) {
      await db.update(contactLists)
        .set({ contactCount: dsql`${contactLists.contactCount} + ${imported}` })
        .where(eq(contactLists.id, listId));
    }
    return imported;
  }

  // Contact Lists
  async getLists(accountId: string): Promise<ContactList[]> {
    return db.select().from(contactLists).where(eq(contactLists.accountId, accountId)).orderBy(desc(contactLists.createdAt));
  }

  async getList(id: string): Promise<ContactList | undefined> {
    const rows = await db.select().from(contactLists).where(eq(contactLists.id, id));
    return rows[0];
  }

  async createList(list: InsertContactList): Promise<ContactList> {
    const rows = await db.insert(contactLists).values(list).returning();
    return rows[0];
  }

  async updateList(id: string, updates: Partial<ContactList>): Promise<ContactList | undefined> {
    const { id: _id, ...rest } = updates as any;
    const rows = await db.update(contactLists).set({ ...rest, updatedAt: new Date() }).where(eq(contactLists.id, id)).returning();
    return rows[0];
  }

  async deleteList(id: string): Promise<boolean> {
    const result = await db.delete(contactLists).where(eq(contactLists.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteContactList(id: string): Promise<boolean> {
    return this.deleteList(id);
  }

  async getContactListsByAccount(accountId: string): Promise<ContactList[]> {
    return this.getLists(accountId);
  }

  // Contact Tags
  async getTags(accountId: string): Promise<ContactTag[]> {
    return db.select().from(contactTags).where(eq(contactTags.accountId, accountId)).orderBy(desc(contactTags.createdAt));
  }

  async getTag(id: string): Promise<ContactTag | undefined> {
    const rows = await db.select().from(contactTags).where(eq(contactTags.id, id));
    return rows[0];
  }

  async createTag(tag: InsertContactTag): Promise<ContactTag> {
    const rows = await db.insert(contactTags).values(tag).returning();
    return rows[0];
  }

  async deleteTag(id: string): Promise<boolean> {
    const result = await db.delete(contactTags).where(eq(contactTags.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async deleteContactTag(id: string): Promise<boolean> {
    return this.deleteTag(id);
  }

  async getContactTagsByAccount(accountId: string): Promise<ContactTag[]> {
    return this.getTags(accountId);
  }

  // Conversations
  async getConversations(accountId: string): Promise<Conversation[]> {
    return db.select().from(conversations)
      .where(eq(conversations.accountId, accountId))
      .orderBy(desc(conversations.lastMessageAt));
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    const rows = await db.select().from(conversations).where(eq(conversations.id, id));
    return rows[0];
  }

  async getConversationByPhone(phone: string, accountId: string): Promise<Conversation | undefined> {
    const normalizedPhone = phone.startsWith("+") ? phone : `+${phone}`;
    const withoutPlus = normalizedPhone.substring(1);
    const rows = await db.select().from(conversations)
      .where(and(
        or(eq(conversations.contactPhone, normalizedPhone), eq(conversations.contactPhone, withoutPlus)),
        eq(conversations.accountId, accountId)
      ));
    return rows[0];
  }

  async createConversation(phone: string, name: string | undefined, accountId: string): Promise<Conversation> {
    const contactRows = await db.select().from(contacts)
      .where(and(eq(contacts.phone, phone), eq(contacts.accountId, accountId)));
    const contact = contactRows[0];

    const rows = await db.insert(conversations).values({
      accountId,
      contactId: contact?.id || "",
      contactPhone: phone,
      contactName: name || contact?.name || undefined,
      unreadCount: 0,
      status: "open",
    }).returning();
    return rows[0];
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const { id: _id, ...rest } = updates as any;
    const rows = await db.update(conversations).set(rest).where(eq(conversations.id, id)).returning();
    return rows[0];
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return db.select().from(conversationMessages)
      .where(eq(conversationMessages.conversationId, conversationId))
      .orderBy(conversationMessages.sentAt);
  }

  async addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const rows = await db.insert(conversationMessages).values(message).returning();
    const newMsg = rows[0];

    await db.update(conversations).set({
      lastMessage: message.content,
      lastMessageAt: new Date(),
      ...(message.direction === "inbound" ? { unreadCount: dsql`${conversations.unreadCount} + 1` } : {}),
    }).where(eq(conversations.id, message.conversationId));

    return newMsg;
  }

  async getConversationsByAccount(accountId: string): Promise<Conversation[]> {
    return this.getConversations(accountId);
  }

  async deleteConversation(id: string): Promise<boolean> {
    await db.delete(conversationMessages).where(eq(conversationMessages.conversationId, id));
    const result = await db.delete(conversations).where(eq(conversations.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  // Notifications
  async getNotifications(accountId: string): Promise<Notification[]> {
    return db.select().from(notifications)
      .where(eq(notifications.accountId, accountId))
      .orderBy(desc(notifications.createdAt));
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    const rows = await db.select().from(notifications).where(eq(notifications.id, id));
    return rows[0];
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    let totalRecipients = 0;
    if (notification.listIds && Array.isArray(notification.listIds)) {
      for (const listId of notification.listIds) {
        const list = await this.getList(listId);
        totalRecipients += list?.contactCount || 0;
      }
    }
    const rows = await db.insert(notifications).values({
      ...notification,
      status: notification.scheduledAt ? "scheduled" : "draft",
      totalRecipients,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
    } as any).returning();
    return rows[0];
  }

  async updateNotification(id: string, updates: Partial<Notification>): Promise<Notification | undefined> {
    const { id: _id, ...rest } = updates as any;
    const rows = await db.update(notifications).set(rest).where(eq(notifications.id, id)).returning();
    return rows[0];
  }

  async deleteNotification(id: string): Promise<boolean> {
    const result = await db.delete(notifications).where(eq(notifications.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getNotificationsByAccount(accountId: string): Promise<Notification[]> {
    return this.getNotifications(accountId);
  }

  async getContactsByAccount(accountId: string): Promise<Contact[]> {
    return this.getContacts(accountId);
  }

  async getTeamMembers(accountId: string): Promise<TeamMember[]> {
    return db.select().from(teamMembers).where(eq(teamMembers.accountId, accountId));
  }

  async addTeamMember(member: InsertTeamMember): Promise<TeamMember> {
    const rows = await db.insert(teamMembers).values(member).returning();
    return rows[0];
  }

  async removeTeamMember(id: string): Promise<boolean> {
    const result = await db.delete(teamMembers).where(eq(teamMembers.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async getTeamMemberByEmail(email: string, accountId: string): Promise<TeamMember | undefined> {
    const rows = await db.select().from(teamMembers)
      .where(and(eq(teamMembers.memberEmail, email), eq(teamMembers.accountId, accountId)));
    return rows[0];
  }

  async getSharedAccountsForUser(userEmail: string): Promise<TeamMember[]> {
    return db.select().from(teamMembers)
      .where(and(eq(teamMembers.memberEmail, userEmail), eq(teamMembers.status, "active")));
  }

  async acceptTeamInvite(id: string, userId: string): Promise<TeamMember | undefined> {
    const rows = await db.update(teamMembers).set({
      memberUserId: userId,
      status: "active",
      acceptedAt: new Date(),
    }).where(eq(teamMembers.id, id)).returning();
    return rows[0];
  }

  async backfillMessageCampaignIds(): Promise<void> {
    const orphanedMessages = await db.select().from(messages).where(isNull(messages.campaignId));
    if (orphanedMessages.length === 0) {
      console.log("[Backfill] No orphaned messages found");
      return;
    }
    console.log(`[Backfill] Found ${orphanedMessages.length} messages without campaign_id, attempting to link...`);

    const allNotifications = await db.select().from(notifications);
    let linked = 0;

    for (const msg of orphanedMessages) {
      const matchingNotification = allNotifications
        .filter(n =>
          n.templateId === msg.templateId &&
          n.sentAt &&
          n.accountId === msg.accountId
        )
        .sort((a, b) => {
          const msgTime = msg.sentAt || msg.queuedAt;
          if (!msgTime) return 0;
          const aDiff = Math.abs(new Date(a.sentAt!).getTime() - new Date(msgTime).getTime());
          const bDiff = Math.abs(new Date(b.sentAt!).getTime() - new Date(msgTime).getTime());
          return aDiff - bDiff;
        })
        .find(n => {
          const msgTime = msg.sentAt || msg.queuedAt;
          if (!msgTime || !n.sentAt) return false;
          const nStart = new Date(n.sentAt).getTime();
          const nEnd = n.completedAt ? new Date(n.completedAt).getTime() + 60000 : nStart + 30 * 60 * 1000;
          const mTime = new Date(msgTime).getTime();
          return mTime >= nStart - 5000 && mTime <= nEnd;
        });

      if (matchingNotification) {
        await db.update(messages)
          .set({ campaignId: matchingNotification.id })
          .where(eq(messages.id, msg.id));
        linked++;
      }
    }
    console.log(`[Backfill] Linked ${linked} of ${orphanedMessages.length} orphaned messages to notifications`);
  }
}

export const storage = new DatabaseStorage();
