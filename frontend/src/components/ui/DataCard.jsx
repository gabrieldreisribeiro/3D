function DataCard({ title, children, action = null }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex items-center justify-between gap-3">
        <h3 className="text-base font-semibold tracking-tight text-slate-900">{title}</h3>
        {action}
      </header>
      <div>{children}</div>
    </section>
  );
}

export default DataCard;
