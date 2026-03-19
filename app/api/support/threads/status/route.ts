import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAdminAccess } from "@/lib/admin";
import { logActionAudit } from "@/lib/action-audit";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { translateMessage } from "@/lib/openai";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";

type UpdateSupportStatusBody = {
  threadId?: number;
  status?: string;
  priority?: string;
  assignToMe?: boolean;
};

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No se pudo validar tu sesion." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: me } = await admin.from("profiles").select("role, email, full_name, preferred_language").eq("id", user.id).single();
    if (!hasAdminAccess(me?.role, me?.email || user.email)) {
      return NextResponse.json({ error: "Solo admin." }, { status: 403 });
    }

    const rateLimitError = await rejectRateLimited({
      scope: "support_status",
      request,
      identifierParts: [user.id],
      limit: 30,
      windowSeconds: 300,
      message: "Estas haciendo demasiados cambios de soporte. Espera un momento.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as UpdateSupportStatusBody;
    const threadId = Number(body.threadId);
    const status = ["open", "in_progress", "resolved"].includes(String(body.status)) ? String(body.status) : null;
    const priority = ["low", "normal", "high"].includes(String(body.priority)) ? String(body.priority) : null;
    const assignToMe = body.assignToMe === true;

    if (!Number.isFinite(threadId) || (!status && !priority && !assignToMe)) {
      return NextResponse.json({ error: "Actualizacion invalida." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { data: thread } = await admin
      .from("support_threads")
      .select("id, user_id, assigned_admin_id")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: "No se encontro el caso de soporte." }, { status: 404 });
    }

    const updatePayload: Record<string, unknown> = {
      updated_at: now,
    };

    if (status) {
      updatePayload.status = status;
    }
    if (priority) {
      updatePayload.priority = priority;
    }
    if (assignToMe || status) {
      updatePayload.assigned_admin_id = user.id;
    }
    if (status && status !== "resolved") {
      updatePayload.last_activity_at = now;
    }
    if (assignToMe) {
      updatePayload.last_activity_at = now;
    }

    const { error } = await admin.from("support_threads").update(updatePayload).eq("id", threadId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (assignToMe && thread.assigned_admin_id !== user.id) {
      const actorName =
        typeof me?.full_name === "string" && me.full_name.trim()
          ? me.full_name.trim()
          : me?.email || user.email || "Support";
      const sourceLanguage = normalizeLanguage(me?.preferred_language);
      const targetLanguage = sourceLanguage === "en" ? ("es" as AppLanguage) : ("en" as AppLanguage);
      const body =
        sourceLanguage === "en" ? `${actorName} has taken your case.` : `${actorName} ha tomado su caso.`;
      const translations: Partial<Record<AppLanguage, string>> = {};

      if (targetLanguage !== sourceLanguage) {
        const translatedBody = await translateMessage({
          text: body,
          sourceLanguage,
          targetLanguage,
        });

        if (translatedBody) {
          translations[targetLanguage] = translatedBody;
        }
      }

      await admin.from("support_messages").insert({
        thread_id: threadId,
        sender_id: user.id,
        body,
        source_language: sourceLanguage,
        translations,
      });
    }

    await logActionAudit({
      actorId: user.id,
      action: "update_support_thread",
      metadata: {
        threadId,
        status,
        priority,
        assignToMe,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el estado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
