import { NextResponse } from "next/server";
import JSZip from "jszip";
import { hasAdminAccess } from "@/lib/admin";
import {
  findDuplicateProviderContact,
  normalizeImportedDraft,
  normalizeImportedContactValue,
  type ProviderImportSource,
} from "@/lib/admin-provider-import";
import { extractProviderContactsFromImage, extractProviderContactsFromText } from "@/lib/openai";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function parseCsvRecords(text: string) {
  const rows: string[][] = [];
  let currentField = "";
  let currentRow: string[] = [];
  let insideQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const nextChar = text[index + 1];

    if (char === "\"") {
      if (insideQuotes && nextChar === "\"") {
        currentField += "\"";
        index += 1;
      } else {
        insideQuotes = !insideQuotes;
      }
      continue;
    }

    if (char === "," && !insideQuotes) {
      currentRow.push(currentField);
      currentField = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        index += 1;
      }
      currentRow.push(currentField);
      rows.push(currentRow);
      currentField = "";
      currentRow = [];
      continue;
    }

    currentField += char;
  }

  if (currentField.length || currentRow.length) {
    currentRow.push(currentField);
    rows.push(currentRow);
  }

  return rows;
}

function extractContactsFromCsvText(text: string) {
  const parsed = parseCsvRecords(text);
  if (!parsed.length) {
    return [];
  }

  const [header, ...records] = parsed;
  const lowerHeader = header.map((column) => column.trim().toLowerCase());
  const typeIndex = lowerHeader.indexOf("type");
  const valueIndex = lowerHeader.indexOf("value");

  if (typeIndex === -1 || valueIndex === -1) {
    throw new Error("El CSV debe incluir columnas type y value.");
  }

  return records
    .map((record) => ({
      type: String(record[typeIndex] || "").trim().toLowerCase(),
      value: String(record[valueIndex] || "").trim(),
    }))
    .filter((record) => record.type && record.value);
}

type ExtractedChatContact = {
  facebook?: string;
  whatsapp?: string;
  email?: string;
  preview: string;
};

function splitWhatsAppMessages(text: string) {
  const normalized = text.replace(/\u200e/g, "").replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const messages: string[] = [];
  let current = "";

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (/^\[\d{1,2}\/\d{1,2}\/\d{2,4}, .+?\]/.test(line)) {
      if (current.trim()) {
        messages.push(current.trim());
      }
      current = line;
      continue;
    }

    current = current ? `${current}\n${line}` : line;
  }

  if (current.trim()) {
    messages.push(current.trim());
  }

  return messages;
}

function extractChatBody(message: string) {
  const closing = message.indexOf("] ");
  if (closing === -1) {
    return message;
  }

  const afterTimestamp = message.slice(closing + 2);
  const authorSeparator = afterTimestamp.indexOf(": ");
  if (authorSeparator === -1) {
    return afterTimestamp;
  }

  return afterTimestamp.slice(authorSeparator + 2).trim();
}

function looksLikeProviderContext(text: string) {
  return /(proveedor|provider|prepago|prepay|paypal|zelle|activo|activa|paga antes|pay first|es proveedor|proveedora)/i.test(text);
}

