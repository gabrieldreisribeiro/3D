function Select({ label, options = [], className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {label ? <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{label}</span> : null}
      <select
        className="h-11 rounded-xl border border-slate-200 bg-white/90 px-3 text-sm text-slate-700 shadow-sm outline-none transition duration-200 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100"
        {...props}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export default Select;
