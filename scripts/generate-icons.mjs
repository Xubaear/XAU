import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';

function createPng(size) {
  const crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    crcTable[n] = c;
  }
  function crc32(buf) {
    let c = 0xffffffff;
    for (let i = 0; i < buf.length; i++) {
      c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
    }
    return (c ^ 0xffffffff) >>> 0;
  }

  function chunk(type, data) {
    const len = data.length;
    const buf = Buffer.alloc(12 + len);
    buf.writeUInt32BE(len, 0);
    buf.write(type, 4, 'ascii');
    data.copy(buf, 8);
    const crcBuf = Buffer.alloc(4 + len);
    buf.copy(crcBuf, 0, 4, 8 + len);
    buf.writeUInt32BE(crc32(crcBuf), 8 + len);
    return buf;
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr.writeUInt8(8, 8); // 8-bit
  ihdr.writeUInt8(6, 9); // RGBA
  ihdr.writeUInt8(0, 10); // deflate
  ihdr.writeUInt8(0, 11); // filter
  ihdr.writeUInt8(0, 12); // no interlace

  const rowLength = 1 + size * 4;
  const rawData = Buffer.alloc(rowLength * size);

  const center = size / 2;
  const radius = size * 0.44;

  for (let y = 0; y < size; y++) {
    const rowOffset = y * rowLength;
    rawData[rowOffset] = 0; // Filter: None
    for (let x = 0; x < size; x++) {
      const pxOffset = rowOffset + 1 + x * 4;
      const dx = x - center;
      const dy = y - center;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist <= radius) {
        // Gold gradient #eab308 to #f59e0b
        const t = (x + y) / (2 * size);
        rawData[pxOffset] = Math.round(234 + (245 - 234) * t);
        rawData[pxOffset + 1] = Math.round(179 + (158 - 179) * t);
        rawData[pxOffset + 2] = Math.round(8 + (11 - 8) * t);
        rawData[pxOffset + 3] = 255;
      } else {
        // Dark background #030712
        rawData[pxOffset] = 3;
        rawData[pxOffset + 1] = 7;
        rawData[pxOffset + 2] = 18;
        rawData[pxOffset + 3] = 255;
      }
    }
  }

  const compressed = zlib.deflateSync(rawData);
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdrChunk = chunk('IHDR', ihdr);
  const idatChunk = chunk('IDAT', compressed);
  const iendChunk = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const publicDir = path.resolve(process.cwd(), 'public');
fs.writeFileSync(path.join(publicDir, 'icon-192.png'), createPng(192));
fs.writeFileSync(path.join(publicDir, 'icon-512.png'), createPng(512));
console.log('Successfully generated public/icon-192.png and public/icon-512.png');
