// Places a path from the site root, such as `/kit/ride.wav`, under the base the site is served from:
// `/` in development, `/MetroRig/` on GitHub Pages
export function withBase(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${path.replace(/^\/+/, '')}`;
}
