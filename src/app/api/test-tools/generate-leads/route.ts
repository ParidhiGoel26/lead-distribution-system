import { NextResponse } from "next/server";
import { createLeadAndDistribute } from "@/lib/distribution";
import { isTestToolsEnabled } from "@/lib/test-tools";
import { SERVICE_TYPES, type ServiceType } from "@/lib/services";

export async function POST(request: Request) {
  if (!isTestToolsEnabled()) {
    return NextResponse.json({ error: "Test tools are disabled." }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const count = Math.min(Math.max(Number(body.count) || 10, 1), 50);
  const serviceType = (body.serviceType as ServiceType) || "SERVICE_1";

  if (!SERVICE_TYPES.includes(serviceType)) {
    return NextResponse.json({ error: "Invalid serviceType." }, { status: 400 });
  }

  const results = await Promise.all(
    Array.from({ length: count }, (_, i) =>
      createLeadAndDistribute({
        customerName: `Load Test ${Date.now()}-${i + 1}`,
        phone: `8800${String(Date.now()).slice(-6)}${String(i).padStart(2, "0")}`,
        city: "Test City",
        serviceType,
        description: `Concurrency test lead #${i + 1}`,
      })
    )
  );

  const summary = {
    created: results.length,
    complete: results.filter((r) => r.complete).length,
    totalAssignments: results.reduce((n, r) => n + r.assignments.length, 0),
  };

  return NextResponse.json({
    message: `Generated ${count} leads in parallel.`,
    serviceType,
    summary,
    leads: results.map((r) => ({
      id: r.lead.id,
      assignments: r.assignments.length,
      complete: r.complete,
    })),
  });
}
