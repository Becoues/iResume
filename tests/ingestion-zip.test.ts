import test from "node:test";
import assert from "node:assert/strict";
import { crc32, deflateRawSync } from "node:zlib";
import { validateDocxArchive } from "../src/lib/ingestion/zip";
import { IngestionError } from "../src/lib/ingestion";

function archive(entries: { name: string; bytes: Buffer; declaredSize?: number }[]): Buffer {
  const locals: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = Buffer.from(entry.name);
    const compressed = deflateRawSync(entry.bytes);
    const size = entry.declaredSize ?? entry.bytes.length;
    const checksum = crc32(entry.bytes);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(checksum, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(size, 22); local.writeUInt16LE(name.length, 26);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4); directory.writeUInt16LE(20, 6); directory.writeUInt16LE(8, 10);
    directory.writeUInt32LE(checksum, 16); directory.writeUInt32LE(compressed.length, 20); directory.writeUInt32LE(size, 24); directory.writeUInt16LE(name.length, 28); directory.writeUInt32LE(offset, 42);
    locals.push(local, name, compressed); central.push(directory, name);
    offset += local.length + name.length + compressed.length;
  }
  const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(central.reduce((size, part) => size + part.length, 0), 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...central, end]);
}

test("DOCX refuses inflated bytes that disagree with forged size metadata", async () => {
  const zip = archive([{ name: "word/document.xml", bytes: Buffer.alloc(2 * 1024 * 1024, 65), declaredSize: 1 }]);
  await assert.rejects(validateDocxArchive(zip), IngestionError);
});
test("DOCX refuses an individual expanded part above 20MB", async () => {
  const zip = archive([{ name: "word/document.xml", bytes: Buffer.alloc(21 * 1024 * 1024, 65) }]);
  await assert.rejects(validateDocxArchive(zip), (error: unknown) => error instanceof IngestionError && /过大/.test(error.message));
});
test("DOCX refuses combined expanded parts above 40MB", async () => {
  const bytes = Buffer.alloc(15 * 1024 * 1024, 65);
  const zip = archive([{ name: "word/document.xml", bytes }, { name: "word/media/one.png", bytes }, { name: "word/media/two.png", bytes }]);
  await assert.rejects(validateDocxArchive(zip), IngestionError);
});
test("DOCX drains valid compressed parts before allowing extraction", async () => {
  await validateDocxArchive(archive([{ name: "word/document.xml", bytes: Buffer.from("<document>Alice Smith</document>") }, { name: "word/styles.xml", bytes: Buffer.from("<styles />") }]));
});
