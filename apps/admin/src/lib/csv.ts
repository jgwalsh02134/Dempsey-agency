/**
 * Minimal RFC-4180-ish CSV parser.
 *
 * Supports:
 *  - Quoted fields with embedded commas, newlines, and "" escaping
 *  - CRLF / LF line endings
 *  - Trailing empty trailing newline
 *
 * Does not support: BOM stripping beyond the leading UTF-8 BOM,
 * escape characters other than doubled quotes, or custom delimiters.
 */
export function parseCsv(input: string): string[][] {
  // Strip UTF-8 BOM.
  let text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  // Normalize CRLF to LF.
  text = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  // Flush trailing field/row.
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export interface CsvRowsResult {
  headers: string[];
  rows: Record<string, string>[];
}

/** Parse CSV and map rows to objects keyed by header names (trimmed). */
export function parseCsvToObjects(input: string): CsvRowsResult {
  const raw = parseCsv(input).filter(
    (r) => r.length > 0 && r.some((c) => c.trim().length > 0),
  );
  if (raw.length === 0) return { headers: [], rows: [] };

  const headers = raw[0].map((h) => h.trim());
  const rows = raw.slice(1).map((cols) => {
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => {
      obj[h] = (cols[idx] ?? "").trim();
    });
    return obj;
  });
  return { headers, rows };
}
