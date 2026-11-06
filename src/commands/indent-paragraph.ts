import type { Editor, MarkdownFileInfo, MarkdownView } from "obsidian";
import { get } from "svelte/store";

import { PAGE_FORM_KEY, pageForm } from "src/model/page-form";
import { draftForPath } from "src/model/scene-navigation";
import { drafts, pluginSettings } from "src/model/stores";
import {
  firstLineIndentText,
  paragraphStartsInSelection,
  withFirstLineIndent,
  type ParagraphEdge,
} from "src/view/page-mode";

import type { CommandBuilder } from "./types";

function isScriptoriumFile(view: MarkdownView | MarkdownFileInfo): boolean {
  const path = view.file?.path;
  if (!path) {
    return false;
  }
  return draftForPath(path, get(drafts)) !== null;
}

export function indentSelectedParagraph(editor: Editor, edge: ParagraphEdge): void {
  const settings = get(pluginSettings);
  if (settings.paragraphIndent) {
    return;
  }
  const indent = firstLineIndentText(settings.paragraphIndentEm);
  const from = editor.getCursor("from");
  const to = editor.getCursor("to");
  const starts = paragraphStartsInSelection(
    editor.lineCount(),
    from.line,
    to.line,
    (index) => editor.getLine(index),
    edge
  );
  let shift = 0;
  for (const line of starts) {
    const current = editor.getLine(line);
    const next = withFirstLineIndent(current, indent);
    if (next === null) {
      continue;
    }
    editor.setLine(line, next);
    if (line === from.line) {
      shift = next.length - current.length;
    }
  }
  if (shift !== 0) {
    editor.setCursor({ line: from.line, ch: from.ch + shift });
  }
}

export const indentThisParagraph: CommandBuilder = (plugin) => ({
  id: "longform-indent-paragraph",
  name: "Indent this paragraph",
  icon: "indent",
  editorCheckCallback(checking, editor, view) {
    if (!isScriptoriumFile(view) || get(pluginSettings).paragraphIndent) {
      return false;
    }
    const form = pageForm(
      view.file
        ? plugin.app.metadataCache.getFileCache(view.file)?.frontmatter?.[
            PAGE_FORM_KEY
          ]
        : undefined
    );
    if (form === "verse" || form === "script") {
      return false;
    }
    if (checking) {
      return true;
    }
    indentSelectedParagraph(editor, form === "prose" ? "line" : "blank");
  },
});
