import { Entity } from '../../../core/models';
import { StatusTone } from '../../../shared/ui';

export type FileKind = 'pdf' | 'slides' | 'sheet' | 'doc' | 'image' | 'other';

/** An uploaded appendix. The file itself lives in FileStorageService under the same id. */
export interface Appendix extends Entity {
  name: string;
  /** MIME type reported by the browser (may be empty). */
  type: string;
  size: number;
  kind: FileKind;
}

export interface AppendixFilters {
  q: string;
  kind: FileKind | 'all';
}

export const FILE_KINDS: readonly { value: FileKind; label: string; tone: StatusTone }[] = [
  { value: 'pdf', label: 'PDF', tone: 'bad' },
  { value: 'slides', label: 'Presentations', tone: 'warn' },
  { value: 'sheet', label: 'Spreadsheets', tone: 'ok' },
  { value: 'doc', label: 'Documents', tone: 'info' },
  { value: 'image', label: 'Images', tone: 'teal' },
  { value: 'other', label: 'Other', tone: 'neutral' },
];

/** Largest file accepted, so one upload can't fill the browser's storage. */
export const MAX_FILE_BYTES = 50 * 1024 * 1024;

const EXTENSIONS: Record<Exclude<FileKind, 'other'>, readonly string[]> = {
  pdf: ['pdf'],
  slides: ['ppt', 'pptx', 'pps', 'ppsx', 'pot', 'potx', 'odp', 'key'],
  sheet: ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'tsv', 'ods', 'numbers'],
  doc: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'avif'],
};

export function extensionOf(name: string): string {
  const dot = name.lastIndexOf('.');
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
}

export function kindOf(name: string, type = ''): FileKind {
  const ext = extensionOf(name);
  for (const [kind, list] of Object.entries(EXTENSIONS)) {
    if (list.includes(ext)) return kind as FileKind;
  }
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  return 'other';
}

export function kindInfo(kind: FileKind): (typeof FILE_KINDS)[number] {
  return FILE_KINDS.find((k) => k.value === kind) ?? FILE_KINDS[FILE_KINDS.length - 1];
}

/** 1536 → "1,5 KB"; 3_400_000 → "3,2 MB". */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  return `${value.toLocaleString('ro-RO', { maximumFractionDigits: value < 10 ? 1 : 0 })} ${units[unit]}`;
}
