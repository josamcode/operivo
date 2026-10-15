/**
 * Optimised images live in src/assets/img as `<base>-<width>.webp` (see scripts in the PR notes).
 * Vite fingerprints them; these helpers build src/srcSet without hand-importing every size.
 */
const files = import.meta.glob('../assets/img/*.{webp,jpg,png}', { eager: true, query: '?url', import: 'default' }) as Record<
  string,
  string
>;

const byName = new Map(Object.entries(files).map(([path, url]) => [path.split('/').pop()!, url]));

function widthsFor(base: string) {
  const re = new RegExp(`^${base}-(\\d+)\\.webp$`);
  return [...byName.keys()]
    .map((n) => Number(re.exec(n)?.[1]))
    .filter((w) => Number.isFinite(w) && w > 0)
    .sort((a, b) => a - b);
}

export type ResponsiveImage = { src: string; srcSet: string; width: number } | null;

/** Largest-first fallback src plus a full srcSet for `<base>-<w>.webp` files. */
export function responsive(base: string): ResponsiveImage {
  const widths = widthsFor(base);
  if (!widths.length) return null;
  const srcSet = widths.map((w) => `${byName.get(`${base}-${w}.webp`)} ${w}w`).join(', ');
  const mid = widths[Math.min(widths.length - 1, 1)];
  return { src: byName.get(`${base}-${mid}.webp`)!, srcSet, width: widths[widths.length - 1] };
}
