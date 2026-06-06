import fs from 'fs';
import { PNG } from 'pngjs';

const outDir = 'public';
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

const bg = { r: 0x1a, g: 0x1a, b: 0x2e, a: 255 };

function createPNG(size) {
  const png = new PNG({ width: size, height: size });
  const cx = size / 2, cy = size / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (size * y + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const inner = size * 0.28, outer = size * 0.42;
      const inGear = dist > inner && dist < outer;
      const spokeAngle = ((Math.atan2(dy, dx) * 180 / Math.PI) + 180) % 60;
      const inSpoke = inGear && (spokeAngle < 18 || spokeAngle > 42);
      const isGear = dist < inner ? true : (inGear && !inSpoke);
      if (isGear) {
        png.data[idx] = 0xff; png.data[idx+1] = 0xbe; png.data[idx+2] = 0x00; png.data[idx+3] = 0xff;
      } else {
        png.data[idx] = bg.r; png.data[idx+1] = bg.g; png.data[idx+2] = bg.b; png.data[idx+3] = 0xff;
      }
    }
  }
  const chunks = [];
  const stream = png.pack();
  stream.on('data', c => chunks.push(c));
  stream.on('end', () => ({ png, buf: Buffer.concat(chunks) }));
  return new Promise(resolve => stream.on('end', () => resolve({ png, buf: Buffer.concat(chunks) })));
}

function writeICOPath(icoBuf, path) {
  fs.writeFileSync(path, icoBuf);
}

async function main() {
  const sizes = [
    { path: `${outDir}/pwa-192x192.png`, size: 192 },
    { path: `${outDir}/pwa-512x512.png`, size: 512 },
    { path: `${outDir}/apple-touch-icon.png`, size: 180 },
  ];

  for (const { path: p, size: s } of sizes) {
    const { buf } = await createPNG(s);
    fs.writeFileSync(p, buf);
    console.log('Wrote', p, buf.length, 'bytes');
  }

  const { png } = await createPNG(32);
  const pngBuf = PNG.sync.write(png);

  const ico = Buffer.alloc(16 + pngBuf.length);
  ico.writeUInt16LE(1, 0);
  ico.writeUInt16LE(1, 2);
  ico.writeUInt16LE(1, 4);
  ico.writeUInt8(32, 6);
  ico.writeUInt8(32, 7);
  ico.writeUInt8(0, 8);
  ico.writeUInt8(0, 9);
  ico.writeUInt16LE(1, 10);
  ico.writeUInt16LE(32, 12);
  ico.writeUInt32LE(pngBuf.length, 14);
  ico.writeUInt32LE(22, 16);
  pngBuf.copy(ico, 16);

  writeICOPath(ico, `${outDir}/favicon.ico`);
  console.log('Wrote', `${outDir}/favicon.ico`, ico.length, 'bytes');
}

main().catch(e => { console.error(e); process.exit(1); });
