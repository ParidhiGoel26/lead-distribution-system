import { EventEmitter } from "events";

export type LeadAssignedEvent = {
  providerId: string;
  assignment: {
    id: string;
    mandatory: boolean;
    assignedAt: string;
    lead: {
      id: string;
      customerName: string;
      phone: string;
      city: string;
      email: string | null;
      serviceType: string;
      description: string;
      status: string;
      createdAt: string;
    };
  };
};

export type QuotaResetEvent = {
  type: "quota_reset";
  monthKey: string;
  providerIds: string[];
};

export type DashboardEvent =
  | ({ type: "lead_assigned" } & LeadAssignedEvent)
  | QuotaResetEvent
  | { type: "connected" };

/** In-process pub/sub for SSE — not used for lead persistence */
const bus = new EventEmitter();
bus.setMaxListeners(200);

const DASHBOARD_CHANNEL = "dashboard";

export function publishLeadAssigned(event: LeadAssignedEvent): void {
  bus.emit(`provider:${event.providerId}`, event);
  bus.emit(DASHBOARD_CHANNEL, { type: "lead_assigned", ...event } satisfies DashboardEvent);
}

export function publishQuotaReset(event: QuotaResetEvent): void {
  bus.emit(DASHBOARD_CHANNEL, event);
}

export function subscribeLeadAssigned(
  providerId: string,
  listener: (event: LeadAssignedEvent) => void
): () => void {
  const channel = `provider:${providerId}`;
  bus.on(channel, listener);
  return () => bus.off(channel, listener);
}

export function subscribeDashboard(
  listener: (event: DashboardEvent) => void
): () => void {
  bus.on(DASHBOARD_CHANNEL, listener);
  return () => bus.off(DASHBOARD_CHANNEL, listener);
}
