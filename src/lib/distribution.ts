import { Prisma, ServiceType as PrismaServiceType } from "@prisma/client";
import { prisma } from "@/lib/db";
import { DuplicateLeadError } from "@/lib/errors";
import { normalizePhone } from "@/lib/phone";
import {
  getCurrentMonthKey,
  releaseMonthlySlot,
  tryReserveMonthlySlot,
  type DbClient,
} from "@/lib/quota";
import { claimNextFairPoolIndex } from "@/lib/round-robin";
import { publishLeadAssigned, type LeadAssignedEvent } from "@/lib/realtime";
import {
  FAIR_POOL_PROVIDER_NUMBERS,
  MANDATORY_PROVIDER_NUMBERS,
  PROVIDERS_PER_LEAD,
} from "@/lib/rules";
import type { ServiceType } from "@/lib/services";

export type CreateEnquiryInput = {
  customerName: string;
  phone: string;
  phoneNormalized?: string;
  city: string;
  serviceType: ServiceType;
  description: string;
  email?: string | null;
};

export type SkippedAssignment = {
  providerId: string;
  providerName: string;
  providerNumber: number;
  reason: "monthly_quota_exceeded" | "inactive" | "already_assigned";
  mandatory: boolean;
};

export type DistributionResult = {
  lead: {
    id: string;
    customerName: string;
    phone: string;
    city: string;
    email: string | null;
    serviceType: ServiceType;
    description: string;
    status: string;
    createdAt: Date;
  };
  assignments: Array<{
    providerId: string;
    providerName: string;
    providerNumber: number;
    mandatory: boolean;
  }>;
  skipped: SkippedAssignment[];
  targetProviderCount: number;
  complete: boolean;
};

type ProviderRecord = {
  id: string;
  providerNumber: number;
  name: string;
  active: boolean;
  monthlyLeadQuota: number;
};

async function loadProvidersByNumber(): Promise<Map<number, ProviderRecord>> {
  const providers = await prisma.provider.findMany({
    select: {
      id: true,
      providerNumber: true,
      name: true,
      active: true,
      monthlyLeadQuota: true,
    },
  });
  return new Map(providers.map((p) => [p.providerNumber, p]));
}

/**
 * Core distribution (Feature 2):
 * - Exactly 3 providers per lead (when quota allows)
 * - Mandatory first, then persisted round-robin fair pool
 * - Monthly quota enforced atomically
 * - DB unique on [leadId, providerId] prevents duplicate assignment
 */
