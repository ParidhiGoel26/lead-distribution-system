import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "Lead Distribution System",
  description: "Service enquiry capture and fair lead distribution to providers",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <header className="site-header">
          <div className="inner">
            <h1>Lead Distribution System</h1>
            <nav className="nav-links">
              <Link href="/request-service">Request service</Link>
              <Link href="/dashboard">Provider dashboard</Link>
              {process.env.TEST_TOOLS_ENABLED === "true" && (
                <Link href="/test-tools">Test tools</Link>
              )}
            </nav>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
