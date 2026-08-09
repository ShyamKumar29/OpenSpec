import type { Metadata } from "next";
import { ReviewQueueView } from "@/components/review/review-queue-view";

export const metadata: Metadata = { title: "Review Task" };

export default async function ReviewTaskPage({ params }: { params: Promise<{ taskId: string }> }) {
  const { taskId } = await params;
  return <ReviewQueueView initialTaskId={taskId} />;
}
