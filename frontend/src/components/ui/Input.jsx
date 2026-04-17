function Input({ label, className = '', ...props }) {
  return (
    <label className={`flex flex-col gap-1.5 ${className}`.trim()}>
      {label ? <span className="text-xs font-medium uppercase tracking-wide text-slate-500">{label}</span> : null}
      <input
        className="h-11 rounded-[10px] border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
        {...props}
      />
    </label>
  );
}

export default Input;
