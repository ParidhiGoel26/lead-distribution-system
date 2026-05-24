import { NextResponse } from "next/server";
import { createLeadAndDistribute } from "@/lib/distribution";
import { DuplicateLeadError, isDuplicateLeadError } from "@/lib/errors";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { isServiceType } from "@/lib/services";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, phone, city, serviceType, description } = body;

    if (!name?.trim() || !phone?.trim() || !city?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: "Name, phone, city, and description are required." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json(
        { error: "Please enter a valid phone number (7–15 digits)." },
        { status: 400 }
      );
    }

    if (!isServiceType(serviceType)) {
      return NextResponse.json(
        { error: "Invalid service type." },
        { status: 400 }
      );
    }

    const phoneNormalized = normalizePhone(phone);

    const result = await createLeadAndDistribute({
      customerName: name,
      phone: phone.trim(),
      phoneNormalized,
      city: city.trim(),
      serviceType,
      description,
    });

    return NextResponse.json(
      {
        message: "Service request submitted. Lead saved and providers assigned.",
        lead: result.lead,
        assignments: result.assignments,
        skipped: result.skipped,
        targetProviderCount: result.targetProviderCount,
        complete: result.complete,
      },
      { status: 201 }
    );
  } catch (error) {
    if (isDuplicateLeadError(error)) {
      const message =
        error instanceof DuplicateLeadError
          ? error.message
          : "Duplicate phone and service combination.";
      return NextResponse.json({ error: message }, { status: 409 });
    }

    console.error("Service request failed:", error);
    return NextResponse.json(
      { error: "Failed to process service request." },
      { status: 500 }
    );
  }
}
