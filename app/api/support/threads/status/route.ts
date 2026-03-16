import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { hasAdminAccess } from "@/lib/admin";
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
    const { data: me } = await admin.from("profiles").select("role, email").eq("id", user.id).single();
    if (!hasAdminAccess(me?.role, me?.email || user.email)) {
      return NextResponse.json({ error: "Solo admin." }, { status: 403 });
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

    const { error } = await admin.from("support_threads").update(updatePayload).eq("id", threadId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo actualizar el estado.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
