export interface CsvRecord {
  row: number;
  values: string[];
}

export class CsvFormatError extends Error {
  constructor(readonly row: number, message: string) { super(message); }
}

/** Keep the starting physical line for diagnostics, including records with quoted newlines. */
export function parseCsv(input: string): CsvRecord[] {
  const records: CsvRecord[] = [];
  let cells: string[] = [];
  let value = '';
  let state: 'plain' | 'quoted' | 'closed' = 'plain';
  let line = 1;
  let start = 1;
  let hasRecord = false;
  function finish() {
    if (hasRecord) records.push({ row: start, values: [...cells, value] });
    cells = [];
    value = '';
    state = 'plain';
    hasRecord = false;
  }
  for (let i = 0; i < input.length; i++) {
    const ch = input[i]!;
    if (ch === '\0') throw new CsvFormatError(line, 'Unexpected binary content.');
    if (ch === '\r' || ch === '\n') {
      const newline = ch === '\r' && input[i + 1] === '\n' ? '\r\n' : ch;
      if (newline.length === 2) i++;
      if (state === 'quoted') value += newline;
      else finish();
      line++;
      if (state !== 'quoted') start = line;
      continue;
    }
    hasRecord = true;
    if (state === 'quoted') {
      if (ch !== '"') value += ch;
      else if (input[i + 1] === '"') { value += '"'; i++; }
      else state = 'closed';
    } else if (ch === ',') {
      cells.push(value);
      value = '';
      state = 'plain';
    } else if (state === 'closed') {
      throw new CsvFormatError(line, 'Unexpected character after a closing quote.');
    } else if (ch === '"') {
      if (value) throw new CsvFormatError(line, 'Quote inside an unquoted field.');
      state = 'quoted';
    } else value += ch;
  }
  if (state === 'quoted') throw new CsvFormatError(start, 'Unclosed quoted field.');
  finish();
  return records;
}
