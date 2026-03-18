import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { hasAdminAccess } from "@/lib/admin";
import { logActionAudit } from "@/lib/action-audit";
import {
  createProviderContactRecord,
  normalizeImportedContactValue,
  type ProviderImportSource,
} from "@/lib/admin-provider-import";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type ImportRow = {
  value: string;
  avatarDataUrl?: string | null;
  email?: string | null;
  whatsapp?: string | null;
  facebook?: string | null;
};

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

function buildDraftFromSource(source: ProviderImportSource, rawValue: string) {
  const value = normalizeImportedContactValue(source, rawValue);

  switch (source) {
    case "messenger":
      return { messenger: value };
    case "facebook":
      return { facebook: value };
    case "instagram":
      return { instagram: value };
    case "whatsapp":
      return { whatsapp: value };
    case "email":
      return { email: value };
    case "bulk_text":
    case "csv_contacts":
      return {};
    default:
      return {};
  }
}

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const { userId, admin } = await assertAdminRoute();
    const body = (await request.json()) as {
      source?: ProviderImportSource;
      rows?: ImportRow[];
      isVerified?: boolean;
    };
    const source = body.source;
    const rows = Array.isArray(body.rows) ? body.rows : [];

    if (!source || !["messenger", "facebook", "instagram", "whatsapp", "email", "bulk_text", "csv_contacts"].includes(source)) {
      return NextResponse.json({ error: "Fuente invalida." }, { status: 400 });
    }

    if (!rows.length) {
      return NextResponse.json({ error: "No hay filas para importar." }, { status: 400 });
    }

    const rateLimitError = await rejectRateLimited({
      scope: "provider_import_commit",
      request,
      identifierParts: [userId],
      limit: 8,
      windowSeconds: 900,
      message: "Estas importando proveedores demasiado rapido. Espera unos minutos.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const created: Array<{ value: string; alias: string }> = [];
    const skipped: Array<{ value: string; reason: string }> = [];

    for (const row of rows) {
      const value = String(row.value || "").trim();
      const normalized = normalizeImportedContactValue(source, value);

      if (!normalized) {
        continue;
      }

      try {
        const alias = await createProviderContactRecord(admin, userId, {
          ...(source === "bulk_text" || source === "csv_contacts"
            ? {
                email: String(row.email || "").trim(),
                whatsapp: String(row.whatsapp || "").trim(),
                facebook: String(row.facebook || "").trim(),
              }
            : buildDraftFromSource(source, normalized)),
          avatarDataUrl: row.avatarDataUrl || null,
          notes:
            source === "bulk_text"
              ? "Importado con IA desde texto masivo."
              : source === "csv_contacts"
                ? "Importado desde CSV de contactos."
                : `Importado con IA desde capturas de ${source}.`,
          isVerified: Boolean(body.isVerified),
        });
        created.push({ value: normalized, alias });
      } catch (error) {
        skipped.push({
          value: normalized,
          reason: error instanceof Error ? error.message : "No se pudo importar.",
        });
      }
    }

    revalidatePath("/admin");
    revalidatePath("/dashboard");

    await logActionAudit({
      actorId: userId,
      action: "import_provider_contacts",
      metadata: {
        source,
        requestedRows: rows.length,
        createdCount: created.length,
        skippedCount: skipped.length,
        createdValues: created.map((item) => item.value),
      },
    });

    return NextResponse.json({
      created,
      skipped,
      summary: `Importados ${created.length} proveedores. ${skipped.length ? `Se omitieron ${skipped.length}.` : ""}`.trim(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "No se pudo completar la importacion.",
      },
      { status: 500 }
    );
  }
}
