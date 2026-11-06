import { Notice, type App } from "obsidian";

import { sceneFolderIsDedicated } from "./project-deletion";
import {
  folderSteps,
  missingFolders,
  sceneFolderVaultPath,
  type VaultPathKind,
} from "./scene-folder";

async function pathKind(app: App, step: string): Promise<VaultPathKind> {
  const stat = await app.vault.adapter.stat(step);
  if (!stat) {
    return "missing";
  }
  return stat.type === "folder" ? "folder" : "file";
}

/** Create `path` when it is missing. An existing folder is left as it is. */
export async function ensureVaultFolder(app: App, path: string): Promise<boolean> {
  const target = path.replace(/\\/g, "/").replace(/\/+$/, "");
  if (target.length === 0 || target === ".") {
    return true;
  }
  const steps = folderSteps(target);
  const kinds = new Map<string, VaultPathKind>();
  for (const step of steps) {
    kinds.set(step, await pathKind(app, step));
  }
  const plan = missingFolders(target, (step) => kinds.get(step) ?? "missing");
  if (plan === null) {
    new Notice("Scriptorium: that path is a note, not a folder.");
    return false;
  }
  for (const step of plan) {
    try {
      await app.vault.createFolder(step);
    } catch (error) {
      const stat = await app.vault.adapter.stat(step);
      if (stat?.type === "folder") {
        continue;
      }
      console.error(`[Scriptorium] Could not create folder "${step}"`, error);
      new Notice("Scriptorium: could not create the scene folder.");
      return false;
    }
  }
  return true;
}

/**
 * Point a project at `folder` under `projectRoot`.
 * `/` keeps scenes beside the index. An existing folder is used.
 * A missing folder is created, including any missing parents.
 */
export async function ensureSceneFolder(
  app: App,
  projectRoot: string,
  folder: string
): Promise<boolean> {
  if (!sceneFolderIsDedicated(folder)) {
    return true;
  }
  const target = sceneFolderVaultPath(projectRoot, folder);
  if (target === null) {
    return true;
  }
  return ensureVaultFolder(app, target);
}
