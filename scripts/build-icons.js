#!/usr/bin/env node
// Renders the home-screen icons, favicons and share image from the two source
// SVGs. Run with `npm run icons` – only needed when assets/icon.svg or
// assets/share.svg change. The PNGs are committed so GitHub Pages needs no build.

const fs = require('fs');
const path = require('path');
const { Resvg } = require('@resvg/resvg-js');

const ROOT = path.resolve(__dirname, '..');
const ASSETS = path.join(ROOT, 'assets');
const ICONS = path.join(ASSETS, 'icons');
fs.mkdirSync(ICONS, { recursive: true });

const iconSvg = fs.readFileSync(path.join(ASSETS, 'icon.svg'), 'utf8');
const shareSvg = fs.readFileSync(path.join(ASSETS, 'share.svg'), 'utf8');

// Maskable variant: Android crops maskable icons to a circle or squircle and
// only promises the central 80% (a circle of radius 40%). The border sits at
// 4% from the edge, so it would be clipped – leave it out. The S (60% of the
// height, centred) is already inside the safe zone. Full-bleed white behind it.
const maskableSvg = iconSvg.replace(/\s*<rect id="border"[^>]*\/>/, '');
if (maskableSvg === iconSvg) throw new Error('icon.svg has no <rect id="border">; update build-icons.js');

function render(svg, width) {
  return new Resvg(svg, {
    fitTo: { mode: 'width', value: width },
    background: '#ffffff',              // no transparency anywhere
    font: { loadSystemFonts: true },    // share.svg's tagline uses the system sans-serif
  }).render().asPng();
}

function write(file, png) {
  fs.writeFileSync(file, png);
  console.log(`  ${path.relative(ROOT, file).replace(/\\/g, '/')}  ${png.length.toLocaleString('en-GB')} bytes`);
}

// An .ico holding PNG images (supported by every current browser and Windows).
function ico(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);           // reserved
  header.writeUInt16LE(1, 2);           // type: icon
  header.writeUInt16LE(pngs.length, 4);
  const entries = [];
  let offset = 6 + 16 * pngs.length;
  for (const { size, png } of pngs) {
    const e = Buffer.alloc(16);
    e.writeUInt8(size >= 256 ? 0 : size, 0);
    e.writeUInt8(size >= 256 ? 0 : size, 1);
    e.writeUInt8(0, 2);                 // no palette
    e.writeUInt8(0, 3);
    e.writeUInt16LE(1, 4);              // colour planes
    e.writeUInt16LE(32, 6);             // bits per pixel
    e.writeUInt32LE(png.length, 8);
    e.writeUInt32LE(offset, 12);
    offset += png.length;
    entries.push(e);
  }
  return Buffer.concat([header, ...entries, ...pngs.map(p => p.png)]);
}

console.log('Rendering icons:');
write(path.join(ICONS, 'icon-192.png'), render(iconSvg, 192));
write(path.join(ICONS, 'icon-512.png'), render(iconSvg, 512));
write(path.join(ICONS, 'icon-512-maskable.png'), render(maskableSvg, 512));
write(path.join(ICONS, 'apple-touch-icon.png'), render(iconSvg, 180));
const fav32 = render(iconSvg, 32);
write(path.join(ICONS, 'favicon-32.png'), fav32);
write(path.join(ICONS, 'favicon.ico'), ico([16, 32, 48].map(size => ({ size, png: size === 32 ? fav32 : render(iconSvg, size) }))));
write(path.join(ASSETS, 'share.png'), render(shareSvg, 1200));
