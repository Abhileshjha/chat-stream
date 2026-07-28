import { db } from "@db";
import {
  contacts,
  conversationMessages,
  conversations,
  messages,
  templates,
  teamMembers,
  whatsappAccounts,
} from "@shared/schema";
import type { User } from "@shared/models/auth";
import type { BillingPlan } from "@shared/billingPlans";
import { and, eq, gte, inArray, or, sql } from "drizzle-orm";
import { getBillingPlanById } from "./billingPlans";

export const TRIAL_DAYS = 3;
export const TRIAL_MAX_CONTACTS = 100;
export const TRIAL_MAX_MESSAGES_PER_DAY = 100;

export const TRIAL_CONTACT_LIMIT_MESSAGE = `Trial accounts can add up to ${TRIAL_MAX_CONTACTS} contacts. Subscribe to add more.`;
export const TRIAL_MESSAGE_LIMIT_MESSAGE = `Trial accounts can send up to ${TRIAL_MAX_MESSAGES_PER_DAY} messages per day. Subscribe to send more.`;

const MS_PER_TRIAL_DAY = 24 * 60 * 60 * 1000;

/** Cap trial at TRIAL_DAYS from signup — fixes accounts created with a longer trial. */
export function getEffectiveTrialEndsAt(user: User): Date | null {
  if (user.subscriptionStatus !== "trial" || !user.trialEndsAt) return null;

  const storedEnd = new Date(user.trialEndsAt);
  if (!user.createdAt) return storedEnd;

  const cappedEnd = new Date(new Date(user.createdAt).getTime() + TRIAL_DAYS * MS_PER_TRIAL_DAY);
  return storedEnd < cappedEnd ? storedEnd : cappedEnd;
}

export function isTrialUser(user: User): boolean {
  if (user.role === "super_admin" || user.grantedFreeAccess) return false;
  if (user.hasPaid && user.subscriptionStatus === "active") return false;

  const endsAt = getEffectiveTrialEndsAt(user);
  return user.subscriptionStatus === "trial" && !!endsAt && endsAt > new Date();
}

export function isPaidActiveUser(user: User): boolean {
  if (user.role === "super_admin" || user.grantedFreeAccess) return false;
  if (!(user.hasPaid && user.subscriptionStatus === "active")) return false;
  if (user.subscriptionEndsAt && new Date(user.subscriptionEndsAt) <= new Date()) {
    return false;
  }
  return true;
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

async function getUserAccountIds(userId: string): Promise<string[]> {
  const rows = await db
    .select({ id: whatsappAccounts.id })
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.userId, userId));
  return rows.map((row) => row.id);
}

export async function countUserContacts(userId: string): Promise<number> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return 0;

  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(contacts)
    .where(inArray(contacts.accountId, accountIds));

  return Number(row?.count) || 0;
}

export async function countUserMessagesSentToday(userId: string): Promise<number> {
  // Aggregate across ALL WhatsApp numbers owned by the user — sending 10k
  // from number A and 10k from number B both count toward the same daily cap.
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return 0;

  const since = startOfTodayUtc();

  const [broadcastRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(messages)
    .where(
      and(
        inArray(messages.accountId, accountIds),
        gte(messages.queuedAt, since),
        sql`${messages.status} <> 'failed'`,
      ),
    );

  const [inboxRow] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(conversationMessages)
    .innerJoin(conversations, eq(conversationMessages.conversationId, conversations.id))
    .where(
      and(
        inArray(conversations.accountId, accountIds),
        or(
          eq(conversationMessages.direction, "outbound"),
          eq(conversationMessages.direction, "outgoing"),
        ),
        gte(conversationMessages.sentAt, since),
      ),
    );

  return (Number(broadcastRow?.count) || 0) + (Number(inboxRow?.count) || 0);
}

export async function countUserWhatsappNumbers(userId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(whatsappAccounts)
    .where(eq(whatsappAccounts.userId, userId));
  return Number(row?.count) || 0;
}

export async function countUserTemplates(userId: string): Promise<number> {
  const accountIds = await getUserAccountIds(userId);
  if (accountIds.length === 0) return 0;
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(templates)
    .where(inArray(templates.accountId, accountIds));
  return Number(row?.count) || 0;
}

export async function countUserTeamSeats(accountId: string): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(teamMembers)
    .where(and(eq(teamMembers.accountId, accountId), sql`${teamMembers.status} <> 'revoked'`));
  // +1 for the owner seat
  return (Number(row?.count) || 0) + 1;
}

