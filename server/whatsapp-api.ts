import type { TemplateComponent } from "@shared/schema";
import fs from "fs";
import path from "path";

const META_API_VERSION = "v21.0";
const META_API_BASE = `https://graph.facebook.com/${META_API_VERSION}`;

export interface MetaApiError {
  message: string;
  type: string;
  code: number;
  error_subcode?: number;
  fbtrace_id?: string;
}

export interface MetaApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: MetaApiError;
  rawStatus?: number;
}

async function metaApiRequest<T = any>(
  url: string,
  options: RequestInit = {}
): Promise<MetaApiResponse<T>> {
  try {
    const response = await fetch(url, options);
    const responseText = await response.text();

    let data: any;
    try {
      data = JSON.parse(responseText);
    } catch {
      return {
        success: false,
        error: {
          message: `Invalid JSON response: ${responseText.substring(0, 200)}`,
          type: "ParseError",
          code: -1,
        },
        rawStatus: response.status,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: data.error || {
          message: `HTTP ${response.status}: ${responseText.substring(0, 200)}`,
          type: "HttpError",
          code: response.status,
        },
        rawStatus: response.status,
      };
    }

    return { success: true, data: data as T };
  } catch (err: any) {
    return {
      success: false,
      error: {
        message: err.message || "Network error",
        type: "NetworkError",
        code: -1,
      },
    };
  }
}

export async function testConnection(
  phoneNumberId: string,
  accessToken: string
): Promise<MetaApiResponse> {
  return metaApiRequest(
    `${META_API_BASE}/${phoneNumberId}?access_token=${accessToken}`
  );
}

