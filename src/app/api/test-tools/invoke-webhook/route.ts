import { NextResponse } from "next/server";
import { isTestToolsEnabled } from "@/lib/test-tools";
import { processPaymentConfirmedWebhook } from "@/lib/webhook";

/** Test panel only — invokes payment webhook logic (not a direct quota DB reset). */
export async function POST(request: Request) {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools are disabled." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const idempotencyKey =
    typeof body.idempotencyKey === "string" && body.idempotencyKey.trim()
      ? body.idempotencyKey.trim()
      : `payment-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`;

  const repeat = Math.min(Math.max(Number(body.repeat) || 1, 1), 10);

  const attempts = [];
  for (let i = 0; i < repeat; i++) {
    attempts.push(await processPaymentConfirmedWebhook(idempotencyKey));
  }

  return NextResponse.json({
    idempotencyKey,
    repeat,
    attempts,
    summary: {
      firstApplied: attempts.some((a) => !a.idempotentReplay),
      replays: attempts.filter((a) => a.idempotentReplay).length,
    },
  });
}
