function ChartCard({ title, children }) {
  return (
    <section className="chart-card">
      <header>
        <h3>{title}</h3>
      </header>
      <div>{children}</div>
    </section>
  );
}

export default ChartCard;
