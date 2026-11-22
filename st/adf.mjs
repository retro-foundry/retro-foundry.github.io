const sectorSize = 512;
const sectors = 1760;
const pointers = 72;

// DOS1 FFS, the format recorded in analysis/media_inventory.json.
export class TableDisk {
  constructor(bytes) {
    this.bytes = bytes;
    this.data = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    if (bytes.length !== sectorSize * sectors || this.data.getUint32(0) !== 0x444f5301) {
      throw new Error('Choose a standard 880 KiB Slam Tilt table ADF.');
    }
    this.root = this.data.getUint32(8) || sectors / 2;
    const root = this.block(this.root);
    if (root.getInt32(0) !== 2 || root.getInt32(508) !== 1 || root.getUint32(12) !== pointers) {
      throw new Error('The ADF has an invalid AmigaDOS root block.');
    }
    this.volume = this.name(root);
  }

  block(sector) {
    if (sector < 2 || sector >= sectors) throw new Error('The ADF references a sector outside its data area.');
    return new DataView(this.bytes.buffer, this.bytes.byteOffset + sector * sectorSize, sectorSize);
  }

  name(block) {
    const length = block.getUint8(432);
    if (length > 30) throw new Error('The ADF contains an invalid file name.');
    return String.fromCharCode(...new Uint8Array(block.buffer, block.byteOffset + 433, length));
  }

  find(directory, name) {
    const seen = new Set();
    const root = this.block(directory);
    for (let index = 0; index < pointers; ++index) {
      let sector = root.getUint32(24 + 4 * index);
      while (sector) {
        if (seen.has(sector)) throw new Error('The ADF contains a directory cycle.');
        seen.add(sector);
        const entry = this.block(sector);
        if (entry.getInt32(0) !== 2) throw new Error('The ADF contains an invalid file header.');
        if (this.name(entry).toLowerCase() === name.toLowerCase()) return sector;
        sector = entry.getUint32(496);
      }
    }
    throw new Error(`${name} is missing from ${this.volume}.`);
  }

  read(path, expectedSize) {
    const names = path.split('/');
    let sector = this.root;
    for (const directory of names.slice(0, -1)) {
      sector = this.find(sector, directory);
      if (this.block(sector).getInt32(508) !== 2) throw new Error(`${directory} is not a directory.`);
    }
    sector = this.find(sector, names.at(-1));
    let header = this.block(sector);
    const size = header.getUint32(324);
    if (header.getInt32(508) !== -3 || size !== expectedSize || size > this.bytes.length) {
      throw new Error(`${path} has an unsupported type or size.`);
    }
    const output = new Uint8Array(size);
    const used = new Set([sector]);
    let position = 0;
    while (position < size) {
      const count = Math.min(pointers, Math.ceil((size - position) / sectorSize));
      if (header.getUint32(8) !== count) throw new Error(`${path} has an invalid block count.`);
      for (let index = 0; index < count; ++index) {
        const dataSector = header.getUint32(308 - index * 4);
        if (used.has(dataSector)) throw new Error(`${path} reuses a file block.`);
        used.add(dataSector);
        const data = this.block(dataSector);
        const length = Math.min(sectorSize, size - position);
        output.set(new Uint8Array(data.buffer, data.byteOffset, length), position);
        position += length;
      }
      if (position < size) {
        sector = header.getUint32(504);
        if (used.has(sector)) throw new Error(`${path} contains an extension cycle.`);
        used.add(sector);
        header = this.block(sector);
        if (header.getInt32(0) !== 16 || header.getInt32(508) !== -3) {
          throw new Error(`${path} has an invalid extension block.`);
        }
      }
    }
    return output;
  }
}

export async function readChecked(disk, { path, size, sha256 }) {
  const bytes = disk.read(path, size);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  const hex = Array.from(digest, byte => byte.toString(16).padStart(2, '0')).join('');
  if (hex !== sha256) throw new Error(`${path} differs from the supported Slam Tilt release.`);
  return bytes;
}
