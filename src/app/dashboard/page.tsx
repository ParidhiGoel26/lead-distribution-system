import { prisma } from "@/lib/db";
import { getCurrentMonthKey } from "@/lib/quota";
import { MONTHLY_QUOTA_PER_PROVIDER } from "@/lib/rules";
import {
  DashboardLive,
  type ProviderDashboardSnapshot,
} from "@/components/DashboardLive";
import { SERVICE_LABELS, type ServiceType } from "@/lib/services";

export const dynamic = "force-dynamic";

const LEADS_LIST_LIMIT = 25;

export default async function DashboardPage() {
  const monthKey = getCurrentMonthKey();

  const providers = await prisma.provider.findMany({
    where: { active: true },
    orderBy: { providerNumber: "asc" },
    include: {
      monthlyUsage: { where: { monthKey } },
      _count: { select: { assignments: true } },
      assignments: {
        orderBy: { assignedAt: "desc" },
        take: LEADS_LIST_LIMIT,
        include: {
          lead: {
            select: {
              id: true,
              customerName: true,
              phone: true,
              city: true,
              serviceType: true,
              description: true,
              createdAt: true,
            },
          },
        },
      },
    },
  });

  const rotation = await prisma.fairRotationState.findMany();
  const rotationSummary = rotation
    .map(
      (r) =>
        `${SERVICE_LABELS[r.serviceType as ServiceType]} → index ${r.nextIndex}`
    )
    .join(" · ");

  const initialProviders: ProviderDashboardSnapshot[] = providers.map((p) => ({
    providerId: p.id,
    providerNumber: p.providerNumber,
    name: p.name,
    email: p.email,
    monthlyQuota: p.monthlyLeadQuota,
    monthlyUsed: p.monthlyUsage[0]?.assignmentCount ?? 0,
    leadsReceivedCount: p._count.assignments,
    assignments: p.assignments.map((a) => ({
      id: a.id,
      mandatory: a.mandatory,
      assignedAt: a.assignedAt.toISOString(),
      lead: {
        id: a.lead.id,
        customerName: a.lead.customerName,
        phone: a.lead.phone,
        city: a.lead.city,
        serviceType: a.lead.serviceType as ServiceType,
        description: a.lead.description,
        createdAt: a.lead.createdAt.toISOString(),
      },
    })),
  }));

  return (
    <main className="container container-wide">
      <div className="card">
        <h2>Provider dashboard</h2>
        <p className="muted">
          Live data from MongoDB · {monthKey} · {MONTHLY_QUOTA_PER_PROVIDER}{" "}
          leads/month per provider · 3 providers per new lead
        </p>

        <DashboardLive
          monthKey={monthKey}
          initialProviders={initialProviders}
          rotationSummary={rotationSummary}
        />
      </div>
    </main>
  );
}
