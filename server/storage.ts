import { 
  type Template, type InsertTemplate,
  type Campaign, type InsertCampaign,
  type Message, type InsertMessage,
  type CampaignMetrics, type InsertCampaignMetrics,
  type DashboardMetrics, type ActivityItem, type ApiSettings,
  type WhatsAppAccount, type InsertWhatsAppAccount,
  type Contact, type InsertContact,
  type ContactList, type InsertContactList,
  type ContactTag, type InsertContactTag,
  type Conversation, type ConversationMessage, type InsertConversationMessage,
  type Notification, type InsertNotification,
  type MediaAsset,
  whatsappAccounts
} from "@shared/schema";
import { db } from "@db";
import { eq } from "drizzle-orm";
import { randomUUID } from "crypto";

export interface IStorage {

  // Templates
  getTemplates(): Promise<Template[]>;
  getTemplate(id: string): Promise<Template | undefined>;
  createTemplate(template: InsertTemplate): Promise<Template>;
  updateTemplate(id: string, updates: Partial<Template>): Promise<Template | undefined>;
  deleteTemplate(id: string): Promise<boolean>;

  // Campaigns
  getCampaigns(): Promise<Campaign[]>;
  getCampaign(id: string): Promise<Campaign | undefined>;
  createCampaign(campaign: InsertCampaign): Promise<Campaign>;
  updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined>;
  deleteCampaign(id: string): Promise<boolean>;

  // Messages
  getMessages(): Promise<Message[]>;
  getMessage(id: string): Promise<Message | undefined>;
  getMessagesByWhatsappId(whatsappId: string): Promise<Message | undefined>;
  getMessagesByCampaign(campaignId: string): Promise<Message[]>;
  createMessage(message: InsertMessage): Promise<Message>;
  updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined>;
  deleteMessage(id: string): Promise<boolean>;

  // Campaign Metrics
  getCampaignMetrics(campaignId: string): Promise<CampaignMetrics | undefined>;
  upsertCampaignMetrics(metrics: InsertCampaignMetrics): Promise<CampaignMetrics>;

  // Dashboard
  getDashboardMetrics(): Promise<DashboardMetrics>;
  getRecentActivities(): Promise<ActivityItem[]>;
  addActivity(activity: Omit<ActivityItem, "id">): Promise<ActivityItem>;

  // Settings
  getSettings(): Promise<ApiSettings | undefined>;
  saveSettings(settings: ApiSettings): Promise<ApiSettings>;

  // Analytics
  getAnalyticsData(timeRange: string): Promise<AnalyticsData>;

  // WhatsApp Accounts
  getAccountsByUser(userId: string): Promise<WhatsAppAccount[]>;
  getAccounts(): Promise<WhatsAppAccount[]>;
  getAccount(id: string): Promise<WhatsAppAccount | undefined>;
  createAccount(account: InsertWhatsAppAccount): Promise<WhatsAppAccount>;
  updateAccount(id: string, updates: Partial<WhatsAppAccount>): Promise<WhatsAppAccount | undefined>;
  deleteAccount(id: string): Promise<boolean>;
  setActiveAccount(userId: string, accountId: string): Promise<void>;
  getActiveAccountId(userId: string): Promise<string | undefined>;

  // Contacts
  getContacts(): Promise<Contact[]>;
  getContact(id: string): Promise<Contact | undefined>;
  createContact(contact: InsertContact): Promise<Contact>;
  updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined>;
  deleteContact(id: string): Promise<boolean>;
  importContacts(contacts: InsertContact[], listId?: string): Promise<number>;

  // Contact Lists
  getLists(): Promise<ContactList[]>;
  getList(id: string): Promise<ContactList | undefined>;
  createList(list: InsertContactList): Promise<ContactList>;
  updateList(id: string, updates: Partial<ContactList>): Promise<ContactList | undefined>;
  deleteList(id: string): Promise<boolean>;
  deleteContactList(id: string): Promise<boolean>;
  getContactListsByAccount(accountId: string): Promise<ContactList[]>;

  // Contact Tags
  getTags(): Promise<ContactTag[]>;
  getTag(id: string): Promise<ContactTag | undefined>;
  createTag(tag: InsertContactTag): Promise<ContactTag>;
  deleteTag(id: string): Promise<boolean>;
  deleteContactTag(id: string): Promise<boolean>;
  getContactTagsByAccount(accountId: string): Promise<ContactTag[]>;

  // Conversations
  getConversations(): Promise<Conversation[]>;
  getConversation(id: string): Promise<Conversation | undefined>;
  getConversationByPhone(phone: string): Promise<Conversation | undefined>;
  createConversation(phone: string, name?: string): Promise<Conversation>;
  updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined>;
  getConversationMessages(conversationId: string): Promise<ConversationMessage[]>;
  addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage>;
  getConversationsByAccount(accountId: string): Promise<Conversation[]>;
  deleteConversation(id: string): Promise<boolean>;

