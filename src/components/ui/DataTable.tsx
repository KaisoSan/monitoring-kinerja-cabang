import type { ReactNode } from "react";

export type Column<T> = {
  key: string;
  header: ReactNode;
  align?: "left" | "right" | "center";
  render: (row: T, index: number) => ReactNode;
  className?: string;
};

const ALIGN = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
} as const;

export function DataTable<T>({
  columns,
  rows,
  getRowKey,
  emptyMessage = "Tidak ada data untuk filter ini.",
  maxHeight,
}: {
  columns: Column<T>[];
  rows: T[];
  getRowKey: (row: T, index: number) => string;
  emptyMessage?: string;
  /** Mis. `"22rem"`; tabel jadi bisa di-scroll dengan header lengket. */
  maxHeight?: string;
}) {
  if (rows.length === 0) {
    return (
      <div className="neu-inset text-ink-500 rounded-2xl px-4 py-10 text-center text-sm">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div
      className="neu-inset neu-scroll overflow-auto rounded-2xl"
      style={maxHeight ? { maxHeight } : undefined}
    >
      <table className="w-full min-w-[38rem] border-collapse text-sm">
        <thead className="bg-surface-sunken/95 sticky top-0 z-10 backdrop-blur">
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                scope="col"
                className={`text-ink-500 px-4 py-3 text-[0.68rem] font-bold tracking-wider whitespace-nowrap uppercase ${
                  ALIGN[column.align ?? "left"]
                }`}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr
              key={getRowKey(row, index)}
              className="border-surface/60 hover:bg-surface-raised/70 border-t transition-colors"
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  className={`text-ink-700 px-4 py-3 align-middle ${ALIGN[column.align ?? "left"]} ${column.className ?? ""}`}
                >
                  {column.render(row, index)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
