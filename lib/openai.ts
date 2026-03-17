import type { AppLanguage } from "@/lib/i18n";
import type { ProviderImportSource } from "@/lib/admin-provider-import";

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || "";
}

export function getOpenAiTranslationModel() {
  return process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o-mini";
}

export function getOpenAiAssistModel() {
  return process.env.OPENAI_ASSIST_MODEL || getOpenAiTranslationModel();
}

function extractResponseText(data: {
  output_text?: string;
  output?: Array<{
    content?: Array<{
      type?: string;
      text?: string;
    }>;
  }>;
}) {
  const nestedOutputText =
    Array.isArray(data.output)
      ? data.output
          .flatMap((item) => item.content || [])
          .map((item) => (typeof item.text === "string" ? item.text : ""))
          .find((item) => item.trim())
      : "";

  return typeof data.output_text === "string" && data.output_text.trim()
    ? data.output_text.trim()
    : typeof nestedOutputText === "string"
      ? nestedOutputText.trim()
      : "";
}

function parseJsonObject<T>(raw: string): T | null {
  const direct = raw.trim();
  const fenced = direct.match(/```(?:json)?\s*([\s\S]+?)\s*```/i)?.[1]?.trim();
  const candidate = fenced || direct;

  try {
    return JSON.parse(candidate) as T;
  } catch {
    return null;
  }
}

export async function translateMessage(input: {
  text: string;
  sourceLanguage: AppLanguage;
  targetLanguage: AppLanguage;
}) {
  if (!input.text.trim() || input.sourceLanguage === input.targetLanguage || !getOpenAiApiKey()) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify({
      model: getOpenAiTranslationModel(),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "Translate the chat message for the recipient in a natural, conversational way. Preserve the sender's intent, tone, line breaks, emojis, product names, links, usernames, and brand names. Fix minor spelling, punctuation, or grammar mistakes only when needed to make the translation sound natural and clear. Do not invent facts or add information that is not in the original message. Return only the translated message text with no explanation.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Source language: ${input.sourceLanguage}\nTarget language: ${input.targetLanguage}\n\nMessage:\n${input.text}`,
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "No se pudo traducir el mensaje.");
  }

  const translatedText = extractResponseText(data);
  return translatedText || null;
}

export async function improveCampaignMessage(input: {
  text: string;
  language: AppLanguage;
}) {
  if (!input.text.trim() || !getOpenAiApiKey()) {
    return null;
  }

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify({
      model: getOpenAiAssistModel(),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                input.language === "en"
                  ? "Rewrite this outreach message for a provider contacting reviewers. Keep it warm, natural, concise, and trustworthy. Correct small mistakes, improve clarity, and keep the same language as the original message. Do not add facts, emojis, or explanations. Return only the improved message."
                  : "Reescribe este mensaje de alcance para un proveedor que quiere contactar reseñadoras. Debe sonar calido, natural, breve y confiable. Corrige pequenos errores, mejora la claridad y manten el mismo idioma del mensaje original. No agregues datos, emojis ni explicaciones. Devuelve solo el mensaje mejorado.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: input.text,
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "No se pudo mejorar el mensaje.");
  }

  const improvedText = extractResponseText(data);

  return improvedText || null;
}

export async function extractProviderContactsFromImage(input: {
  imageDataUrl: string;
  source: ProviderImportSource;
}) {
  if (!getOpenAiApiKey()) {
    throw new Error("Falta OPENAI_API_KEY para procesar capturas.");
  }

  const sourceLabel =
    input.source === "messenger"
      ? "Messenger"
      : input.source === "facebook"
        ? "Facebook"
      : input.source === "instagram"
        ? "Instagram"
        : input.source === "whatsapp"
          ? "WhatsApp"
          : "email";
  const extractionRule =
    input.source === "messenger"
      ? "Extract visible Messenger conversation names, usernames, or profile identifiers from the screenshot. Use one value per visible row. Ignore timestamps, snippets like 'You:' and app chrome. Return only the visible contact identifier text."
      : input.source === "facebook"
        ? "Extract visible Facebook profile names, usernames, or profile identifiers from the screenshot. Ignore timestamps, snippets, and app chrome. Return only the visible contact identifier text."
      : input.source === "instagram"
        ? "Extract only Instagram usernames visible in the screenshot. Return usernames only, without labels, @ symbols, or full URLs when possible."
        : input.source === "whatsapp"
          ? "Extract only WhatsApp phone numbers visible in the screenshot. Return the digits with country code when visible."
          : "Extract only email addresses visible in the screenshot.";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${getOpenAiApiKey()}`,
    },
    body: JSON.stringify({
      model: getOpenAiAssistModel(),
      input: [
        {
          role: "system",
          content: [
            {
              type: "input_text",
              text:
                "You extract provider contact handles from screenshots for an admin import tool. Return strict JSON only. Do not infer the platform. Ignore buttons, timestamps, counts, ads, and duplicated rows. If nothing valid is visible, return an empty array.",
            },
          ],
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: `Source platform selected by admin: ${sourceLabel}.\n${extractionRule}\nIf you can see a profile image next to a contact row, also return an approximate normalized avatar box for that row. Use numbers between 0 and 1. Return only JSON in this shape: {"contacts":[{"value":"value 1","avatar_box":{"x":0.1,"y":0.2,"w":0.08,"h":0.08}}]}`,
            },
            {
              type: "input_image",
              image_url: input.imageDataUrl,
            },
          ],
        },
      ],
    }),
    cache: "no-store",
  });

  const data = (await response.json()) as {
    output_text?: string;
    output?: Array<{
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
    error?: { message?: string };
  };

  if (!response.ok) {
    throw new Error(data.error?.message || "No se pudo procesar la captura.");
  }

  const parsed = parseJsonObject<{
    contacts?: Array<{
      value?: string;
      avatar_box?: { x?: number; y?: number; w?: number; h?: number };
    }>;
  }>(extractResponseText(data));
  return Array.isArray(parsed?.contacts)
    ? parsed.contacts
        .map((item) => ({
          value: String(item?.value || "").trim(),
          avatarBox:
            item?.avatar_box &&
            [item.avatar_box.x, item.avatar_box.y, item.avatar_box.w, item.avatar_box.h].every(
              (part) => typeof part === "number" && Number.isFinite(part)
            )
              ? {
                  x: Math.max(0, Math.min(1, Number(item.avatar_box.x))),
                  y: Math.max(0, Math.min(1, Number(item.avatar_box.y))),
                  w: Math.max(0, Math.min(1, Number(item.avatar_box.w))),
                  h: Math.max(0, Math.min(1, Number(item.avatar_box.h))),
                }
              : null,
        }))
        .filter((item) => item.value)
    : [];
}
