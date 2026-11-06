import { describe, expect, it } from "vitest";

import {
  folderSteps,
  missingFolders,
  sceneFolderVaultPath,
} from "src/model/scene-folder";

describe("scene folder", () => {
  it("uses a folder that is already there", () => {
    expect(
      missingFolders("Books/Novel/scenes", (step) =>
        step === "Books/Novel/scenes" || step === "Books" || step === "Books/Novel"
          ? "folder"
          : "missing"
      )
    ).toEqual([]);
  });

  it("creates the folder and any missing parent", () => {
    expect(
      missingFolders("Books/Novel/chapters/one", (step) =>
        step === "Books" || step === "Books/Novel" ? "folder" : "missing"
      )
    ).toEqual(["Books/Novel/chapters", "Books/Novel/chapters/one"]);
  });

  it("keeps scenes beside the index when the folder is /", () => {
    expect(sceneFolderVaultPath("Books/Novel", "/")).toBeNull();
    expect(sceneFolderVaultPath("Books/Novel", "chapters")).toBe(
      "Books/Novel/chapters"
    );
  });

  it("refuses a path that is a note", () => {
    expect(
      missingFolders("Books/Novel/scenes", (step) =>
        step === "Books/Novel/scenes" ? "file" : "folder"
      )
    ).toBeNull();
    expect(folderSteps("Books/Novel/scenes")).toEqual([
      "Books",
      "Books/Novel",
      "Books/Novel/scenes",
    ]);
  });
});
