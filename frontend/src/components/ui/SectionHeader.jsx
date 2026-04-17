function SectionHeader({ eyebrow, title, subtitle, action = null, className = '' }) {
  return (
    <div className={`flex flex-wrap items-end justify-between gap-4 ${className}`.trim()}>
      <div className="space-y-1">
        {eyebrow ? <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">{eyebrow}</span> : null}
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h2>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
