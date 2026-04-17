function Table({ columns, rows, renderRow, empty }) {
  if (!rows.length) return empty;

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <table className="min-w-full bg-white text-sm [&_td]:px-4 [&_td]:py-3 [&_td]:align-middle [&_tr:hover]:bg-slate-50/70">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left">
            {columns.map((column) => (
              <th key={column} className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                {column}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

export default Table;
