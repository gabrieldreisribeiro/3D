function ChartCard({ title, children }) {
  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm">
      <header className="mb-4 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      </header>
      <div className="min-h-[190px]">{children}</div>
    </section>
  );
}

export default ChartCard;
