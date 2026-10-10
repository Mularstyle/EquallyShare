/** Builds a synthetic MPEG-1 Layer III stream (128 kbps, 44.1 kHz, stereo, 417-byte frames). */
export const frameBytes = 417;

export function mp3Frame(index: number, options: { xing?: boolean } = {}): Buffer {
  const frame = Buffer.alloc(frameBytes);
  frame.set([0xff, 0xfb, 0x90, 0x00]);
  if (options.xing) frame.write("Xing", 4 + 32, "ascii");
  // Stamp the frame index outside the side-info/Xing area so slices can be checked.
  frame.writeUInt16BE(index, 60);
  return frame;
}

export function mp3File(frameCount: number, options: { id3?: boolean; xing?: boolean; id3v1?: boolean } = {}): Buffer {
  const parts: Buffer[] = [];
  if (options.id3) {
    const body = Buffer.alloc(30, 0x41);
    const header = Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, 0, 0, 0, body.length]);
    parts.push(header, body);
  }
  if (options.xing) parts.push(mp3Frame(0xffff, { xing: true }));
  for (let i = 0; i < frameCount; i++) parts.push(mp3Frame(i));
  if (options.id3v1) parts.push(Buffer.concat([Buffer.from("TAG"), Buffer.alloc(125)]));
  return Buffer.concat(parts);
}

export const frameIndexes = (data: Uint8Array) => Array.from({ length: data.length / frameBytes }, (_, i) => Buffer.from(data).readUInt16BE(i * frameBytes + 60));
