import { Notice, TFile, TFolder, type App } from "obsidian";
import { get } from "svelte/store";

import { draftTitle } from "src/model/draft-utils";
import {
  draftRemovalPlan,
  noteOwnedByProject,
  parentOfVaultPath,
  pathCoveredByFolder,
  projectDeletionPlan,
} from "src/model/project-deletion";
import {
  pluginSettings,
  projects,
  selectedDraft,
  selectedDraftVaultPath,
} from "src/model/stores";
import type { Draft } from "src/model/types";
import type ScriptoriumPlugin from "src/main";
import ConfirmActionModal from "src/view/ConfirmActionModal";
import { literaryLedger } from "src/view/literary-ledger";
import { workshopLedger } from "src/view/workshop-ledger";

import type { CommandBuilder } from "./types";

function belongsToRemoved(path: string, files: string[], folders: string[]): boolean {
  if (files.indexOf(path) >= 0) {
    return true;
  }
  for (const folder of folders) {
    if (pathCoveredByFolder(path, folder)) {
      return true;
    }
  }
  return false;
}

async function trashPath(app: App, path: string): Promise<void> {
  const file = app.vault.getAbstractFileByPath(path);
  if (!file) {
    return;
  }
  await app.vault.trash(file, true);
}

async function removeFrozen(app: App, relative: string): Promise<void> {
  if (!relative) {
    return;
  }
  const full = `${app.vault.configDir}/${relative}`;
  try {
    if (await app.vault.adapter.exists(full)) {
      await app.vault.adapter.remove(full);
    }
  } catch {
    // The copy may already be gone.
  }
}

export async function deleteProjectFiles(
  plugin: ScriptoriumPlugin,
  projectDrafts: Draft[]
): Promise<void> {
  const app = plugin.app;
  const title = projectDrafts[0]?.title ?? "";
  if (!title || projectDrafts.length === 0) {
    return;
  }
  const parents: Record<string, string> = {};
  for (const draft of projectDrafts) {
    const file = app.vault.getAbstractFileByPath(draft.vaultPath);
    parents[draft.vaultPath] =
      file instanceof TFile && file.parent
        ? file.parent.path
        : parentOfVaultPath(draft.vaultPath);
  }
  const plan = projectDeletionPlan(projectDrafts, parents);
  const indexes = new Set(projectDrafts.map((draft) => draft.vaultPath));

  for (const path of plan.files) {
    if (indexes.has(path)) {
      await trashPath(app, path);
    }
  }

  for (const file of app.vault.getMarkdownFiles()) {
    if (belongsToRemoved(file.path, plan.files, plan.folders)) {
      continue;
    }
    if (
      noteOwnedByProject(
        app.metadataCache.getFileCache(file)?.frontmatter,
        title
      )
    ) {
      await trashPath(app, file.path);
    }
  }

  for (const path of plan.files) {
    if (!indexes.has(path)) {
      await trashPath(app, path);
    }
  }

  for (const folder of plan.folders) {
    await trashPath(app, folder);
  }

  const parentPaths: string[] = [];
  for (const draft of projectDrafts) {
    const parent = parents[draft.vaultPath];
    if (parent && parentPaths.indexOf(parent) < 0) {
      parentPaths.push(parent);
    }
  }
  for (const parent of parentPaths) {
    const folder = app.vault.getAbstractFileByPath(parent);
    if (folder instanceof TFolder && folder.children.length === 0) {
      await app.vault.trash(folder, true);
    }
  }

  const removed = (path: string) =>
    belongsToRemoved(path, plan.files, plan.folders) ||
    parentPaths.some((parent) => pathCoveredByFolder(path, parent));
  plugin.revisionLedger?.dropWhere(removed);
  plugin.pageRecovery?.forgetWhere(removed);

  const life = literaryLedger();
  if (life) {
    for (const frozen of life.dropProject(title)) {
      await removeFrozen(app, frozen);
    }
    life.flush();
  }
  const workshop = workshopLedger();
  if (workshop) {
    for (const frozen of workshop.dropProject(title)) {
      await removeFrozen(app, frozen);
    }
    workshop.flush();
  }

  pluginSettings.update((settings) => ({
    ...settings,
    sessions: settings.sessions.map((session) => {
      const next = { ...session.drafts };
      for (const path of indexes) {
        delete next[path];
      }
      return { ...session, drafts: next };
    }),
  }));

  new Notice(
    `Deleted “${title}”. Its notes and project folders went to the system trash.`
  );
}

