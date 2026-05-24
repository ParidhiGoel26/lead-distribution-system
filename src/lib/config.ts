import { PROVIDERS_PER_LEAD } from "@/lib/rules";

export function getMaxProvidersPerLead(): number {
  const raw = process.env.MAX_PROVIDERS_PER_LEAD;
  if (raw === undefined || raw === "") return PROVIDERS_PER_LEAD;
  const parsed = parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : PROVIDERS_PER_LEAD;
}
