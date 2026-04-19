function SectionHeader({ eyebrow, title, subtitle, action = null, className = '' }) {
  return (
    <div className={`flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between ${className}`.trim()}>
      <div className="min-w-0 space-y-1">
        {eyebrow ? <span className="text-xs font-semibold uppercase tracking-[0.16em] text-violet-600">{eyebrow}</span> : null}
        <h2 className="break-words text-xl font-bold tracking-tight text-slate-900 sm:text-2xl">{title}</h2>
        {subtitle ? <p className="max-w-3xl text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto sm:shrink-0 [&_button]:w-full sm:[&_button]:w-auto">{action}</div> : null}
    </div>
  );
}

export default SectionHeader;
