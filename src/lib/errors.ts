import { Prisma } from "@prisma/client";

export class DuplicateLeadError extends Error {
  constructor() {
    super(
      "A lead already exists for this phone number and service type. You may submit a different service instead."
    );
    this.name = "DuplicateLeadError";
  }
}

export function isDuplicateLeadError(error: unknown): boolean {
  if (error instanceof DuplicateLeadError) return true;
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    return true;
  }
  return false;
}