  // Notifications/Broadcasts
  getNotifications(): Promise<Notification[]>;
  getNotification(id: string): Promise<Notification | undefined>;
  createNotification(notification: InsertNotification): Promise<Notification>;
  updateNotification(id: string, updates: Partial<Notification>): Promise<Notification | undefined>;
  deleteNotification(id: string): Promise<boolean>;
  getNotificationsByAccount(accountId: string): Promise<Notification[]>;

  // Contacts by account
  getContactsByAccount(accountId: string): Promise<Contact[]>;

  // API Settings
  getApiSettings(): Promise<ApiSettings | undefined>;
  deleteApiSettings(): Promise<boolean>;
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

export class MemStorage implements IStorage {
  private templates: Map<string, Template>;
  private campaigns: Map<string, Campaign>;
  private messages: Map<string, Message>;
  private campaignMetrics: Map<string, CampaignMetrics>;
  private activities: ActivityItem[];
  private settings: ApiSettings | undefined;
  private activeAccountByUser: Map<string, string>;
  private activeAccountId: string | undefined;
  private contacts: Map<string, Contact>;
  private contactLists: Map<string, ContactList>;
  private contactTags: Map<string, ContactTag>;
  private conversations: Map<string, Conversation>;
  private conversationMessages: Map<string, ConversationMessage[]>;
  private notifications: Map<string, Notification>;

  constructor() {
    this.templates = new Map();
    this.campaigns = new Map();
    this.messages = new Map();
    this.campaignMetrics = new Map();
    this.activities = [];
    this.settings = undefined;
    this.activeAccountByUser = new Map();
    this.contacts = new Map();
    this.contactLists = new Map();
    this.contactTags = new Map();
    this.conversations = new Map();
    this.conversationMessages = new Map();
    this.notifications = new Map();
    
    // No sample data - production mode
  }

