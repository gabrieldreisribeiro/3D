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
      'bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-sm hover:from-violet-700 hover:to-indigo-700 hover:shadow-md focus-visible:ring-violet-200',
    secondary:
      'border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 focus-visible:ring-slate-200',
    ghost: 'bg-transparent text-slate-700 hover:bg-slate-100/90 focus-visible:ring-slate-200',
    danger: 'bg-gradient-to-r from-rose-600 to-red-600 text-white shadow-sm hover:from-rose-700 hover:to-red-700 focus-visible:ring-rose-200',
  };

  return (
    <button
      className={`inline-flex h-10 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold tracking-tight transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-60 ${styles[variant] || styles.primary} ${className}`.trim()}
      disabled={loading || props.disabled}
      {...props}
    >
      {icon ? <span className="inline-flex h-4 w-4 items-center justify-center">{icon}</span> : null}
      <span>{loading ? loadingText : children}</span>
    </button>
  );
}

export default Button;
