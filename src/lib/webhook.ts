import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";
import { getCurrentMonthKey } from "@/lib/quota";
import { publishQuotaReset } from "@/lib/realtime";
import { MONTHLY_QUOTA_PER_PROVIDER } from "@/lib/rules";

export const PAYMENT_WEBHOOK_EVENT = "payment.subscription.confirmed";

export type WebhookResult = {
  idempotentReplay: boolean;
  idempotencyKey: string;
  eventType: string;
  monthKey: string;
  providersReset: number;
  remainingQuotaPerProvider: number;
  processedAt: string;
};

/**
 * Simulates payment gateway confirming subscription.
 * Resets monthly usage to 0 (full quota of 10 available again).
 * Idempotent: duplicate idempotencyKey returns cached result without re-reset.
 */
export async function processPaymentConfirmedWebhook(
  idempotencyKey: string
): Promise<WebhookResult> {
  const key = idempotencyKey.trim();
  if (!key) {
    throw new Error("idempotencyKey is required");
  }

  const existing = await prisma.webhookProcessedEvent.findUnique({
    where: { idempotencyKey: key },
  });

  if (existing) {
    return buildReplayResult(key, existing.eventType, existing.processedAt);
  }

  try {
    await prisma.webhookProcessedEvent.create({
      data: {
        idempotencyKey: key,
        eventType: PAYMENT_WEBHOOK_EVENT,
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const raced = await prisma.webhookProcessedEvent.findUnique({
        where: { idempotencyKey: key },
      });
      if (raced) {
        return buildReplayResult(key, raced.eventType, raced.processedAt);
      }
    }
    throw error;
  }

  const monthKey = getCurrentMonthKey();
  const providers = await prisma.provider.findMany({
    where: { active: true },
    select: { id: true },
  });

  for (const provider of providers) {
    await prisma.providerMonthlyUsage.upsert({
      where: {
        providerId_monthKey: { providerId: provider.id, monthKey },
      },
      create: { providerId: provider.id, monthKey, assignmentCount: 0 },
      update: { assignmentCount: 0 },
    });
  }

  publishQuotaReset({
    type: "quota_reset",
    monthKey,
    providerIds: providers.map((p) => p.id),
  });

  return {
    idempotentReplay: false,
    idempotencyKey: key,
    eventType: PAYMENT_WEBHOOK_EVENT,
    monthKey,
    providersReset: providers.length,
    remainingQuotaPerProvider: MONTHLY_QUOTA_PER_PROVIDER,
    processedAt: new Date().toISOString(),
  };
}

function buildReplayResult(
  key: string,
  eventType: string,
  processedAt: Date
): WebhookResult {
  return {
    idempotentReplay: true,
    idempotencyKey: key,
    eventType,
    monthKey: getCurrentMonthKey(),
    providersReset: 0,
    remainingQuotaPerProvider: MONTHLY_QUOTA_PER_PROVIDER,
    processedAt: processedAt.toISOString(),
  };
}
