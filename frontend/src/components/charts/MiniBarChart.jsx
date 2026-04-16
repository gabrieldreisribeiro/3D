function MiniBarChart({ points = [], money = false }) {
  const max = Math.max(...points.map((item) => item.value), 1);

  return (
    <div className="mini-chart">
      {points.map((point) => {
        const height = Math.max(6, (point.value / max) * 100);
        return (
          <div className="mini-chart-item" key={point.label}>
            <span className="mini-chart-bar" style={{ height: `${height}%` }} />
            <small>{point.label}</small>
            <strong>{money ? `R$ ${point.value.toFixed(0)}` : point.value}</strong>
          </div>
        );
      })}
    </div>
  );
}

export default MiniBarChart;
