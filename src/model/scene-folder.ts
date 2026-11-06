export type VaultPathKind = "folder" | "file" | "missing";

/** Each folder from the vault root down to `path`, including `path`. */
export function folderSteps(path: string): string[] {
  const parts = path.replace(/\\/g, "/").split("/").filter((part) => part.length > 0);
  const steps: string[] = [];
  let current = "";
  for (const part of parts) {
    current = current.length === 0 ? part : `${current}/${part}`;
    steps.push(current);
  }
  return steps;
}

/**
 * Folders that still need to be created so `path` exists.
 * `null` when a note already occupies the path or one of its parents.
 */
export function missingFolders(
  path: string,
  kindAt: (step: string) => VaultPathKind
): string[] | null {
  const create: string[] = [];
  for (const step of folderSteps(path)) {
    const kind = kindAt(step);
    if (kind === "file") {
      return null;
    }
    if (kind === "missing") {
      create.push(step);
    }
  }
  return create;
}

/** Scene folder path under a project. `/` stays beside the index. */
export function sceneFolderVaultPath(projectRoot: string, folder: string): string | null {
  const relative = folder
    .trim()
    .replace(/\\/g, "/")
    .replace(/^\/+/, "")
    .replace(/\/+$/, "");
  if (relative.length === 0 || relative === "." || relative === "./") {
    return null;
  }
  const root = projectRoot.replace(/\\/g, "/").replace(/\/+$/, "");
  if (root.length === 0 || root === "/" || root === ".") {
    return relative;
  }
  return `${root}/${relative}`;
}
