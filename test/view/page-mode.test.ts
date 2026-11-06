import { describe, expect, it } from "vitest";

import {
  firstLineIndentText,
  hidePropertiesOnNote,
  pageLineMarks,
  pageModeClasses,
  paragraphFirstLines,
  paragraphSpan,
  paragraphStartsInSelection,
  withFirstLineIndent,
  manuscriptContrastClass,
  readingMeasureVars,
} from "src/view/page-mode";

const lines = ["Um", "Dois", "", "Três", "Quatro"];
const text = (index: number) => lines[index];

describe("paragraph span", () => {
  it("keeps lines together until a blank line", () => {
    expect(paragraphSpan(lines.length, 0, text)).toEqual({ from: 0, to: 1 });
    expect(paragraphSpan(lines.length, 1, text)).toEqual({ from: 0, to: 1 });
    expect(paragraphSpan(lines.length, 3, text)).toEqual({ from: 3, to: 4 });
  });

  it("treats the blank line under the cursor as its own span", () => {
    expect(paragraphSpan(lines.length, 2, text)).toEqual({ from: 2, to: 2 });
  });

  it("keeps a prose line on its own", () => {
    expect(paragraphSpan(lines.length, 0, text, "line")).toEqual({
      from: 0,
      to: 0,
    });
    expect(paragraphSpan(lines.length, 1, text, "line")).toEqual({
      from: 1,
      to: 1,
    });
  });
});

describe("page line marks", () => {
  it("marks the whole paragraph and the cursor line when both modes are on", () => {
    expect(
      pageLineMarks(lines.length, 4, { focus: true, highlight: true }, text)
    ).toEqual([
      { line: 3, classes: "longform-current-paragraph" },
      {
        line: 4,
        classes: "longform-current-paragraph longform-current-line",
      },
    ]);
  });

  it("keeps a blank line created with Enter in focus", () => {
    const broken = ["Texto.", ""];
    expect(
      pageLineMarks(
        broken.length,
        1,
        { focus: true, highlight: false },
        (index) => broken[index]
      )
    ).toEqual([
      {
        line: 1,
        classes: "longform-current-paragraph longform-current-line",
      },
    ]);
  });

  it("marks only the cursor line when focus is off", () => {
    expect(
      pageLineMarks(lines.length, 0, { focus: false, highlight: true }, text)
    ).toEqual([{ line: 0, classes: "longform-current-line" }]);
  });

  it("marks nothing when both modes are off", () => {
    expect(
      pageLineMarks(lines.length, 0, { focus: false, highlight: false }, text)
    ).toEqual([]);
  });
});

describe("hidden properties", () => {
  it("hides the block on a manuscript note and on a bible card", () => {
    expect(
      hidePropertiesOnNote({ manuscript: true, bibleCard: false }, true)
    ).toBe(true);
    expect(
      hidePropertiesOnNote({ manuscript: false, bibleCard: true }, true)
    ).toBe(true);
  });

  it("leaves the block visible when the setting is off", () => {
    expect(
      hidePropertiesOnNote({ manuscript: false, bibleCard: true }, false)
    ).toBe(false);
    expect(
      hidePropertiesOnNote({ manuscript: false, bibleCard: false }, true)
    ).toBe(false);
  });
});

describe("page mode classes", () => {
  it("lists only the modes that are on", () => {
    expect(
      pageModeClasses({
        highlightCurrentLine: true,
        focusMode: false,
        typewriterMode: true,
        hideProperties: false,
        paragraphIndent: false,
      })
    ).toEqual(["longform-highlight-line", "longform-typewriter"]);
    expect(
      pageModeClasses({
        highlightCurrentLine: false,
        focusMode: false,
        typewriterMode: false,
        hideProperties: true,
        paragraphIndent: true,
      })
    ).toEqual(["longform-hide-properties", "longform-indent"]);
  });
});

describe("manual first-line indent", () => {
  const note = ["Um parágrafo", "que continua", "", "# Título", "Outro"];
  const text = (index: number) => note[index];

  it("uses the chosen width in quarter ems", () => {
    expect(firstLineIndentText(2).length).toBe(8);
    expect(firstLineIndentText(0.5).length).toBe(2);
  });

  it("indents one prose line and leaves a heading alone", () => {
    const indent = firstLineIndentText(2);
    expect(withFirstLineIndent("Um parágrafo", indent)).toBe(indent + "Um parágrafo");
    expect(withFirstLineIndent(indent + "Um parágrafo", indent)).toBeNull();
    expect(withFirstLineIndent("# Título", indent)).toBeNull();
  });

  it("indents only the paragraph the selection touches", () => {
    expect(paragraphStartsInSelection(note.length, 1, 1, text, "line")).toEqual([1]);
    expect(paragraphStartsInSelection(note.length, 1, 1, text, "blank")).toEqual([0]);
  });
});

describe("first line of a paragraph", () => {
  it("treats each prose line as its own paragraph", () => {
    const note = ["Um parágrafo", "que continua", "", "Outro"];
    expect(
      paragraphFirstLines(note.length, (index) => note[index], "line")
    ).toEqual([0, 1, 3]);
  });

  it("indents the first line and leaves the rest of the paragraph flush", () => {
    const note = ["Um parágrafo", "que continua", "", "Outro"];
    expect(paragraphFirstLines(note.length, (index) => note[index])).toEqual([
      0, 3,
    ]);
  });

  it("skips frontmatter, headings, lists, quotes, and fenced code", () => {
    const note = [
      "---",
      "title: Livro",
      "---",
      "",
      "# Capítulo",
      "Abre o capítulo",
      "e segue.",
      "",
      "- item",
      "",
      "> citação",
      "",
      "```",
      "código",
      "```",
      "",
      "Depois da cerca.",
    ];
    expect(paragraphFirstLines(note.length, (index) => note[index])).toEqual([
      5, 16,
    ]);
  });
});

describe("manuscript theme", () => {
  it("stays off until the writer asks for the opposite page", () => {
    expect(manuscriptContrastClass(false, "dark")).toBeNull();
    expect(manuscriptContrastClass(false, "light")).toBeNull();
  });

  it("uses the opposite of the app theme", () => {
    expect(manuscriptContrastClass(true, "dark")).toBe(
      "longform-manuscript-light"
    );
    expect(manuscriptContrastClass(true, "light")).toBe(
      "longform-manuscript-dark"
    );
  });
});

describe("reading measure", () => {
  it("stays off until the writer turns it on", () => {
    expect(
      readingMeasureVars({
        readingMeasure: false,
        measureWidth: 66,
        lineHeight: 1.7,
        pageMargin: 32,
      })
    ).toBeNull();
  });

  it("clamps width, leading, and margin into a readable column", () => {
    expect(
      readingMeasureVars({
        readingMeasure: true,
        measureWidth: 1000,
        lineHeight: 0,
        pageMargin: Number.NaN,
      })
    ).toEqual({
      "--longform-measure-width": "100ch",
      "--longform-line-height": "1.2",
      "--longform-page-margin": "32px",
    });
  });
});
