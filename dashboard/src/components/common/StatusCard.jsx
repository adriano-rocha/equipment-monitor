export function StatusCard({ title, count, className }) {
  return (
    <div className={`status-card ${className}`}>
      <span className="status-card-title">{title}</span>
      <strong className="status-card-count">{count}</strong>
    </div>
  );
}

export default StatusCard;