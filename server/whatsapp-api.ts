import type { TemplateComponent } from "@shared/schema";

const META_API_VERSION = "v18.0";
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

function buildMetaComponents(components: TemplateComponent[]): any[] {
  const metaComponents: any[] = [];

  for (const comp of components) {
    if (comp.type === "HEADER") {
      const header: any = { type: "HEADER" };
      if (comp.format === "TEXT") {
        header.format = "TEXT";
        header.text = comp.text || "";
      } else if (comp.format === "IMAGE") {
        header.format = "IMAGE";
        if (comp.mediaUrl) {
          header.example = { header_handle: [comp.mediaUrl] };
        }
      } else if (comp.format === "VIDEO") {
        header.format = "VIDEO";
        if (comp.mediaUrl) {
          header.example = { header_handle: [comp.mediaUrl] };
        }
      } else if (comp.format === "DOCUMENT") {
        header.format = "DOCUMENT";
        if (comp.mediaUrl) {
          header.example = { header_handle: [comp.mediaUrl] };
        }
      }
      metaComponents.push(header);
    } else if (comp.type === "BODY") {
      metaComponents.push({
        type: "BODY",
        text: comp.text || "",
      });
    } else if (comp.type === "FOOTER") {
      metaComponents.push({
        type: "FOOTER",
        text: comp.text || "",
      });
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
  components: TemplateComponent[]
): Promise<MetaApiResponse> {
  const metaComponents = buildMetaComponents(components);

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