export async function createLeadAndDistribute(
  input: CreateEnquiryInput
): Promise<DistributionResult> {
  const targetProviderCount = PROVIDERS_PER_LEAD;
  const serviceType = input.serviceType as PrismaServiceType;
  const monthKey = getCurrentMonthKey();
  const providerByNumber = await loadProvidersByNumber();

  const phoneNormalized =
    input.phoneNormalized ?? normalizePhone(input.phone);
  const phone = input.phone.trim();

  let lead;
  try {
    lead = await prisma.lead.create({
      data: {
        customerName: input.customerName.trim(),
        phone,
        phoneNormalized,
        city: input.city.trim(),
        email: input.email?.trim().toLowerCase() || null,
        serviceType,
        description: input.description.trim(),
        status: "NEW",
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new DuplicateLeadError();
    }
    throw error;
  }

  const assignedIds = new Set<string>();
  const assignments: DistributionResult["assignments"] = [];
  const skipped: SkippedAssignment[] = [];
  const createdAssignmentIds: string[] = [];
  const reservations: Array<{ providerId: string }> = [];

  try {
    for (const providerNumber of MANDATORY_PROVIDER_NUMBERS[input.serviceType]) {
      const provider = providerByNumber.get(providerNumber);
      if (!provider) continue;

      await tryAssignProvider({
        provider,
        mandatory: true,
        leadId: lead.id,
        monthKey,
        assignedIds,
        assignments,
        skipped,
        createdAssignmentIds,
        reservations,
      });
    }

    const fairPool = FAIR_POOL_PROVIDER_NUMBERS[input.serviceType];
    const maxFairAttempts = Math.max(
      fairPool.length * targetProviderCount * 2,
      fairPool.length
    );
    let fairAttempts = 0;

    while (
      assignedIds.size < targetProviderCount &&
      fairAttempts < maxFairAttempts
    ) {
      const poolIndex = await claimNextFairPoolIndex(input.serviceType);
      const providerNumber = fairPool[poolIndex];
      fairAttempts++;

      const provider = providerByNumber.get(providerNumber);
      if (!provider) continue;

      if (assignedIds.has(provider.id)) continue;

      await tryAssignProvider({
        provider,
        mandatory: false,
        leadId: lead.id,
        monthKey,
        assignedIds,
        assignments,
        skipped,
        createdAssignmentIds,
        reservations,
      });
    }

    const complete = assignments.length === targetProviderCount;

    const updatedLead = await prisma.lead.update({
      where: { id: lead.id },
      data: { status: assignments.length > 0 ? "ASSIGNED" : "NEW" },
    });

    const result: DistributionResult = {
      lead: {
        id: updatedLead.id,
        customerName: updatedLead.customerName,
        phone: updatedLead.phone,
        city: updatedLead.city,
        email: updatedLead.email,
        serviceType: updatedLead.serviceType as ServiceType,
        description: updatedLead.description,
        status: updatedLead.status,
        createdAt: updatedLead.createdAt,
      },
      assignments,
      skipped,
      targetProviderCount,
      complete,
    };

    await publishAssignmentsForLead(lead.id, result);
    return result;
  } catch (error) {
    await rollbackAssignments(createdAssignmentIds, reservations, monthKey);
    throw error;
  }
}

type TryAssignParams = {
  provider: ProviderRecord;
  mandatory: boolean;
  leadId: string;
  monthKey: string;
  assignedIds: Set<string>;
  assignments: DistributionResult["assignments"];
  skipped: SkippedAssignment[];
  createdAssignmentIds: string[];
  reservations: Array<{ providerId: string }>;
};

async function tryAssignProvider(params: TryAssignParams): Promise<boolean> {
  const { provider, mandatory, monthKey } = params;

  if (params.assignedIds.has(provider.id)) {
    params.skipped.push({
      providerId: provider.id,
      providerName: provider.name,
      providerNumber: provider.providerNumber,
      reason: "already_assigned",
      mandatory,
    });
    return false;
  }

  if (!provider.active) {
    params.skipped.push({
      providerId: provider.id,
      providerName: provider.name,
      providerNumber: provider.providerNumber,
      reason: "inactive",
      mandatory,
    });
    return false;
  }

  const assigned = await assignToProvider(prisma, {
    leadId: params.leadId,
    provider,
    mandatory,
    monthKey,
    assignedIds: params.assignedIds,
    assignments: params.assignments,
    createdAssignmentIds: params.createdAssignmentIds,
    reservations: params.reservations,
  });

  if (!assigned) {
    params.skipped.push({
      providerId: provider.id,
      providerName: provider.name,
      providerNumber: provider.providerNumber,
      reason: "monthly_quota_exceeded",
      mandatory,
    });
  }

  return assigned;
}

type AssignContext = {
  leadId: string;
  provider: ProviderRecord;
  mandatory: boolean;
  monthKey: string;
  assignedIds: Set<string>;
  assignments: DistributionResult["assignments"];
  createdAssignmentIds: string[];
  reservations: Array<{ providerId: string }>;
};

async function assignToProvider(
  db: DbClient,
  ctx: AssignContext
): Promise<boolean> {
  const { provider, monthKey } = ctx;

  if (ctx.assignedIds.has(provider.id)) {
    return false;
  }

  const reserved = await tryReserveMonthlySlot(
    db,
    provider.id,
    provider.monthlyLeadQuota,
    monthKey
  );
  if (!reserved) return false;

  ctx.reservations.push({ providerId: provider.id });

  try {
    const assignment = await db.leadAssignment.create({
      data: {
        leadId: ctx.leadId,
        providerId: provider.id,
        mandatory: ctx.mandatory,
      },
    });

    ctx.createdAssignmentIds.push(assignment.id);
    ctx.assignedIds.add(provider.id);
    ctx.assignments.push({
      providerId: provider.id,
      providerName: provider.name,
      providerNumber: provider.providerNumber,
      mandatory: ctx.mandatory,
    });

    return true;
  } catch (error) {
    await releaseMonthlySlot(db, provider.id, monthKey);
    const idx = ctx.reservations.findIndex((r) => r.providerId === provider.id);
    if (idx >= 0) ctx.reservations.splice(idx, 1);

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      ctx.assignedIds.add(provider.id);
      return false;
    }
    throw error;
  }
}

async function rollbackAssignments(
  assignmentIds: string[],
  reservations: Array<{ providerId: string }>,
  monthKey: string
): Promise<void> {
  if (assignmentIds.length > 0) {
    await prisma.leadAssignment.deleteMany({
      where: { id: { in: assignmentIds } },
    });
  }

  for (const { providerId } of reservations) {
    await releaseMonthlySlot(prisma, providerId, monthKey);
  }
}

async function publishAssignmentsForLead(
  leadId: string,
  result: DistributionResult
): Promise<void> {
  const createdAssignments = await prisma.leadAssignment.findMany({
    where: { leadId },
  });

  for (const assignment of createdAssignments) {
    const event: LeadAssignedEvent = {
      providerId: assignment.providerId,
      assignment: {
        id: assignment.id,
        mandatory: assignment.mandatory,
        assignedAt: assignment.assignedAt.toISOString(),
        lead: {
          id: result.lead.id,
          customerName: result.lead.customerName,
          phone: result.lead.phone,
          city: result.lead.city,
          email: result.lead.email,
          serviceType: result.lead.serviceType,
          description: result.lead.description,
          status: result.lead.status,
          createdAt: result.lead.createdAt.toISOString(),
        },
      },
    };
    publishLeadAssigned(event);
  }
}
