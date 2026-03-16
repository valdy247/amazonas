import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { improveCampaignMessage } from "@/lib/openai";
import { normalizeLanguage } from "@/lib/i18n";
import { rejectUntrustedOrigin } from "@/lib/security";

type CampaignAssistBody = {
  message?: string;
  language?: string;
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

    const body = (await request.json()) as CampaignAssistBody;
    const message = String(body.message || "").trim();

    if (!message) {
      return NextResponse.json({ error: "Escribe el mensaje antes de usar IA." }, { status: 400 });
    }

    const improved = await improveCampaignMessage({
      text: message,
      language: normalizeLanguage(body.language),
    });

    return NextResponse.json({
      data: {
        message: improved || message,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo mejorar el mensaje.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
