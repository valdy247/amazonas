import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { rejectRateLimited } from "@/lib/rate-limit";
import { logActionAudit } from "@/lib/action-audit";

type Payload = {
  contactChannel?: string;
  contactValue?: string;
};

function normalizeChannel(value: unknown) {
  const channel = String(value || "").trim().toLowerCase();
  return channel === "whatsapp" || channel === "messenger" || channel === "facebook" ? channel : "";
}

function normalizeValue(channel: string, value: unknown) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  if (channel === "whatsapp") {
    return normalized.replace(/[^\d+]/g, "");
  }

  return normalized;
}

export async function POST(request: Request) {
  try {
    const limited = await rejectRateLimited({
      scope: "directory_removal_request",
      request,
      limit: 5,
      windowSeconds: 60 * 60,
      message: "Too many removal requests. Please try again later.",
    });

    if (limited) {
      return limited;
    }

    const body = (await request.json()) as Payload;
    const contactChannel = normalizeChannel(body.contactChannel);
    const contactValue = normalizeValue(contactChannel, body.contactValue);

    if (!contactChannel) {
      return NextResponse.json({ error: "Please choose how you were contacted." }, { status: 400 });
    }

    if (!contactValue) {
      return NextResponse.json({ error: "Please enter the contact value we should review." }, { status: 400 });
    }

    if (contactChannel === "whatsapp" && contactValue.length < 7) {
      return NextResponse.json({ error: "Please enter a valid WhatsApp number." }, { status: 400 });
    }

    if ((contactChannel === "messenger" || contactChannel === "facebook") && contactValue.length < 4) {
      return NextResponse.json({ error: "Please paste a valid profile link or username." }, { status: 400 });
    }

    const admin = createAdminClient();
    const { error } = await admin.from("directory_removal_requests").insert({
      contact_channel: contactChannel,
      contact_value: contactValue,
      request_note: "Submitted from provider directory invite modal.",
      metadata: {
        source: "provider_directory_invite",
      },
    });

    if (error) {
      throw new Error(error.message || "Could not submit the request.");
    }

    await logActionAudit({
      action: "directory_removal_request_submitted",
      metadata: {
        contactChannel,
        contactValue,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not submit the request.",
      },
      { status: 500 }
    );
  }
}
