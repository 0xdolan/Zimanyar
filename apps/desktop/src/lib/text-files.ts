/** Kinds of file the app opens and saves. */
export const TEXT_EXTENSIONS = ["txt", "md"];

/** A file bigger than this is not something to write in a text field. */
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

export const isTextFileName = (name: string): boolean =>
  TEXT_EXTENSIONS.includes(name.split(".").at(-1)?.toLowerCase() ?? "");

/** The first file dropped that can be opened, or why none can. */
export function chooseDropped<File extends { name: string; size: number }>(
  files: readonly File[],
): { file: File } | { problem: "kind" | "size" } | null {
  if (files.length === 0) return null;
  const candidate = files.find((file) => isTextFileName(file.name));
  if (candidate === undefined) return { problem: "kind" };
  return candidate.size > MAX_FILE_BYTES ? { problem: "size" } : { file: candidate };
}

export const baseName = (path: string): string => path.split(/[\\/]/).at(-1) ?? path;
