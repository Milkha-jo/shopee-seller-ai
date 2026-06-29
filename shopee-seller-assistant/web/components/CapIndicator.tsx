import { Badge } from "@/components/ui/badge";

/** Shows whether a fee line hit its cap (data comes from the backend). */
export function CapIndicator({ capBound }: { capBound: boolean }) {
  return capBound ? (
    <Badge variant="warning">Cap applied</Badge>
  ) : (
    <Badge variant="secondary">Uncapped</Badge>
  );
}
