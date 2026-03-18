import { NextResponse } from "next/server";
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

    if (!["messenger", "facebook", "instagram", "whatsapp", "email", "bulk_text", "csv_contacts"].includes(source)) {
      return NextResponse.json({ error: "Fuente invalida." }, { status: 400 });
    }

    if ((source === "bulk_text" || source === "csv_contacts") && !text) {
      return NextResponse.json(
        { error: source === "csv_contacts" ? "Debes subir un CSV para procesarlo." : "Debes pegar texto para procesarlo." },
        { status: 400 }
      );
    }

    if (source !== "bulk_text" && source !== "csv_contacts" && !files.length) {
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
