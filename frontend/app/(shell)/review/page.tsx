import type { Metadata } from "next";
import { ReviewQueueView } from "@/components/review/review-queue-view";

export const metadata: Metadata = { title: "Review Queue" };

export default function ReviewPage() {
  return <ReviewQueueView />;
}
