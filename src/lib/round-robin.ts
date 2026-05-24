import { ServiceType as PrismaServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import type { ServiceType } from "@/lib/services";
import { FAIR_POOL_PROVIDER_NUMBERS } from "@/lib/rules";

/**
 * Atomically advances the persisted round-robin cursor and returns
 * the pool index for this fair-pick attempt (safe under concurrency).
 */
export async function claimNextFairPoolIndex(
  serviceType: ServiceType
): Promise<number> {
  const poolSize = FAIR_POOL_PROVIDER_NUMBERS[serviceType].length;
  if (poolSize === 0) return 0;

  const prismaType = serviceType as PrismaServiceType;

  await prisma.fairRotationState.upsert({
    where: { serviceType: prismaType },
    create: { serviceType: prismaType, nextIndex: 0 },
    update: {},
  });

  const updated = await prisma.fairRotationState.update({
    where: { serviceType: prismaType },
    data: { nextIndex: { increment: 1 } },
  });

  return (updated.nextIndex - 1 + poolSize * 1000) % poolSize;
}

export async function ensureFairRotationStates(): Promise<void> {
  for (const serviceType of ["SERVICE_1", "SERVICE_2", "SERVICE_3"] as const) {
    await prisma.fairRotationState.upsert({
      where: { serviceType },
      create: { serviceType, nextIndex: 0 },
      update: {},
    });
  }
}
