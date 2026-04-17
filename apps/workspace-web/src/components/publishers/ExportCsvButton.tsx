import type { Publisher } from "../../data/publishers";
import { toCsv, triggerCsvDownload, type CsvColumn } from "../../lib/csv";

type ExportCsvButtonProps = {
  rows: Publisher[];
  filename?: string;
};

const COLUMNS: CsvColumn<Publisher>[] = [
  { key: "name", label: "Name" },
  { key: "addr", label: "Address" },
  { key: "city", label: "City" },
  { key: "state", label: "State" },
  { key: "zip", label: "ZIP" },
  { key: "dma", label: "DMA" },
  { key: "dma_code", label: "DMA Code" },
  { key: "circ", label: "Circulation" },
  { key: "url", label: "URL" },
];

export function ExportCsvButton({
  rows,
  filename = "publishers.csv",
}: ExportCsvButtonProps) {
  const onClick = () => {
    const csv = toCsv(rows, COLUMNS);
    triggerCsvDownload(filename, csv);
  };
  return (
    <button
      type="button"
      className="btn btn-ghost btn-sm export-csv"
      onClick={onClick}
      disabled={rows.length === 0}
      title={`Export ${rows.length} publishers as CSV`}
      aria-label="Export as CSV"
    >
      <svg
        className="export-csv-icon"
        viewBox="0 0 16 16"
        width="14"
        height="14"
        aria-hidden="true"
      >
        <path
          d="M8 1.5v9m0 0l-3-3m3 3l3-3M2.5 13.5h11"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="export-csv-label">Export CSV</span>
    </button>
  );
}
