import { STATUS_BADGES } from "../../utils/formatters";

export function StatusBadge({ status }) {
  const config = STATUS_BADGES[status] ?? {
    label: status ?? "SEM REGISTRO",
    className: "status-unknown",
  };
  return (
    <span className={`status-badge ${config.className}`}>{config.label}</span>
  );
}

export default StatusBadge;