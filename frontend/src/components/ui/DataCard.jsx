function DataCard({ title, children, action = null }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <header className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="break-words text-base font-semibold tracking-tight text-slate-900">{title}</h3>
        {action ? <div className="w-full sm:w-auto [&_button]:w-full sm:[&_button]:w-auto">{action}</div> : null}
      </header>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default DataCard;
