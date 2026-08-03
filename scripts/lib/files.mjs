import { mkdir, readdir, readFile, rm, stat, writeFile, copyFile } from 'node:fs/promises';
import path from 'node:path';

export async function ensureEmptyDir(directory) {
  await rm(directory, { recursive: true, force: true });
  await mkdir(directory, { recursive: true });
}

export async function ensureDir(directory) {
  await mkdir(directory, { recursive: true });
}

export async function walkFiles(root, relative = '') {
  const directory = path.join(root, relative);
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name, 'en'))) {
    const next = path.posix.join(relative.split(path.sep).join('/'), entry.name);
    if (entry.isDirectory()) files.push(...await walkFiles(root, next));
    else if (entry.isFile()) files.push(next);
  }
  return files.sort((left, right) => left.localeCompare(right, 'en'));
}

export async function copyTree(sourceRoot, destinationRoot) {
  for (const relativePath of await walkFiles(sourceRoot)) {
    const source = path.join(sourceRoot, relativePath);
    const destination = path.join(destinationRoot, relativePath);
    await mkdir(path.dirname(destination), { recursive: true });
    await copyFile(source, destination);
  }
}

export async function copyFileEnsured(source, destination) {
  await mkdir(path.dirname(destination), { recursive: true });
  await copyFile(source, destination);
}

export async function writeText(filePath, content) {
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, content.endsWith('\n') ? content : `${content}\n`, 'utf8');
}

export async function readJson(filePath) {
  return JSON.parse(await readFile(filePath, 'utf8'));
}

export async function fileExists(filePath) {
  try {
    return (await stat(filePath)).isFile();
  } catch {
    return false;
  }
}