type LimitResult = { ok: true } | { ok: false; message: string; code: string };

async function resolvePlanLimits(user: User): Promise<{
  mode: "none" | "trial" | "plan";
  plan?: BillingPlan;
  maxContacts: number | null;
  maxMessagesPerDay: number | null;
  maxWhatsappNumbers: number | null;
  maxTemplates: number | null;
  maxTeamSeats: number | null;
}> {
  if (user.role === "super_admin" || user.grantedFreeAccess) {
    return {
      mode: "none",
      maxContacts: null,
      maxMessagesPerDay: null,
      maxWhatsappNumbers: null,
      maxTemplates: null,
      maxTeamSeats: null,
    };
  }

  if (isTrialUser(user)) {
    return {
      mode: "trial",
      maxContacts: TRIAL_MAX_CONTACTS,
      maxMessagesPerDay: TRIAL_MAX_MESSAGES_PER_DAY,
      maxWhatsappNumbers: 1,
      maxTemplates: null,
      maxTeamSeats: 1,
    };
  }

  if (isPaidActiveUser(user) && user.billingPlanId) {
    const plan = await getBillingPlanById(user.billingPlanId);
    if (plan) {
      return {
        mode: "plan",
        plan,
        maxContacts: plan.maxContacts,
        maxMessagesPerDay: plan.maxMessagesPerDay,
        maxWhatsappNumbers: plan.maxWhatsappNumbers,
        maxTemplates: plan.maxTemplates,
        maxTeamSeats: plan.maxTeamSeats,
      };
    }
  }

  return {
    mode: "none",
    maxContacts: null,
    maxMessagesPerDay: null,
    maxWhatsappNumbers: null,
    maxTemplates: null,
    maxTeamSeats: null,
  };
}

export async function getTrialUsage(userId: string) {
  const [contactCount, messagesSentToday] = await Promise.all([
    countUserContacts(userId),
    countUserMessagesSentToday(userId),
  ]);

  return {
    contactCount,
    contactLimit: TRIAL_MAX_CONTACTS,
    contactsRemaining: Math.max(0, TRIAL_MAX_CONTACTS - contactCount),
    messagesSentToday,
    messageDailyLimit: TRIAL_MAX_MESSAGES_PER_DAY,
    messagesRemainingToday: Math.max(0, TRIAL_MAX_MESSAGES_PER_DAY - messagesSentToday),
  };
}

export async function getPlanUsage(user: User) {
  const limits = await resolvePlanLimits(user);
  const [contactCount, messagesSentToday, whatsappNumbers, templateCount] = await Promise.all([
    countUserContacts(user.id),
    countUserMessagesSentToday(user.id),
    countUserWhatsappNumbers(user.id),
    countUserTemplates(user.id),
  ]);

  const remaining = (limit: number | null, used: number) =>
    limit == null ? null : Math.max(0, limit - used);

  return {
    mode: limits.mode,
    plan: limits.plan
      ? { id: limits.plan.id, name: limits.plan.name, priceLabel: limits.plan.priceLabel }
      : null,
    contactCount,
    contactLimit: limits.maxContacts,
    contactsRemaining: remaining(limits.maxContacts, contactCount),
    messagesSentToday,
    messageDailyLimit: limits.maxMessagesPerDay,
    messagesRemainingToday: remaining(limits.maxMessagesPerDay, messagesSentToday),
    whatsappNumbers,
    whatsappNumberLimit: limits.maxWhatsappNumbers,
    templateCount,
    templateLimit: limits.maxTemplates,
  };
}

