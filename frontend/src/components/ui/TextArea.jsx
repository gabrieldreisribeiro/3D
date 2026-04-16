function TextArea({ label, className = '', ...props }) {
  return (
    <label className={`field ${className}`.trim()}>
      {label ? <span className="field-label">{label}</span> : null}
      <textarea className="field-control field-textarea" {...props} />
    </label>
  );
}

export default TextArea;