  private seedData() {
    // Seed templates
    const templateData: InsertTemplate[] = [
      {
        name: "order_confirmation",
        category: "UTILITY",
        language: "en",
        status: "APPROVED",
        qualityScore: "GREEN",
        metaTemplateId: "tpl_001",
        components: [
          { type: "HEADER", text: "Order Confirmed" },
          { type: "BODY", text: "Hi {{1}}, your order #{{2}} has been confirmed and will be shipped within 2-3 business days." },
          { type: "FOOTER", text: "Thank you for your purchase!" }
        ],
        lastSyncedAt: new Date(),
      },
      {
        name: "shipping_notification",
        category: "UTILITY",
        language: "en",
        status: "APPROVED",
        qualityScore: "GREEN",
        metaTemplateId: "tpl_002",
        components: [
          { type: "HEADER", text: "Order Shipped" },
          { type: "BODY", text: "Great news! Your order #{{1}} is on its way. Track it here: {{2}}" },
        ],
        lastSyncedAt: new Date(),
      },
      {
        name: "summer_sale",
        category: "MARKETING",
        language: "en",
        status: "APPROVED",
        qualityScore: "YELLOW",
        metaTemplateId: "tpl_003",
        components: [
          { type: "BODY", text: "Summer Sale is here! Get up to 50% off on selected items. Shop now at {{1}}" },
          { type: "FOOTER", text: "Reply STOP to unsubscribe" }
        ],
        lastSyncedAt: new Date(),
      },
      {
        name: "login_otp",
        category: "AUTHENTICATION",
        language: "en",
        status: "APPROVED",
        qualityScore: "GREEN",
        metaTemplateId: "tpl_004",
        components: [
          { type: "BODY", text: "Your verification code is {{1}}. This code expires in 10 minutes." },
        ],
        lastSyncedAt: new Date(),
      },
      {
        name: "welcome_message",
        category: "MARKETING",
        language: "en",
        status: "PENDING",
        metaTemplateId: "tpl_005",
        components: [
          { type: "HEADER", text: "Welcome!" },
          { type: "BODY", text: "Hi {{1}}, welcome to our service! We're excited to have you on board." },
        ],
      },
      {
        name: "appointment_reminder",
        category: "UTILITY",
        language: "en",
        status: "REJECTED",
        qualityScore: "RED",
        rejectionReason: "Template content is unclear. Please specify the type of appointment.",
        metaTemplateId: "tpl_006",
        components: [
          { type: "BODY", text: "Reminder: You have an appointment on {{1}} at {{2}}." },
        ],
      },
    ];

    templateData.forEach((t) => {
      const id = randomUUID();
      this.templates.set(id, {
        ...t,
        id,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as Template);
    });

    // Seed campaigns
    const templateIds = Array.from(this.templates.keys());
    const approvedTemplates = Array.from(this.templates.values())
      .filter(t => t.status === "APPROVED")
      .map(t => t.id);

    if (approvedTemplates.length > 0) {
      const campaignData: InsertCampaign[] = [
        {
          name: "Summer Sale Campaign",
          description: "Promote our summer sale to all customers",
          templateId: approvedTemplates[0],
          status: "running",
          startedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
          recipients: ["+1234567890", "+1234567891", "+1234567892", "+1234567893", "+1234567894"],
        },
        {
          name: "Order Confirmations",
          description: "Automated order confirmation messages",
          templateId: approvedTemplates[0],
          status: "completed",
          startedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
          completedAt: new Date(Date.now() - 20 * 60 * 60 * 1000),
          recipients: ["+1234567800", "+1234567801"],
        },
        {
          name: "Holiday Special",
          description: "Holiday promotion campaign",
          templateId: approvedTemplates.length > 1 ? approvedTemplates[1] : approvedTemplates[0],
          status: "draft",
          recipients: ["+1234567700", "+1234567701", "+1234567702"],
        },
      ];

      campaignData.forEach((c) => {
        const id = randomUUID();
        this.campaigns.set(id, {
          ...c,
          id,
          scheduledAt: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Campaign);
      });
    }

    // Seed messages
    const campaignIds = Array.from(this.campaigns.keys());
    if (campaignIds.length > 0 && approvedTemplates.length > 0) {
      const messageStatuses = ["sent", "delivered", "read", "failed"] as const;
      const phones = ["+1234567890", "+1234567891", "+1234567892", "+1234567893", "+1234567894"];
      
      for (let i = 0; i < 50; i++) {
        const status = messageStatuses[Math.floor(Math.random() * messageStatuses.length)];
        const sentAt = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000);
        const deliveredAt = status !== "sent" && status !== "failed" 
          ? new Date(sentAt.getTime() + Math.random() * 60000) 
          : null;
        const readAt = status === "read" 
          ? new Date((deliveredAt?.getTime() || sentAt.getTime()) + Math.random() * 300000) 
          : null;

        const id = randomUUID();
        this.messages.set(id, {
          id,
          whatsappMessageId: `wamid.${randomUUID().replace(/-/g, "").substring(0, 20)}`,
          campaignId: campaignIds[Math.floor(Math.random() * campaignIds.length)],
          templateId: approvedTemplates[Math.floor(Math.random() * approvedTemplates.length)],
          recipientPhone: phones[Math.floor(Math.random() * phones.length)],
          status,
          queuedAt: new Date(sentAt.getTime() - 1000),
          sentAt,
          deliveredAt,
          readAt,
          errorCode: status === "failed" ? "130472" : null,
          errorDescription: status === "failed" ? "User phone number not registered on WhatsApp" : null,
          cost: "0.0055",
          metadata: null,
        } as Message);
      }
    }

    // Seed activities
    this.activities = [
      {
        id: randomUUID(),
        type: "message_delivered",
        title: "Message Delivered",
        description: "Summer Sale campaign - +1234567890",
        timestamp: new Date(Date.now() - 2 * 60 * 1000),
      },
      {
        id: randomUUID(),
        type: "template_approved",
        title: "Template Approved",
        description: "order_confirmation template is now active",
        timestamp: new Date(Date.now() - 15 * 60 * 1000),
      },
      {
        id: randomUUID(),
        type: "campaign_started",
        title: "Campaign Started",
        description: "Holiday Special - 3,800 recipients",
        timestamp: new Date(Date.now() - 45 * 60 * 1000),
      },
      {
        id: randomUUID(),
        type: "message_failed",
        title: "Message Failed",
        description: "Invalid phone number - +9876543210",
        timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000),
      },
      {
        id: randomUUID(),
        type: "message_read",
        title: "Message Read",
        description: "Welcome series - +1122334455",
        timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000),
      },
    ];

    // WhatsApp accounts are now stored in database

