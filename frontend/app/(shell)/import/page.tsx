import type { Metadata } from "next";
import { PageHeader } from "@/components/shell/page-header";
import { PageContainer } from "@/components/shell/page-container";
import { InProgressState } from "@/components/state/in-progress";

export const metadata: Metadata = { title: "Import" };

export default function ImportPage() {
  return (
    <>
      <PageHeader
        title="Import"
        description="Upload, column mapping, validation preview, progress."
      />
      <PageContainer>
        <InProgressState
          phase="F6"
          note="Drag/drop upload, column mapping, and row-level validation land in F6 (demo beat 1)."
        />
      </PageContainer>
    </>
  );
}
