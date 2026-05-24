/** Mirrors Prisma ServiceType enum — safe for client components */
export const SERVICE_TYPES = ["SERVICE_1", "SERVICE_2", "SERVICE_3"] as const;

export type ServiceType = (typeof SERVICE_TYPES)[number];

export const SERVICE_LABELS: Record<ServiceType, string> = {
  SERVICE_1: "Service 1",
  SERVICE_2: "Service 2",
  SERVICE_3: "Service 3",
};

export function isServiceType(value: string): value is ServiceType {
  return (SERVICE_TYPES as readonly string[]).includes(value);
}