function draftParents(
  app: App,
  group: Draft[]
): Record<string, string> {
  const parents: Record<string, string> = {};
  for (const item of group) {
    const file = app.vault.getAbstractFileByPath(item.vaultPath);
    parents[item.vaultPath] =
      file instanceof TFile && file.parent
        ? file.parent.path
        : parentOfVaultPath(item.vaultPath);
  }
  return parents;
}

export async function deleteDraftFiles(
  plugin: ScriptoriumPlugin,
  draft: Draft
): Promise<void> {
  const app = plugin.app;
  const group = get(projects)[draft.title] ?? [draft];
  const others = group.filter((item) => item.vaultPath !== draft.vaultPath);
  if (others.length === 0) {
    await deleteProjectFiles(plugin, [draft]);
    return;
  }
  if (get(selectedDraftVaultPath) === draft.vaultPath) {
    selectedDraftVaultPath.set(others[0].vaultPath);
  }
  const parents = draftParents(app, group);
  const plan = draftRemovalPlan(draft, parents[draft.vaultPath] ?? "", others, parents);
  for (const path of plan.files) {
    await trashPath(app, path);
  }
  for (const folder of plan.folders) {
    await trashPath(app, folder);
  }
  const parent = parents[draft.vaultPath];
  const shared = others.some((item) => parents[item.vaultPath] === parent);
  if (parent && !shared) {
    const folder = app.vault.getAbstractFileByPath(parent);
    if (folder instanceof TFolder && folder.children.length === 0) {
      await app.vault.trash(folder, true);
    }
  }
  const removed = (path: string) => belongsToRemoved(path, plan.files, plan.folders);
  plugin.revisionLedger?.dropWhere(removed);
  plugin.pageRecovery?.forgetWhere(removed);
  pluginSettings.update((settings) => ({
    ...settings,
    sessions: settings.sessions.map((session) => {
      const next = { ...session.drafts };
      delete next[draft.vaultPath];
      return { ...session, drafts: next };
    }),
  }));
  new Notice(
    `Deleted draft “${draftTitle(draft)}”. Its notes went to the system trash.`
  );
}

export function confirmDeleteDraft(plugin: ScriptoriumPlugin, draft: Draft): void {
  const group = get(projects)[draft.title] ?? [draft];
  if (group.length <= 1) {
    confirmDeleteProject(plugin, draft);
    return;
  }
  new ConfirmActionModal(
    plugin.app,
    "Delete draft",
    `Delete the draft “${draftTitle(draft)}” of “${draft.title}”. Its index and scenes go to the system trash. The other drafts stay, and so do the bible and research shared by the project.`,
    "Delete draft",
    () => {
      void deleteDraftFiles(plugin, draft);
    }
  ).open();
}

export function confirmDeleteProject(plugin: ScriptoriumPlugin, draft: Draft): void {
  const group = get(projects)[draft.title] ?? [draft];
  const count = group.length;
  new ConfirmActionModal(
    plugin.app,
    "Delete project",
    `Delete “${draft.title}” and clean its files. This removes ${count} draft${
      count === 1 ? "" : "s"
    }, scene notes, and the Pesquisa, Bíblia, Reading, Output, and Workshop folders beside each draft. Research and bible notes kept for this project go too. Anything else in the folder stays. The notes move to the system trash.`,
    "Delete project",
    () => {
      void deleteProjectFiles(plugin, group);
    }
  ).open();
}

export const deleteDraftCommand: CommandBuilder = (plugin) => ({
  id: "longform-delete-draft",
  name: "Delete this draft",
  callback: () => {
    const draft = get(selectedDraft);
    if (!draft) {
      new Notice("Open a Scriptorium project first.");
      return;
    }
    confirmDeleteDraft(plugin, draft);
  },
});

export const deleteProjectCommand: CommandBuilder = (plugin) => ({
  id: "longform-delete-project",
  name: "Delete this project",
  callback: () => {
    const draft = get(selectedDraft);
    if (!draft) {
      new Notice("Open a Scriptorium project first.");
      return;
    }
    confirmDeleteProject(plugin, draft);
  },
});