    // Seed contact lists
    const listIds: string[] = [];
    const listData = [
      { name: "Default", description: "Default contact list" },
      { name: "17-01-04", description: "Contacts from January 2026" },
      { name: "list 2", description: "Second contact list" },
      { name: "all ivr data", description: "IVR contacts" },
    ];
    listData.forEach((list, i) => {
      const id = randomUUID();
      listIds.push(id);
      this.contactLists.set(id, {
        id,
        accountId: acc1Id,
        name: list.name,
        description: list.description,
        contactCount: [0, 3391, 2299, 2649][i],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Seed contact tags
    const tagData = [
      { name: "VIP", color: "#22c55e" },
      { name: "New Customer", color: "#3b82f6" },
      { name: "Inactive", color: "#ef4444" },
    ];
    tagData.forEach((tag) => {
      const id = randomUUID();
      this.contactTags.set(id, {
        id,
        accountId: acc1Id,
        name: tag.name,
        color: tag.color,
        contactCount: Math.floor(Math.random() * 500),
        createdAt: new Date(),
      });
    });

    // Seed some contacts
    const contactData = [
      { phone: "+918840843567", name: undefined },
      { phone: "+919310967063", name: undefined },
      { phone: "+918826446429", name: undefined },
      { phone: "+918410201403", name: undefined },
      { phone: "+919971853500", name: undefined },
      { phone: "+919267938981", name: undefined },
      { phone: "+919911413381", name: "Manish" },
      { phone: "+918826446429", name: "Ahammad Rezauddin" },
    ];
    contactData.forEach((c) => {
      const id = randomUUID();
      this.contacts.set(id, {
        id,
        accountId: acc1Id,
        phone: c.phone,
        name: c.name,
        status: "subscribed",
        listIds: listIds.length > 0 ? [listIds[0]] : [],
        tagIds: [],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });

    // Seed conversations
    const convData = [
      { phone: "+918840843567", lastMessage: "Get Brochure", unread: 1 },
      { phone: "+919310967063", lastMessage: "Thank you for your message. We...", unread: 2 },
      { phone: "+918826446429", lastMessage: "Get Brochure", unread: 1 },
      { phone: "+918410201403", lastMessage: "Get Brochure", unread: 1 },
      { phone: "+919971853500", lastMessage: "Get Brochure", unread: 1 },
    ];
    convData.forEach((conv) => {
      const id = randomUUID();
      const contact = Array.from(this.contacts.values()).find(c => c.phone === conv.phone);
      this.conversations.set(id, {
        id,
        accountId: acc1Id,
        contactId: contact?.id || "",
        contactPhone: conv.phone,
        contactName: contact?.name,
        lastMessage: conv.lastMessage,
        lastMessageAt: new Date(Date.now() - Math.random() * 3600000),
        unreadCount: conv.unread,
        status: "active",
        windowEndsAt: new Date(Date.now() + 20 * 60 * 60 * 1000),
        createdAt: new Date(),
      });
      this.conversationMessages.set(id, []);
    });
  }

  // Templates
  async getTemplates(): Promise<Template[]> {
    return Array.from(this.templates.values()).sort(
      (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getTemplate(id: string): Promise<Template | undefined> {
    return this.templates.get(id);
  }

  async createTemplate(template: InsertTemplate): Promise<Template> {
    const id = randomUUID();
    const now = new Date();
    const newTemplate: Template = {
      ...template,
      id,
      metaTemplateId: template.metaTemplateId || null,
      qualityScore: template.qualityScore || "UNKNOWN",
      rejectionReason: template.rejectionReason || null,
      components: template.components || null,
      lastSyncedAt: template.lastSyncedAt || null,
      createdAt: now,
      updatedAt: now,
    };
    this.templates.set(id, newTemplate);
    return newTemplate;
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template | undefined> {
    const template = this.templates.get(id);
    if (!template) return undefined;
    
    const updated = { ...template, ...updates, updatedAt: new Date() };
    this.templates.set(id, updated);
    return updated;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    return this.templates.delete(id);
  }

  // Campaigns
  async getCampaigns(): Promise<Campaign[]> {
    return Array.from(this.campaigns.values()).sort(
      (a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime()
    );
  }

  async getCampaign(id: string): Promise<Campaign | undefined> {
    return this.campaigns.get(id);
  }

  async createCampaign(campaign: InsertCampaign): Promise<Campaign> {
    const id = randomUUID();
    const now = new Date();
    const newCampaign: Campaign = {
      ...campaign,
      id,
      description: campaign.description || null,
      scheduledAt: campaign.scheduledAt || null,
      startedAt: campaign.startedAt || null,
      completedAt: campaign.completedAt || null,
      recipients: campaign.recipients || null,
      createdAt: now,
      updatedAt: now,
    };
    this.campaigns.set(id, newCampaign);
    return newCampaign;
  }

  async updateCampaign(id: string, updates: Partial<Campaign>): Promise<Campaign | undefined> {
    const campaign = this.campaigns.get(id);
    if (!campaign) return undefined;
    
    const updated = { ...campaign, ...updates, updatedAt: new Date() };
    this.campaigns.set(id, updated);
    return updated;
  }

  async deleteCampaign(id: string): Promise<boolean> {
    return this.campaigns.delete(id);
  }

  // Messages
  async getMessages(): Promise<Message[]> {
    return Array.from(this.messages.values()).sort(
      (a, b) => new Date(b.queuedAt!).getTime() - new Date(a.queuedAt!).getTime()
    );
  }

  async getMessage(id: string): Promise<Message | undefined> {
    return this.messages.get(id);
  }

  async getMessagesByWhatsappId(whatsappId: string): Promise<Message | undefined> {
    return Array.from(this.messages.values()).find(
      (m) => m.whatsappMessageId === whatsappId
    );
  }

  async getMessagesByCampaign(campaignId: string): Promise<Message[]> {
    return Array.from(this.messages.values()).filter(
      (m) => m.campaignId === campaignId
    );
  }

  async createMessage(message: InsertMessage): Promise<Message> {
    const id = randomUUID();
    const newMessage: Message = {
      ...message,
      id,
      whatsappMessageId: message.whatsappMessageId || null,
      campaignId: message.campaignId || null,
      templateId: message.templateId || null,
      sentAt: message.sentAt || null,
      deliveredAt: message.deliveredAt || null,
      readAt: message.readAt || null,
      errorCode: message.errorCode || null,
      errorDescription: message.errorDescription || null,
      cost: message.cost || null,
      metadata: message.metadata || null,
      queuedAt: new Date(),
    };
    this.messages.set(id, newMessage);
    return newMessage;
  }

  async updateMessage(id: string, updates: Partial<Message>): Promise<Message | undefined> {
    const message = this.messages.get(id);
    if (!message) return undefined;
    
    const updated = { ...message, ...updates };
    this.messages.set(id, updated);
    return updated;
  }

  async deleteMessage(id: string): Promise<boolean> {
    return this.messages.delete(id);
  }

  // Campaign Metrics
  async getCampaignMetrics(campaignId: string): Promise<CampaignMetrics | undefined> {
    return this.campaignMetrics.get(campaignId);
  }

  async upsertCampaignMetrics(metrics: InsertCampaignMetrics): Promise<CampaignMetrics> {
    const existing = this.campaignMetrics.get(metrics.campaignId);
    const updated: CampaignMetrics = {
      ...existing,
      ...metrics,
      lastUpdatedAt: new Date(),
    };
    this.campaignMetrics.set(metrics.campaignId, updated);
    return updated;
  }

  // Dashboard
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    const messages = Array.from(this.messages.values());
    const templates = Array.from(this.templates.values());
    const campaigns = Array.from(this.campaigns.values());

    const sentCount = messages.filter((m) => m.status !== "queued").length;
    const deliveredCount = messages.filter((m) => m.status === "delivered" || m.status === "read").length;
    const readCount = messages.filter((m) => m.status === "read").length;
    const failedCount = messages.filter((m) => m.status === "failed").length;

    const totalCost = messages.reduce((sum, m) => sum + parseFloat(m.cost || "0"), 0);

    // Get all accounts for general stats
    const allAccounts = await this.getAccounts();
    const totalMessagingLimit = allAccounts.reduce((sum, a) => sum + (a.messagingLimit || 0), 0);
    const totalMessagingUsed = allAccounts.reduce((sum, a) => sum + (a.messagingUsed || 0), 0);

    return {
      totalMessages: messages.length,
      sentCount,
      deliveredCount,
      readCount,
      failedCount,
      deliveryRate: sentCount > 0 ? (deliveredCount / sentCount) * 100 : 0,
      readRate: deliveredCount > 0 ? (readCount / deliveredCount) * 100 : 0,
      totalCost,
      activeCampaigns: campaigns.filter((c) => c.status === "running").length,
      approvedTemplates: templates.filter((t) => t.status === "APPROVED").length,
      pendingTemplates: templates.filter((t) => t.status === "PENDING").length,
      messagingLimit: totalMessagingLimit || 100000,
      messagingUsed: totalMessagingUsed || messages.length,
      qualityRating: allAccounts[0]?.qualityRating as "GREEN" | "YELLOW" | "RED" | "UNKNOWN" || "GREEN",
      apiStatus: allAccounts.length > 0 ? "connected" : "disconnected",
    };
  }

  async getRecentActivities(): Promise<ActivityItem[]> {
    return this.activities.slice(0, 20);
  }

  async addActivity(activity: Omit<ActivityItem, "id">): Promise<ActivityItem> {
    const newActivity: ActivityItem = {
      ...activity,
      id: randomUUID(),
    };
    this.activities.unshift(newActivity);
    // Keep only last 100 activities
    if (this.activities.length > 100) {
      this.activities = this.activities.slice(0, 100);
    }
    return newActivity;
  }

  // Settings
  async getSettings(): Promise<ApiSettings | undefined> {
    return this.settings;
  }

  async saveSettings(settings: ApiSettings): Promise<ApiSettings> {
    this.settings = settings;
    return settings;
  }

  // Analytics
  async getAnalyticsData(timeRange: string): Promise<AnalyticsData> {
    const messages = Array.from(this.messages.values());
    const templates = Array.from(this.templates.values());
    
    // Calculate time window based on range
    const now = new Date();
    const daysMap: Record<string, number> = { "24h": 1, "7d": 7, "30d": 30, "90d": 90 };
    const days = daysMap[timeRange] || 7;
    
    // Generate daily data based on actual messages (grouped by date)
    const dailyMap = new Map<string, { sent: number; delivered: number; read: number; failed: number }>();
    
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateStr = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      dailyMap.set(dateStr, { sent: 0, delivered: 0, read: 0, failed: 0 });
    }
    
    // Aggregate messages into daily buckets (using queuedAt as the date)
    messages.forEach((msg) => {
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
    
    const dailyData = Array.from(dailyMap.entries()).map(([date, data]) => ({
      date,
      ...data,
    }));
    
    // Generate hourly distribution
    const hourlyMap = new Map<string, number>();
    for (let h = 0; h < 24; h += 2) {
      hourlyMap.set(`${h.toString().padStart(2, "0")}:00`, 0);
    }
    
    messages.forEach((msg) => {
      const hour = new Date(msg.queuedAt).getHours();
      const hourKey = `${(Math.floor(hour / 2) * 2).toString().padStart(2, "0")}:00`;
      hourlyMap.set(hourKey, (hourlyMap.get(hourKey) || 0) + 1);
    });
    
    const hourlyData = Array.from(hourlyMap.entries()).map(([hour, messages]) => ({
      hour,
      messages,
    }));
    
    // Category distribution based on templates
    const categoryCount = new Map<string, number>();
    templates.forEach((t) => {
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
    
    // Error distribution
    const errorMap = new Map<string, { description: string; count: number }>();
    messages.forEach((msg) => {
      if (msg.status === "failed" && msg.errorCode) {
        const existing = errorMap.get(msg.errorCode);
        if (existing) {
          existing.count++;
        } else {
          errorMap.set(msg.errorCode, {
            description: msg.errorDescription || "Unknown error",
            count: 1,
          });
        }
      }
    });
    
    const errorData = Array.from(errorMap.entries())
      .map(([code, { description, count }]) => ({ code, description, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    // Cost data per day
    const costMap = new Map<string, number>();
    dailyMap.forEach((_, date) => {
      costMap.set(date, 0);
    });
    
    messages.forEach((msg) => {
      const msgDate = new Date(msg.queuedAt);
      const dateStr = msgDate.toLocaleDateString("en-US", { month: "short", day: "numeric" });
      if (costMap.has(dateStr)) {
        costMap.set(dateStr, (costMap.get(dateStr) || 0) + parseFloat(msg.cost || "0"));
      }
    });
    
    const costData = Array.from(costMap.entries()).map(([date, cost]) => ({
      date,
      cost: Math.round(cost * 100) / 100,
    }));
    
    // Calculate summary
    const totalMessages = messages.length;
    const totalDelivered = messages.filter((m) => m.status === "delivered" || m.status === "read").length;
    const totalRead = messages.filter((m) => m.status === "read").length;
    const totalFailed = messages.filter((m) => m.status === "failed").length;
    const totalCost = messages.reduce((sum, m) => sum + parseFloat(m.cost || "0"), 0);
    
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

  // WhatsApp Accounts (database-backed)
  async getAccountsByUser(userId: string): Promise<WhatsAppAccount[]> {
    const results = await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.userId, userId));
    return results as WhatsAppAccount[];
  }

  async getAccounts(): Promise<WhatsAppAccount[]> {
    const results = await db.select().from(whatsappAccounts);
    return results as WhatsAppAccount[];
  }

  async getAccount(id: string): Promise<WhatsAppAccount | undefined> {
    const results = await db.select().from(whatsappAccounts).where(eq(whatsappAccounts.id, id));
    return results[0] as WhatsAppAccount | undefined;
  }

  async createAccount(account: InsertWhatsAppAccount): Promise<WhatsAppAccount> {
    const results = await db.insert(whatsappAccounts).values({
      ...account,
      status: "connected",
      qualityRating: "UNKNOWN",
      messagingLimit: 1000,
      messagingUsed: 0,
    }).returning();
    return results[0] as WhatsAppAccount;
  }

  async updateAccount(id: string, updates: Partial<WhatsAppAccount>): Promise<WhatsAppAccount | undefined> {
    const results = await db.update(whatsappAccounts)
      .set(updates)
      .where(eq(whatsappAccounts.id, id))
      .returning();
    return results[0] as WhatsAppAccount | undefined;
  }

  async deleteAccount(id: string): Promise<boolean> {
    const result = await db.delete(whatsappAccounts).where(eq(whatsappAccounts.id, id));
    return (result.rowCount ?? 0) > 0;
  }

  async setActiveAccount(userId: string, accountId: string): Promise<void> {
    this.activeAccountByUser.set(userId, accountId);
  }

  async getActiveAccountId(userId: string): Promise<string | undefined> {
    return this.activeAccountByUser.get(userId);
  }

  // Contacts
  async getContacts(): Promise<Contact[]> {
    const accountId = this.activeAccountId;
    return Array.from(this.contacts.values()).filter(c => c.accountId === accountId);
  }

  async getContact(id: string): Promise<Contact | undefined> {
    return this.contacts.get(id);
  }

  async createContact(contact: InsertContact): Promise<Contact> {
    const id = randomUUID();
    const accountId = this.activeAccountId || "";
    const newContact: Contact = {
      ...contact,
      id,
      accountId,
      status: contact.status || "subscribed",
      listIds: contact.listIds || [],
      tagIds: contact.tagIds || [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contacts.set(id, newContact);
    return newContact;
  }

  async updateContact(id: string, updates: Partial<Contact>): Promise<Contact | undefined> {
    const contact = this.contacts.get(id);
    if (!contact || contact.accountId !== this.activeAccountId) return undefined;
    const updated = { ...contact, ...updates, updatedAt: new Date() };
    this.contacts.set(id, updated);
    return updated;
  }

  async deleteContact(id: string): Promise<boolean> {
    const contact = this.contacts.get(id);
    if (!contact || contact.accountId !== this.activeAccountId) return false;
    return this.contacts.delete(id);
  }

  async importContacts(contacts: InsertContact[], listId?: string): Promise<number> {
    const accountId = this.activeAccountId;
    let imported = 0;
    for (const contact of contacts) {
      const existing = Array.from(this.contacts.values()).find(c => c.phone === contact.phone && c.accountId === accountId);
      if (!existing) {
        await this.createContact({
          ...contact,
          listIds: listId ? [listId] : contact.listIds || [],
        });
        imported++;
      }
    }
    if (listId) {
      const list = this.contactLists.get(listId);
      if (list) {
        list.contactCount += imported;
        this.contactLists.set(listId, list);
      }
    }
    return imported;
  }

  // Contact Lists
  async getLists(): Promise<ContactList[]> {
    const accountId = this.activeAccountId;
    return Array.from(this.contactLists.values()).filter(l => l.accountId === accountId);
  }

  async getList(id: string): Promise<ContactList | undefined> {
    return this.contactLists.get(id);
  }

  async createList(list: InsertContactList): Promise<ContactList> {
    const id = randomUUID();
    const accountId = this.activeAccountId || "";
    const newList: ContactList = {
      ...list,
      id,
      accountId,
      contactCount: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.contactLists.set(id, newList);
    return newList;
  }

  async updateList(id: string, updates: Partial<ContactList>): Promise<ContactList | undefined> {
    const list = this.contactLists.get(id);
    if (!list || list.accountId !== this.activeAccountId) return undefined;
    const updated = { ...list, ...updates, updatedAt: new Date() };
    this.contactLists.set(id, updated);
    return updated;
  }

  async deleteList(id: string): Promise<boolean> {
    const list = this.contactLists.get(id);
    if (!list || list.accountId !== this.activeAccountId) return false;
    return this.contactLists.delete(id);
  }

  // Contact Tags
  async getTags(): Promise<ContactTag[]> {
    const accountId = this.activeAccountId;
    return Array.from(this.contactTags.values()).filter(t => t.accountId === accountId);
  }

  async getTag(id: string): Promise<ContactTag | undefined> {
    return this.contactTags.get(id);
  }

  async createTag(tag: InsertContactTag): Promise<ContactTag> {
    const id = randomUUID();
    const accountId = this.activeAccountId || "";
    const newTag: ContactTag = {
      ...tag,
      id,
      accountId,
      contactCount: 0,
      createdAt: new Date(),
    };
    this.contactTags.set(id, newTag);
    return newTag;
  }

  async deleteTag(id: string): Promise<boolean> {
    const tag = this.contactTags.get(id);
    if (!tag || tag.accountId !== this.activeAccountId) return false;
    return this.contactTags.delete(id);
  }

  // Conversations
  async getConversations(): Promise<Conversation[]> {
    const accountId = this.activeAccountId;
    return Array.from(this.conversations.values())
      .filter(c => c.accountId === accountId)
      .sort((a, b) => new Date(b.lastMessageAt || b.createdAt).getTime() - new Date(a.lastMessageAt || a.createdAt).getTime());
  }

  async getConversation(id: string): Promise<Conversation | undefined> {
    return this.conversations.get(id);
  }

  async getConversationByPhone(phone: string): Promise<Conversation | undefined> {
    const accountId = this.activeAccountId;
    return Array.from(this.conversations.values()).find(c => c.contactPhone === phone && c.accountId === accountId);
  }

  async createConversation(phone: string, name?: string): Promise<Conversation> {
    const id = randomUUID();
    const accountId = this.activeAccountId || "";
    const contact = Array.from(this.contacts.values()).find(c => c.phone === phone);
    const newConv: Conversation = {
      id,
      accountId,
      contactId: contact?.id || "",
      contactPhone: phone,
      contactName: name || contact?.name,
      unreadCount: 0,
      status: "open",
      createdAt: new Date(),
    };
    this.conversations.set(id, newConv);
    this.conversationMessages.set(id, []);
    return newConv;
  }

  async updateConversation(id: string, updates: Partial<Conversation>): Promise<Conversation | undefined> {
    const conv = this.conversations.get(id);
    if (!conv || conv.accountId !== this.activeAccountId) return undefined;
    const updated = { ...conv, ...updates };
    this.conversations.set(id, updated);
    return updated;
  }

  async getConversationMessages(conversationId: string): Promise<ConversationMessage[]> {
    return this.conversationMessages.get(conversationId) || [];
  }

  async addConversationMessage(message: InsertConversationMessage): Promise<ConversationMessage> {
    const id = randomUUID();
    const newMessage: ConversationMessage = {
      ...message,
      id,
      sentAt: new Date(),
    };
    const messages = this.conversationMessages.get(message.conversationId) || [];
    messages.push(newMessage);
    this.conversationMessages.set(message.conversationId, messages);
    
    // Update conversation
    const conv = this.conversations.get(message.conversationId);
    if (conv) {
      conv.lastMessage = message.content;
      conv.lastMessageAt = new Date();
      if (message.direction === "inbound") {
        conv.unreadCount++;
      }
      this.conversations.set(message.conversationId, conv);
    }
    return newMessage;
  }

  // Notifications/Broadcasts
  async getNotifications(): Promise<Notification[]> {
    const accountId = this.activeAccountId;
    return Array.from(this.notifications.values())
      .filter(n => n.accountId === accountId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getNotification(id: string): Promise<Notification | undefined> {
    return this.notifications.get(id);
  }

  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const accountId = this.activeAccountId || "";
    const totalRecipients = notification.listIds.reduce((sum, listId) => {
      const list = this.contactLists.get(listId);
      return sum + (list?.contactCount || 0);
    }, 0);
    
    const newNotification: Notification = {
      ...notification,
      id,
      accountId,
      status: notification.scheduledAt ? "scheduled" : "draft",
      totalRecipients,
      sentCount: 0,
      deliveredCount: 0,
      readCount: 0,
      failedCount: 0,
      createdAt: new Date(),
    };
    this.notifications.set(id, newNotification);
    return newNotification;
  }

  async updateNotification(id: string, updates: Partial<Notification>): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification || notification.accountId !== this.activeAccountId) return undefined;
    const updated = { ...notification, ...updates };
    this.notifications.set(id, updated);
    return updated;
  }

  async deleteNotification(id: string): Promise<boolean> {
    const notification = this.notifications.get(id);
    if (!notification || notification.accountId !== this.activeAccountId) return false;
    return this.notifications.delete(id);
  }

  async getNotificationsByAccount(accountId: string): Promise<Notification[]> {
    return Array.from(this.notifications.values()).filter(n => n.accountId === accountId);
  }

  async getContactsByAccount(accountId: string): Promise<Contact[]> {
    return Array.from(this.contacts.values()).filter(c => c.accountId === accountId);
  }

  async getContactListsByAccount(accountId: string): Promise<ContactList[]> {
    return Array.from(this.contactLists.values()).filter(l => l.accountId === accountId);
  }

  async deleteContactList(id: string): Promise<boolean> {
    return this.contactLists.delete(id);
  }

  async getContactTagsByAccount(accountId: string): Promise<ContactTag[]> {
    return Array.from(this.contactTags.values()).filter(t => t.accountId === accountId);
  }

  async deleteContactTag(id: string): Promise<boolean> {
    return this.contactTags.delete(id);
  }

  async getConversationsByAccount(accountId: string): Promise<Conversation[]> {
    return Array.from(this.conversations.values()).filter(c => c.accountId === accountId);
  }

  async deleteConversation(id: string): Promise<boolean> {
    this.conversationMessages.delete(id);
    return this.conversations.delete(id);
  }

  async getApiSettings(): Promise<ApiSettings | undefined> {
    return this.settings;
  }

  async deleteApiSettings(): Promise<boolean> {
    if (this.settings) {
      this.settings = undefined;
      return true;
    }
    return false;
  }
}

export const storage = new MemStorage();
