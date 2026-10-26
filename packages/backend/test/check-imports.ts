import { readdir, readFile } from 'node:fs/promises';

export async function forbiddenImports(): Promise<string[]> {
  const forbidden: string[] = [];
  for (const file of await readdir(new URL('../src/', import.meta.url))) {
    if (!file.endsWith('.ts') || file === 'node.ts') continue;
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    if (/(?:from\s*|import\s*\()\s*['"](?:node:fs|fs(?:['"/])|firebase-admin|@react-native-async-storage\/)/.test(source)) forbidden.push(file);
  }
  return forbidden;
}
