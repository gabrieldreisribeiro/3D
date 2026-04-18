function Button({
  variant = 'primary',
  loading = false,
  loadingText = 'Carregando...',
  icon = null,
  className = '',
  children,
  ...props
}) {
  const styles = {
    primary:
      'bg-violet-600 text-white shadow-sm hover:bg-violet-700 hover:shadow-glow focus-visible:ring-violet-200',
    secondary:
      'border border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:text-violet-700 focus-visible:ring-violet-200',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-200',
    danger: 'bg-rose-600 text-white shadow-sm hover:bg-rose-700 focus-visible:ring-rose-200',
  };

  return (
    <button
      className={`inline-flex h-11 items-center justify-center gap-2 rounded-[10px] px-4 text-sm font-semibold tracking-tight transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant] || styles.primary} ${className}`.trim()}
      disabled={loading || props.disabled}
      {...props}
    >
      {icon ? <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span> : null}
      <span>{loading ? loadingText : children}</span>
    </button>
  );
}

export default Button;
