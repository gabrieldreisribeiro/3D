function Select({ label, options = [], className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {label ? <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span> : null}
      <select
        className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
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