export async function uploadSessionMedia(
  appId: string,
  accessToken: string,
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<MetaApiResponse> {
  const fileSize = fileBuffer.length;

  const createSessionRes = await metaApiRequest<{ id: string }>(
    `${META_API_BASE}/${appId}/uploads?file_length=${fileSize}&file_type=${encodeURIComponent(mimeType)}&file_name=${encodeURIComponent(fileName)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!createSessionRes.success || !createSessionRes.data?.id) {
    console.error("Failed to create upload session:", createSessionRes.error);
    return createSessionRes;
  }

  const uploadSessionId = createSessionRes.data.id;

  const uploadRes = await metaApiRequest<{ h: string }>(
    `${META_API_BASE}/${uploadSessionId}`,
    {
      method: "POST",
      headers: {
        Authorization: `OAuth ${accessToken}`,
        "file_offset": "0",
        "Content-Type": mimeType,
      },
      body: fileBuffer,
    }
  );

  if (!uploadRes.success || !uploadRes.data?.h) {
    console.error("Failed to upload file data:", uploadRes.error);
    return uploadRes;
  }

  return {
    success: true,
    data: { handle: uploadRes.data.h },
  };
}

function buildMetaComponents(components: TemplateComponent[], mediaHandle?: string): any[] {
  const metaComponents: any[] = [];

  for (const comp of components) {
    if (comp.type === "HEADER") {
      const header: any = { type: "HEADER" };
      if (comp.format === "TEXT") {
        header.format = "TEXT";
        header.text = comp.text || "";
        if (header.text && header.text.includes("{{")) {
          const varCount = (header.text.match(/\{\{\d+\}\}/g) || []).length;
          if (varCount > 0) {
            header.example = {
              header_text: Array(varCount).fill("Sample"),
            };
          }
        }
      } else if (["IMAGE", "VIDEO", "DOCUMENT"].includes(comp.format || "")) {
        header.format = comp.format;
        if (mediaHandle) {
          header.example = { header_handle: [mediaHandle] };
        }
      }
      metaComponents.push(header);
    } else if (comp.type === "BODY") {
      const bodyComp: any = {
        type: "BODY",
        text: comp.text || "",
      };
      if (bodyComp.text && bodyComp.text.includes("{{")) {
        const varCount = (bodyComp.text.match(/\{\{\d+\}\}/g) || []).length;
        if (varCount > 0) {
          bodyComp.example = {
            body_text: [Array(varCount).fill("Sample")],
          };
        }
      }
      metaComponents.push(bodyComp);
    } else if (comp.type === "FOOTER") {
      if (comp.text && comp.text.trim()) {
        metaComponents.push({
          type: "FOOTER",
          text: comp.text,
        });
      }
    } else if (comp.type === "BUTTONS" && comp.buttons) {
      metaComponents.push({
        type: "BUTTONS",
        buttons: comp.buttons.map((btn) => {
          if (btn.type === "QUICK_REPLY") {
            return { type: "QUICK_REPLY", text: btn.text };
          } else if (btn.type === "URL") {
            return { type: "URL", text: btn.text, url: btn.url };
          } else if (btn.type === "PHONE_NUMBER") {
            return {
              type: "PHONE_NUMBER",
              text: btn.text,
              phone_number: btn.phoneNumber,
            };
          }
          return { type: btn.type, text: btn.text };
        }),
      });
    }
  }

  return metaComponents;
}

export async function createTemplate(
  wabaId: string,
  accessToken: string,
  name: string,
  category: string,
  language: string,
  components: TemplateComponent[],
  appId?: string
): Promise<MetaApiResponse> {
  let mediaHandle: string | undefined;

  const headerComp = components.find(c => c.type === "HEADER");
  if (headerComp && ["IMAGE", "VIDEO", "DOCUMENT"].includes(headerComp.format || "")) {
    if (headerComp.mediaUrl) {
      const localFilePath = headerComp.mediaUrl.startsWith("/uploads/")
        ? path.join(process.cwd(), "uploads", path.basename(headerComp.mediaUrl))
        : null;

      if (localFilePath && fs.existsSync(localFilePath)) {
        const fileBuffer = fs.readFileSync(localFilePath);
        const ext = path.extname(localFilePath).toLowerCase();
        const mimeMap: Record<string, string> = {
          ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
          ".mp4": "video/mp4", ".3gp": "video/3gpp",
          ".pdf": "application/pdf", ".doc": "application/msword",
          ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        };
        const mimeType = mimeMap[ext] || "application/octet-stream";
        const effectiveAppId = appId || wabaId;

        console.log(`Uploading media to Meta for template header: ${localFilePath}`);
        const uploadResult = await uploadSessionMedia(
          effectiveAppId,
          accessToken,
          fileBuffer,
          mimeType,
          path.basename(localFilePath)
        );

        if (uploadResult.success && uploadResult.data?.handle) {
          mediaHandle = uploadResult.data.handle;
          console.log("Media uploaded successfully, handle:", mediaHandle);
        } else {
          console.error("Media upload to Meta failed:", uploadResult.error);
          return {
            success: false,
            error: {
              message: `Failed to upload media to Meta: ${uploadResult.error?.message || "Unknown error"}. Please try again or use a different media file.`,
              type: "MediaUploadError",
              code: -1,
            },
          };
        }
      } else {
        console.warn("Media file not found locally, submitting template without media sample:", headerComp.mediaUrl);
      }
    }
  }

  const metaComponents = buildMetaComponents(components, mediaHandle);

  const hasBody = metaComponents.some(c => c.type === "BODY" && c.text && c.text.trim());
  if (!hasBody) {
    return {
      success: false,
      error: {
        message: "Template body text is required. Please add body text before submitting.",
        type: "ValidationError",
        code: -1,
      },
    };
  }

  const payload = {
    name: name.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
    category: category.toUpperCase(),
    language: language,
    components: metaComponents,
  };

  console.log(
    "Submitting template to Meta API:",
    JSON.stringify(payload, null, 2)
  );

  return metaApiRequest(`${META_API_BASE}/${wabaId}/message_templates`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function deleteTemplate(
  wabaId: string,
  accessToken: string,
  templateName: string
): Promise<MetaApiResponse> {
  return metaApiRequest(
    `${META_API_BASE}/${wabaId}/message_templates?name=${encodeURIComponent(templateName)}`,
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

export async function getTemplates(
  wabaId: string,
  accessToken: string
): Promise<MetaApiResponse> {
  return metaApiRequest(
    `${META_API_BASE}/${wabaId}/message_templates?limit=100&fields=id,name,status,category,language,components,quality_score,rejected_reason`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );
}

export async function sendTemplateMessage(
  phoneNumberId: string,
  accessToken: string,
  recipientPhone: string,
  templateName: string,
  templateLanguage: string,
  headerParams?: any[],
  bodyParams?: any[],
  buttonParams?: any[]
): Promise<MetaApiResponse> {
  const template: any = {
    name: templateName,
    language: { code: templateLanguage },
  };

  const templateComponents: any[] = [];

  if (headerParams && headerParams.length > 0) {
    templateComponents.push({
      type: "header",
      parameters: headerParams,
    });
  }

  if (bodyParams && bodyParams.length > 0) {
    templateComponents.push({
      type: "body",
      parameters: bodyParams,
    });
  }

  if (buttonParams && buttonParams.length > 0) {
    for (let i = 0; i < buttonParams.length; i++) {
      templateComponents.push({
        type: "button",
        sub_type: buttonParams[i].sub_type || "quick_reply",
        index: i.toString(),
        parameters: [buttonParams[i].parameter],
      });
    }
  }

  if (templateComponents.length > 0) {
    template.components = templateComponents;
  }

  const payload = {
    messaging_product: "whatsapp",
    to: recipientPhone.replace(/[^0-9]/g, ""),
    type: "template",
    template,
  };

  console.log(
    "Sending template message via Meta API:",
    JSON.stringify(payload, null, 2)
  );

  return metaApiRequest(`${META_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function sendTextMessage(
  phoneNumberId: string,
  accessToken: string,
  recipientPhone: string,
  messageText: string
): Promise<MetaApiResponse> {
  const payload = {
    messaging_product: "whatsapp",
    to: recipientPhone.replace(/[^0-9]/g, ""),
    type: "text",
    text: { body: messageText },
  };

  return metaApiRequest(`${META_API_BASE}/${phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });
}

export async function uploadMedia(
  phoneNumberId: string,
  accessToken: string,
  fileBuffer: Buffer,
  mimeType: string,
  fileName: string
): Promise<MetaApiResponse> {
  const formData = new FormData();
  const blob = new Blob([fileBuffer], { type: mimeType });
  formData.append("file", blob, fileName);
  formData.append("messaging_product", "whatsapp");
  formData.append("type", mimeType);

  return metaApiRequest(`${META_API_BASE}/${phoneNumberId}/media`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
    body: formData,
  });
}

export async function getPhoneNumberAnalytics(
  phoneNumberId: string,
  accessToken: string
): Promise<MetaApiResponse> {
  const fields = "quality_rating,messaging_limit_tier,verified_name,display_phone_number,status";
  return metaApiRequest(
    `${META_API_BASE}/${phoneNumberId}?fields=${fields}&access_token=${accessToken}`
  );
}

export async function getWabaAnalytics(
  wabaId: string,
  accessToken: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<MetaApiResponse> {
  const granularity = "DAY";
  const url = `${META_API_BASE}/${wabaId}?fields=analytics.start(${startTimestamp}).end(${endTimestamp}).granularity(${granularity})&access_token=${accessToken}`;
  return metaApiRequest(url);
}

export async function getConversationAnalytics(
  wabaId: string,
  accessToken: string,
  startTimestamp: number,
  endTimestamp: number
): Promise<MetaApiResponse> {
  const granularity = "DAILY";
  const url = `${META_API_BASE}/${wabaId}?fields=conversation_analytics.start(${startTimestamp}).end(${endTimestamp}).granularity(${granularity}).conversation_type(FREE_ENTRY,FREE_TIER,REGULAR)&access_token=${accessToken}`;
  return metaApiRequest(url);
}

const whatsappApi = {
  testConnection,
  createTemplate,
  deleteTemplate,
  getTemplates,
  sendTemplateMessage,
  sendTextMessage,
  uploadMedia,
  uploadSessionMedia,
  subscribeAppToWaba,
  getPhoneNumberAnalytics,
  getWabaAnalytics,
  getConversationAnalytics,
};

export async function subscribeAppToWaba(
  wabaId: string,
  accessToken: string
): Promise<MetaApiResponse> {
  const url = `${META_API_BASE}/${wabaId}/subscribed_apps`;
  return metaApiRequest(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
  });
}

export async function registerWebhookWithMeta(
  appId: string,
  appSecret: string,
  callbackUrl: string,
  verifyToken: string
): Promise<MetaApiResponse> {
  const appAccessToken = `${appId}|${appSecret}`;
  const url = `${META_API_BASE}/${appId}/subscriptions`;
  
  const params = new URLSearchParams({
    object: "whatsapp_business_account",
    callback_url: callbackUrl,
    verify_token: verifyToken,
    fields: "messages,message_template_status_update",
    access_token: appAccessToken,
  });

  console.log(`[Meta Webhook] Registering webhook URL: ${callbackUrl} for app ${appId}`);

  return metaApiRequest(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: params.toString(),
  });
}

export async function getWebhookSubscriptions(
  appId: string,
  appSecret: string
): Promise<MetaApiResponse> {
  const appAccessToken = `${appId}|${appSecret}`;
  const url = `${META_API_BASE}/${appId}/subscriptions?access_token=${appAccessToken}`;
  return metaApiRequest(url);
}

export default whatsappApi;
