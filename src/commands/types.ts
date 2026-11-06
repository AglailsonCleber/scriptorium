import type { Command } from "obsidian";

import type ScriptoriumPlugin from "src/main";

export type CommandBuilder = (plugin: ScriptoriumPlugin) => Command;
