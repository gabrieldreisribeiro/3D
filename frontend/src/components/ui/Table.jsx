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
    <div className="overflow-x-auto rounded-xl border border-slate-200">
      <div className={maxHeightClass ? `overflow-y-auto ${maxHeightClass}` : ''}>
        <table className="min-w-[680px] w-full bg-white text-sm [&_td]:px-3 [&_td]:py-3 [&_td]:align-middle sm:[&_td]:px-4 [&_tr:hover]:bg-slate-50/70">
          <thead className={stickyHeader ? 'md:sticky md:top-0 md:z-10' : ''}>
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
    </div>
  );
}

export default Table;
