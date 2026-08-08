import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Schemas, thresholds, tier policy, model routing." />
      <PageContainer>
        <InProgressState
          phase="F7"
          note="A read-only schema browser and threshold/tier-policy views land in F7 — clearly marked read-only until the admin API exists (Track B)."
        />
      </PageContainer>
    </>
  );
}
