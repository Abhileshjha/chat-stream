import { sql } from "drizzle-orm";
import { index, jsonb, pgTable, timestamp, varchar, boolean } from "drizzle-orm/pg-core";

// User roles for the application
export type UserRole = "super_admin" | "admin" | "user";

// Subscription status types
export type SubscriptionStatus = "active" | "inactive" | "trial" | "cancelled";

// Session storage table.
// (IMPORTANT) This table is required by connect-pg-simple for Passport sessions, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// id is the Facebook profile id for users signed in via Facebook Login,
// or a generated uuid for users registered with email + password.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  passwordHash: varchar("password_hash"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  role: varchar("role", { length: 20 }).notNull().default("user"),
  subscriptionStatus: varchar("subscription_status", { length: 20 }).notNull().default("inactive"),
  subscriptionId: varchar("subscription_id"),
  hasPaid: boolean("has_paid").notNull().default(false),
  grantedFreeAccess: boolean("granted_free_access").notNull().default(false),
  trialEndsAt: timestamp("trial_ends_at"),
  razorpayCustomerId: varchar("razorpay_customer_id"),
  razorpaySubscriptionId: varchar("razorpay_subscription_id"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Visitor/page-view tracking for the admin analytics dashboard.
export const pageViews = pgTable(
  "page_views",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id").notNull(),
    userId: varchar("user_id"),
    path: varchar("path", { length: 500 }).notNull(),
    referrer: varchar("referrer", { length: 500 }),
    userAgent: varchar("user_agent", { length: 500 }),
    timestamp: timestamp("timestamp").defaultNow(),
  },
  (table) => [
    index("IDX_page_views_timestamp").on(table.timestamp),
    index("IDX_page_views_session").on(table.sessionId),
  ]
);

export type PageView = typeof pageViews.$inferSelect;
export type InsertPageView = typeof pageViews.$inferInsert;
