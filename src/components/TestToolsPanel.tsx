"use client";

import { useState } from "react";
import { SERVICE_LABELS, SERVICE_TYPES } from "@/lib/services";

type LogEntry = {
  time: string;
  title: string;
  detail: string;
};

export function TestToolsPanel() {
  const [loading, setLoading] = useState<string | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [serviceType, setServiceType] = useState("SERVICE_1");
  const [idempotencyKey, setIdempotencyKey] = useState(
    () => `idem-${Date.now()}`
  );

  function addLog(title: string, detail: string) {
    setLogs((prev) => [
      {
        time: new Date().toLocaleTimeString(),
        title,
        detail,
      },
      ...prev,
    ].slice(0, 20));
  }

  async function resetQuotaViaWebhook() {
    setLoading("reset");
    try {
      const key = `payment-reset-${Date.now()}`;
      const res = await fetch("/api/test-tools/invoke-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idempotencyKey: key }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      addLog(
        "Quota reset (webhook)",
        JSON.stringify(json.attempts[0], null, 2)
      );
    } catch (e) {
      addLog("Error", e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }

  async function testIdempotency() {
    setLoading("idempotent");
    try {
      const res = await fetch("/api/test-tools/invoke-webhook", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idempotencyKey,
          repeat: 5,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      addLog(
        `Idempotency test (key: ${idempotencyKey})`,
        `Applied: ${json.summary.firstApplied}, Replays: ${json.summary.replays} / ${json.repeat}`
      );
    } catch (e) {
      addLog("Error", e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }

  async function generateLeads() {
    setLoading("leads");
    try {
      const res = await fetch("/api/test-tools/generate-leads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: 10, serviceType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed");
      addLog(
        "Generate 10 leads",
        `${json.summary.created} leads, ${json.summary.totalAssignments} assignments, ${json.summary.complete} complete`
      );
    } catch (e) {
      addLog("Error", e instanceof Error ? e.message : "Request failed");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="alert alert-error" style={{ marginBottom: "1.25rem" }}>
        Test panel only. Quota resets run through the payment webhook — not
        from the customer form or provider dashboard.
      </div>

      <div className="test-tools-grid">
        <section className="test-tool-card">
          <h3>Reset provider quota to 10</h3>
          <p className="muted">
            Simulates payment gateway confirming subscription. Resets monthly
            usage via webhook (remaining quota = 10).
          </p>
          <button
            type="button"
            className="btn"
            disabled={loading !== null}
            onClick={resetQuotaViaWebhook}
          >
            {loading === "reset" ? "Calling webhook…" : "Simulate payment webhook"}
          </button>
        </section>

        <section className="test-tool-card">
          <h3>Webhook idempotency</h3>
          <p className="muted">
            Calls the same webhook 5 times with one idempotency key. Only the
            first call should reset quota.
          </p>
          <label>
            Idempotency key
            <input
              value={idempotencyKey}
              onChange={(e) => setIdempotencyKey(e.target.value)}
            />
          </label>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading !== null}
            onClick={testIdempotency}
            style={{ marginTop: "0.75rem" }}
          >
            {loading === "idempotent"
              ? "Calling…"
              : "Call webhook 5× (same key)"}
          </button>
        </section>

        <section className="test-tool-card">
          <h3>Generate 10 leads (concurrency)</h3>
          <p className="muted">
            Creates 10 leads in parallel to stress distribution and quota.
          </p>
          <label>
            Service type
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
            >
              {SERVICE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {SERVICE_LABELS[t]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="btn"
            disabled={loading !== null}
            onClick={generateLeads}
            style={{ marginTop: "0.75rem" }}
          >
            {loading === "leads" ? "Generating…" : "Generate 10 leads instantly"}
          </button>
        </section>
      </div>

      <h3 style={{ marginTop: "2rem" }}>Activity log</h3>
      {logs.length === 0 ? (
        <p className="muted">No actions yet.</p>
      ) : (
        <ul className="log-list">
          {logs.map((log, i) => (
            <li key={i} className="log-item">
              <strong>
                [{log.time}] {log.title}
              </strong>
              <pre>{log.detail}</pre>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
