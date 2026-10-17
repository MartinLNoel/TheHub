// Generates the placeholder app icons (no dependencies): a blue square with a white "hub"
// (a ring around a dot, with four spokes). Run: npm run icons
// PLACEHOLDER(Q-5): replace with a real icon design if Martin wants one.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x2f, 0x6f, 0xde];
const FG = [0xff, 0xff, 0xff];

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

// scale: how much of the icon the drawing uses (maskable icons keep it inside the safe zone).
function icon(size, { rounded, scale }) {
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const c = size / 2;
  const unit = (size / 2) * scale;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    for (let x = 0; x < size; x++) {
      const dx = x + 0.5 - c;
      const dy = y + 0.5 - c;
      const r = Math.hypot(dx, dy) / unit;
      const corner = size * 0.2;
      const outside =
        rounded &&
        ((x < corner || x >= size - corner) && (y < corner || y >= size - corner)) &&
        Math.hypot(Math.max(corner - x - 0.5, x + 0.5 - (size - corner), 0), Math.max(corner - y - 0.5, y + 0.5 - (size - corner), 0)) > corner;
      const ring = r > 0.62 && r < 0.8;
      const dot = r < 0.24;
      const spoke = r < 0.62 && (Math.abs(dx) / unit < 0.07 || Math.abs(dy) / unit < 0.07);
      const color = ring || dot || spoke ? FG : BG;
      const i = y * (size * 4 + 1) + 1 + x * 4;
      raw[i] = color[0];
      raw[i + 1] = color[1];
      raw[i + 2] = color[2];
      raw[i + 3] = outside ? 0 : 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

mkdirSync('icons', { recursive: true });
writeFileSync('icons/icon-192.png', icon(192, { rounded: true, scale: 0.8 }));
writeFileSync('icons/icon-512.png', icon(512, { rounded: true, scale: 0.8 }));
writeFileSync('icons/icon-maskable-512.png', icon(512, { rounded: false, scale: 0.6 }));
console.log('Wrote icons/icon-192.png, icons/icon-512.png, icons/icon-maskable-512.png');
