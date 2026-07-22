import Razorpay from "razorpay";
import crypto from "crypto";

const PLAN_AMOUNT_PAISE = 79900; // ₹799.00
const PLAN_NAME = "WhatsApp Broadcast - Unlimited Messaging";

let client: Razorpay | null = null;

function getClient(): Razorpay {
  if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
    throw new Error("RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET must be set");
  }
  if (!client) {
    client = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return client;
}

// Finds the existing monthly ₹799 plan, or creates it if this is the first
// time a subscription is ever requested. Avoids needing the user to click
// through Razorpay's dashboard to set this up manually.
let cachedPlanId: string | null = null;

export async function getOrCreatePlanId(): Promise<string> {
  if (process.env.RAZORPAY_PLAN_ID) return process.env.RAZORPAY_PLAN_ID;
  if (cachedPlanId) return cachedPlanId;

  const razorpay = getClient();
  const existing = await razorpay.plans.all({ count: 100 });
  const match = existing.items.find(
    (p: any) => p.item?.name === PLAN_NAME && p.item?.amount === PLAN_AMOUNT_PAISE
  );
  if (match) {
    cachedPlanId = match.id;
    return match.id;
  }

  const created = await razorpay.plans.create({
    period: "monthly",
    interval: 1,
    item: {
      name: PLAN_NAME,
      amount: PLAN_AMOUNT_PAISE,
      currency: "INR",
      description: "Unlimited WhatsApp broadcast messaging, billed monthly",
    },
  } as any);
  cachedPlanId = created.id;
  return created.id;
}

export async function createSubscription(customerEmail: string, customerName: string) {
  const razorpay = getClient();
  const planId = await getOrCreatePlanId();

  const subscription = await razorpay.subscriptions.create({
    plan_id: planId,
    customer_notify: 1,
    total_count: 120, // 10 years of monthly cycles - effectively "until cancelled"
    notes: {
      email: customerEmail,
      name: customerName,
    },
  } as any);

  return subscription;
}

export function verifyWebhookSignature(rawBody: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_WEBHOOK_SECRET must be set");
  }
  const expected = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
}

export function verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new Error("RAZORPAY_KEY_SECRET must be set");
  }
  const expected = crypto
    .createHmac("sha256", secret)
    .update(`${orderId}|${paymentId}`)
    .digest("hex");
  return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature || ""));
}

export { PLAN_AMOUNT_PAISE };
