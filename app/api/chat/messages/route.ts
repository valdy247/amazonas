import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { translateMessage } from "@/lib/openai";
import { getLocalizedPushBody, getLocalizedPushTitle, normalizePushLanguage, sendPushNotificationToUser } from "@/lib/push";
import { rejectUntrustedOrigin } from "@/lib/security";

type SendMessageBody = {
  requestId?: number;
  body?: string;
  imageUrl?: string | null;
  imagePath?: string | null;
  requestData?: Record<string, unknown> | null;
};

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const body = (await request.json()) as SendMessageBody;
    const requestId = Number(body.requestId);

    if (!Number.isFinite(requestId)) {
      return NextResponse.json({ error: "Request invalido." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No se pudo validar tu sesion." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: chatRequest } = await admin
      .from("reviewer_contact_requests")
      .select("id, provider_id, reviewer_id, status, request_data")
      .eq("id", requestId)
      .maybeSingle();

    if (!chatRequest) {
      return NextResponse.json({ error: "No se encontro la conversacion." }, { status: 404 });
    }

    if (chatRequest.status !== "accepted") {
      return NextResponse.json({ error: "Esta conversacion no esta disponible para mensajes." }, { status: 400 });
    }

    const isProvider = chatRequest.provider_id === user.id;
    const isReviewer = chatRequest.reviewer_id === user.id;

    if (!isProvider && !isReviewer) {
      return NextResponse.json({ error: "No tienes acceso a esta conversacion." }, { status: 403 });
    }

    const receiverId = isProvider ? chatRequest.reviewer_id : chatRequest.provider_id;
    const now = new Date().toISOString();
    const originalBody = String(body.body || "").trim();

    if (!originalBody && !body.imageUrl) {
      return NextResponse.json({ error: "Escribe un mensaje o adjunta una imagen." }, { status: 400 });
    }

    const recentMessagesResult = await admin
      .from("request_messages")
      .select("id, created_at")
      .eq("request_id", requestId)
      .eq("sender_id", user.id)
      .gte("created_at", new Date(Date.now() - 20 * 1000).toISOString());

    if ((recentMessagesResult.data || []).length >= 8) {
      return NextResponse.json({ error: "Estas enviando mensajes demasiado rapido. Espera unos segundos." }, { status: 429 });
    }

    const { data: participants } = await admin
      .from("profiles")
      .select("id, full_name, preferred_language")
      .in("id", [user.id, receiverId]);

    const languageByUser = new Map<string, AppLanguage>();
    const nameByUser = new Map<string, string>();

    for (const participant of participants || []) {
      languageByUser.set(String(participant.id), normalizeLanguage(participant.preferred_language));
      nameByUser.set(String(participant.id), typeof participant.full_name === "string" && participant.full_name.trim() ? participant.full_name.trim() : "Verifyzon");
    }

    async function resolveLanguageForUser(userId: string) {
      const { data: authUserResult, error: authUserError } = await admin.auth.admin.getUserById(userId);
      if (!authUserError) {
        const rawPreferredLanguage = authUserResult.user?.user_metadata?.preferred_language;
        if (typeof rawPreferredLanguage === "string") {
          return normalizeLanguage(rawPreferredLanguage);
        }
      }

      return languageByUser.get(userId) || ("es" as AppLanguage);
    }

    const sourceLanguage = await resolveLanguageForUser(user.id);
    const targetLanguage = await resolveLanguageForUser(receiverId);
    const translations: Partial<Record<AppLanguage, string>> = {};

    if (originalBody) {
      const translatedBody = await translateMessage({
        text: originalBody,
        sourceLanguage,
        targetLanguage,
      });

      if (translatedBody && targetLanguage !== sourceLanguage) {
        translations[targetLanguage] = translatedBody;
      }
    }

    const { data: insertedMessage, error: insertError } = await admin
      .from("request_messages")
      .insert({
        request_id: requestId,
        sender_id: user.id,
        body: originalBody,
        source_language: sourceLanguage,
        translations,
        image_url: body.imageUrl || null,
        image_path: body.imagePath || null,
      })
      .select("id, sender_id, body, source_language, translations, created_at, image_url, image_path")
      .single();

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    const nextRequestData = body.requestData && typeof body.requestData === "object" ? body.requestData : chatRequest.request_data;
    await admin
      .from("reviewer_contact_requests")
      .update({
        updated_at: now,
        last_activity_at: now,
        request_data: nextRequestData,
      })
      .eq("id", requestId);

    const localizedTargetLanguage = normalizePushLanguage(targetLanguage);
    const previewBody = translations[localizedTargetLanguage] || originalBody || (localizedTargetLanguage === "en" ? "New image" : "Nueva imagen");
    const senderName = nameByUser.get(user.id) || "Verifyzon";

    await sendPushNotificationToUser(receiverId, {
      title: getLocalizedPushTitle(localizedTargetLanguage),
      body: getLocalizedPushBody(localizedTargetLanguage, senderName, previewBody),
      url: `/dashboard?section=messages&thread=${requestId}`,
      tag: `chat-${requestId}`,
    });

    return NextResponse.json({
      data: {
        id: insertedMessage.id,
        sender_id: insertedMessage.sender_id,
        body: insertedMessage.body,
        source_language: insertedMessage.source_language,
        translations: insertedMessage.translations,
        created_at: insertedMessage.created_at,
        image_url: insertedMessage.image_url,
        image_path: insertedMessage.image_path,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar el mensaje.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
