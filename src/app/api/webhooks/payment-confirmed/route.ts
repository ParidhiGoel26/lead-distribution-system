import { NextResponse } from "next/server";
import { isTestToolsEnabled, verifyWebhookSecret } from "@/lib/test-tools";
import { processPaymentConfirmedWebhook } from "@/lib/webhook";

export async function POST(request: Request) {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Webhooks are disabled." }, { status: 403 });
  }

  if (!verifyWebhookSecret(request)) {
    return NextResponse.json({ error: "Invalid webhook secret." }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    const idempotencyKey =
      request.headers.get("idempotency-key") ??
      body.idempotencyKey ??
      body.idempotency_key;

    if (!idempotencyKey || typeof idempotencyKey !== "string") {
      return NextResponse.json(
        { error: "Idempotency-Key header or body.idempotencyKey is required." },
        { status: 400 }
      );
    }

    const result = await processPaymentConfirmedWebhook(idempotencyKey);

    return NextResponse.json(
      {
        message: result.idempotentReplay
          ? "Webhook already processed (idempotent replay)."
          : "Payment confirmed. Provider quotas reset.",
        ...result,
      },
      { status: result.idempotentReplay ? 200 : 201 }
    );
  } catch (error) {
    console.error("Webhook processing failed:", error);
    return NextResponse.json(
      { error: "Webhook processing failed." },
      { status: 500 }
    );
  }
}
