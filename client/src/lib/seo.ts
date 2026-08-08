import { faqs, EMAIL_INFO, EMAIL_SUPPORT, HELP_NUMBER } from "./marketing-content";

/** Canonical production origin — must match the live app host. */
export const SITE_URL = "https://app.convora.tech";
export const SITE_NAME = "Chat Stream";
export const SITE_AUTHOR = "Chat Stream";
export const SITE_PUBLISHER = "Chat Stream";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export const DEFAULT_KEYWORDS =
  "WhatsApp Business API, WhatsApp marketing, WhatsApp broadcast, WhatsApp campaigns, Meta Cloud API, WhatsApp inbox, message templates, Chat Stream";

export type SeoRobots = "index, follow" | "noindex, nofollow" | "noindex, follow";

export type SeoPageConfig = {
  path: string;
  title: string;
  description: string;
  keywords?: string;
  robots?: SeoRobots;
  ogType?: "website" | "article";
  /** Extra JSON-LD objects beyond Organization (merged into script array). */
  jsonLd?: Record<string, unknown>[];
};

function absoluteUrl(path: string): string {
  if (path === "/") return `${SITE_URL}/`;
  return `${SITE_URL}${path.startsWith("/") ? path : `/${path}`}`;
}

export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: SITE_URL,
    logo: `${SITE_URL}/favicon.png`,
    email: EMAIL_INFO,
    telephone: `+91-${HELP_NUMBER}`,
    sameAs: [],
    contactPoint: [
      {
        "@type": "ContactPoint",
        telephone: `+91-${HELP_NUMBER}`,
        contactType: "customer support",
        email: EMAIL_SUPPORT,
        availableLanguage: ["English", "Hindi"],
      },
    ],
  };
}

export function softwareApplicationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "Chat Stream",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description:
      "WhatsApp Business API platform for broadcast campaigns, templates, shared inbox, and real-time delivery analytics.",
    offers: {
      "@type": "Offer",
      url: `${SITE_URL}/pricing`,
      priceCurrency: "INR",
      availability: "https://schema.org/InStock",
    },
    provider: {
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
    },
  };
}

export function breadcrumbJsonLd(
  items: Array<{ name: string; path: string }>,
): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqPageJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: {
        "@type": "Answer",
        text: item.a,
      },
    })),
  };
}

export function contactPageJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "ContactPage",
    name: "Contact Chat Stream",
    url: `${SITE_URL}/contact`,
    mainEntity: {
      "@type": "Organization",
      name: SITE_NAME,
      email: EMAIL_INFO,
      telephone: `+91-${HELP_NUMBER}`,
    },
  };
}

function crumbs(...trail: Array<{ name: string; path: string }>) {
  return breadcrumbJsonLd([{ name: "Home", path: "/" }, ...trail]);
}

