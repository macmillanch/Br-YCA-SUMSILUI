/**
 * A web address is the only part of a notice an editor cannot take back once it
 * has been shared on WhatsApp, so the slug is derived from the title and then
 * owned by the editor: derived once, editable afterwards, never changed
 * automatically under their feet.
 */

export const SLUG_MAX_LENGTH = 60;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return value.length > 0 && value.length <= SLUG_MAX_LENGTH && SLUG.test(value);
}

/** Characters a URL can carry without percent-encoding. */
function keepAscii(text: string): string {
  let out = "";
  for (const character of text) {
    const code = character.codePointAt(0) ?? 0;
    if (code <= 0x7f) out += character;
  }
  return out;
}

/** Lowercase ASCII words joined by single hyphens; empty when nothing qualifies. */
export function slugFromTitle(title: string): string {
  return keepAscii(title.normalize("NFKD"))
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, SLUG_MAX_LENGTH)
    .replace(/^-+|-+$/g, "");
}
