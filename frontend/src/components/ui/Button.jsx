function Button({ variant = 'primary', loading = false, icon = null, className = '', children, ...props }) {
  return (
    <button className={`btn btn-${variant} ${className}`.trim()} disabled={loading || props.disabled} {...props}>
      {icon ? <span className="btn-icon">{icon}</span> : null}
      <span>{loading ? 'Carregando...' : children}</span>
    </button>
  );
}

export default Button;
