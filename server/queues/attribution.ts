// Reports each batch of recipient phones to Sukriti CRM's bulk
// campaign-attribution endpoint as a campaign is enqueued, so a lead's
// eventual reply resolves to the right project even without a prior Lead
// for that phone there. See Sukriti's src/models/CampaignReplyAttribution.js
// and src/routes/internal.js for the receiving side and why this exists.
//
// Fire-and-forget by design, same as the inbound-message relay in routes.ts:
// a failure here must never slow down or fail the actual send pipeline.

const SUKRITI_INTERNAL_URL =
  process.env.SUKRITI_INTERNAL_URL || "https://sampark-backend-v2.onrender.com";

export function reportCampaignAttribution(params: {
  projectId: string | null | undefined;
  campaignId?: string;
  campaignName?: string;
  accountId?: string;
  phones: string[];
}): void {
  const secret = process.env.SUKRITI_INTERNAL_SECRET;
  if (!secret || !params.projectId || params.phones.length === 0) return;

  // Sukriti's schema caps a single call at 1000 phones; our chunks are
  // CONTACT_STREAM_PAGE_SIZE (500), but guard here too in case a caller
  // ever passes a larger batch directly.
  const MAX_PHONES = 1000;
  for (let i = 0; i < params.phones.length; i += MAX_PHONES) {
    const phones = params.phones.slice(i, i + MAX_PHONES);
    fetch(`${SUKRITI_INTERNAL_URL}/internal/campaign-attribution/bulk`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Internal-Secret": secret,
      },
      body: JSON.stringify({
        projectId: params.projectId,
        campaignId: params.campaignId,
        campaignName: params.campaignName,
        accountId: params.accountId,
        phones,
      }),
    }).catch((err) => {
      console.error("[attribution] Sukriti bulk-attribution call failed:", err.message);
    });
  }
}
