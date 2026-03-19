import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAdminAccess } from "@/lib/admin";
import { normalizeLanguage, type AppLanguage } from "@/lib/i18n";
import { translateMessage } from "@/lib/openai";
import { SUPPORT_CATEGORIES } from "@/lib/support";
import { logActionAudit } from "@/lib/action-audit";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";

type CreateSupportThreadBody = {
  subject?: string;
  category?: string;
  message?: string;
};

type SupportThreadRow = {
  id: number;
  user_id: string;
  category: string;
  subject: string;
  status: string;
  priority: string | null;
  last_activity_at: string;
  assigned_admin_id: string | null;
};

type SupportMessageRow = {
  id: number;
  thread_id: number;
  sender_id: string;
  body: string;
  source_language: string | null;
  translations: Record<string, string> | null;
  created_at: string;
};

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No se pudo validar tu sesion." }, { status: 401 });
    }

    const admin = createAdminClient();
    const { data: me } = await admin
      .from("profiles")
      .select("role, email, full_name, preferred_language")
      .eq("id", user.id)
      .single();
    const isAdmin = hasAdminAccess(me?.role, me?.email || user.email);

    let query = admin
      .from("support_threads")
      .select("id, user_id, category, subject, status, priority, last_activity_at, assigned_admin_id")
      .order("last_activity_at", { ascending: false });

    if (!isAdmin) {
      query = query.eq("user_id", user.id);
    }

    const { data: supportThreadRows, error: threadError } = await query;

    if (threadError) {
      return NextResponse.json({ error: threadError.message }, { status: 500 });
    }

    const typedThreads = (supportThreadRows || []) as SupportThreadRow[];
    if (!typedThreads.length) {
      return NextResponse.json({ data: [] });
    }

    const supportIds = typedThreads.map((thread) => thread.id);
    const participantIds = Array.from(
      new Set(
        typedThreads.flatMap((thread) =>
          [thread.user_id, thread.assigned_admin_id].filter((value): value is string => Boolean(value))
        )
      )
    );

    const [{ data: supportMessageRows, error: messageError }, { data: supportProfiles, error: profileError }] =
      await Promise.all([
        admin
          .from("support_messages")
          .select("id, thread_id, sender_id, body, source_language, translations, created_at")
          .in("thread_id", supportIds)
          .order("created_at", { ascending: true }),
        participantIds.length
          ? admin.from("profiles").select("id, full_name, email").in("id", participantIds)
          : Promise.resolve({ data: [], error: null }),
      ]);

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    if (profileError) {
      return NextResponse.json({ error: profileError.message }, { status: 500 });
    }

    const profileMap = new Map(
      ((supportProfiles || []) as Array<{ id: string; full_name: string | null; email: string | null }>).map((profile) => [
        profile.id,
        profile,
      ])
    );

    const language = normalizeLanguage(me?.preferred_language);
    const supportLabel = language === "en" ? "Support" : "Soporte";
    const userLabel = language === "en" ? "User" : "Usuario";

    const data = typedThreads.map((thread) => {
      const profileForThread = profileMap.get(thread.user_id);
      return {
        id: thread.id,
        userId: thread.user_id,
        userName: profileForThread?.full_name || userLabel,
        userEmail: profileForThread?.email || "",
        subject: thread.subject,
        category: thread.category,
        status: thread.status,
        priority: thread.priority || "normal",
        lastActivityAt: thread.last_activity_at,
        assignedAdminId: thread.assigned_admin_id || null,
        assignedAdminName: thread.assigned_admin_id ? profileMap.get(thread.assigned_admin_id)?.full_name || supportLabel : null,
        messages: ((supportMessageRows || []) as SupportMessageRow[])
          .filter((message) => message.thread_id === thread.id)
          .map((message) => ({
            id: message.id,
            senderId: message.sender_id,
            senderName:
              message.sender_id === thread.user_id
                ? profileForThread?.full_name || userLabel
                : thread.assigned_admin_id && message.sender_id === thread.assigned_admin_id
                  ? profileMap.get(thread.assigned_admin_id)?.full_name || supportLabel
                  : supportLabel,
            body: message.body,
            sourceLanguage: normalizeLanguage(message.source_language),
            translations: message.translations || null,
            createdAt: message.created_at,
          })),
      };
    });

    return NextResponse.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudieron cargar los casos.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

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
      scope: "support_threads",
      request,
      identifierParts: [user.id],
      limit: 5,
      windowSeconds: 900,
      message: "Has creado demasiados casos en poco tiempo. Espera un momento.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    const body = (await request.json()) as CreateSupportThreadBody;
    const subject = String(body.subject || "").trim();
    const message = String(body.message || "").trim();
    const category = SUPPORT_CATEGORIES.includes(body.category as (typeof SUPPORT_CATEGORIES)[number])
      ? body.category
      : "general";

    if (!subject || !message) {
      return NextResponse.json({ error: "Completa el asunto y el primer mensaje." }, { status: 400 });
    }

    const admin = createAdminClient();
    const now = new Date().toISOString();
    const { data: me } = await admin.from("profiles").select("preferred_language").eq("id", user.id).single();
    const { data: thread, error: threadError } = await admin
      .from("support_threads")
      .insert({
        user_id: user.id,
        category,
        subject,
        status: "open",
        last_activity_at: now,
        updated_at: now,
      })
      .select("id")
      .single();

    if (threadError || !thread) {
      return NextResponse.json({ error: threadError?.message || "No se pudo crear el caso." }, { status: 500 });
    }

    const sourceLanguage = normalizeLanguage(me?.preferred_language);
    const targetLanguage = sourceLanguage === "en" ? ("es" as AppLanguage) : ("en" as AppLanguage);
    const translations: Partial<Record<AppLanguage, string>> = {};

    if (targetLanguage !== sourceLanguage) {
      const translatedBody = await translateMessage({
        text: message,
        sourceLanguage,
        targetLanguage,
      });

      if (translatedBody) {
        translations[targetLanguage] = translatedBody;
      }
    }

    const { error: messageError } = await admin.from("support_messages").insert({
      thread_id: thread.id,
      sender_id: user.id,
      body: message,
      source_language: sourceLanguage,
      translations,
    });

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    await logActionAudit({
      actorId: user.id,
      action: "create_support_thread",
      targetUserId: user.id,
      metadata: {
        threadId: thread.id,
        category,
        subject,
      },
    });

    return NextResponse.json({ data: { id: thread.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el caso.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
