function StatusBadge({ children, tone = 'neutral' }) {
  return <span className={`status-badge tone-${tone}`}>{children}</span>;
}

export default StatusBadge;
