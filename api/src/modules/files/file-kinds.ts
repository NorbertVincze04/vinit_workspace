/** Same grouping as the Files page (src/app/features/tools/files/files.model.ts). */
export type FileKind = 'pdf' | 'slides' | 'sheet' | 'doc' | 'image' | 'other';

const EXTENSIONS: Record<Exclude<FileKind, 'other'>, readonly string[]> = {
  pdf: ['pdf'],
  slides: ['ppt', 'pptx', 'pps', 'ppsx', 'pot', 'potx', 'odp', 'key'],
  sheet: ['xls', 'xlsx', 'xlsm', 'xlsb', 'csv', 'tsv', 'ods', 'numbers'],
  doc: ['doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'pages'],
  image: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'heic', 'avif'],
};

export function kindOf(name: string, type = ''): FileKind {
  const dot = name.lastIndexOf('.');
  const ext = dot > 0 ? name.slice(dot + 1).toLowerCase() : '';
  for (const [kind, list] of Object.entries(EXTENSIONS)) {
    if (list.includes(ext)) return kind as FileKind;
  }
  if (type === 'application/pdf') return 'pdf';
  if (type.startsWith('image/')) return 'image';
  return 'other';
}
