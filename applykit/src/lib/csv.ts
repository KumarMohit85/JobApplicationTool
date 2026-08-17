import type { QueueItem, QueueStatus } from '@/types/queue';

const CSV_HEADERS = [
  'id',
  'type',
  'status',
  'email',
  'company',
  'role',
  'description',
  'sourceUrl',
  'resumeId',
  'createdAt',
  'updatedAt',
] as const;

function escapeCsvField(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function rowToCsv(item: QueueItem): string {
  return CSV_HEADERS.map((header) => {
    const raw = item[header as keyof QueueItem];
    return escapeCsvField(raw == null ? '' : String(raw));
  }).join(',');
}

export function queueToCsv(items: QueueItem[]): string {
  const lines = [CSV_HEADERS.join(','), ...items.map(rowToCsv)];
  return lines.join('\n');
}

function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i]!;
    if (inQuotes) {
      if (char === '"') {
        if (line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        current += char;
      }
    } else if (char === '"') {
      inQuotes = true;
    } else if (char === ',') {
      fields.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  fields.push(current);
  return fields;
}

export function csvToQueueItems(csv: string): Partial<QueueItem>[] {
  const lines = csv.replace(/\r/g, '').split('\n').filter((line) => line.trim());
  if (lines.length === 0) return [];

  const headerLine = lines[0]!;
  const headers = parseCsvLine(headerLine).map((h) => h.trim());
  const rows: Partial<QueueItem>[] = [];

  for (const line of lines.slice(1)) {
    const values = parseCsvLine(line);
    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      record[header] = values[index] ?? '';
    });

    rows.push({
      id: record.id,
      type: record.type === 'linkedin_mail' ? 'linkedin_mail' : 'job_scan',
      status: (['pending', 'sent', 'applied'] as QueueStatus[]).includes(record.status as QueueStatus)
        ? (record.status as QueueStatus)
        : 'pending',
      email: record.email,
      company: record.company,
      role: record.role,
      description: record.description,
      sourceUrl: record.sourceUrl,
      resumeId: record.resumeId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    });
  }

  return rows;
}

export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') {
    const bytes = new TextEncoder().encode(csv);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    const dataUrl = `data:text/csv;base64,${btoa(binary)}`;
    void chrome.downloads.download({ url: dataUrl, filename, saveAs: false });
    return;
  }

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
