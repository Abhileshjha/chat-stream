/** One BullMQ queue per WhatsApp account (phone number). */
export function accountQueueName(accountId: string): string {
  // BullMQ forbids ":" in queue names.
  return `wa-send-account-${accountId}`;
}

export const ACTIVE_ACCOUNTS_KEY = "wa-send:active-accounts";
export const REMAINING_KEY_PREFIX = "wa-send:remaining:";
export const STATS_KEY_PREFIX = "wa-send:stats:";
export const BACKLOG_ALERT_KEY_PREFIX = "wa-send:backlog-alert:";

/** Phones per BullMQ job — keep jobs small so nothing huge sits in Redis/memory. */
export const PHONES_PER_JOB = 10;

/** How many jobs one account may run per fair-dispatcher cycle. */
export const JOBS_PER_ACCOUNT_CYCLE = 1;

/** Max account queues with live Workers at once (round-robin the rest). */
export const MAX_CONCURRENT_ACCOUNT_WORKERS = 20;

/** Concurrent Meta API calls inside a single batch job. */
export const SEND_CONCURRENCY_PER_JOB = 5;

/** Soft global ceiling for in-flight Meta sends across all workers. */
export const GLOBAL_SEND_CONCURRENCY = 40;

/** Contact page size when streaming recipients out of Postgres. */
export const CONTACT_STREAM_PAGE_SIZE = 500;

/** Meta rate-limit error codes that should trigger retry/backoff. */
export const META_RATE_LIMIT_CODES = new Set([4, 80007, 130429, 131048, 131056]);

export function remainingKey(campaignId: string): string {
  return `${REMAINING_KEY_PREFIX}${campaignId}`;
}

export function statsKey(accountId: string): string {
  return `${STATS_KEY_PREFIX}${accountId}`;
}
