import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/db";

export type DbClient = Prisma.TransactionClient | typeof prisma;

/** Calendar month bucket, e.g. "2026-05" (UTC) */
export function getCurrentMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

export async function ensureMonthlyUsage(
  db: DbClient,
  providerId: string,
  monthKey: string
): Promise<void> {
  await db.providerMonthlyUsage.upsert({
    where: { providerId_monthKey: { providerId, monthKey } },
    create: { providerId, monthKey, assignmentCount: 0 },
    update: {},
  });
}

/**
 * Atomically reserves one monthly slot if under quota.
 * Safe when many leads are created at the same time (MongoDB single-document update).
 */
export async function tryReserveMonthlySlot(
  db: DbClient,
  providerId: string,
  monthlyLeadQuota: number,
  monthKey: string
): Promise<boolean> {
  await ensureMonthlyUsage(db, providerId, monthKey);

  const reserved = await db.providerMonthlyUsage.updateMany({
    where: {
      providerId,
      monthKey,
      assignmentCount: { lt: monthlyLeadQuota },
    },
    data: { assignmentCount: { increment: 1 } },
  });

  return reserved.count > 0;
}

/** Roll back a reserved slot (e.g. if assignment creation fails). */
export async function releaseMonthlySlot(
  db: DbClient,
  providerId: string,
  monthKey: string
): Promise<void> {
  await db.providerMonthlyUsage.updateMany({
    where: { providerId, monthKey, assignmentCount: { gt: 0 } },
    data: { assignmentCount: { decrement: 1 } },
  });
}

export async function getMonthlyUsage(
  providerId: string,
  monthKey: string
): Promise<{ used: number; quota: number } | null> {
  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    select: { monthlyLeadQuota: true },
  });
  if (!provider) return null;

  const usage = await prisma.providerMonthlyUsage.findUnique({
    where: { providerId_monthKey: { providerId, monthKey } },
  });

  return {
    used: usage?.assignmentCount ?? 0,
    quota: provider.monthlyLeadQuota,
  };
}
