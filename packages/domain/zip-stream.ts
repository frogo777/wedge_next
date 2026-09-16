export type ZipInputFile = Readonly<{
  path: string;
  bytes: Uint8Array<ArrayBuffer>;
}>;

type CentralEntry = Readonly<{
  name: Uint8Array<ArrayBuffer>;
  crc32: number;
  size: number;
  offset: number;
}>;

const ZIP32_MAX = 0xffffffff;
const ZIP_ENTRY_MAX = 0xffff;
const UTF8_WITH_DESCRIPTOR = 0x0808;
const STORED = 0;
const DOS_TIME = 0;
const DOS_DATE_1980_01_01 = 0x21;
const CRC32_TABLE = Object.freeze(Array.from({ length: 256 }, (_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return value >>> 0;
}));

function crc32(bytes: Uint8Array<ArrayBuffer>) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value = (value >>> 8) ^ CRC32_TABLE[(value ^ byte) & 0xff];
  }
  return (value ^ 0xffffffff) >>> 0;
}

function header(size: number, write: (view: DataView) => void) {
  const bytes = new Uint8Array(size);
  write(new DataView(bytes.buffer));
  return bytes;
}

function safeName(path: string) {
  const segments = typeof path === 'string' ? path.split('/') : [];
  if (typeof path !== 'string' || path.length > 256 || path.startsWith('/')
    || path.includes('\\') || segments.some(segment => !segment || segment === '.' || segment === '..')
    || !/^[a-z0-9][a-z0-9._/-]*$/.test(path)) throw new Error('invalid_zip_path');
  const bytes = new TextEncoder().encode(path);
  if (bytes.byteLength > ZIP_ENTRY_MAX) throw new Error('invalid_zip_path');
  return bytes;
}

function ensureZip32(value: number) {
  if (!Number.isSafeInteger(value) || value < 0 || value > ZIP32_MAX) throw new Error('zip_too_large');
  return value;
}

export async function* encodeStoredZip(files: AsyncIterable<ZipInputFile>): AsyncGenerator<Uint8Array<ArrayBuffer>> {
  const central: CentralEntry[] = [];
  let offset = 0;

  for await (const file of files) {
    if (!(file.bytes instanceof Uint8Array)) throw new Error('invalid_zip_bytes');
    if (central.length >= ZIP_ENTRY_MAX) throw new Error('zip_too_many_files');
    const name = safeName(file.path);
    const size = ensureZip32(file.bytes.byteLength);
    const checksum = crc32(file.bytes);
    const localOffset = ensureZip32(offset);
    const local = header(30, view => {
      view.setUint32(0, 0x04034b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, UTF8_WITH_DESCRIPTOR, true);
      view.setUint16(8, STORED, true);
      view.setUint16(10, DOS_TIME, true);
      view.setUint16(12, DOS_DATE_1980_01_01, true);
      view.setUint16(26, name.byteLength, true);
    });
    const descriptor = header(16, view => {
      view.setUint32(0, 0x08074b50, true);
      view.setUint32(4, checksum, true);
      view.setUint32(8, size, true);
      view.setUint32(12, size, true);
    });
    yield local;
    yield name;
    yield file.bytes;
    yield descriptor;
    offset = ensureZip32(offset + local.byteLength + name.byteLength + size + descriptor.byteLength);
    central.push({ name, crc32: checksum, size, offset: localOffset });
  }

  const centralOffset = offset;
  for (const entry of central) {
    const record = header(46, view => {
      view.setUint32(0, 0x02014b50, true);
      view.setUint16(4, 20, true);
      view.setUint16(6, 20, true);
      view.setUint16(8, UTF8_WITH_DESCRIPTOR, true);
      view.setUint16(10, STORED, true);
      view.setUint16(12, DOS_TIME, true);
      view.setUint16(14, DOS_DATE_1980_01_01, true);
      view.setUint32(16, entry.crc32, true);
      view.setUint32(20, entry.size, true);
      view.setUint32(24, entry.size, true);
      view.setUint16(28, entry.name.byteLength, true);
      view.setUint32(42, entry.offset, true);
    });
    yield record;
    yield entry.name;
    offset = ensureZip32(offset + record.byteLength + entry.name.byteLength);
  }

  const centralSize = ensureZip32(offset - centralOffset);
  yield header(22, view => {
    view.setUint32(0, 0x06054b50, true);
    view.setUint16(8, central.length, true);
    view.setUint16(10, central.length, true);
    view.setUint32(12, centralSize, true);
    view.setUint32(16, centralOffset, true);
  });
}

export function zipReadableStream(files: AsyncIterable<ZipInputFile>) {
  const iterator = encodeStoredZip(files)[Symbol.asyncIterator]();
  return new ReadableStream<Uint8Array<ArrayBuffer>>({
    async pull(controller) {
      try {
        const next = await iterator.next();
        if (next.done) controller.close();
        else controller.enqueue(next.value);
      } catch (error) {
        controller.error(error);
      }
    },
    async cancel() {
      await iterator.return?.(undefined);
    },
  });
}
