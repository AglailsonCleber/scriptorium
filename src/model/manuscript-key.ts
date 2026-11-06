/** The index block. Longform called this `longform`. */
export const MANUSCRIPT_BLOCK = "scriptorium";

const LEGACY_BLOCK = "longform";
const PREFIX = "scriptorium-";
const LEGACY_PREFIX = "longform-";

export function manuscriptEntry(
  frontmatter: Record<string, any> | null | undefined
): Record<string, any> | null {
  if (!frontmatter) {
    return null;
  }
  const current = frontmatter[MANUSCRIPT_BLOCK];
  if (current && typeof current === "object") {
    return current;
  }
  const legacy = frontmatter[LEGACY_BLOCK];
  if (legacy && typeof legacy === "object") {
    return legacy;
  }
  return null;
}

/** A property written on the note. Reads the Scriptorium name, then the old Longform name. */
export function noteField(
  record: Record<string, unknown> | null | undefined,
  key: string
): unknown {
  if (!record) {
    return undefined;
  }
  if (record[key] !== undefined) {
    return record[key];
  }
  if (key.indexOf(PREFIX) === 0) {
    return record[LEGACY_PREFIX + key.slice(PREFIX.length)];
  }
  return undefined;
}

export function manuscriptNeedsRename(frontmatter: Record<string, unknown> | null | undefined): boolean {
  if (!frontmatter) {
    return false;
  }
  if (frontmatter[LEGACY_BLOCK] && typeof frontmatter[LEGACY_BLOCK] === "object") {
    return true;
  }
  const keys = Object.keys(frontmatter);
  for (let index = 0; index < keys.length; index += 1) {
    if (keys[index].indexOf(LEGACY_PREFIX) === 0) {
      return true;
    }
  }
  return false;
}

/** Moves the old block and the old `longform-` properties onto the Scriptorium names. */
export function renameManuscriptFrontmatter(fm: Record<string, unknown>): void {
  const legacy = fm[LEGACY_BLOCK];
  if (legacy && typeof legacy === "object" && !fm[MANUSCRIPT_BLOCK]) {
    fm[MANUSCRIPT_BLOCK] = legacy;
  }
  if (LEGACY_BLOCK in fm) {
    delete fm[LEGACY_BLOCK];
  }
  const keys = Object.keys(fm);
  for (let index = 0; index < keys.length; index += 1) {
    const key = keys[index];
    if (key.indexOf(LEGACY_PREFIX) !== 0) {
      continue;
    }
    const next = PREFIX + key.slice(LEGACY_PREFIX.length);
    if (fm[next] === undefined) {
      fm[next] = fm[key];
    }
    delete fm[key];
  }
}
