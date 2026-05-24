"use client";

import { FormEvent, useState } from "react";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/services";

type Assignment = {
  providerId: string;
  providerName: string;
  providerNumber?: number;
  mandatory: boolean;
};

type Skipped = {
  providerId: string;
  providerName: string;
  reason: string;
  mandatory: boolean;
};

export function EnquiryForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<{
    leadId: string;
    assignments: Assignment[];
    skipped: Skipped[];
  } | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const form = e.currentTarget;
    const data = new FormData(form);

    try {
      const res = await fetch("/api/enquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: data.get("customerName"),
          email: data.get("email"),
          phone: data.get("phone") || undefined,
          serviceType: data.get("serviceType"),
          description: data.get("description"),
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error ?? "Submission failed");
      }

      setSuccess({
        leadId: json.lead.id,
        assignments: json.assignments,
        skipped: json.skipped ?? [],
      });
      form.reset();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Service enquiry</h2>
      <p className="muted">
        Submit a request and the system will store it as a lead and assign it to
        providers: mandatory rules first, then round-robin fair pool (3 total).
      </p>

      <form className="form-grid" onSubmit={handleSubmit} style={{ marginTop: "1.25rem" }}>
        <label>
          Your name
          <input name="customerName" required placeholder="Jane Smith" />
        </label>

        <label>
          Email
          <input name="email" type="email" required placeholder="jane@example.com" />
        </label>

        <label>
          Phone (optional)
          <input name="phone" type="tel" placeholder="+1 555 0100" />
        </label>

        <label>
          Service type
          <select name="serviceType" required defaultValue="">
            <option value="" disabled>
              Select a service
            </option>
            {SERVICE_TYPES.map((type) => (
              <option key={type} value={type}>
                {SERVICE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label>
          Description
          <textarea
            name="description"
            required
            placeholder="Describe what you need help with..."
          />
        </label>

        <button type="submit" className="btn" disabled={loading}>
          {loading ? "Submitting…" : "Submit enquiry"}
        </button>
      </form>

      {error && <div className="alert alert-error">{error}</div>}

      {success && (
        <div className="alert alert-success">
          <p>
            <strong>Lead created</strong> (ID: {success.leadId})
          </p>
          <p>Assigned to {success.assignments.length} provider(s):</p>
          <ul>
            {success.assignments.map((a) => (
              <li key={a.providerId}>
                Provider {a.providerNumber ?? "—"} — {a.providerName}
                {a.mandatory ? " (mandatory)" : " (round-robin fair pool)"}
              </li>
            ))}
          </ul>
          {success.skipped.length > 0 && (
            <>
              <p style={{ marginTop: "0.75rem" }}>
                Skipped (quota or inactive):
              </p>
              <ul>
                {success.skipped.map((s) => (
                  <li key={`${s.providerId}-${s.reason}`}>
                    {s.providerName}
                    {s.mandatory ? " (mandatory)" : ""} — {s.reason.replace(/_/g, " ")}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}
