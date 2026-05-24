import { notFound } from "next/navigation";
import { TestToolsPanel } from "@/components/TestToolsPanel";
import { isTestToolsEnabled } from "@/lib/test-tools";

export const dynamic = "force-dynamic";

export default function TestToolsPage() {
  if (!isTestToolsEnabled()) {
    notFound();
  }

  return (
    <main className="container">
      <div className="card">
        <h2>Webhook simulation (test panel)</h2>
        <p className="muted">
          Payment gateway simulation and load testing. Not available in production
          unless <code>TEST_TOOLS_ENABLED=true</code>.
        </p>
        <TestToolsPanel />
      </div>
    </main>
  );
}
