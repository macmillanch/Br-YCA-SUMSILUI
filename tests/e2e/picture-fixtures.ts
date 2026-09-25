/**
 * Picture bytes the browser will really lay out.
 *
 * The gallery's whole promise is that a portrait picture stays tall, and a
 * request that answers with the wrong shape — or fails outright — would let a
 * grid that crops everything to one box pass for a masonry of columns. So the
 * test store hands back an image of the size the address asks for.
 *
 * A 24-bit BMP is used because it is the one format whose bytes are written out
 * directly: no checksums, no compression, nothing that can drift from the
 * standard the way a hand-rolled PNG chunk chain can.
 */
export function bitmapOf(width: number, height: number, colour: [number, number, number]): Buffer {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixels = Buffer.alloc(rowSize * height);
  // A BMP holds its rows bottom-up and its colours as BGR; each row is padded to
  // a multiple of four bytes, which the loop leaves at zero.
  for (let row = 0; row < height; row += 1) {
    const start = row * rowSize;
    for (let x = 0; x < width; x += 1) {
      pixels[start + x * 3] = colour[2];
      pixels[start + x * 3 + 1] = colour[1];
      pixels[start + x * 3 + 2] = colour[0];
    }
  }

  const fileSize = 14 + 40 + pixels.length;
  const header = Buffer.alloc(54);
  header.write("BM", 0, "ascii");
  header.writeUInt32LE(fileSize, 2);
  header.writeUInt32LE(54, 10);
  header.writeUInt32LE(40, 14);
  header.writeInt32LE(width, 18);
  // A positive height is the bottom-up rows the pixel block above is written in.
  header.writeInt32LE(height, 22);
  header.writeUInt16LE(1, 26);
  header.writeUInt16LE(24, 28);
  header.writeUInt32LE(pixels.length, 34);
  return Buffer.concat([header, pixels]);
}

/** The shape a picture address asks for: `…/portrait-300x600.jpg` is 300 by 600. */
export function sizeFromUrl(url: string): { width: number; height: number } | null {
  const match = /(\d{2,4})x(\d{2,4})\.\w{3,4}(\?|$)/.exec(url);
  if (!match) return null;
  return { width: Number(match[1]), height: Number(match[2]) };
}
