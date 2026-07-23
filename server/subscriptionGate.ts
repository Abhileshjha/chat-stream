import type { RequestHandler } from "express";
import { authStorage } from "./auth/storage";

const SUBSCRIPTION_REQUIRED_MESSAGE =
  "Your free trial has ended. Subscribe for ₹799/month to keep sending messages.";

// Checks whether a user is allowed to send messages right now: super admins
// and users with granted free access always can, paid+active subscribers
// can, and trial users can until their trial end date passes. Everyone else
// (lapsed trial, inactive/cancelled subscription) is blocked from sending -
// but this only gates the send action, not read/manage access to their data.
export async function hasActiveSubscription(userId: string): Promise<boolean> {
  const user = await authStorage.getUser(userId);
  if (!user) return false;

  if (user.role === "super_admin") return true;
  if (user.grantedFreeAccess) return true;
  if (user.hasPaid && user.subscriptionStatus === "active") return true;
  if (user.subscriptionStatus === "trial" && user.trialEndsAt && new Date(user.trialEndsAt) > new Date()) {
    return true;
  }
  return false;
}

export const requireActiveSubscription: RequestHandler = async (req: any, res, next) => {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (await hasActiveSubscription(userId)) {
    return next();
  }

  return res.status(402).json({
    error: "subscription_required",
    message: SUBSCRIPTION_REQUIRED_MESSAGE,
  });
};

const EMAIL_VERIFICATION_REQUIRED_MESSAGE =
  "Please verify your email address before sending messages. Check your inbox for the verification link.";

// A trial account that never verifies its email can register but can never
// actually send - this is what keeps a bogus/throwaway signup from consuming
// messaging resources, without hard-blocking their ability to log in and look
// around first.
export const requireVerifiedEmail: RequestHandler = async (req: any, res, next) => {
  const userId = req.user?.claims?.sub;
  if (!userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const user = await authStorage.getUser(userId);
  if (!user) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  if (user.role === "super_admin" || user.emailVerified) {
    return next();
  }

  return res.status(403).json({
    error: "email_verification_required",
    message: EMAIL_VERIFICATION_REQUIRED_MESSAGE,
  });
};

export { SUBSCRIPTION_REQUIRED_MESSAGE, EMAIL_VERIFICATION_REQUIRED_MESSAGE };
