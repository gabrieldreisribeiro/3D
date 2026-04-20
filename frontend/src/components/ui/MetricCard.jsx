function MetricCard({ label, value, helper = null }) {
  return (
    <article className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span>
      <strong className="mt-2 block text-[30px] font-bold leading-none tracking-tight text-slate-900">{value}</strong>
      {helper ? <small className="mt-2 block text-xs text-slate-500">{helper}</small> : null}
    </article>
  );
}

export default MetricCard;
