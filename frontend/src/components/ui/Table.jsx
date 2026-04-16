function Table({ columns, rows, renderRow, empty }) {
  if (!rows.length) return empty;

  return (
    <div className="table-wrap">
      <table className="table-pro">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column}>{column}</th>
            ))}
          </tr>
        </thead>
        <tbody>{rows.map(renderRow)}</tbody>
      </table>
    </div>
  );
}

export default Table;
