/**
 * Concurrency test for Feature 2 — run after db:seed:
 *
 *   npm run test:concurrent
 */
import { PrismaClient } from "@prisma/client";
import { createLeadAndDistribute } from "../src/lib/distribution";
import { getCurrentMonthKey } from "../src/lib/quota";
import { PROVIDERS_PER_LEAD } from "../src/lib/rules";

const prisma = new PrismaClient();
const PARALLEL = 20;

function fail(msg: string): never {
  console.error(`FAIL: ${msg}`);
  process.exit(1);
}

async function main() {
  console.log("=== Feature 2 concurrency test ===\n");

  const providers = await prisma.provider.findMany({
    orderBy: { providerNumber: "asc" },
    include: { monthlyUsage: true },
  });

  if (providers.length !== 8) {
    fail(`Expected 8 providers, got ${providers.length}. Run npm run db:seed`);
  }

  const monthKey = getCurrentMonthKey();
  const usageBefore = new Map(
    providers.map((p) => [
      p.providerNumber,
      p.monthlyUsage.find((u) => u.monthKey === monthKey)?.assignmentCount ?? 0,
    ])
  );

  console.log(`Firing ${PARALLEL} Service 1 leads in parallel...\n`);

  const results = await Promise.all(
    Array.from({ length: PARALLEL }, (_, i) =>
      createLeadAndDistribute({
        customerName: `Concurrent ${i + 1}`,
        phone: `9100000${String(i + 1).padStart(4, "0")}`,
        city: "Test City",
        serviceType: "SERVICE_1",
        description: `Load test lead #${i + 1}`,
      })
    )
  );

  // 1) Exactly 3 providers per lead (when distribution completes)
  const notThree = results.filter((r) => r.assignments.length !== PROVIDERS_PER_LEAD);
  if (notThree.length > 0) {
    console.log(
      `Warning: ${notThree.length} lead(s) got fewer than ${PROVIDERS_PER_LEAD} providers (likely quota exhaustion)`
    );
    notThree.forEach((r, i) => {
      console.log(
        `  Lead ${i + 1}: ${r.assignments.length} assigned, skipped: ${r.skipped.length}`
      );
    });
  } else {
    console.log(`✓ All ${PARALLEL} leads assigned to exactly ${PROVIDERS_PER_LEAD} providers`);
  }

  // 2) No duplicate provider on same lead
  for (const r of results) {
    const ids = r.assignments.map((a) => a.providerId);
    if (new Set(ids).size !== ids.length) {
      fail(`Duplicate provider on lead ${r.lead.id}`);
    }
  }
  console.log("✓ No provider assigned twice to the same lead");

  // 3) Service 1 must include mandatory P1 when assigned
  for (const r of results) {
    if (r.assignments.length === 0) continue;
    const hasP1 = r.assignments.some((a) => a.providerNumber === 1);
    if (!hasP1) {
      fail(`Service 1 lead ${r.lead.id} missing mandatory Provider 1`);
    }
  }
  console.log("✓ Service 1 leads include mandatory Provider 1 (when any assignment)");

  // 4) Monthly quota not exceeded
  const updatedProviders = await prisma.provider.findMany({
    include: { monthlyUsage: { where: { monthKey } } },
  });

  for (const p of updatedProviders) {
    const used = p.monthlyUsage[0]?.assignmentCount ?? 0;
    if (used > p.monthlyLeadQuota) {
      fail(
        `Provider ${p.providerNumber} quota exceeded: ${used} > ${p.monthlyLeadQuota}`
      );
    }
  }
  console.log("✓ No provider exceeded monthly quota (10)");

  // 5) DB: no duplicate [leadId, providerId] for this batch
  const leadIds = results.map((r) => r.lead.id);
  const batchAssignments = await prisma.leadAssignment.findMany({
    where: { leadId: { in: leadIds } },
    select: { leadId: true, providerId: true },
  });
  const pairKeys = new Set<string>();
  for (const a of batchAssignments) {
    const key = `${a.leadId}:${a.providerId}`;
    if (pairKeys.has(key)) {
      fail("Duplicate leadId+providerId in database");
    }
    pairKeys.add(key);
  }
  console.log("✓ Database has no duplicate lead–provider pairs in batch");

  // 6) Round-robin state persisted
  const rotation = await prisma.fairRotationState.findUnique({
    where: { serviceType: "SERVICE_1" },
  });
  if (!rotation) {
    fail("FairRotationState missing for SERVICE_1");
  }
  console.log(`✓ Round-robin cursor persisted (SERVICE_1 index: ${rotation.nextIndex})`);

  // 7) Usage delta matches assignment count for P1
  const p1 = updatedProviders.find((p) => p.providerNumber === 1)!;
  const p1Used = p1.monthlyUsage[0]?.assignmentCount ?? 0;
  const p1Before = usageBefore.get(1) ?? 0;
  const p1AssignedInBatch = results.filter((r) =>
    r.assignments.some((a) => a.providerNumber === 1)
  ).length;

  if (p1Used - p1Before !== p1AssignedInBatch) {
    fail(
      `P1 usage delta ${p1Used - p1Before} != assignments in batch ${p1AssignedInBatch}`
    );
  }
  console.log("✓ P1 monthly usage counter matches assignments in batch");

  console.log("\n=== PASS ===");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
