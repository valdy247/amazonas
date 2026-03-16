import type { AppLanguage } from "@/lib/i18n";

export function getOpenAiApiKey() {
  return process.env.OPENAI_API_KEY || "";
}

export function getOpenAiTranslationModel() {
  return process.env.OPENAI_TRANSLATION_MODEL || "gpt-4o-mini";
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

  const nestedOutputText =
    Array.isArray(data.output)
      ? data.output
          .flatMap((item) => item.content || [])
          .map((item) => (typeof item.text === "string" ? item.text : ""))
          .find((item) => item.trim())
      : "";
  const translatedText =
    typeof data.output_text === "string" && data.output_text.trim()
      ? data.output_text.trim()
      : typeof nestedOutputText === "string"
        ? nestedOutputText.trim()
        : "";
  return translatedText || null;
}
