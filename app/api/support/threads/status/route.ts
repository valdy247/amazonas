import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAdminAccess } from "@/lib/admin";

type UpdateSupportStatusBody = {
  threadId?: number;
  status?: string;
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

    const admin = createAdminClient();
    const { data: me } = await admin.from("profiles").select("role, email").eq("id", user.id).single();
    if (!hasAdminAccess(me?.role, me?.email || user.email)) {
      return NextResponse.json({ error: "Solo admin." }, { status: 403 });
    }

    const body = (await request.json()) as UpdateSupportStatusBody;
    const threadId = Number(body.threadId);
    const status = ["open", "in_progress", "resolved"].includes(String(body.status)) ? String(body.status) : null;

    if (!Number.isFinite(threadId) || !status) {
      return NextResponse.json({ error: "Estado invalido." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const { error } = await admin
      .from("support_threads")
      .update({
        status,
        assigned_admin_id: user.id,
        updated_at: now,
        last_activity_at: now,
      })
      .eq("id", threadId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el estado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
