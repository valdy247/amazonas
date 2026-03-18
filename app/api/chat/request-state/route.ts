import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";

type SyncRequestDataBody = {
  mode: "sync_request_data";
  requestId?: number;
  requestData?: Record<string, unknown> | null;
};

type UpdateStatusBody = {
  mode: "update_status";
  requestId?: number;
  status?: "read" | "accepted" | "declined";
  responseMessage?: string | null;
};

type RequestStateBody = SyncRequestDataBody | UpdateStatusBody;

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
      scope: "chat_request_state",
      request,
      identifierParts: [user.id],
      limit: 60,
      windowSeconds: 60,
      message: "Demasiadas actualizaciones en poco tiempo. Espera un momento.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as RequestStateBody;
    const requestId = Number(body.requestId);

    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: "Solicitud invalida." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: chatRequest } = await admin
      .from("reviewer_contact_requests")
      .select("id, provider_id, reviewer_id, status, request_data")
      .eq("id", requestId)
      .maybeSingle();

    if (!chatRequest) {
      return NextResponse.json({ error: "No se encontro la solicitud." }, { status: 404 });
    }

    const isProvider = chatRequest.provider_id === user.id;
    const isReviewer = chatRequest.reviewer_id === user.id;

    if (!isProvider && !isReviewer) {
      return NextResponse.json({ error: "No tienes acceso a esta solicitud." }, { status: 403 });
    }

    if (body.mode === "sync_request_data") {
      const now = new Date().toISOString();
      const nextRequestData = body.requestData && typeof body.requestData === "object" ? body.requestData : {};
      const { error } = await admin
        .from("reviewer_contact_requests")
        .update({
          request_data: nextRequestData,
          updated_at: now,
          last_activity_at: now,
        })
        .eq("id", requestId);

      if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
      }

      return NextResponse.json({ ok: true });
    }

    if (!isReviewer) {
      return NextResponse.json({ error: "Solo el reseñador puede cambiar este estado." }, { status: 403 });
    }

    const nextStatus = body.status;
    if (!nextStatus || !["read", "accepted", "declined"].includes(nextStatus)) {
      return NextResponse.json({ error: "Estado invalido." }, { status: 400 });
    }

    const responseMessage = String(body.responseMessage || "").trim() || null;
    const now = new Date().toISOString();
    const { error: updateError } = await admin
      .from("reviewer_contact_requests")
      .update({
        status: nextStatus,
        response_message: responseMessage,
        updated_at: now,
        last_activity_at: now,
      })
      .eq("id", requestId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    if (nextStatus === "accepted" && responseMessage) {
      const { error: messageError } = await admin.from("request_messages").insert({
        request_id: requestId,
        sender_id: user.id,
        body: responseMessage,
      });

      if (messageError) {
        return NextResponse.json({ error: messageError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar la solicitud.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
