/**
 * Security headers, host canonicalization, and HSTS for production.
 * Preferred host comes from APP_URL (e.g. https://app.convora.tech).
 */
import type { Express, RequestHandler } from "express";

function preferredOrigin(): URL | null {
  const raw = (process.env.APP_URL || "").replace(/\/$/, "");
  if (!raw) return null;
  try {
    return new URL(raw);
  } catch {
    return null;
  }
}

export function registerSecurityAndCanonicalMiddleware(app: Express) {
  app.disable("x-powered-by");

  const securityHeaders: RequestHandler = (_req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");

    if (process.env.NODE_ENV === "production") {
      // 2 years, include subdomains, allow preload lists
      res.setHeader(
        "Strict-Transport-Security",
        "max-age=63072000; includeSubDomains; preload",
      );
    }
    next();
  };

  const canonicalHostRedirect: RequestHandler = (req, res, next) => {
    if (process.env.NODE_ENV !== "production") return next();

    const preferred = preferredOrigin();
    if (!preferred) return next();

    // Skip health checks and local probes
    if (req.path === "/healthz") return next();

    const forwardedProto = (req.headers["x-forwarded-proto"] as string | undefined)
      ?.split(",")[0]
      ?.trim();
    const proto = forwardedProto || req.protocol || "https";
    const hostHeader = (req.headers["x-forwarded-host"] as string | undefined) || req.headers.host || "";
    const requestHost = hostHeader.split(":")[0].toLowerCase();
    const preferredHost = preferred.hostname.toLowerCase();
    const preferredProto = preferred.protocol.replace(":", "");

    const hostMismatch = requestHost && requestHost !== preferredHost;
    const protoMismatch = proto !== preferredProto;

    if (hostMismatch || protoMismatch) {
      const target = `${preferred.origin}${req.originalUrl || "/"}`;
      return res.redirect(301, target);
    }

    next();
  };

  app.use(securityHeaders);
  app.use(canonicalHostRedirect);
}
