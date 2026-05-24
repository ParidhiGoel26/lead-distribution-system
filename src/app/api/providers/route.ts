import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentMonthKey } from "@/lib/quota";
import { FAIR_POOL_PROVIDER_NUMBERS, MANDATORY_PROVIDER_NUMBERS } from "@/lib/rules";

export async function GET() {
  const monthKey = getCurrentMonthKey();

  const [providers, rotation] = await Promise.all([
    prisma.provider.findMany({
      where: { active: true },
      orderBy: { providerNumber: "asc" },
      select: {
        id: true,
        providerNumber: true,
        name: true,
        email: true,
        monthlyLeadQuota: true,
        mandatoryRules: { select: { serviceType: true } },
        monthlyUsage: {
          where: { monthKey },
          select: { assignmentCount: true },
        },
      },
    }),
    prisma.fairRotationState.findMany(),
  ]);

  return NextResponse.json({
    monthKey,
    providersPerLead: 3,
    mandatoryRules: MANDATORY_PROVIDER_NUMBERS,
    fairPools: FAIR_POOL_PROVIDER_NUMBERS,
    roundRobin: rotation,
    providers: providers.map((p) => ({
      id: p.id,
      providerNumber: p.providerNumber,
      name: p.name,
      email: p.email,
      monthlyLeadQuota: p.monthlyLeadQuota,
      monthlyUsed: p.monthlyUsage[0]?.assignmentCount ?? 0,
      monthlyRemaining: Math.max(
        0,
        p.monthlyLeadQuota - (p.monthlyUsage[0]?.assignmentCount ?? 0)
      ),
      mandatoryServices: p.mandatoryRules.map((r) => r.serviceType),
    })),
  });
}
