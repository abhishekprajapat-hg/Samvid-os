import { Badge, cn } from "../ui";
import { getStatusMeta } from "./statusStyles";

const StatusBadge = ({ status, label, className }) => {
  const meta = getStatusMeta(status);

  return (
    <Badge variant={meta.tone} dot className={cn("whitespace-nowrap", className)}>
      {label || meta.label}
    </Badge>
  );
};

export default StatusBadge;