/** SEO for public content / marketing pages only. */
export const CONTENT_SEO: Record<string, SeoPageConfig> = {
  "/": {
    path: "/",
    title: "WhatsApp Business API Platform for Teams | Chat Stream",
    description:
      "Broadcast WhatsApp campaigns with Meta-approved templates, shared team inbox and live delivery analytics. Start free with Chat Stream.",
    keywords: DEFAULT_KEYWORDS,
    jsonLd: [softwareApplicationJsonLd()],
  },
  "/features": {
    path: "/features",
    title: "WhatsApp Marketing Features & Inbox | Chat Stream",
    description:
      "Explore Chat Stream features: broadcast campaigns, Meta template manager, shared inbox, contact lists, tags and real-time WhatsApp delivery analytics for growing teams.",
    keywords:
      "WhatsApp marketing features, WhatsApp broadcast, WhatsApp shared inbox, Meta template manager, WhatsApp analytics, Chat Stream",
    jsonLd: [
      crumbs({ name: "Features", path: "/features" }),
      softwareApplicationJsonLd(),
    ],
  },
  "/trust": {
    path: "/trust",
    title: "Trusted Official Meta WhatsApp API | Chat Stream",
    description:
      "Chat Stream runs on the official Meta WhatsApp Business Platform. Transparent delivery, secure workspaces and reliable Cloud API messaging your customers can trust.",
    keywords:
      "official WhatsApp Business API, Meta Cloud API, WhatsApp trust, secure WhatsApp messaging, Chat Stream",
    jsonLd: [crumbs({ name: "Trust", path: "/trust" })],
  },
  "/how-it-works": {
    path: "/how-it-works",
    title: "How WhatsApp Campaigns Work on Chat Stream",
    description:
      "Connect Meta API, create approved templates, then launch and track WhatsApp broadcast campaigns in real time with Chat Stream — from signup to first send in days.",
    keywords:
      "how WhatsApp campaigns work, WhatsApp broadcast steps, Meta API setup, WhatsApp templates, Chat Stream",
    jsonLd: [crumbs({ name: "How it works", path: "/how-it-works" })],
  },
  "/setup-guide": {
    path: "/setup-guide",
    title: "WhatsApp Business API Setup Guide | Chat Stream",
    description:
      "Step-by-step guide to connect Meta Business, WhatsApp Cloud API, message templates and your first Chat Stream campaign so your team can go live in days, not weeks.",
    keywords:
      "WhatsApp Business API setup, Meta embedded signup, WABA setup guide, WhatsApp Cloud API, Chat Stream",
    jsonLd: [crumbs({ name: "Setup guide", path: "/setup-guide" })],
  },
  "/use-cases": {
    path: "/use-cases",
    title: "WhatsApp Business Use Cases for Teams | Chat Stream",
    description:
      "See how sales, support and marketing teams use Chat Stream for WhatsApp broadcasts, follow-ups, order notifications and shared inbox replies that convert conversations.",
    keywords:
      "WhatsApp use cases, WhatsApp for sales, WhatsApp customer support, WhatsApp notifications, Chat Stream",
    jsonLd: [crumbs({ name: "Use cases", path: "/use-cases" })],
  },
  "/proof": {
    path: "/proof",
    title: "WhatsApp Delivery Results & Campaign Proof",
    description:
      "Real delivery transparency on WhatsApp: sent, delivered, read and failed tracked live per campaign with Chat Stream analytics so you always know what customers received.",
    keywords:
      "WhatsApp delivery reports, WhatsApp read receipts, campaign analytics, message tracking, Chat Stream",
    jsonLd: [crumbs({ name: "Proof", path: "/proof" })],
  },
  "/pricing": {
    path: "/pricing",
    title: "WhatsApp API Pricing Plans & Free Trial",
    description:
      "Simple Chat Stream plans for WhatsApp Business API broadcasting. Free trial included — Meta conversation fees billed at Meta rates with no platform markup on messages.",
    keywords:
      "WhatsApp API pricing, WhatsApp Business API cost, Chat Stream plans, WhatsApp free trial, Meta conversation fees",
    jsonLd: [
      crumbs({ name: "Pricing", path: "/pricing" }),
      softwareApplicationJsonLd(),
    ],
  },
  "/faq": {
    path: "/faq",
    title: "WhatsApp Business API FAQ Answered | Chat Stream",
    description:
      "Answers about official WhatsApp Business API, Meta conversation charges, template approval times, shared team inbox and Chat Stream free trials — clear and up to date.",
    keywords:
      "WhatsApp Business API FAQ, Meta conversation charges, WhatsApp template approval, Chat Stream help",
    jsonLd: [crumbs({ name: "FAQ", path: "/faq" }), faqPageJsonLd()],
  },
  "/contact": {
    path: "/contact",
    title: "Contact Chat Stream Support | WhatsApp API Help",
    description:
      "Contact Chat Stream for WhatsApp Business API setup, billing and support. Call +91 9217730926 or email info@convora.tech and support@convora.tech — we reply within 24 hours.",
    keywords:
      "contact Chat Stream, WhatsApp API support, Chat Stream help desk, billing support, Chat Stream phone",
    jsonLd: [crumbs({ name: "Contact", path: "/contact" }), contactPageJsonLd()],
  },
  "/privacy": {
    path: "/privacy",
    title: "Privacy Policy | Chat Stream WhatsApp Platform",
    description:
      "How Chat Stream collects, uses and protects personal data on our WhatsApp Business API broadcasting platform. Read our privacy practices before you create an account.",
    keywords: "Chat Stream privacy policy, WhatsApp data privacy, personal data protection",
    jsonLd: [crumbs({ name: "Privacy Policy", path: "/privacy" })],
  },
  "/terms": {
    path: "/terms",
    title: "Terms of Service | Chat Stream WhatsApp Platform",
    description:
      "Terms governing use of Chat Stream’s WhatsApp Business API platform, including accounts, acceptable use, billing, service limits and your responsibilities as a customer.",
    keywords: "Chat Stream terms of service, WhatsApp platform terms, acceptable use policy",
    jsonLd: [crumbs({ name: "Terms of Service", path: "/terms" })],
  },
  "/refund": {
    path: "/refund",
    title: "Refund Policy for Chat Stream Billing Plans",
    description:
      "Chat Stream refund policy for subscription billing on our WhatsApp Business API platform. Learn when refunds apply, what is excluded, and how to request billing help.",
    keywords: "Chat Stream refund policy, WhatsApp API billing refund, subscription refund",
    jsonLd: [crumbs({ name: "Refund Policy", path: "/refund" })],
  },
  "/delete-data": {
    path: "/delete-data",
    title: "User Data Deletion Requests | Chat Stream Privacy",
    description:
      "Request deletion of your Chat Stream account and associated WhatsApp workspace data. Steps for GDPR-style user data removal requests, timelines and support contacts.",
    keywords: "data deletion request, GDPR delete account, Chat Stream delete data, WhatsApp data removal",
    jsonLd: [crumbs({ name: "Data Deletion", path: "/delete-data" })],
  },
};

/** Auth pages: crawlable URL but noindex. */
export const AUTH_SEO: Record<string, SeoPageConfig> = {
  "/login": {
    path: "/login",
    title: "Log In | Chat Stream",
    description: "Sign in to your Chat Stream WhatsApp Business API workspace.",
    robots: "noindex, nofollow",
  },
  "/admin-login": {
    path: "/admin-login",
    title: "Admin Log In | Chat Stream",
    description: "Admin sign-in for the Chat Stream platform.",
    robots: "noindex, nofollow",
  },
};

export function getContentSeo(pathname: string): SeoPageConfig | null {
  const path = pathname.split("?")[0] || "/";
  return CONTENT_SEO[path] ?? null;
}

export function buildCanonical(path: string): string {
  return absoluteUrl(path);
}
