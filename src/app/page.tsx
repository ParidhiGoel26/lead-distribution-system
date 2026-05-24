import Link from "next/link";

export default function HomePage() {
  return (
    <main className="container">
      <div className="card">
        <h2>Lead Distribution System</h2>
        <p className="muted">
          Customers submit service requests; leads are assigned to providers
          automatically using mandatory rules and fair round-robin pools.
        </p>
        <p style={{ marginTop: "1.25rem" }}>
          <Link href="/request-service" className="btn">
            Request a service
          </Link>
        </p>
        <p className="muted" style={{ marginTop: "1rem" }}>
          Providers:{" "}
          <Link href="/dashboard">open dashboard</Link>
        </p>
      </div>
    </main>
  );
}
