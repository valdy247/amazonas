import { NextResponse } from "next/server";

// TODO: conectar firma de Square y actualizar memberships a active automáticamente.
export async function POST() {
  return NextResponse.json({ ok: true, message: "Webhook recibido (placeholder)" });
}


