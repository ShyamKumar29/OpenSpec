import type { Metadata } from "next";
import { RecordDetailView } from "@/components/record-detail/record-detail-view";

export const metadata: Metadata = { title: "Record Detail" };

export default async function RecordDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RecordDetailView id={id} />;
}
