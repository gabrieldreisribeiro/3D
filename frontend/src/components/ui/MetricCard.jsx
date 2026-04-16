function MetricCard({ label, value, helper = null }) {
  return (
    <article className="metric-card-pro">
      <span>{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </article>
  );
}

export default MetricCard;
