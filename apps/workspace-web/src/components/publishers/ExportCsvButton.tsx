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
      className="btn btn-ghost btn-sm"
      onClick={onClick}
      disabled={rows.length === 0}
      title={`Export ${rows.length} publishers as CSV`}
    >
      Export CSV
    </button>
  );
}
