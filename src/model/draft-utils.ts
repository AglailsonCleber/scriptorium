import { App, TFile, Vault } from "obsidian";
import { get, type Writable } from "svelte/store";

import type { Draft, IndentedScene, MultipleSceneDraft } from "./types";
import { scenePath } from "src/model/scene-navigation";
import { createNoteWithPotentialTemplate } from "./note-utils";
import { defaultPageForm } from "./project-kind";
import { setNoteForm } from "./page-form";
import { MANUSCRIPT_BLOCK, renameManuscriptFrontmatter } from "./manuscript-key";
import { pluginSettings } from "./stores";

export function draftTitle(draft: Draft): string {
  return draft.draftTitle ?? draft.vaultPath;
}

type SceneInsertionLocation = {
  at: "before" | "after" | "end";
  relativeTo: number | null;
};

export async function createScene(
  app: App,
  path: string,
  index: number,
  draft: MultipleSceneDraft,
  open: boolean
): Promise<void> {
  const template = draft.sceneTemplate ?? get(pluginSettings).sceneTemplate;
  const note = await createNoteWithPotentialTemplate(app, path, template);
  if (note === null) return;

  if (get(pluginSettings).writeProperty) {
    await app.fileManager.processFrontMatter(note, (fm) => {
      fm["scriptorium-order"] = index;
    });
  }

  if (open) {
    app.workspace.openLinkText(path, "/", false);
  }
  const form = defaultPageForm(draft.kind);
  if (form !== "prose") {
    await setNoteForm(app, note, form);
  }
}

export async function insertScene(
  app: App,
  draftsStore: Writable<Draft[]>,
  draft: MultipleSceneDraft,
  sceneName: string,
  vault: Vault,
  location: SceneInsertionLocation,
  open: boolean
) {
  const newScenePath = scenePath(sceneName, draft, vault);

  if (!newScenePath || !draft || draft.format !== "scenes") {
    return;
  }

  draftsStore.update((allDrafts) => {
    return allDrafts.map((d) => {
      if (d.vaultPath === draft.vaultPath && d.format === "scenes") {
        if (location.at === "end") {
          d.scenes = [...d.scenes, { title: sceneName, indent: 0 }];
        } else {
          const relativeScene = d.scenes[location.relativeTo];
          const index =
            location.at === "before"
              ? location.relativeTo
              : location.relativeTo + 1;
          d.scenes.splice(index, 0, {
            title: sceneName,
            indent: relativeScene.indent,
          });
        }
      }
      return d;
    });
  });

  await createScene(
    app,
    newScenePath,
    draft.scenes.findIndex((s) => s.title === sceneName),
    draft,
    open
  );
}

export function setDraftOnFrontmatterObject(
  obj: Record<string, any>,
  draft: Draft
) {
  renameManuscriptFrontmatter(obj);
  delete obj["longform"];
  obj[MANUSCRIPT_BLOCK] = {};
  obj[MANUSCRIPT_BLOCK]["format"] = draft.format;
  if (draft.titleInFrontmatter) {
    obj[MANUSCRIPT_BLOCK]["title"] = draft.title;
  }
  if (draft.draftTitle) {
    obj[MANUSCRIPT_BLOCK]["draftTitle"] = draft.draftTitle;
  }
  if (draft.workflow) {
    obj[MANUSCRIPT_BLOCK]["workflow"] = draft.workflow;
  }
  if (draft.kind) {
    obj[MANUSCRIPT_BLOCK]["kind"] = draft.kind;
  }

  if (draft.format === "scenes") {
    obj[MANUSCRIPT_BLOCK]["sceneFolder"] = draft.sceneFolder;
    obj[MANUSCRIPT_BLOCK]["scenes"] = indentedScenesToArrays(draft.scenes);
    if (draft.sceneTemplate) {
      obj[MANUSCRIPT_BLOCK]["sceneTemplate"] = draft.sceneTemplate;
    }
    obj[MANUSCRIPT_BLOCK]["ignoredFiles"] = draft.ignoredFiles;
  }
}

export function indentedScenesToArrays(indented: IndentedScene[]) {
  const result: any = [];
  // track our current indentation level
  let currentIndent = 0;
  // array for the current indentation level
  let currentNesting = result;
  // memoized arrays so that later, lesser indents can use earlier-created array
  const nestingAt: Record<number, any> = {};
  nestingAt[0] = currentNesting;

  indented.forEach(({ title, indent }) => {
    if (indent > currentIndent) {
      // we're at a deeper indentation level than current,
      // so build up a nest and memoize it
      while (currentIndent < indent) {
        currentIndent = currentIndent + 1;
        const newNesting: any = [];
        currentNesting.push(newNesting);
        nestingAt[currentIndent] = newNesting;
        currentNesting = newNesting;
      }
    } else if (indent < currentIndent) {
      // we're at a lesser indentation level than current,
      // so drop back to previously memoized nesting
      currentNesting = nestingAt[indent];
      currentIndent = indent;
    }

    // actually insert the value
    currentNesting.push(title);
  });
  return result;
}

export function arraysToIndentedScenes(
  arr: any,
  result: IndentedScene[] = [],
  currentIndent = -1
): IndentedScene[] {
  if (arr instanceof Array) {
    if (arr.length === 0) {
      return result;
    }

    const next = arr.shift();
    const inner = arraysToIndentedScenes(next, [], currentIndent + 1);
    return arraysToIndentedScenes(arr, [...result, ...inner], currentIndent);
  } else {
    return [
      {
        title: arr,
        indent: currentIndent,
      },
    ];
  }
}

export type NumberedScene = IndentedScene & {
  numbering: number[];
};

export function numberScenes(scenes: IndentedScene[]): NumberedScene[] {
  const numbering = [0];
  let lastNumberedIndent = 0;

  return scenes.map((scene) => {
    const { indent } = scene;
    if (indent > lastNumberedIndent) {
      let fill = lastNumberedIndent + 1;
      while (fill <= indent) {
        numbering[fill] = 1;
        fill = fill + 1;
      }
      numbering[indent] = 0;
    } else if (indent < lastNumberedIndent) {
      const start = indent + 1;
      numbering.splice(start, numbering.length - start);
    }
    lastNumberedIndent = indent;

    numbering[indent] = numbering[indent] + 1;
    return {
      ...scene,
      numbering: [...numbering],
    };
  });
}

export function formatSceneNumber(numbering: number[]): string {
  return numbering.join(".");
}

export async function insertDraftIntoFrontmatter(
  app: App,
  path: string,
  draft: Draft
) {
  const exists = await app.vault.adapter.exists(path);
  if (!exists) {
    await app.vault.create(path, "");
  }

  const file = app.vault.getAbstractFileByPath(path);
  if (!(file instanceof TFile)) {
    // TODO: error?
    return;
  }
  try {
    await app.fileManager.processFrontMatter(file, (fm) => {
      setDraftOnFrontmatterObject(fm, draft);
    });
  } catch (error) {
    console.error(
      "[Scriptorium] insertDraftIntoFrontmatter: processFrontMatter error:",
      error
    );
  }
}
