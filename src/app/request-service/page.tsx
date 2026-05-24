import { ServiceRequestForm } from "@/components/ServiceRequestForm";

export const metadata = {
  title: "Request Service | Lead Distribution System",
};

export default function RequestServicePage() {
  return (
    <main className="container">
      <ServiceRequestForm />
    </main>
  );
}
