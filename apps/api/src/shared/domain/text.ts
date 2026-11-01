/** "Café da Serra!" → "cafe-da-serra". Base para slugs de loja e selo. */
export function slugify(text: string, maxLength = 80): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength)
    .replace(/-+$/g, "");
  return slug.length >= 2 ? slug : `${slug || "item"}-1`.slice(0, maxLength);
}

/**
 * Primeiro slug livre: "base", "base-2", "base-3"… dado o conjunto de slugs
 * já usados que começam com a base.
 */
export function nextAvailableSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let i = 2; ; i++) {
    const suffix = `-${i}`;
    const candidate = `${base.slice(0, 80 - suffix.length).replace(/-+$/, "")}${suffix}`;
    if (!taken.has(candidate)) return candidate;
  }
}
