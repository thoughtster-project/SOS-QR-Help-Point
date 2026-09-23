import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { neon } from '@neondatabase/serverless';

const archiveOpen = process.argv.includes('--archive-open');
const dryRun = process.argv.includes('--dry-run');
const file = process.argv.find(arg => arg.endsWith('.json')) || '.netlify/firebase-events-export.json';
const source = JSON.parse(await readFile(resolve(file), 'utf8'));
const points = JSON.parse(await readFile(new URL('./qr-points-seed.json', import.meta.url), 'utf8'));
const allowed = new Set([
  'sos', 'police_request', 'driver_ack', 'driver_resolved_self', 'driver_police_started',
  'driver_calling_done', 'unit_arriving', 'case_closed', 'reporter_closed',
]);
const incidents = new Map();
const events = [];
const entries = Object.entries(source).sort((a, b) => {
  const byTime = Number(a[1]?.ts || 0) - Number(b[1]?.ts || 0);
  return byTime || a[0].localeCompare(b[0]);
});

for (const [sourceEventId, msg] of entries) {
  if (!msg || !allowed.has(msg.type) || typeof msg.caseId !== 'string' || !msg.caseId) continue;
  const occurredAt = Number.isFinite(Number(msg.ts)) ? new Date(Number(msg.ts)) : new Date();
  if (Number.isNaN(occurredAt.getTime())) continue;
  let row = incidents.get(msg.caseId);
  if (!row) {
    row = {
      caseId: msg.caseId, reporterType: 'unknown', bus: null, pointId: null, pointName: null,
      zone: null, seat: null, details: '', tags: [], status: 'open',
      policeRequested: false, policeCalled: false, resolution: null,
      reportedAt: occurredAt, acknowledgedAt: null, closedAt: null, updatedAt: occurredAt,
    };
    incidents.set(msg.caseId, row);
  }
  row.updatedAt = occurredAt;
  if (msg.type === 'sos') {
    row.reporterType = String(msg.from || 'unknown');
    row.bus = typeof msg.bus === 'string' ? msg.bus : null;
    row.pointId = typeof msg.pointId === 'string' ? msg.pointId : null;
    row.pointName = typeof msg.pointName === 'string' ? msg.pointName : null;
    row.zone = typeof msg.zone === 'string' ? msg.zone : null;
    row.seat = msg.seat == null ? null : String(msg.seat);
    row.details = typeof msg.details === 'string' ? msg.details : '';
    row.tags = Array.isArray(msg.tags) ? msg.tags.filter(tag => typeof tag === 'string') : [];
    row.reportedAt = occurredAt;
  } else if (msg.type === 'police_request') {
    row.policeRequested = true;
  } else if (msg.type === 'driver_ack') {
    row.status = 'acknowledged';
    row.acknowledgedAt = occurredAt;
  } else if (msg.type === 'driver_resolved_self') {
    row.resolution = 'resolved_by_driver';
  } else if (msg.type === 'driver_police_started' || msg.type === 'driver_calling_done') {
    row.policeCalled = true;
    row.resolution = 'police_contacted';
  } else if (msg.type === 'case_closed') {
    row.status = 'closed';
    row.closedAt = occurredAt;
    row.resolution = typeof msg.reason === 'string' ? msg.reason : row.resolution;
  }
  const payload = Object.fromEntries(Object.entries(msg).filter(([key]) => !['type', 'from', 'caseId', 'ts'].includes(key)));
  events.push({ caseId: msg.caseId, eventType: msg.type, actor: String(msg.from || 'unknown'), payload, occurredAt, sourceEventId });
}

const open = [...incidents.values()].filter(row => row.status !== 'closed');
if (archiveOpen) {
  const archivedAt = new Date();
  for (const row of open) {
    row.status = 'closed';
    row.resolution = 'migrated_demo_history';
    row.closedAt = archivedAt;
    row.updatedAt = archivedAt;
    events.push({
      caseId: row.caseId, eventType: 'case_closed', actor: 'migration',
      payload: { reason: 'migrated_demo_history' }, occurredAt: archivedAt,
      sourceEventId: `migration:${row.caseId}`,
    });
  }
}

