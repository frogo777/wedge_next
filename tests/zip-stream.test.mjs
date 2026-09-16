import test from 'node:test';
import assert from 'node:assert/strict';
import { zipReadableStream } from '../packages/domain/zip-stream.ts';

function crc32(bytes) {
  let value = 0xffffffff;
  for (const byte of bytes) {
    value ^= byte;
    for (let bit = 0; bit < 8; bit += 1) value = (value >>> 1) ^ (0xedb88320 & -(value & 1));
  }
  return (value ^ 0xffffffff) >>> 0;
}

function parseStoredZip(bytes) {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const end = bytes.byteLength - 22;
  assert.equal(view.getUint32(end, true), 0x06054b50);
  const count = view.getUint16(end + 10, true);
  let cursor = view.getUint32(end + 16, true);
  const files = new Map();
  for (let index = 0; index < count; index += 1) {
    assert.equal(view.getUint32(cursor, true), 0x02014b50);
    assert.equal(view.getUint16(cursor + 10, true), 0);
    const expectedCrc = view.getUint32(cursor + 16, true);
    const size = view.getUint32(cursor + 24, true);
    const nameLength = view.getUint16(cursor + 28, true);
    const extraLength = view.getUint16(cursor + 30, true);
    const commentLength = view.getUint16(cursor + 32, true);
    const localOffset = view.getUint32(cursor + 42, true);
    const name = new TextDecoder().decode(bytes.subarray(cursor + 46, cursor + 46 + nameLength));
    assert.equal(view.getUint32(localOffset, true), 0x04034b50);
    const localNameLength = view.getUint16(localOffset + 26, true);
    const localExtraLength = view.getUint16(localOffset + 28, true);
    const dataOffset = localOffset + 30 + localNameLength + localExtraLength;
    const data = bytes.slice(dataOffset, dataOffset + size);
    assert.equal(crc32(data), expectedCrc);
    assert.equal(view.getUint32(dataOffset + size, true), 0x08074b50);
    assert.equal(view.getUint32(dataOffset + size + 4, true), expectedCrc);
    assert.equal(view.getUint32(dataOffset + size + 8, true), size);
    assert.equal(view.getUint32(dataOffset + size + 12, true), size);
    files.set(name, data);
    cursor += 46 + nameLength + extraLength + commentLength;
  }
  return files;
}

test('ZIP almacena archivos verificables y sólo cierra el directorio al final', async () => {
  const encoder = new TextEncoder();
  const expected = new Map([
    ['demo-progress.json', encoder.encode('{"format":1}\n')],
    [`private-entity/sources/${'a'.repeat(64)}.xml`, encoder.encode('<synthetic/>')],
  ]);
  async function* files() {
    for (const [path, bytes] of expected) yield { path, bytes };
  }
  const archive = new Uint8Array(await new Response(zipReadableStream(files())).arrayBuffer());
  const parsed = parseStoredZip(archive);
  assert.deepEqual([...parsed.keys()], [...expected.keys()]);
  for (const [path, bytes] of expected) assert.deepEqual(parsed.get(path), bytes);
});

test('ZIP rechaza rutas que podrían escapar del expediente', async () => {
  for (const path of ['../secret', 'safe/./secret', 'folder/']) {
    async function* files() { yield { path, bytes: new Uint8Array([1]) }; }
    await assert.rejects(new Response(zipReadableStream(files())).arrayBuffer(), /invalid_zip_path/);
  }
});
