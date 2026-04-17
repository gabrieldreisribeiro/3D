function MetricCard({ label, value, helper = null }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <strong className="mt-2 block text-2xl font-bold tracking-tight text-slate-900">{value}</strong>
      {helper ? <small className="mt-1 block text-xs text-slate-500">{helper}</small> : null}
    </article>
  );
}

export default MetricCard;
