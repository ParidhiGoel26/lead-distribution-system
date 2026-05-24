import { NextResponse } from "next/server";
import { createLeadAndDistribute } from "@/lib/distribution";
import { isDuplicateLeadError } from "@/lib/errors";
import { isValidPhone, normalizePhone } from "@/lib/phone";
import { isServiceType } from "@/lib/services";

/** Legacy endpoint — prefer POST /api/service-requests */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { customerName, email, phone, city, serviceType, description } = body;

    if (!customerName?.trim() || !phone?.trim() || !description?.trim()) {
      return NextResponse.json(
        { error: "Name, phone, and description are required." },
        { status: 400 }
      );
    }

    if (!isValidPhone(phone)) {
      return NextResponse.json({ error: "Invalid phone number." }, { status: 400 });
    }

    if (!isServiceType(serviceType)) {
      return NextResponse.json({ error: "Invalid service type." }, { status: 400 });
    }

    const result = await createLeadAndDistribute({
      customerName,
      phone: phone.trim(),
      phoneNormalized: normalizePhone(phone),
      city: city?.trim() || "Unknown",
      serviceType,
      description,
      email: email || null,
    });

    return NextResponse.json(
      {
        message: "Enquiry submitted. Lead assigned to providers.",
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
      return NextResponse.json(
        {
          error:
            "A lead already exists for this phone number and service type.",
        },
        { status: 409 }
      );
    }

    console.error("Enquiry submission failed:", error);
    return NextResponse.json(
      { error: "Failed to process enquiry." },
      { status: 500 }
    );
  }
}
