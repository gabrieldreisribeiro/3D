function SectionHeader({ eyebrow, title, subtitle, action = null, className = '' }) {
  return (
    <div className={`section-header-pro ${className}`.trim()}>
      <div>
        {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
        <h2>{title}</h2>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export default SectionHeader;
