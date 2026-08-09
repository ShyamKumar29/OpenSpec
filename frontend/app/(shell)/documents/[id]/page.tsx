import type { Metadata } from "next";
import { DocumentDetailView } from "@/components/documents/document-detail-view";

export const metadata: Metadata = { title: "Document" };

export default async function DocumentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <DocumentDetailView documentVersionId={id} />;
}
