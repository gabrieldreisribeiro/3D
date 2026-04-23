function Sidebar({ brand, subtitle, links, footer, className = '' }) {
  return (
    <aside className={`sticky top-0 hidden h-screen w-[296px] shrink-0 border-r border-slate-200/60 bg-white/50 p-5 backdrop-blur-2xl lg:flex lg:flex-col ${className}`.trim()}>
      <div className="mb-6 rounded-2xl border border-white/60 bg-white/70 p-4 shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
        {brand}
        {subtitle ? <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{subtitle}</p> : null}
      </div>
      <nav className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto pr-1">{links}</nav>
      <div className="pt-4">{footer}</div>
    </aside>
  );
}

export default Sidebar;
