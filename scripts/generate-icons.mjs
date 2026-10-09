// Generates the app icons from one SVG mark: lucide's "library" glyph, white
// on the brand indigo. Run after changing the mark: `node scripts/generate-icons.mjs`.
// Uses sharp, which Next.js already installs.
import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const ROOT = path.dirname(path.dirname(new URL(import.meta.url).pathname));
const BRAND = "#4f46e5"; // --primary (light theme); white on it is 6.3:1
const GLYPH = ["m16 6 4 14", "M12 6v14", "M8 8v12", "M4 4v16"]; // lucide "library", 24×24
const PLUS = ["M12 5v14", "M5 12h14"]; // lucide "plus"

/** The mark on a square canvas. `glyph` is the glyph's share of the edge;
 *  `radius` rounds the corners (0 = full bleed, for maskable / Apple icons);
 *  `background: false` leaves just the white glyph. */
function svg({ size, glyph, radius, paths = GLYPH, background = true }) {
  const g = size * glyph;
  const scale = g / 24;
  const offset = (size - g) / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${background ? `<rect width="${size}" height="${size}" rx="${size * radius}" fill="${BRAND}"/>` : ""}
  <g transform="translate(${offset} ${offset}) scale(${scale})" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    ${paths.map((d) => `<path d="${d}"/>`).join("\n    ")}
  </g>
</svg>`;
}

async function png(file, opts) {
  const out = path.join(ROOT, file);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  await sharp(Buffer.from(svg(opts)))
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log("wrote", file);
}

// Install icons: rounded corners, glyph at 56%.
await png("public/icons/icon-192.png", {
  size: 192,
  glyph: 0.56,
  radius: 0.22,
});
await png("public/icons/icon-512.png", {
  size: 512,
  glyph: 0.56,
  radius: 0.22,
});
// Maskable: full bleed; Android crops to a circle/squircle, so keep the glyph
// well inside the central 80% safe zone.
await png("public/icons/maskable-192.png", {
  size: 192,
  glyph: 0.42,
  radius: 0,
});
await png("public/icons/maskable-512.png", {
  size: 512,
  glyph: 0.42,
  radius: 0,
});
// Long-press shortcut "新增作品".
await png("public/icons/shortcut-add-96.png", {
  size: 96,
  glyph: 0.5,
  radius: 0.22,
  paths: PLUS,
});
// Notification badge (Android status bar): only its alpha is used, so the
// glyph alone, white on transparent.
await png("public/icons/badge-96.png", {
  size: 96,
  glyph: 0.8,
  radius: 0,
  background: false,
});
// Next.js file conventions: apple-icon → <link rel="apple-touch-icon">, icon.svg → favicon.
// iOS rounds the corners itself and needs an opaque square.
await png("src/app/apple-icon.png", { size: 180, glyph: 0.52, radius: 0 });
fs.writeFileSync(
  path.join(ROOT, "src/app/icon.svg"),
  svg({ size: 64, glyph: 0.6, radius: 0.22 }) + "\n",
);
console.log("wrote src/app/icon.svg");
