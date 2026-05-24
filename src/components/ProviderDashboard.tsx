"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateTime } from "@/lib/format-date";
import { SERVICE_LABELS, type ServiceType } from "@/lib/services";

type LeadRow = {
  assignmentId: string;
  mandatory: boolean;
  assignedAt: string;
  lead: {
    id: string;
    customerName: string;
    email: string | null;
    phone: string;
    city?: string;
    serviceType: ServiceType;
    description: string;
    status: string;
    createdAt: string;
  };
};

type ProviderDashboardProps = {
  providerId: string;
  providerName: string;
  providerNumber: number;
  initialRemainingQuota: number;
  initialLeadsCount: number;
};

export function ProviderDashboard({
  providerId,
  providerName,
  providerNumber,
  initialRemainingQuota,
  initialLeadsCount,
}: ProviderDashboardProps) {
  const [leads, setLeads] = useState<LeadRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [connected, setConnected] = useState(false);
  const [leadsCount, setLeadsCount] = useState(initialLeadsCount);
  const seenIds = useRef(new Set<string>());

  const loadLeads = useCallback(async () => {
    const res = await fetch(`/api/leads?providerId=${providerId}`);
    const json = await res.json();
    if (res.ok) {
      const rows: LeadRow[] = json.leads.map(
        (item: {
          assignmentId: string;
          mandatory: boolean;
          assignedAt: string;
          lead: LeadRow["lead"];
        }) => ({
          assignmentId: item.assignmentId,
          mandatory: item.mandatory,
          assignedAt: item.assignedAt,
          lead: {
            ...item.lead,
            createdAt:
              typeof item.lead.createdAt === "string"
                ? item.lead.createdAt
                : new Date(item.lead.createdAt).toISOString(),
          },
        })
      );
      rows.forEach((r) => seenIds.current.add(r.assignmentId));
      setLeads(rows);
      setLeadsCount(json.leadsReceivedCount ?? rows.length);
    }
    setLoading(false);
  }, [providerId]);

  useEffect(() => {
    loadLeads();
  }, [loadLeads]);

  useEffect(() => {
    const source = new EventSource(
      `/api/leads/stream?providerId=${encodeURIComponent(providerId)}`
    );

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);

    source.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === "connected") {
        setConnected(true);
        return;
      }

      if (data.type === "lead_assigned") {
        const assignment = data.assignment;
        if (seenIds.current.has(assignment.id)) return;
        seenIds.current.add(assignment.id);

        setLeadsCount((c) => c + 1);
        setLeads((prev) => [
          {
            assignmentId: assignment.id,
            mandatory: assignment.mandatory,
            assignedAt: assignment.assignedAt,
            lead: assignment.lead,
          },
          ...prev,
        ]);
      }
    };

    return () => source.close();
  }, [providerId]);

  return (
    <div>
      <div className="dashboard-toolbar">
        <div>
          <h2 style={{ margin: 0 }}>
            Provider {providerNumber}: {providerName}
          </h2>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Live feed · quota remaining: <strong>{initialRemainingQuota}</strong>{" "}
            · leads received: <strong>{leadsCount}</strong>
          </p>
        </div>
        <span className="badge badge-live">
          <span
            className={`status-dot ${connected ? "connected" : ""}`}
            style={{ marginRight: "0.35rem", verticalAlign: "middle" }}
          />
          {connected ? "Live" : "Connecting…"}
        </span>
      </div>

      <h3 className="panel-subtitle">Assigned leads</h3>

      {loading ? (
        <p className="muted">Loading leads…</p>
      ) : leads.length === 0 ? (
        <p className="muted">No leads yet.</p>
      ) : (
        <ul className="lead-list">
          {leads.map((row) => (
            <li key={row.assignmentId} className="lead-item">
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <strong>{row.lead.customerName}</strong>
                <span className="badge">
                  {SERVICE_LABELS[row.lead.serviceType]}
                </span>
                {row.mandatory && (
                  <span className="badge badge-mandatory">Mandatory</span>
                )}
              </div>
              <p style={{ margin: "0.5rem 0" }}>{row.lead.description}</p>
              <div className="lead-meta">
                <span>{row.lead.phone}</span>
                {row.lead.city && <span>{row.lead.city}</span>}
                <span>
                  Assigned {formatDateTime(row.assignedAt)}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
