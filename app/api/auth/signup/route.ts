import { NextResponse } from "next/server";
import { callSupabaseAuth } from "@/lib/auth-api";
import { rejectRateLimited } from "@/lib/rate-limit";
import { rejectUntrustedOrigin } from "@/lib/security";
import { resolveSiteOrigin } from "@/lib/site-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeReferralCode, isVerifiedReviewerReferrer } from "@/lib/referrals";

type SignupBody = {
  email?: string;
  password?: string;
  data?: Record<string, unknown>;
};

function getSignupUserPayload(data: unknown) {
  if (!data || typeof data !== "object") {
    return null;
  }

  const payload = data as {
    user?: {
      id?: unknown;
      email_confirmed_at?: unknown;
    };
    access_token?: unknown;
    refresh_token?: unknown;
    session?: {
      access_token?: unknown;
      refresh_token?: unknown;
    } | null;
  };

  const userId = typeof payload.user?.id === "string" ? payload.user.id : null;
  const emailConfirmedAt =
    typeof payload.user?.email_confirmed_at === "string" ? payload.user.email_confirmed_at : null;
  const hasSessionTokens =
    typeof payload.access_token === "string" ||
    typeof payload.refresh_token === "string" ||
    typeof payload.session?.access_token === "string" ||
    typeof payload.session?.refresh_token === "string";

  return {
    userId,
    emailConfirmedAt,
    hasSessionTokens,
  };
}

export async function POST(request: Request) {
  try {
    const originError = rejectUntrustedOrigin(request);
    if (originError) {
      return originError;
    }

    const body = (await request.json()) as SignupBody;
    const email = String(body.email || "").trim().toLowerCase();
    const password = String(body.password || "");
    const legalConsent = body.data && typeof body.data === "object" ? Boolean(body.data.legal_consent) : false;
    const signupRole =
      body.data && typeof body.data === "object" && body.data.signup_role === "provider" ? "provider" : "reviewer";
    const referralCodeInput =
      body.data && typeof body.data === "object" ? normalizeReferralCode(body.data.referral_code_input) : "";

    if (!email || !password) {
      return NextResponse.json({ error: "Datos incompletos" }, { status: 400 });
    }

    if (!legalConsent) {
      return NextResponse.json({ error: "Debes aceptar las politicas y terminos antes de crear tu cuenta." }, { status: 400 });
    }

    const rateLimitError = await rejectRateLimited({
      scope: "auth_signup",
      request,
      identifierParts: [email],
      limit: 5,
      windowSeconds: 900,
      message: "Demasiados intentos de registro. Espera un poco antes de intentarlo otra vez.",
    });
    if (rateLimitError) {
      return rateLimitError;
    }

    let referredByUserId: string | null = null;
    let referredByCode: string | null = null;
    if (signupRole === "reviewer" && referralCodeInput) {
      const admin = createAdminClient();
      const { data: referrer } = await admin
        .from("profiles")
        .select("id, role, referral_code, email_confirmed_at")
        .eq("referral_code", referralCodeInput)
        .maybeSingle();

      if (!referrer) {
        return NextResponse.json(
          {
            error:
              "El codigo de referido no existe o ya no esta activo.",
          },
          { status: 400 }
        );
      }

      const [{ data: membership }, { data: kyc }] = await Promise.all([
        admin.from("memberships").select("status, current_period_end_at, canceled_at, last_payment_failed_at").eq("user_id", referrer.id).maybeSingle(),
        admin.from("kyc_checks").select("status").eq("user_id", referrer.id).maybeSingle(),
      ]);

      if (
        !isVerifiedReviewerReferrer({
          role: referrer.role,
          membership,
          kycStatus: kyc?.status || null,
          emailConfirmedAt: referrer.email_confirmed_at || null,
        })
      ) {
        return NextResponse.json(
          {
            error:
              "El codigo de referido no esta habilitado todavia.",
          },
          { status: 400 }
        );
      }

      referredByUserId = referrer.id;
      referredByCode = referrer.referral_code || referralCodeInput;
    }

    const result = await callSupabaseAuth("/auth/v1/signup", {
      email,
      password,
      emailRedirectTo: `${resolveSiteOrigin({
        requestUrl: request.url,
        headerOrigin: request.headers.get("origin"),
        forwardedHost: request.headers.get("x-forwarded-host") || request.headers.get("host"),
        forwardedProto: request.headers.get("x-forwarded-proto"),
      })}/auth/callback`,
      data: {
        ...(body.data || {}),
        referred_by_user_id: referredByUserId,
        referred_by_code: referredByCode,
      },
    });

    if (!result.ok) {
      return NextResponse.json({ error: result.error || "Error de registro" }, { status: result.status });
    }

    const signupUser = getSignupUserPayload(result.data);

    if (signupUser?.userId && (signupUser.emailConfirmedAt || signupUser.hasSessionTokens)) {
      const admin = createAdminClient();

      await Promise.allSettled([
        admin.auth.admin.deleteUser(signupUser.userId),
        admin.from("profiles").delete().eq("id", signupUser.userId),
      ]);

      return NextResponse.json(
        {
          error:
            "El registro requiere verificacion de correo, pero Supabase esta confirmando cuentas automaticamente. Activa la confirmacion por email en Supabase y vuelve a intentarlo.",
        },
        { status: 500 }
      );
    }

    return NextResponse.json({ data: result.data }, { status: 200 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo procesar el registro";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
