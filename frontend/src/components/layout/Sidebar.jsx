function Sidebar({ brand, subtitle, links, footer, className = '' }) {
  return (
    <aside className={`sticky top-0 hidden h-screen w-[296px] shrink-0 border-r border-slate-200/80 bg-gradient-to-b from-white to-slate-50/90 p-5 backdrop-blur lg:flex lg:flex-col ${className}`.trim()}>
      <div className="mb-6 rounded-2xl border border-white/80 bg-white/80 p-4 shadow-sm">
        {brand}
        {subtitle ? <p className="mt-1 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">{subtitle}</p> : null}
      </div>
      <nav className="flex flex-1 min-h-0 flex-col gap-2 overflow-y-auto pr-1">{links}</nav>
      <div className="pt-4">{footer}</div>
    </aside>
  );
}

export default Sidebar;
