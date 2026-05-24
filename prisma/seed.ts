import { PrismaClient, ServiceType } from "@prisma/client";
import { ensureFairRotationStates } from "../src/lib/round-robin";
import {
  FAIR_POOL_PROVIDER_NUMBERS,
  MANDATORY_PROVIDER_NUMBERS,
  MONTHLY_QUOTA_PER_PROVIDER,
} from "../src/lib/rules";

const prisma = new PrismaClient();

function getCurrentMonthKey(date = new Date()): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

const PROVIDER_COUNT = 8;

async function main() {
  const monthKey = getCurrentMonthKey();
  console.log(`Seeding MongoDB (month: ${monthKey})...`);

  for (let n = 1; n <= PROVIDER_COUNT; n++) {
    const provider = await prisma.provider.upsert({
      where: { providerNumber: n },
      update: {
        name: `Provider ${n}`,
        active: true,
        monthlyLeadQuota: MONTHLY_QUOTA_PER_PROVIDER,
      },
      create: {
        providerNumber: n,
        name: `Provider ${n}`,
        email: `provider${n}@example.com`,
        active: true,
        monthlyLeadQuota: MONTHLY_QUOTA_PER_PROVIDER,
      },
    });

    await prisma.providerMonthlyUsage.upsert({
      where: {
        providerId_monthKey: { providerId: provider.id, monthKey },
      },
      update: {},
      create: { providerId: provider.id, monthKey, assignmentCount: 0 },
    });
  }

  const providers = await prisma.provider.findMany();
  const byNumber = new Map(providers.map((p) => [p.providerNumber, p]));

  for (const serviceType of Object.keys(
    MANDATORY_PROVIDER_NUMBERS
  ) as ServiceType[]) {
    for (const num of MANDATORY_PROVIDER_NUMBERS[serviceType]) {
      const provider = byNumber.get(num);
      if (!provider) continue;

      await prisma.mandatoryAssignmentRule.upsert({
        where: {
          providerId_serviceType: {
            providerId: provider.id,
            serviceType,
          },
        },
        update: {},
        create: { providerId: provider.id, serviceType },
      });
    }
  }

  await ensureFairRotationStates();

  console.log("Seeded:");
  console.log(`  - ${PROVIDER_COUNT} providers (quota ${MONTHLY_QUOTA_PER_PROVIDER}/month each)`);
  console.log("  - Services: Service 1, Service 2, Service 3");
  console.log("  - Mandatory: S1→P1 | S2→P5 | S3→P1+P4");
  console.log("  - Fair pools:", FAIR_POOL_PROVIDER_NUMBERS);
  console.log("  - Round-robin cursors initialized (persist across restarts)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
