function MiniBarChart({ points = [], money = false }) {
  const max = Math.max(...points.map((item) => item.value), 1);

  if (!points.length) {
    return <p className="text-sm text-slate-500">Sem dados para exibir.</p>;
  }

  return (
    <div className="flex min-h-[210px] items-end gap-3 overflow-x-auto pb-1">
      {points.map((point) => {
        const height = Math.max(10, (point.value / max) * 140);
        return (
          <div key={point.label} className="min-w-[68px] text-center">
            <div className="mx-auto flex h-40 items-end justify-center">
              <span
                className="w-8 rounded-t-md bg-gradient-to-t from-violet-600 to-fuchsia-500"
                style={{ height: `${height}px` }}
              />
            </div>
            <small className="mt-2 block text-xs text-slate-500">{point.label}</small>
            <strong className="block text-xs font-semibold text-slate-700">
              {money ? `R$ ${point.value.toFixed(0)}` : point.value}
            </strong>
          </div>
        );
      })}
    </div>
  );
}

export default MiniBarChart;
