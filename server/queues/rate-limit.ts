/**
 * Map Meta messaging tiers / throughput to a safe per-second send budget.
 * messaging_limit_tier is a 24h unique-conversation cap — we still pace MPS
 * so we never stampede the Cloud API. Throughput level (when present) can
 * raise the ceiling slightly.
 */
export function messagesPerSecondForAccount(opts: {
  messagingLimit?: number | null;
  throughputLevel?: string | null;
}): number {
  const limit = opts.messagingLimit ?? 0;
  const throughput = (opts.throughputLevel || "").toUpperCase();

  let mps: number;
  if (limit <= 0) {
    // Unknown tier — be conservative
    mps = 8;
  } else if (limit <= 250) {
    mps = 5;
  } else if (limit <= 1000) {
    mps = 10;
  } else if (limit <= 2000) {
    mps = 12;
  } else if (limit <= 10000) {
    mps = 20;
  } else if (limit <= 100000) {
    mps = 40;
  } else {
    mps = 50;
  }

  if (throughput === "HIGH" || throughput === "VERY_HIGH") {
    mps = Math.min(80, Math.round(mps * 1.5));
  }

  return Math.max(1, Math.min(mps, 50));
}

/** BullMQ worker limiter: max jobs completed per duration window. */
export function bullMqLimiterForAccount(opts: {
  messagingLimit?: number | null;
  throughputLevel?: string | null;
}): { max: number; duration: number } {
  const mps = messagesPerSecondForAccount(opts);
  // Each job sends up to PHONES_PER_JOB messages; budget jobs/sec accordingly.
  const phonesPerJob = 10;
  const jobsPerSec = Math.max(1, Math.ceil(mps / phonesPerJob));
  return { max: jobsPerSec, duration: 1000 };
}
