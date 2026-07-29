import { faqs, EMAIL_INFO, EMAIL_SUPPORT, HELP_NUMBER } from "./marketing-content";

/** Canonical production origin for marketing SEO. */
export const SITE_URL = "https://convora.tech";
export const SITE_NAME = "Convora";
export const DEFAULT_OG_IMAGE = `${SITE_URL}/og-image.jpg`;

export type SeoRobots = "index, follow" | "noindex, nofollow" | "noindex, follow";

export type SeoPageConfig = {
  path: string;
  title: string;
  description: string;
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
    name: "Convora",
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
    name: "Contact Convora",
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
    title: "WhatsApp Business API Platform for Teams | Convora",
    description:
      "Broadcast campaigns, approved templates, shared team inbox and live delivery analytics on the official Meta WhatsApp Business API. Start your free Convora trial today.",
    jsonLd: [softwareApplicationJsonLd()],
  },
  "/features": {
    path: "/features",
    title: "WhatsApp Marketing Features & Inbox | Convora",
    description:
      "Explore Convora features: broadcast campaigns, Meta template manager, shared inbox, contact lists, tags and real-time WhatsApp delivery analytics for growing teams.",
    jsonLd: [
      crumbs({ name: "Features", path: "/features" }),
      softwareApplicationJsonLd(),
    ],
  },
  "/trust": {
    path: "/trust",
    title: "Trusted Official Meta WhatsApp API | Convora",
    description:
      "Convora runs on the official Meta WhatsApp Business Platform. Transparent delivery, secure workspaces and reliable Cloud API messaging your customers can trust.",
    jsonLd: [crumbs({ name: "Trust", path: "/trust" })],
  },
  "/how-it-works": {
    path: "/how-it-works",
    title: "How WhatsApp Campaigns Work on Convora",
    description:
      "Connect Meta API, create approved templates, then launch and track WhatsApp broadcast campaigns in real time with Convora — from signup to first send in days.",
    jsonLd: [crumbs({ name: "How it works", path: "/how-it-works" })],
  },
  "/setup-guide": {
    path: "/setup-guide",
    title: "WhatsApp Business API Setup Guide | Convora",
    description:
      "Step-by-step guide to connect Meta Business, WhatsApp Cloud API, message templates and your first Convora campaign so your team can go live in days, not weeks.",
    jsonLd: [crumbs({ name: "Setup guide", path: "/setup-guide" })],
  },
  "/use-cases": {
    path: "/use-cases",
    title: "WhatsApp Business Use Cases for Teams | Convora",
    description:
      "See how sales, support and marketing teams use Convora for WhatsApp broadcasts, follow-ups, order notifications and shared inbox replies that convert conversations.",
    jsonLd: [crumbs({ name: "Use cases", path: "/use-cases" })],
  },
  "/proof": {
    path: "/proof",
    title: "WhatsApp Delivery Results & Campaign Proof",
    description:
      "Real delivery transparency on WhatsApp: sent, delivered, read and failed tracked live per campaign with Convora analytics so you always know what customers received.",
    jsonLd: [crumbs({ name: "Proof", path: "/proof" })],
  },
  "/pricing": {
    path: "/pricing",
    title: "WhatsApp API Pricing Plans & Free Trial",
    description:
      "Simple Convora plans for WhatsApp Business API broadcasting. Free trial included — Meta conversation fees billed at Meta rates with no platform markup on messages.",
    jsonLd: [
      crumbs({ name: "Pricing", path: "/pricing" }),
      softwareApplicationJsonLd(),
    ],
  },
  "/faq": {
    path: "/faq",
    title: "WhatsApp Business API FAQ Answered | Convora",
    description:
      "Answers about official WhatsApp Business API, Meta conversation charges, template approval times, shared team inbox and Convora free trials — clear and up to date.",
    jsonLd: [crumbs({ name: "FAQ", path: "/faq" }), faqPageJsonLd()],
  },
  "/contact": {
    path: "/contact",
    title: "Contact Convora Support | WhatsApp API Help",
    description:
      "Contact Convora for WhatsApp Business API setup, billing and support. Call +91 9217730926 or email info@convora.tech and support@convora.tech — we reply within 24 hours.",
    jsonLd: [crumbs({ name: "Contact", path: "/contact" }), contactPageJsonLd()],
  },
  "/privacy": {
    path: "/privacy",
    title: "Privacy Policy | Convora WhatsApp Platform",
    description:
      "How Convora collects, uses and protects personal data on our WhatsApp Business API broadcasting platform. Read our privacy practices before you create an account.",
    jsonLd: [crumbs({ name: "Privacy Policy", path: "/privacy" })],
  },
  "/terms": {
    path: "/terms",
    title: "Terms of Service | Convora WhatsApp Platform",
    description:
      "Terms governing use of Convora’s WhatsApp Business API platform, including accounts, acceptable use, billing, service limits and your responsibilities as a customer.",
    jsonLd: [crumbs({ name: "Terms of Service", path: "/terms" })],
  },
  "/refund": {
    path: "/refund",
    title: "Refund Policy for Convora Billing Plans",
    description:
      "Convora refund policy for subscription billing on our WhatsApp Business API platform. Learn when refunds apply, what is excluded, and how to request billing help.",
    jsonLd: [crumbs({ name: "Refund Policy", path: "/refund" })],
  },
  "/delete-data": {
    path: "/delete-data",
    title: "User Data Deletion Requests | Convora Privacy",
    description:
      "Request deletion of your Convora account and associated WhatsApp workspace data. Steps for GDPR-style user data removal requests, timelines and support contacts.",
    jsonLd: [crumbs({ name: "Data Deletion", path: "/delete-data" })],
  },
};

/** Auth pages: crawlable URL but noindex. */
export const AUTH_SEO: Record<string, SeoPageConfig> = {
  "/login": {
    path: "/login",
    title: "Log In | Convora",
    description: "Sign in to your Convora WhatsApp Business API workspace.",
    robots: "noindex, nofollow",
  },
  "/admin-login": {
    path: "/admin-login",
    title: "Admin Log In | Convora",
    description: "Admin sign-in for the Convora platform.",
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
