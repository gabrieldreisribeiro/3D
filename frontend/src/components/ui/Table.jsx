function Table({
  columns,
  rows,
  renderRow,
  empty,
  maxHeightClass = '',
  stickyHeader = true,
}) {
  if (!rows.length) return empty;

  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className={maxHeightClass ? `overflow-y-auto ${maxHeightClass}` : ''}>
        <table className="min-w-[680px] w-full bg-white text-sm [&_td]:px-3 [&_td]:py-3 [&_td]:align-middle sm:[&_td]:px-4 [&_tr:hover]:bg-slate-50/70">
          <thead className={stickyHeader ? 'md:sticky md:top-0 md:z-10' : ''}>
            <tr className="border-b border-slate-200 bg-slate-50/90 text-left">
              {columns.map((column) => (
                <th key={column} className="px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">{rows.map(renderRow)}</tbody>
        </table>
      </div>
    </div>
  );
}

export default Table;
