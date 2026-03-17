import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAdminAccess } from "@/lib/admin";
import { logActionAudit } from "@/lib/action-audit";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";

type SendSupportMessageBody = {
  threadId?: number;
  body?: string;
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

    const rateLimitError = await rejectRateLimited({
      scope: "support_messages",
      request,
      identifierParts: [user.id],
      limit: 20,
      windowSeconds: 300,
      message: "Estas enviando mensajes de soporte demasiado rapido. Espera un momento.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as SendSupportMessageBody;
    const threadId = Number(body.threadId);
    const message = String(body.body || "").trim();

    if (!Number.isFinite(threadId) || !message) {
      return NextResponse.json({ error: "Datos invalidos para soporte." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: me } = await admin.from("profiles").select("role, email").eq("id", user.id).single();
    const isAdmin = hasAdminAccess(me?.role, me?.email || user.email);
    const { data: thread } = await admin
      .from("support_threads")
      .select("id, user_id")
      .eq("id", threadId)
      .maybeSingle();

    if (!thread) {
      return NextResponse.json({ error: "No se encontro el caso de soporte." }, { status: 404 });
    }

    if (!isAdmin && thread.user_id !== user.id) {
      return NextResponse.json({ error: "No tienes acceso a este caso." }, { status: 403 });
    }

    const now = new Date().toISOString();
    const { data: insertedMessage, error: insertError } = await admin
      .from("support_messages")
      .insert({
        thread_id: threadId,
        sender_id: user.id,
        body: message,
      })
      .select("id, sender_id, body, created_at")
      .single();

    if (insertError || !insertedMessage) {
      return NextResponse.json({ error: insertError?.message || "No se pudo enviar el mensaje." }, { status: 500 });
    }

    const threadUpdate: Record<string, unknown> = {
      updated_at: now,
      last_activity_at: now,
    };

    if (isAdmin) {
      threadUpdate.assigned_admin_id = user.id;
      threadUpdate.status = "in_progress";
    }

    await admin.from("support_threads").update(threadUpdate).eq("id", threadId);

    await logActionAudit({
      actorId: user.id,
      action: isAdmin ? "support_message_admin" : "support_message_user",
      targetUserId: isAdmin ? thread.user_id : user.id,
      metadata: {
        threadId,
        messageId: insertedMessage.id,
      },
    });

    return NextResponse.json({ data: insertedMessage });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar el mensaje.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