function extractContactsFromChatText(text: string) {
  const messages = splitWhatsAppMessages(text);
  const results: ExtractedChatContact[] = [];

  for (const message of messages) {
    const body = extractChatBody(message);
    if (!body) {
      continue;
    }

    const facebookMatches = [...body.matchAll(/https?:\/\/(?:www\.)?facebook\.com\/[^\s<>"']+/gi)].map((match) => match[0]);
    const waMatches = [...body.matchAll(/https?:\/\/wa\.me\/[^\s<>"']+/gi)].map((match) => match[0]);
    const emailMatches = [...body.matchAll(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi)].map((match) => match[0]);
    const phoneMatches = [...body.matchAll(/(?:\+\d[\d\s().-]{7,}\d)/g)].map((match) => match[0]);
    const providerContext = looksLikeProviderContext(body);

    for (const facebook of facebookMatches) {
      results.push({ facebook, preview: body.slice(0, 220) });
    }

    if (providerContext) {
      for (const whatsapp of [...waMatches, ...phoneMatches]) {
        results.push({ whatsapp, preview: body.slice(0, 220) });
      }

      for (const email of emailMatches) {
        results.push({ email, preview: body.slice(0, 220) });
      }
    }
  }

  return results;
}

function inferDraftFromSource(source: ProviderImportSource, value: string) {
  switch (source) {
    case "messenger":
      return { messenger: value, preview: value };
    case "facebook":
      return { facebook: value, preview: value };
    case "instagram":
      return { instagram: value, preview: value.replace(/^https?:\/\/(www\.)?instagram\.com\//i, "") };
    case "whatsapp":
      return { whatsapp: value, preview: value };
    case "email":
      return { email: value, preview: value };
    case "bulk_text":
      return { preview: value };
    case "csv_contacts":
      return { preview: value };
    case "chat_export_zip":
      return { preview: value };
    default:
      return { preview: value };
  }
}

async function assertAdminRoute() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new Error("No autorizado");
  }

  const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();

  if (!hasAdminAccess(profile?.role, profile?.email || user.email)) {
    throw new Error("Solo admin");
  }

  return { userId: user.id, admin: createAdminClient() };
}

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const { userId, admin } = await assertAdminRoute();
    const formData = await request.formData();
    const source = String(formData.get("source") || "").trim() as ProviderImportSource;
    const text = String(formData.get("text") || "").trim();
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);
    const zipFile = formData.get("zip");

    if (!["messenger", "facebook", "instagram", "whatsapp", "email", "bulk_text", "csv_contacts", "chat_export_zip"].includes(source)) {
      return NextResponse.json({ error: "Fuente invalida." }, { status: 400 });
    }

    if ((source === "bulk_text" || source === "csv_contacts") && !text) {
      return NextResponse.json(
        { error: source === "csv_contacts" ? "Debes subir un CSV para procesarlo." : "Debes pegar texto para procesarlo." },
        { status: 400 }
      );
    }

    if (source === "chat_export_zip" && !(zipFile instanceof File && zipFile.size > 0)) {
      return NextResponse.json({ error: "Debes subir el ZIP del chat exportado." }, { status: 400 });
    }

    if (source !== "bulk_text" && source !== "csv_contacts" && source !== "chat_export_zip" && !files.length) {
      return NextResponse.json({ error: "Debes subir al menos una imagen." }, { status: 400 });
    }

    const rateLimitError = await rejectRateLimited({
      scope: "provider_import_extract",
      request,
      identifierParts: [userId],
      limit: 12,
      windowSeconds: 900,
      message: "Estas procesando demasiadas capturas en poco tiempo. Espera unos minutos.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const rows: Array<{
      id: string;
      source: ProviderImportSource;
      value: string;
      preview: string;
      duplicateMessage: string | null;
      fileName: string;
      email?: string | null;
      whatsapp?: string | null;
      facebook?: string | null;
      avatarBox?: { x: number; y: number; w: number; h: number } | null;
    }> = [];
    const seen = new Set<string>();

    if (source === "bulk_text") {
      const extracted = await extractProviderContactsFromText({ text });

      for (const contact of extracted) {
        const normalizedDraft = normalizeImportedDraft({
          email: contact.email,
          whatsapp: contact.whatsapp,
          facebook: contact.facebook,
        });

        const signature = [normalizedDraft.facebook, normalizedDraft.email, normalizedDraft.whatsapp].filter(Boolean).join("|");
        if (!signature || seen.has(signature)) {
          continue;
        }

        seen.add(signature);
        const duplicateMessage = await findDuplicateProviderContact(admin, {
          email: normalizedDraft.email,
          facebook: normalizedDraft.facebook,
          whatsapp: normalizedDraft.whatsapp,
        });

        rows.push({
          id: `bulk:${signature}`,
          source,
          value: signature,
          preview:
            [normalizedDraft.facebook ? `Facebook: ${normalizedDraft.facebook}` : null, normalizedDraft.email, normalizedDraft.whatsapp]
              .filter(Boolean)
              .join(" · ") || signature,
          duplicateMessage,
          fileName: "bulk-text",
          email: normalizedDraft.email || null,
          whatsapp: normalizedDraft.whatsapp || null,
          facebook: normalizedDraft.facebook || null,
        });
      }

      return NextResponse.json({ rows });
    }

    if (source === "csv_contacts") {
      const extracted = extractContactsFromCsvText(text);

      for (const contact of extracted) {
        const normalizedSource = (["facebook", "whatsapp", "email"].includes(contact.type) ? contact.type : "") as
          | "facebook"
          | "whatsapp"
          | "email"
          | "";

        if (!normalizedSource) {
          continue;
        }

        const normalized = normalizeImportedContactValue(normalizedSource, contact.value);
        if (!normalized) {
          continue;
        }

        const draft =
          normalizedSource === "facebook"
            ? normalizeImportedDraft({ facebook: normalized })
            : normalizedSource === "whatsapp"
              ? normalizeImportedDraft({ whatsapp: normalized })
              : normalizeImportedDraft({ email: normalized });

        const signature = [draft.facebook, draft.email, draft.whatsapp].filter(Boolean).join("|");
        if (!signature || seen.has(signature)) {
          continue;
        }

        seen.add(signature);
        const duplicateMessage = await findDuplicateProviderContact(admin, {
          email: draft.email,
          facebook: draft.facebook,
          whatsapp: draft.whatsapp,
        });

        rows.push({
          id: `csv:${signature}`,
          source,
          value: signature,
          preview:
            [
              draft.facebook ? `Facebook: ${draft.facebook}` : null,
              draft.email ? `Email: ${draft.email}` : null,
              draft.whatsapp ? `Telefono: ${draft.whatsapp}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || signature,
          duplicateMessage,
          fileName: "csv-contacts",
          email: draft.email || null,
          whatsapp: draft.whatsapp || null,
          facebook: draft.facebook || null,
        });
      }

      return NextResponse.json({ rows });
    }

    if (source === "chat_export_zip" && zipFile instanceof File) {
      const archive = await JSZip.loadAsync(await zipFile.arrayBuffer());
      const chatEntry =
        archive.file("_chat.txt") ||
        archive.file(/_chat\.txt$/i)[0] ||
        archive.file(/\.txt$/i)[0];

      if (!chatEntry) {
        return NextResponse.json({ error: "No encontramos _chat.txt dentro del ZIP." }, { status: 400 });
      }

      const chatText = await chatEntry.async("text");
      const extracted = extractContactsFromChatText(chatText);

      for (const contact of extracted) {
        const draft = normalizeImportedDraft({
          facebook: contact.facebook,
          whatsapp: contact.whatsapp,
          email: contact.email,
        });

        const signature = [draft.facebook, draft.email, draft.whatsapp].filter(Boolean).join("|");
        if (!signature || seen.has(signature)) {
          continue;
        }

        seen.add(signature);
        const duplicateMessage = await findDuplicateProviderContact(admin, {
          email: draft.email,
          facebook: draft.facebook,
          whatsapp: draft.whatsapp,
        });

        rows.push({
          id: `chat:${signature}`,
          source,
          value: signature,
          preview:
            [
              draft.facebook ? `Facebook: ${draft.facebook}` : null,
              draft.email ? `Email: ${draft.email}` : null,
              draft.whatsapp ? `Telefono: ${draft.whatsapp}` : null,
            ]
              .filter(Boolean)
              .join(" · ") || contact.preview,
          duplicateMessage,
          fileName: zipFile.name,
          email: draft.email || null,
          whatsapp: draft.whatsapp || null,
          facebook: draft.facebook || null,
        });
      }

      return NextResponse.json({ rows });
    }

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${file.type || "image/jpeg"};base64,${bytes.toString("base64")}`;
      const extracted = await extractProviderContactsFromImage({ imageDataUrl: dataUrl, source });

      for (const rawValue of extracted) {
        const normalized = normalizeImportedContactValue(source, rawValue.value);

        if (!normalized || seen.has(`${source}:${normalized}`)) {
          continue;
        }

        seen.add(`${source}:${normalized}`);
        const draft = inferDraftFromSource(source, normalized);
        const duplicateMessage = await findDuplicateProviderContact(admin, {
          email: draft.email,
          facebook: "facebook" in draft ? draft.facebook : undefined,
          instagram: draft.instagram,
          messenger: draft.messenger,
          whatsapp: draft.whatsapp,
        });

        rows.push({
          id: `${source}:${normalized}`,
          source,
          value: normalized,
          preview: draft.preview,
          duplicateMessage,
          fileName: file.name,
          avatarBox: rawValue.avatarBox,
        });
      }
    }

    return NextResponse.json({ rows });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudieron procesar las capturas.",
      },
      { status: 500 }
    );
  }
}
