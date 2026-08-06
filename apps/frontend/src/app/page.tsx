import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { DashboardPage } from "@/features/dashboard/dashboard-page";

export default function Home() {
  return (
    <DashboardLayout>
      <DashboardPage />
    </DashboardLayout>
  );
}