const summary = { points: points.length, cases: incidents.size, events: events.length, openBeforeArchive: open.length, archived: archiveOpen ? open.length : 0 };
if (dryRun) {
  console.log(JSON.stringify(summary));
  process.exit(0);
}
if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is required');
const sql = neon(process.env.DATABASE_URL);
const schema = [
  `CREATE TABLE IF NOT EXISTS incidents (
    case_id text PRIMARY KEY, reporter_type text NOT NULL DEFAULT 'unknown', bus text,
    point_id text, point_name text, zone text, seat text, details text NOT NULL DEFAULT '',
    tags jsonb NOT NULL DEFAULT '[]', status text NOT NULL DEFAULT 'open',
    police_requested boolean NOT NULL DEFAULT false, police_called boolean NOT NULL DEFAULT false,
    resolution text, reported_at timestamptz NOT NULL DEFAULT now(), acknowledged_at timestamptz,
    closed_at timestamptz, updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  `CREATE TABLE IF NOT EXISTS incident_events (
    id serial PRIMARY KEY, case_id text NOT NULL, event_type text NOT NULL, actor text NOT NULL,
    payload jsonb NOT NULL DEFAULT '{}', occurred_at timestamptz NOT NULL DEFAULT now(),
    source_event_id text UNIQUE
  )`,
  `CREATE TABLE IF NOT EXISTS qr_points (
    id text PRIMARY KEY, bus text NOT NULL, name text NOT NULL, zone text NOT NULL, seat text,
    active boolean NOT NULL DEFAULT true, created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS incidents_bus_status_idx ON incidents (bus, status, reported_at)',
];
for (const statement of schema) await sql.query(statement);

async function insertRows(table, columns, rows, conflict) {
  for (let offset = 0; offset < rows.length; offset += 40) {
    const chunk = rows.slice(offset, offset + 40);
    const values = chunk.flatMap(row => columns.map(column => row[column]));
    const tuples = chunk.map((_, rowIndex) => `(${columns.map((column, columnIndex) => {
      const param = `$${rowIndex * columns.length + columnIndex + 1}`;
      return column === 'tags' || column === 'payload' ? `${param}::jsonb` : param;
    }).join(',')})`).join(',');
    const names = columns.map(column => `"${column}"`).join(',');
    await sql.query(`INSERT INTO ${table} (${names}) VALUES ${tuples} ON CONFLICT (${conflict}) DO NOTHING`, values);
  }
}

await insertRows('qr_points', ['id','bus','name','zone','seat'], points, 'id');
const incidentRows = [...incidents.values()].map(row => ({
  case_id: row.caseId, reporter_type: row.reporterType, bus: row.bus, point_id: row.pointId,
  point_name: row.pointName, zone: row.zone, seat: row.seat, details: row.details,
  tags: JSON.stringify(row.tags), status: row.status, police_requested: row.policeRequested,
  police_called: row.policeCalled, resolution: row.resolution, reported_at: row.reportedAt.toISOString(),
  acknowledged_at: row.acknowledgedAt?.toISOString() || null,
  closed_at: row.closedAt?.toISOString() || null, updated_at: row.updatedAt.toISOString(),
}));
await insertRows('incidents', [
  'case_id','reporter_type','bus','point_id','point_name','zone','seat','details','tags','status',
  'police_requested','police_called','resolution','reported_at','acknowledged_at','closed_at','updated_at',
], incidentRows, 'case_id');
const eventRows = events.map(event => ({
  case_id: event.caseId, event_type: event.eventType, actor: event.actor,
  payload: JSON.stringify(event.payload), occurred_at: event.occurredAt.toISOString(), source_event_id: event.sourceEventId,
}));
await insertRows('incident_events', ['case_id','event_type','actor','payload','occurred_at','source_event_id'], eventRows, 'source_event_id');
console.log(JSON.stringify(summary));
