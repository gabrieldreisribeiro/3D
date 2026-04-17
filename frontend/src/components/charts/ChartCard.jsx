function ChartCard({ title, children }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-4">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      </header>
      <div>{children}</div>
    </section>
  );
}

export default ChartCard;
