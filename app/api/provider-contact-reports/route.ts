import { NextResponse } from "next/server";
import { logActionAudit } from "@/lib/action-audit";
import { rejectRateLimited } from "@/lib/rate-limit";
import { hasAdminAccess } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type Payload = {
  providerContactId?: number;
  reportType?: string;
};

const REPORT_TYPES = new Set(["no_reply", "not_provider", "trusted", "scam", "broken_contact"]);

async function syncProviderVerification(admin: ReturnType<typeof createAdminClient>, providerContactId: number) {
  const { count, error: countError } = await admin
    .from("provider_contact_reports")
    .select("*", { count: "exact", head: true })
    .eq("provider_contact_id", providerContactId)
    .eq("report_type", "trusted")
    .in("reporter_role", ["reviewer", "tester"])
    .neq("status", "dismissed");

  if (countError) {
    throw new Error(countError.message || "Could not recalculate provider verification.");
  }

  const { error: updateError } = await admin
    .from("provider_contacts")
    .update({ is_verified: (count || 0) >= 2 })
    .eq("id", providerContactId);

  if (updateError) {
    throw new Error(updateError.message || "Could not update provider verification.");
  }
}

export async function POST(request: Request) {
  try {
    const limited = await rejectRateLimited({
      scope: "provider_contact_report",
      request,
      limit: 20,
      windowSeconds: 60 * 60,
      message: "Too many contact reports. Please try again later.",
    });

    if (limited) {
      return limited;
    }

    const supabase = await createClient();
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return NextResponse.json({ error: "You need an active session." }, { status: 401 });
    }

    const { data: profile } = await supabase.from("profiles").select("role, email").eq("id", user.id).single();
    const role = String(profile?.role || "").trim();
    const reporterRole = hasAdminAccess(profile?.role, profile?.email || user.email)
      ? "admin"
      : role === "reviewer" || role === "tester"
        ? role
        : "";

    if (!reporterRole) {
      return NextResponse.json({ error: "This account cannot submit contact reports." }, { status: 403 });
    }

    const body = (await request.json()) as Payload;
    const providerContactId = Number(body.providerContactId || 0);
    const reportType = String(body.reportType || "").trim();

    if (!Number.isFinite(providerContactId) || providerContactId <= 0) {
      return NextResponse.json({ error: "Invalid contact." }, { status: 400 });
    }

    if (!REPORT_TYPES.has(reportType)) {
      return NextResponse.json({ error: "Invalid report type." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { data: contact, error: contactError } = await admin
      .from("provider_contacts")
      .select("id")
      .eq("id", providerContactId)
      .maybeSingle();

    if (contactError || !contact) {
      return NextResponse.json({ error: "The provider contact no longer exists." }, { status: 404 });
    }

    const now = new Date().toISOString();
    const { error } = await admin.from("provider_contact_reports").upsert(
      {
        provider_contact_id: providerContactId,
        reporter_id: user.id,
        reporter_role: reporterRole,
        report_type: reportType,
        status: "open",
        updated_at: now,
      },
      {
        onConflict: "provider_contact_id,reporter_id,report_type",
      }
    );

    if (error) {
      throw new Error(error.message || "Could not submit the report.");
    }

    await syncProviderVerification(admin, providerContactId);

    await logActionAudit({
      actorId: reporterRole === "admin" ? user.id : null,
      action: "provider_contact_report_submitted",
      metadata: {
        providerContactId,
        reportType,
        reporterRole,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not submit the report.",
      },
      { status: 500 }
    );
  }
}
