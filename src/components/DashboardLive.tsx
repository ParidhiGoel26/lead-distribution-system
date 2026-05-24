"use client";

import { useEffect, useRef, useState } from "react";
import {
  ProviderDashboardPanel,
  type DashboardAssignment,
} from "@/components/ProviderDashboardPanel";
import type { ServiceType } from "@/lib/services";

export type ProviderDashboardSnapshot = {
  providerId: string;
  providerNumber: number;
  name: string;
  email: string;
  monthlyQuota: number;
  monthlyUsed: number;
  leadsReceivedCount: number;
  assignments: Array<{
    id: string;
    mandatory: boolean;
    assignedAt: string;
    lead: {
      id: string;
      customerName: string;
      phone: string;
      city: string;
      serviceType: ServiceType;
      description: string;
      createdAt: string;
    };
  }>;
};

type DashboardLiveProps = {
  monthKey: string;
  initialProviders: ProviderDashboardSnapshot[];
  rotationSummary: string;
};

export function DashboardLive({
  initialProviders,
  rotationSummary,
}: DashboardLiveProps) {
  const [providers, setProviders] = useState(initialProviders);
  const [connected, setConnected] = useState(false);
  const seenAssignmentIds = useRef(
    new Set(
      initialProviders.flatMap((p) => p.assignments.map((a) => a.id))
    )
  );

  useEffect(() => {
    const source = new EventSource("/api/dashboard/stream");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "connected") {
        setConnected(true);
        return;
      }

      if (data.type === "quota_reset") {
        setProviders((prev) =>
          prev.map((p) => ({
            ...p,
            monthlyUsed: 0,
          }))
        );
        return;
      }

      if (data.type === "lead_assigned") {
        const assignment = data.assignment;
        if (seenAssignmentIds.current.has(assignment.id)) return;
        seenAssignmentIds.current.add(assignment.id);

        const providerId = data.providerId as string;
        const newRow: ProviderDashboardSnapshot["assignments"][0] = {
          id: assignment.id,
          mandatory: assignment.mandatory,
          assignedAt: assignment.assignedAt,
          lead: {
            id: assignment.lead.id,
            customerName: assignment.lead.customerName,
            phone: assignment.lead.phone,
            city: assignment.lead.city,
            serviceType: assignment.lead.serviceType as ServiceType,
            description: assignment.lead.description,
            createdAt: assignment.lead.createdAt,
          },
        };

        setProviders((prev) =>
          prev.map((p) => {
            if (p.providerId !== providerId) return p;
            return {
              ...p,
              monthlyUsed: p.monthlyUsed + 1,
              leadsReceivedCount: p.leadsReceivedCount + 1,
              assignments: [newRow, ...p.assignments].slice(0, 25),
            };
          })
        );
      }
    };

    return () => source.close();
  }, []);

  return (
    <>
      <div className="dashboard-toolbar" style={{ marginBottom: "1rem" }}>
        <p className="muted" style={{ margin: 0 }}>
          Real-time updates via SSE — submit a lead in another tab to test.
        </p>
        <span className="badge badge-live">
          <span
            className={`status-dot ${connected ? "connected" : ""}`}
            style={{ marginRight: "0.35rem", verticalAlign: "middle" }}
          />
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>

      <div className="rules-panel">
        <h3>Distribution state (persisted)</h3>
        <p className="muted" style={{ margin: 0 }}>
          {rotationSummary}
        </p>
      </div>

      <div className="provider-panels">
        {providers.map((p) => {
          const assignments: DashboardAssignment[] = p.assignments.map((a) => ({
            id: a.id,
            mandatory: a.mandatory,
            assignedAt: new Date(a.assignedAt),
            lead: {
              ...a.lead,
              createdAt: new Date(a.lead.createdAt),
            },
          }));

          return (
            <ProviderDashboardPanel
              key={p.providerId}
              providerId={p.providerId}
              providerNumber={p.providerNumber}
              name={p.name}
              email={p.email}
              monthlyQuota={p.monthlyQuota}
              monthlyUsed={p.monthlyUsed}
              leadsReceivedCount={p.leadsReceivedCount}
              assignments={assignments}
            />
          );
        })}
      </div>
    </>
  );
}