export async function assertCanAddContacts(
  user: User,
  additionalContacts: number,
): Promise<LimitResult> {
  if (additionalContacts <= 0) return { ok: true };
  const limits = await resolvePlanLimits(user);
  if (limits.maxContacts == null) return { ok: true };

  const current = await countUserContacts(user.id);
  if (current + additionalContacts > limits.maxContacts) {
    return {
      ok: false,
      code: limits.mode === "trial" ? "trial_contact_limit" : "plan_contact_limit",
      message:
        limits.mode === "trial"
          ? TRIAL_CONTACT_LIMIT_MESSAGE
          : `Your ${limits.plan?.name ?? "current"} plan allows up to ${limits.maxContacts.toLocaleString("en-IN")} contacts. Upgrade to add more.`,
    };
  }
  return { ok: true };
}

export async function assertCanSendMessages(
  user: User,
  messageCount: number,
): Promise<LimitResult> {
  if (messageCount <= 0) return { ok: true };
  const limits = await resolvePlanLimits(user);
  if (limits.maxMessagesPerDay == null) return { ok: true };

  const sentToday = await countUserMessagesSentToday(user.id);
  if (sentToday + messageCount > limits.maxMessagesPerDay) {
    const remaining = Math.max(0, limits.maxMessagesPerDay - sentToday);
    return {
      ok: false,
      code: limits.mode === "trial" ? "trial_message_limit" : "plan_message_limit",
      message:
        remaining > 0
          ? `You can only send ${remaining} more message${remaining === 1 ? "" : "s"} today on your ${limits.mode === "trial" ? "trial" : "plan"}.`
          : limits.mode === "trial"
            ? TRIAL_MESSAGE_LIMIT_MESSAGE
            : `Your ${limits.plan?.name ?? "current"} plan allows ${limits.maxMessagesPerDay} messages per day. Upgrade to send more.`,
    };
  }
  return { ok: true };
}

export async function assertCanAddWhatsappNumber(user: User): Promise<LimitResult> {
  const limits = await resolvePlanLimits(user);
  if (limits.maxWhatsappNumbers == null) return { ok: true };

  const current = await countUserWhatsappNumbers(user.id);
  if (current >= limits.maxWhatsappNumbers) {
    return {
      ok: false,
      code: "plan_whatsapp_limit",
      message:
        limits.mode === "trial"
          ? "Trial accounts can connect 1 WhatsApp number. Subscribe to add more."
          : `Your ${limits.plan?.name ?? "current"} plan allows ${limits.maxWhatsappNumbers} WhatsApp number${limits.maxWhatsappNumbers === 1 ? "" : "s"}. Upgrade to add more.`,
    };
  }
  return { ok: true };
}

export async function assertCanCreateTemplate(user: User): Promise<LimitResult> {
  const limits = await resolvePlanLimits(user);
  if (limits.maxTemplates == null) return { ok: true };

  const current = await countUserTemplates(user.id);
  if (current >= limits.maxTemplates) {
    return {
      ok: false,
      code: "plan_template_limit",
      message: `Your ${limits.plan?.name ?? "current"} plan allows ${limits.maxTemplates} templates. Upgrade to create more.`,
    };
  }
  return { ok: true };
}

export async function assertCanAddTeamSeat(
  user: User,
  accountId: string,
): Promise<LimitResult> {
  const limits = await resolvePlanLimits(user);
  if (limits.maxTeamSeats == null) return { ok: true };

  const current = await countUserTeamSeats(accountId);
  if (current >= limits.maxTeamSeats) {
    return {
      ok: false,
      code: "plan_seat_limit",
      message: `Your ${limits.plan?.name ?? "current"} plan allows ${limits.maxTeamSeats} team seat${limits.maxTeamSeats === 1 ? "" : "s"}. Upgrade to invite more.`,
    };
  }
  return { ok: true };
}

/** Count how many imported rows would create new contacts (not updates). */
export async function countNewContactsForImport(
  accountId: string,
  phones: string[],
): Promise<number> {
  const uniquePhones = Array.from(new Set(phones.filter(Boolean)));
  if (uniquePhones.length === 0) return 0;

  const existingRows = await db
    .select({ phone: contacts.phone })
    .from(contacts)
    .where(and(eq(contacts.accountId, accountId), inArray(contacts.phone, uniquePhones)));

  const existing = new Set(existingRows.map((row) => row.phone));
  return uniquePhones.filter((phone) => !existing.has(phone)).length;
}
