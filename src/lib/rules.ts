import type { ServiceType } from "@/lib/services";

/** Every lead is assigned to exactly this many providers */
export const PROVIDERS_PER_LEAD = 3;

/**
 * Mandatory provider numbers (1–8) per service.
 * Service 1 → P1 | Service 2 → P5 | Service 3 → P1 + P4
 */
export const MANDATORY_PROVIDER_NUMBERS: Record<ServiceType, readonly number[]> = {
  SERVICE_1: [1],
  SERVICE_2: [5],
  SERVICE_3: [1, 4],
};

/**
 * Fair round-robin pools (provider numbers) after mandatory assignments.
 * Service 1 → P2,P3,P4 | Service 2 → P6,P7,P8 | Service 3 → P2,P3,P5,P6,P7,P8
 */
export const FAIR_POOL_PROVIDER_NUMBERS: Record<ServiceType, readonly number[]> = {
  SERVICE_1: [2, 3, 4],
  SERVICE_2: [6, 7, 8],
  SERVICE_3: [2, 3, 5, 6, 7, 8],
};

export const MONTHLY_QUOTA_PER_PROVIDER = 10;
