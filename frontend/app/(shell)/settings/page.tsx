import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { SettingsView } from "@/components/settings/settings-view";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader
        title="Configuration"
        description="System parameters, AI processing thresholds, and operational routing rules — read-only until the admin API exists."
      />
      <PageContainer>
        <SettingsView />
      </PageContainer>
    </>
  );
}
