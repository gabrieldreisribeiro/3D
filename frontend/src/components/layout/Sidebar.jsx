function Sidebar({ brand, subtitle, links, footer, className = '' }) {
  return (
    <aside className={`sticky top-0 hidden h-screen w-[280px] shrink-0 border-r border-slate-200 bg-white/95 p-5 backdrop-blur lg:flex lg:flex-col ${className}`.trim()}>
      <div className="mb-8 space-y-2">
        {brand}
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <nav className="flex flex-1 flex-col gap-1">{links}</nav>
      <div className="pt-4">{footer}</div>
    </aside>
  );
}

export default Sidebar;
