function ChartCard({ title, children }) {
  return (
    <section className="glass-card rounded-2xl p-4 transition-all duration-300 hover:-translate-y-1 hover:shadow-lg">
      <header className="mb-4 border-b border-slate-100 pb-3">
        <h3 className="text-sm font-semibold tracking-tight text-slate-900">{title}</h3>
      </header>
      <div className="min-h-[190px]">{children}</div>
    </section>
  );
}

export default ChartCard;
