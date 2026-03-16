import { NextResponse } from "next/server";
import { getWebPushPublicKey, isWebPushConfigured } from "@/lib/push";

export async function GET() {
  if (!isWebPushConfigured()) {
    return NextResponse.json({ error: "Web push is not configured." }, { status: 503 });
  }

  return NextResponse.json({ data: { publicKey: getWebPushPublicKey() } });
}
