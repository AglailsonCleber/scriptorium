import { describe, expect, it } from "vitest";

import {
  manuscriptEntry,
  noteField,
  renameManuscriptFrontmatter,
} from "src/model/manuscript-key";

describe("manuscript block", () => {
  it("reads the Scriptorium block and the old Longform block", () => {
    expect(manuscriptEntry({ scriptorium: { format: "single" } })?.format).toBe(
      "single"
    );
    expect(manuscriptEntry({ longform: { format: "scenes" } })?.format).toBe(
      "scenes"
    );
  });

  it("renames the block and the note properties", () => {
    const frontmatter: Record<string, unknown> = {
      longform: { format: "scenes", scenes: ["One"] },
      "longform-role": "manuscript",
      "longform-form": "prose",
    };
    renameManuscriptFrontmatter(frontmatter);
    expect(frontmatter.longform).toBeUndefined();
    expect(frontmatter.scriptorium).toEqual({ format: "scenes", scenes: ["One"] });
    expect(frontmatter["scriptorium-role"]).toBe("manuscript");
    expect(frontmatter["scriptorium-form"]).toBe("prose");
    expect(noteField({ "longform-role": "cut" }, "scriptorium-role")).toBe("cut");
  });
});
