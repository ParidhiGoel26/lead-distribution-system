"use client";

import { FormEvent, useState } from "react";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/services";

type Assignment = {
  providerId: string;
  providerName: string;
  providerNumber: number;
  mandatory: boolean;
};

type Skipped = {
  providerName: string;
  reason: string;
  mandatory: boolean;
};

const emptyForm = {
  name: "",
  phone: "",
  city: "",
  serviceType: "",
  description: "",
};

export function ServiceRequestForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fields, setFields] = useState(emptyForm);
  const [success, setSuccess] = useState<{
    leadId: string;
    assignments: Assignment[];
    skipped: Skipped[];
  } | null>(null);

  function startAnotherRequest() {
    setSuccess(null);
    setError(null);
    setFields(emptyForm);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/service-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.name,
          phone: fields.phone,
          city: fields.city,
          serviceType: fields.serviceType,
          description: fields.description,
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
      setFields(emptyForm);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2>Request a service</h2>
      <p className="muted">
        Submit your details below. Each phone number can request each service type
        once — the same number may request different services.
      </p>

      {success && (
        <div className="alert alert-success" style={{ marginTop: "1.25rem" }}>
          <p>
            <strong>Request received</strong> — assigned to{" "}
            {success.assignments.length} of 3 provider(s).
            {success.assignments.length < 3 && (
              <span>
                {" "}
                (Some providers were at monthly quota — see skipped list.)
              </span>
            )}
          </p>
          <ul>
            {success.assignments.map((a) => (
              <li key={a.providerId}>
                Provider {a.providerNumber} — {a.providerName}
                {a.mandatory ? " (mandatory)" : " (fair pool)"}
              </li>
            ))}
          </ul>
          {success.skipped.length > 0 && (
            <p className="muted" style={{ marginTop: "0.5rem" }}>
              Skipped (quota):{" "}
              {success.skipped.map((s) => s.providerName).join(", ")}
            </p>
          )}
          <div className="form-actions" style={{ marginTop: "1rem" }}>
            <button
              type="button"
              className="btn"
              onClick={startAnotherRequest}
            >
              Submit another request
            </button>
            <a href="/dashboard" className="btn btn-secondary">
              View dashboard
            </a>
          </div>
        </div>
      )}

      {!success && (
        <form
          className="form-grid"
          onSubmit={handleSubmit}
          style={{ marginTop: "1.25rem" }}
        >
          <label>
            Name
            <input
              name="name"
              required
              placeholder="Jane Smith"
              autoComplete="name"
              value={fields.name}
              onChange={(e) =>
                setFields((f) => ({ ...f, name: e.target.value }))
              }
            />
          </label>

          <label>
            Phone number
            <input
              name="phone"
              type="tel"
              required
              placeholder="9999999999"
              autoComplete="tel"
              value={fields.phone}
              onChange={(e) =>
                setFields((f) => ({ ...f, phone: e.target.value }))
              }
            />
          </label>

          <label>
            City
            <input
              name="city"
              required
              placeholder="Mumbai"
              autoComplete="address-level2"
              value={fields.city}
              onChange={(e) =>
                setFields((f) => ({ ...f, city: e.target.value }))
              }
            />
          </label>

          <label>
            Service type
            <select
              name="serviceType"
              required
              value={fields.serviceType}
              onChange={(e) =>
                setFields((f) => ({ ...f, serviceType: e.target.value }))
              }
            >
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
              placeholder="Describe what you need..."
              value={fields.description}
              onChange={(e) =>
                setFields((f) => ({ ...f, description: e.target.value }))
              }
            />
          </label>

          <button type="submit" className="btn" disabled={loading}>
            {loading ? "Submitting…" : "Submit request"}
          </button>
        </form>
      )}

      {error && <div className="alert alert-error">{error}</div>}
    </div>
  );
}
