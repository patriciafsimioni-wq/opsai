// Moves every base64 `data:` URL stored on a record into the Attachment table
// and replaces it with `/api/attachments/<id>`, so list queries stop shipping
// megabytes of file data. Idempotent: rows already holding a URL are skipped.
//
// Usage: DB_URL=<connection string> node scripts/migrate-attachments.mjs [--dry]
import { PrismaClient } from "@prisma/client";

const url = process.env.DB_URL;
if (!url) {
  console.error("Set DB_URL to the target database connection string.");
  process.exit(1);
}
const dry = process.argv.includes("--dry");
const prisma = new PrismaClient({ datasources: { db: { url } } });

const DATA_URL = /^data:([^;,]*)(;base64)?,/i;
const EXTENSIONS = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
};

async function store(value) {
  const m = DATA_URL.exec(value);
  if (!m) return value;
  const comma = value.indexOf(",");
  const mimeType = m[1] || "application/octet-stream";
  const payload = value.slice(comma + 1);
  const bytes = m[2]
    ? Buffer.from(payload, "base64")
    : Buffer.from(decodeURIComponent(payload), "binary");
  if (dry) return `/api/attachments/dry-${bytes.byteLength}`;
  const saved = await prisma.attachment.create({
    data: { mimeType, size: bytes.byteLength, data: bytes.toString("base64") },
    select: { id: true },
  });
  const ext = EXTENSIONS[mimeType.toLowerCase()];
  return `/api/attachments/${saved.id}${ext ? `.${ext}` : ""}`;
}

/** Rewrites a column value: a bare data URL, or a JSON array of data URLs /
 *  objects whose `url` is one. Returns null when nothing needed moving. */
async function convert(value) {
  if (DATA_URL.test(value)) return await store(value);
  let parsed;
  try {
    parsed = JSON.parse(value);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed)) return null;
  let changed = false;
  const out = [];
  for (const entry of parsed) {
    if (typeof entry === "string" && DATA_URL.test(entry)) {
      out.push(await store(entry));
      changed = true;
    } else if (entry && typeof entry === "object" && typeof entry.url === "string" && DATA_URL.test(entry.url)) {
      out.push({ ...entry, url: await store(entry.url) });
      changed = true;
    } else {
      out.push(entry);
    }
  }
  return changed ? JSON.stringify(out) : null;
}

const columns = await prisma.$queryRawUnsafe(`
  select c.table_name, c.column_name
  from information_schema.columns c
  join information_schema.columns pk
    on pk.table_schema = c.table_schema and pk.table_name = c.table_name and pk.column_name = 'id'
  where c.table_schema = 'public'
    and c.data_type in ('text', 'character varying')
    and not (c.table_name = 'Attachment' and c.column_name = 'data')
`);

let movedFiles = 0;
let movedBytes = 0;
for (const { table_name: table, column_name: column } of columns) {
  const ids = await prisma.$queryRawUnsafe(
    `select "id" from "${table}" where "${column}" like 'data:%' or "${column}" like '%"data:%' or "${column}" like '%: "data:%'`,
  );
  if (ids.length === 0) continue;
  let count = 0;
  let bytes = 0;
  for (const { id } of ids) {
    const [row] = await prisma.$queryRawUnsafe(
      `select "${column}" as value from "${table}" where "id" = $1`,
      id,
    );
    if (!row?.value) continue;
    const before = row.value.length;
    const next = await convert(row.value);
    if (next === null) continue;
    if (!dry) {
      await prisma.$executeRawUnsafe(`update "${table}" set "${column}" = $1 where "id" = $2`, next, id);
    }
    count += 1;
    bytes += before - next.length;
  }
  if (count > 0) {
    movedFiles += count;
    movedBytes += bytes;
    console.log(`${table}.${column}: ${count} row(s), ${(bytes / 1e6).toFixed(2)} MB moved out`);
  }
}

console.log(`${dry ? "[dry run] " : ""}total: ${movedFiles} row(s), ${(movedBytes / 1e6).toFixed(2)} MB`);
await prisma.$disconnect();
