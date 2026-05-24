import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { getCurrentMonthKey } from "@/lib/quota";
import { ProviderDashboard } from "@/components/ProviderDashboard";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ providerId: string }>;
};

export default async function ProviderLivePage({ params }: PageProps) {
  const { providerId } = await params;
  const monthKey = getCurrentMonthKey();

  const provider = await prisma.provider.findUnique({
    where: { id: providerId },
    include: {
      monthlyUsage: { where: { monthKey } },
      _count: { select: { assignments: true } },
    },
  });

  if (!provider) {
    notFound();
  }

  const monthlyUsed = provider.monthlyUsage[0]?.assignmentCount ?? 0;
  const remaining = Math.max(0, provider.monthlyLeadQuota - monthlyUsed);

  return (
    <main className="container">
      <p style={{ marginBottom: "1rem" }}>
        <Link href="/dashboard">← All providers</Link>
      </p>
      <div className="card">
        <div className="stats-row" style={{ marginBottom: "1.25rem" }}>
          <div className="stat-box">
            <span className="stat-label">Provider</span>
            <strong className="stat-value">
              {provider.providerNumber}: {provider.name}
            </strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Remaining quota ({monthKey})</span>
            <strong className="stat-value">
              {remaining} / {provider.monthlyLeadQuota}
            </strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Leads received (all time)</span>
            <strong className="stat-value">{provider._count.assignments}</strong>
          </div>
        </div>

        <ProviderDashboard
          providerId={provider.id}
          providerName={provider.name}
          providerNumber={provider.providerNumber}
          initialRemainingQuota={remaining}
          initialLeadsCount={provider._count.assignments}
        />
      </div>
    </main>
  );
}
