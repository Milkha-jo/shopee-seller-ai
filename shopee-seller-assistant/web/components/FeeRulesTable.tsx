import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { feeLabel, formatIDR, formatPercent } from "@/lib/format";
import type { FeeRule } from "@/types/api";

export function FeeRulesTable({ rules }: { rules: FeeRule[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Fee</TableHead>
          <TableHead>Rate</TableHead>
          <TableHead>Cap</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {rules.map((r) => (
          <TableRow key={r.id ?? r.feeType}>
            <TableCell className="font-medium">{feeLabel(r.feeType)}</TableCell>
            <TableCell>{formatPercent(r.rate)}</TableCell>
            <TableCell>
              {r.cap === null ? (
                <Badge variant="secondary">No cap</Badge>
              ) : (
                formatIDR(r.cap)
              )}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
