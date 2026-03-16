import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { SUPPORT_CATEGORIES } from "@/lib/support";

type CreateSupportThreadBody = {
  subject?: string;
  category?: string;
  message?: string;
};

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "No se pudo validar tu sesion." }, { status: 401 });
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

    const { error: messageError } = await admin.from("support_messages").insert({
      thread_id: thread.id,
      sender_id: user.id,
      body: message,
    });

    if (messageError) {
      return NextResponse.json({ error: messageError.message }, { status: 500 });
    }

    return NextResponse.json({ data: { id: thread.id } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo crear el caso.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
