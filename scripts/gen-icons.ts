/**
 * Generates the toolbar/store icons as PNGs (no image dependencies).
 * Design: rounded green square with a white-ringed red disc (Bangladesh flag
 * colours). It is font-independent and stays legible at 16px.
 *
 * Usage: npm run icons   (writes static/icons/icon{16,32,48,128}.png)
 */
import { deflateSync, crc32 } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const GREEN = [0x00, 0x6a, 0x4e];
const RED = [0xf4, 0x2a, 0x41];
const WHITE = [0xff, 0xff, 0xff];

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

export function encodePng(size: number, rgba: Uint8Array): Buffer {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0; // filter: none
    Buffer.from(rgba.buffer, rgba.byteOffset + y * size * 4, size * 4).copy(raw, y * (size * 4 + 1) + 1);
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** Returns [r,g,b,a] for a point in unit coordinates (0..1). */
function shade(x: number, y: number): [number, number, number, number] {
  const r = 0.2; // corner radius
  const inset = 0.02;
  const cx = Math.min(Math.max(x, inset + r), 1 - inset - r);
  const cy = Math.min(Math.max(y, inset + r), 1 - inset - r);
  const inSquare = (x - cx) ** 2 + (y - cy) ** 2 <= r * r && x >= inset && x <= 1 - inset && y >= inset && y <= 1 - inset;
  if (!inSquare) return [0, 0, 0, 0];
  const d = Math.hypot(x - 0.46, y - 0.5);
  if (d <= 0.27) return [...RED, 255] as [number, number, number, number];
  if (d <= 0.31) return [...WHITE, 255] as [number, number, number, number];
  return [...GREEN, 255] as [number, number, number, number];
}

export function renderIcon(size: number): Uint8Array {
  const ss = 4; // supersampling for anti-aliasing
  const out = new Uint8Array(size * size * 4);
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let rs = 0, gs = 0, bs = 0, as = 0;
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const [r, g, b, a] = shade((px + (sx + 0.5) / ss) / size, (py + (sy + 0.5) / ss) / size);
          rs += r * a; gs += g * a; bs += b * a; as += a;
        }
      }
      const i = (py * size + px) * 4;
      const n = ss * ss;
      out[i + 3] = Math.round(as / n);
      if (as > 0) {
        out[i] = Math.round(rs / as);
        out[i + 1] = Math.round(gs / as);
        out[i + 2] = Math.round(bs / as);
      }
    }
  }
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = join(process.cwd(), 'static', 'icons');
  mkdirSync(dir, { recursive: true });
  for (const size of [16, 32, 48, 128]) {
    writeFileSync(join(dir, `icon${size}.png`), encodePng(size, renderIcon(size)));
    console.log(`wrote static/icons/icon${size}.png`);
  }
}
