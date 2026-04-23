function MetricCard({ label, value, helper = null }) {
  return (
    <article className="glass-card rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <strong className="mt-2 block text-[30px] font-bold leading-none tracking-tight text-slate-900">{value}</strong>
      {helper ? <small className="mt-2 block text-xs text-slate-500">{helper}</small> : null}
    </article>
  );
}

export default MetricCard;
