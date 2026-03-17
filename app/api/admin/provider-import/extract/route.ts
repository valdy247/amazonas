import { NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin";
import {
  findDuplicateProviderContact,
  normalizeImportedContactValue,
  type ProviderImportSource,
} from "@/lib/admin-provider-import";
import { extractProviderContactsFromImage } from "@/lib/openai";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

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
    const { admin } = await assertAdminRoute();
    const formData = await request.formData();
    const source = String(formData.get("source") || "").trim() as ProviderImportSource;
    const files = formData
      .getAll("files")
      .filter((entry): entry is File => entry instanceof File && entry.size > 0);

    if (!["messenger", "facebook", "instagram", "whatsapp", "email"].includes(source)) {
      return NextResponse.json({ error: "Fuente invalida." }, { status: 400 });
    }

    if (!files.length) {
      return NextResponse.json({ error: "Debes subir al menos una imagen." }, { status: 400 });
    }

    const rows: Array<{
      id: string;
      source: ProviderImportSource;
      value: string;
      preview: string;
      duplicateMessage: string | null;
      fileName: string;
    }> = [];
    const seen = new Set<string>();

    for (const file of files) {
      const bytes = Buffer.from(await file.arrayBuffer());
      const dataUrl = `data:${file.type || "image/jpeg"};base64,${bytes.toString("base64")}`;
      const extracted = await extractProviderContactsFromImage({ imageDataUrl: dataUrl, source });

      for (const rawValue of extracted) {
        const normalized = normalizeImportedContactValue(source, rawValue);

        if (!normalized || seen.has(`${source}:${normalized}`)) {
          continue;
        }

        seen.add(`${source}:${normalized}`);
        const draft = inferDraftFromSource(source, normalized);
        const duplicateMessage = await findDuplicateProviderContact(admin, {
          email: draft.email,
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
