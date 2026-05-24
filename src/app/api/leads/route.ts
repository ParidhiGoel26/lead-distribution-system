import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentMonthKey } from "@/lib/quota";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const providerId = searchParams.get("providerId");

  if (!providerId) {
    return NextResponse.json(
      { error: "providerId query parameter is required." },
      { status: 400 }
    );
  }

  const monthKey = getCurrentMonthKey();

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      monthlyUsage: { where: { monthKey } },
      _count: { select: { assignments: true } },
    },
  });

  if (!provider) {
    return NextResponse.json({ error: "Provider not found." }, { status: 404 });
  }

  const monthlyUsed = provider.monthlyUsage[0]?.assignmentCount ?? 0;

  const assignments = await prisma.leadAssignment.findMany({
    where: { providerId },
    orderBy: { assignedAt: "desc" },
    include: { lead: true },
    take: 50,
  });

  return NextResponse.json({
    provider: {
      id: provider.id,
      providerNumber: provider.providerNumber,
      name: provider.name,
      email: provider.email,
    },
    monthKey,
    monthlyQuota: provider.monthlyLeadQuota,
    monthlyUsed,
    remainingQuota: Math.max(0, provider.monthlyLeadQuota - monthlyUsed),
    leadsReceivedCount: provider._count.assignments,
    leads: assignments.map((a) => ({
      assignmentId: a.id,
      mandatory: a.mandatory,
      assignedAt: a.assignedAt,
      lead: a.lead,
    })),
  });
}
