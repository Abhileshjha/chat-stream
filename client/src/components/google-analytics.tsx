import { useEffect } from "react";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

/**
 * Loads Google Analytics 4 when VITE_GA_MEASUREMENT_ID is set (e.g. G-XXXXXXXX).
 * No-op when the env var is missing so local/dev builds stay clean.
 */
export function GoogleAnalytics() {
  useEffect(() => {
    const measurementId = import.meta.env.VITE_GA_MEASUREMENT_ID as string | undefined;
    if (!measurementId || !measurementId.startsWith("G-")) return;
    if (document.getElementById("ga4-gtag")) return;

    window.dataLayer = window.dataLayer || [];
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer!.push(args);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, { anonymize_ip: true });

    const script = document.createElement("script");
    script.id = "ga4-gtag";
    script.async = true;
    script.src = `https://www.googletagmanager.com/gtag/js?id=${measurementId}`;
    document.head.appendChild(script);
  }, []);

  return null;
}
