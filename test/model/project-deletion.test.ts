import { describe, expect, it } from "vitest";

import {
  draftRemovalPlan,
  noteOwnedByProject,
  pathCoveredByFolder,
  projectDeletionPlan,
  sceneFolderIsDedicated,
} from "src/model/project-deletion";
import type { Draft } from "src/model/types";

const novel: Draft = {
  format: "scenes",
  title: "My Novel",
  titleInFrontmatter: true,
  draftTitle: null,
  vaultPath: "Books/My Novel/Index.md",
  workflow: null,
  sceneFolder: "scenes",
  scenes: [{ title: "One", indent: 0 }],
  ignoredFiles: null,
  unknownFiles: ["extra"],
  sceneTemplate: null,
};

describe("project deletion", () => {
  it("removes the index, the scene folder, and the side folders", () => {
    const plan = projectDeletionPlan([novel], {
      "Books/My Novel/Index.md": "Books/My Novel",
    });
    expect(plan.files).toEqual(["Books/My Novel/Index.md"]);
    expect(plan.folders).toContain("Books/My Novel/scenes");
    expect(plan.folders).toContain("Books/My Novel/Pesquisa");
    expect(plan.folders).toContain("Books/My Novel/Bíblia");
    expect(plan.folders).toContain("Books/My Novel/Reading");
    expect(plan.folders).toContain("Books/My Novel/Output");
    expect(plan.folders).toContain("Books/My Novel/Workshop");
  });

  it("deletes loose scene files when they sit beside the index", () => {
    expect(sceneFolderIsDedicated("/")).toBe(false);
    const plan = projectDeletionPlan(
      [{ ...novel, sceneFolder: "/", vaultPath: "Story.md" }],
      { "Story.md": "" }
    );
    expect(plan.files).toContain("One.md");
    expect(plan.files).toContain("extra.md");
    expect(plan.files).not.toContain("Story.md/scenes");
  });

  it("removes one draft and leaves the other draft’s folder", () => {
    const second: Draft = {
      ...novel,
      draftTitle: "Second",
      vaultPath: "Books/My Novel/Second/Index.md",
      sceneFolder: "scenes",
    };
    const plan = draftRemovalPlan(
      second,
      "Books/My Novel/Second",
      [novel],
      { "Books/My Novel/Index.md": "Books/My Novel" }
    );
    expect(plan.files).toEqual(["Books/My Novel/Second/Index.md"]);
    expect(plan.folders).toContain("Books/My Novel/Second/scenes");
    expect(plan.folders).not.toContain("Books/My Novel/scenes");
    expect(plan.folders).not.toContain("Books/My Novel/Bíblia");
  });

  it("keeps a side folder that another draft in the same place still uses", () => {
    const sibling: Draft = {
      format: "single",
      title: "Story",
      titleInFrontmatter: true,
      draftTitle: "Sibling",
      vaultPath: "Books/Story.md",
      workflow: null,
    };
    const current: Draft = {
      format: "single",
      title: "Story",
      titleInFrontmatter: true,
      draftTitle: "Current",
      vaultPath: "Books/Other.md",
      workflow: null,
    };
    const plan = draftRemovalPlan(current, "Books", [sibling], {
      "Books/Story.md": "Books",
    });
    expect(plan.files).toEqual(["Books/Other.md"]);
    expect(plan.folders).not.toContain("Books/Bíblia");
  });

  it("recognizes research and bible notes kept for the project", () => {
    expect(
      noteOwnedByProject({ "scriptorium-capture": { project: "My Novel" } }, "My Novel")
    ).toBe(true);
    expect(
      noteOwnedByProject({ "scriptorium-card": { project: "My Novel" } }, "Other")
    ).toBe(false);
    expect(pathCoveredByFolder("Books/My Novel/Pesquisa/a.md", "Books/My Novel/Pesquisa")).toBe(
      true
    );
  });
});
