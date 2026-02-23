import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../../data');
const CSV_PATH = path.join(DATA_DIR, 'sked-b25.csv');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

function getFileAge(): number | null {
  try {
    const stat = fs.statSync(CSV_PATH);
    return Date.now() - stat.mtimeMs;
  } catch {
    return null;
  }
}

export function getCachedCsv(): string | null {
  try {
    return fs.readFileSync(CSV_PATH, 'utf-8');
  } catch {
    return null;
  }
}

export async function fetchEibiCsv(url: string, maxAgeMs: number): Promise<string> {
  ensureDataDir();

  const age = getFileAge();
  if (age !== null && age < maxAgeMs) {
    const cached = getCachedCsv();
    if (cached) return cached;
  }

  console.log(`Fetching EiBi CSV from ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch EiBi CSV: ${response.status} ${response.statusText}`);
  }

  const text = await response.text();
  fs.writeFileSync(CSV_PATH, text, 'utf-8');
  console.log(`EiBi CSV saved to ${CSV_PATH} (${text.length} bytes)`);
  return text;
}

export function loadLocalCsv(filePath: string): string {
  return fs.readFileSync(filePath, 'utf-8');
}
