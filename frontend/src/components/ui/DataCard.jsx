function DataCard({ title, children, action = null }) {
  return (
    <section className="data-card">
      <header className="data-card-header">
        <h3>{title}</h3>
        {action}
      </header>
      <div className="data-card-body">{children}</div>
    </section>
  );
}

export default DataCard;
