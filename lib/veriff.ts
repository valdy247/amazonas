import { createHmac } from "node:crypto";

type VeriffSessionResponse = {
  status?: string;
  verification?: {
    id?: string;
    url?: string;
    vendorData?: string | null;
    endUserId?: string | null;
  };
};

type VeriffDecisionPayload = {
  id?: string;
  sessionId?: string;
  vendorData?: string | null;
  endUserId?: string | null;
  time?: string | null;
  acceptanceTime?: string | null;
  status?: string;
  data?: {
    verification?: {
      decision?: string | null;
      person?: {
        firstName?: { value?: string | null } | null;
        lastName?: { value?: string | null } | null;
        dateOfBirth?: { value?: string | null } | null;
        dob?: { value?: string | null } | null;
        birthDate?: { value?: string | null } | null;
      } | null;
    } | null;
  } | null;
  verification?: {
    id?: string;
    vendorData?: string | null;
    endUserId?: string | null;
    status?: string;
    code?: number | null;
    reason?: string | null;
    reasonCode?: number | null;
    decisionTime?: string | null;
    person?: {
      firstName?: string | null;
      lastName?: string | null;
      fullName?: string | null;
      dateOfBirth?: string | null;
      dob?: string | null;
      birthDate?: string | null;
    };
  };
};

export function getVeriffApiBaseUrl() {
  const baseUrl = process.env.VERIFF_API_BASE_URL;

  if (!baseUrl) {
    throw new Error("Missing VERIFF_API_BASE_URL.");
  }

  return baseUrl.replace(/\/+$/, "");
}

export function getVeriffApiKey() {
  const apiKey = process.env.VERIFF_API_KEY;

  if (!apiKey) {
    throw new Error("Missing VERIFF_API_KEY.");
  }

  return apiKey;
}

export function getVeriffSharedSecret() {
  const sharedSecret = process.env.VERIFF_SHARED_SECRET;

  if (!sharedSecret) {
    throw new Error("Missing VERIFF_SHARED_SECRET.");
  }

  return sharedSecret;
}

function signPayload(payload: string) {
  return createHmac("sha256", getVeriffSharedSecret()).update(payload, "utf8").digest("hex");
}

function getVeriffHeaders(payload: string) {
  return {
    "Content-Type": "application/json",
    "X-AUTH-CLIENT": getVeriffApiKey(),
    "X-HMAC-SIGNATURE": signPayload(payload),
  };
}

export async function createVeriffSession(input: {
  userId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  phone?: string | null;
  callbackUrl: string;
}) {
  const payload = JSON.stringify({
    verification: {
      callback: input.callbackUrl,
      endUserId: input.userId,
      vendorData: input.userId,
      person: {
        ...(input.fullName ? { fullName: input.fullName } : {}),
        ...(input.firstName ? { firstName: input.firstName } : {}),
        ...(input.lastName ? { lastName: input.lastName } : {}),
        ...(input.phone ? { phoneNumber: input.phone } : {}),
      },
    },
  });

  const response = await fetch(`${getVeriffApiBaseUrl()}/v1/sessions`, {
    method: "POST",
    headers: getVeriffHeaders(payload),
    body: payload,
    cache: "no-store",
  });

  const data = (await response.json()) as VeriffSessionResponse & { code?: string; message?: string };

  if (!response.ok) {
    throw new Error(data.message || "No se pudo crear la sesion de Veriff.");
  }

  const sessionId = data.verification?.id;
  const sessionUrl = data.verification?.url;

  if (!sessionId || !sessionUrl) {
    throw new Error("Veriff no devolvio una sesion valida.");
  }

  return {
    sessionId,
    sessionUrl,
  };
}

export function verifyVeriffWebhookSignature(input: {
  body: string;
  signature: string | null;
  apiKey: string | null;
}) {
  if (!input.signature || !input.apiKey) {
    return false;
  }

  if (input.apiKey !== getVeriffApiKey()) {
    return false;
  }

  return signPayload(input.body) === input.signature;
}

export function mapVeriffDecisionStatus(status: string | null | undefined) {
  switch ((status || "").toLowerCase()) {
    case "approved":
      return "approved" as const;
    case "declined":
    case "expired":
    case "abandoned":
      return "rejected" as const;
    case "review":
    case "resubmission_requested":
      return "in_review" as const;
    default:
      return "pending" as const;
  }
}

export function parseVeriffDecisionPayload(body: string) {
  return JSON.parse(body) as VeriffDecisionPayload;
}
