import { StatusBadge } from "@/components/attribute/status-badge";
import {
  RECORD_STATUS_DESCRIPTION,
  RECORD_STATUS_LABEL,
  RECORD_STATUS_SEMANTIC,
} from "@/lib/format/record-status";
import type { RecordStatus } from "@/lib/contracts/record";

/** Record-level status (distinct from an attribute value's status) — see
 *  lib/format/record-status.ts for the mapping onto the shared six-token colour system. */
export function RecordStatusBadge({
  status,
  className,
}: {
  status: RecordStatus;
  className?: string;
}) {
  return (
    <StatusBadge
      status={RECORD_STATUS_SEMANTIC[status]}
      label={RECORD_STATUS_LABEL[status]}
      className={className}
      title={RECORD_STATUS_DESCRIPTION[status]}
    />
  );
}
