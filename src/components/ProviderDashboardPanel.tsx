import Link from "next/link";
import { formatDateTime } from "@/lib/format-date";
import { SERVICE_LABELS, type ServiceType } from "@/lib/services";

export type DashboardAssignment = {
  id: string;
  mandatory: boolean;
  assignedAt: Date;
  lead: {
    id: string;
    customerName: string;
    phone: string;
    city: string;
    serviceType: ServiceType;
    description: string;
    createdAt: Date;
  };
};

type ProviderDashboardPanelProps = {
  providerId: string;
  providerNumber: number;
  name: string;
  email: string;
  monthlyQuota: number;
  monthlyUsed: number;
  leadsReceivedCount: number;
  assignments: DashboardAssignment[];
};

export function ProviderDashboardPanel({
  providerId,
  providerNumber,
  name,
  email,
  monthlyQuota,
  monthlyUsed,
  leadsReceivedCount,
  assignments,
}: ProviderDashboardPanelProps) {
  const remaining = Math.max(0, monthlyQuota - monthlyUsed);

  return (
    <section className="provider-panel">
      <div className="provider-panel-header">
        <div>
          <h3>
            Provider {providerNumber}: {name}
          </h3>
          <p className="muted">{email}</p>
        </div>
        <div className="stats-row">
          <div className="stat-box">
            <span className="stat-label">Remaining quota</span>
            <strong className="stat-value">
              {remaining} / {monthlyQuota}
            </strong>
          </div>
          <div className="stat-box">
            <span className="stat-label">Leads received</span>
            <strong className="stat-value">{leadsReceivedCount}</strong>
          </div>
        </div>
      </div>

      <p style={{ margin: "0 0 0.75rem" }}>
        <Link href={`/dashboard/${providerId}`} className="btn btn-secondary btn-sm">
          Open live feed →
        </Link>
      </p>

      <h4 className="panel-subtitle">Assigned leads</h4>
      {assignments.length === 0 ? (
        <p className="muted">No leads assigned yet.</p>
      ) : (
        <ul className="lead-list lead-list-compact">
          {assignments.map((a) => (
            <li key={a.id} className="lead-item">
              <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                <strong>{a.lead.customerName}</strong>
                <span className="badge">
                  {SERVICE_LABELS[a.lead.serviceType]}
                </span>
                {a.mandatory && (
                  <span className="badge badge-mandatory">Mandatory</span>
                )}
              </div>
              <p style={{ margin: "0.35rem 0" }}>{a.lead.description}</p>
              <div className="lead-meta">
                <span>{a.lead.phone}</span>
                <span>{a.lead.city}</span>
                <span>{formatDateTime(a.assignedAt)}</span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
