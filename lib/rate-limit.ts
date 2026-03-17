import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

function getRequestIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  return request.headers.get("x-real-ip") || "unknown";
}

function buildIdentifier(parts: Array<string | null | undefined>) {
  return parts
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join("|");
}

export async function consumeRateLimit(input: {
  scope: string;
  request: Request;
  identifierParts?: Array<string | null | undefined>;
  limit: number;
  windowSeconds: number;
}) {
  const admin = createAdminClient();
  const identifier = buildIdentifier([getRequestIp(input.request), ...(input.identifierParts || [])]);
  const { data, error } = await admin.rpc("consume_rate_limit", {
    scope_name: input.scope,
    identifier_value: identifier,
    max_hits: input.limit,
    window_seconds: input.windowSeconds,
  });

  if (error) {
    const message = error.message || "";
    if (
      message.includes("consume_rate_limit") ||
      message.includes("request_rate_limits") ||
      message.includes("Could not find the function")
    ) {
      return {
        allowed: true,
        hits: 0,
        retryAfterSeconds: 0,
      };
    }

    throw new Error(message || "Rate limit check failed.");
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(row?.allowed),
    hits: Number(row?.hits || 0),
    retryAfterSeconds: Number(row?.retry_after_seconds || input.windowSeconds),
  };
}

export async function rejectRateLimited(input: Parameters<typeof consumeRateLimit>[0] & { message: string }) {
  const result = await consumeRateLimit(input);

  if (result.allowed) {
    return null;
  }

  return NextResponse.json(
    { error: input.message },
    {
      status: 429,
      headers: {
        "Retry-After": String(result.retryAfterSeconds),
      },
    }
  );
}
