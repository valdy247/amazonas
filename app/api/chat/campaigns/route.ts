import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { mergeProfileData } from "@/lib/profile-data";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { normalizeInterestKeys } from "@/lib/onboarding";
import { translateMessage } from "@/lib/openai";
import { getLocalizedPushBody, getLocalizedPushTitle, sendPushNotificationToUser } from "@/lib/push";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";

type CampaignBody = {
  reviewerIds?: string[];
  message?: string;
  category?: string;
};

type ProfileLanguageRow = {
  id: string;
  preferred_language?: AppLanguage | null;
};

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const payload = (await request.json()) as CampaignBody;
    const reviewerIds = Array.from(
      new Set((payload.reviewerIds || []).filter((item): item is string => typeof item === "string" && item.trim().length > 0))
    ).slice(0, 200);
    const message = String(payload.message || "").trim();
    const category = typeof payload.category === "string" ? payload.category : "";

    if (!reviewerIds.length) {
      return NextResponse.json({ error: "No hay destinatarias para esta campana." }, { status: 400 });
    }

    if (!message) {
      return NextResponse.json({ error: "Escribe el mensaje antes de enviarlo." }, { status: 400 });
    }

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No se pudo validar tu sesion." }, { status: 401 });
    }

    const rateLimitError = await rejectRateLimited({
      scope: "chat_campaigns",
      request,
      identifierParts: [user.id],
      limit: 4,
      windowSeconds: 300,
      message: "Estas enviando campanas demasiado rapido. Espera unos minutos.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const admin = createAdminClient();
    const { data: providerProfile } = await admin
      .from("profiles")
      .select("id, full_name, role, profile_data, preferred_language")
      .eq("id", user.id)
      .single();

    if (!providerProfile || providerProfile.role !== "provider") {
      return NextResponse.json({ error: "Solo los proveedores pueden enviar campanas." }, { status: 403 });
    }

    const providerProfileData = mergeProfileData(providerProfile.profile_data);
    const providerSnapshot = {
      fullName:
        typeof providerProfile.full_name === "string" && providerProfile.full_name.trim()
          ? providerProfile.full_name
          : typeof user.user_metadata?.full_name === "string"
            ? user.user_metadata.full_name
            : "Provider",
      country: providerProfileData.country,
      interests: normalizeInterestKeys(providerProfileData.interests),
    };

    const { data: visibleReviewers } = await admin
      .from("profiles")
      .select("id, preferred_language, role, accepted_terms_at, profile_data")
      .in("id", reviewerIds)
      .in("role", ["reviewer", "tester"])
      .not("accepted_terms_at", "is", null);

    const eligibleReviewers = (visibleReviewers || []).filter((row) => mergeProfileData((row as { profile_data?: unknown }).profile_data).publicProfile);
    const eligibleReviewerIds = eligibleReviewers.map((row) => row.id);

    if (!eligibleReviewerIds.length) {
      return NextResponse.json({ error: "No hay resenadoras disponibles para esta campana." }, { status: 400 });
    }

    const { data: existingRequests } = await admin
      .from("reviewer_contact_requests")
      .select("id, reviewer_id, request_data, status")
      .eq("provider_id", user.id)
      .in("reviewer_id", eligibleReviewerIds)
      .neq("status", "declined");

    const existingByReviewer = new Map<string, { id: number; request_data?: unknown; status: string }>();
    for (const item of existingRequests || []) {
      existingByReviewer.set(String(item.reviewer_id), {
        id: Number(item.id),
        request_data: item.request_data,
        status: String(item.status),
      });
    }

    const now = new Date().toISOString();
    const requestsToCreate = eligibleReviewerIds
      .filter((reviewerId) => !existingByReviewer.has(reviewerId))
      .map((reviewerId) => ({
        provider_id: user.id,
        reviewer_id: reviewerId,
        status: "accepted",
        created_at: now,
        updated_at: now,
        last_activity_at: now,
        request_data: {
          providerSnapshot,
          category,
          productName: "",
        },
      }));

    if (requestsToCreate.length) {
      const { data: insertedRequests, error: insertRequestsError } = await admin
        .from("reviewer_contact_requests")
        .insert(requestsToCreate)
        .select("id, reviewer_id, request_data, status");

      if (insertRequestsError) {
        return NextResponse.json({ error: insertRequestsError.message }, { status: 500 });
      }

      for (const item of insertedRequests || []) {
        existingByReviewer.set(String(item.reviewer_id), {
          id: Number(item.id),
          request_data: item.request_data,
          status: String(item.status),
        });
      }
    }

    const participantRows = [{ id: providerProfile.id, preferred_language: providerProfile.preferred_language }, ...(eligibleReviewers as ProfileLanguageRow[])];
    const languageByUser = new Map<string, AppLanguage>();
    for (const row of participantRows) {
      languageByUser.set(String(row.id), normalizeLanguage(row.preferred_language));
    }

    const sourceLanguage = normalizeLanguage(providerProfile.preferred_language || user.user_metadata?.preferred_language);
    const messageRows: Array<{
      request_id: number;
      sender_id: string;
      body: string;
      source_language: AppLanguage;
      translations: Partial<Record<AppLanguage, string>>;
    }> = [];

    for (const reviewer of eligibleReviewers) {
      const requestMeta = existingByReviewer.get(String(reviewer.id));
      if (!requestMeta) {
        continue;
      }

      const targetLanguage = languageByUser.get(String(reviewer.id)) || ("es" as AppLanguage);
      const translations: Partial<Record<AppLanguage, string>> = {};
      const translatedBody = await translateMessage({
        text: message,
        sourceLanguage,
        targetLanguage,
      });

      if (translatedBody && targetLanguage !== sourceLanguage) {
        translations[targetLanguage] = translatedBody;
      }

      messageRows.push({
        request_id: requestMeta.id,
        sender_id: user.id,
        body: message,
        source_language: sourceLanguage,
        translations,
      });
    }

    if (messageRows.length) {
      const { error: insertMessagesError } = await admin.from("request_messages").insert(messageRows);
      if (insertMessagesError) {
        return NextResponse.json({ error: insertMessagesError.message }, { status: 500 });
      }

      const requestIds = messageRows.map((row) => row.request_id);
      for (const requestId of requestIds) {
        const current = Array.from(existingByReviewer.values()).find((item) => item.id === requestId);
        await admin
          .from("reviewer_contact_requests")
          .update({
            updated_at: now,
            last_activity_at: now,
            request_data: {
              ...(current?.request_data && typeof current.request_data === "object" ? current.request_data : {}),
              providerSnapshot,
              category,
              productName: "",
            },
          })
          .eq("id", requestId);
      }

      await Promise.allSettled(
        eligibleReviewers.map(async (reviewer) => {
          const requestMeta = existingByReviewer.get(String(reviewer.id));
          if (!requestMeta) {
            return;
          }

          const targetLanguage = languageByUser.get(String(reviewer.id)) || ("es" as AppLanguage);
          const translatedBody = await translateMessage({
            text: message,
            sourceLanguage,
            targetLanguage,
          });

          await sendPushNotificationToUser(String(reviewer.id), {
            title: getLocalizedPushTitle(targetLanguage),
            body: getLocalizedPushBody(targetLanguage, providerSnapshot.fullName, translatedBody || message),
            url: `/dashboard?section=messages&thread=${requestMeta.id}`,
            tag: `chat-${requestMeta.id}`,
          });
        })
      );
    }

    return NextResponse.json({
      data: {
        sentCount: messageRows.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo enviar la campana.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
