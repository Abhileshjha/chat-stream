import { 
  type User, type InsertUser,
  type Template, type InsertTemplate,
  type Campaign, type InsertCampaign,
  type Message, type InsertMessage,
  type CampaignMetrics, type InsertCampaignMetrics,
  type DashboardMetrics, type ActivityItem, type ApiSettings
} from "@shared/schema";
import { randomUUID } from "crypto";

export interface IStorage {
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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
  private users: Map<string, User>;
  private templates: Map<string, Template>;
  private campaigns: Map<string, Campaign>;
  private messages: Map<string, Message>;
  private campaignMetrics: Map<string, CampaignMetrics>;
  private activities: ActivityItem[];
  private settings: ApiSettings | undefined;

  constructor() {
    this.users = new Map();
    this.templates = new Map();
    this.campaigns = new Map();
    this.messages = new Map();
    this.campaignMetrics = new Map();
    this.activities = [];
    this.settings = undefined;

    // Seed with sample data
    this.seedData();
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
  }

  // Users
  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
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
      messagingLimit: 100000,
      messagingUsed: messages.length,
      qualityRating: "GREEN",
      apiStatus: this.settings ? "connected" : "disconnected",
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
}

export const storage = new MemStorage();
