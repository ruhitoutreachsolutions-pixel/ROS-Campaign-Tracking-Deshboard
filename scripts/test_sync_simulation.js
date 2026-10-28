// End-to-end multi-device sync simulation (no browser, no live writes).
//
// Runs the real src/services/{db,storage}.js against an in-memory fake of the Supabase
// `workspaces` table, then checks that a delete on Device A reaches a stale Device B exactly:
//   1. Cloud is seeded with a 54,408-lead Crewlix workspace (chunked like production).
//   2. Device A deletes 100 leads (some from the bundled 20,113 baseline) and saves.
//   3. Device B boots from a stale cache: the pre-delete leads, plus leads removed long ago whose
//      tombstones are gone, plus one lead imported offline that never uploaded.
//   4. B pulls (fetchWorkspacesFromCloud) and must hold A's leads + its pending import, nothing else.
//   5. B saves; A pulls again; both devices must hold the identical lead set.
// Also checks the stitcher ignores stale partitions past chunkCount and refuses partial copies,
// that the boot-time purge never deletes Crewlix partitions, and that a device holding the full
// set rebuilds the cloud after partitions were wiped (while a baseline-only device can't).
//
// Usage:  node scripts/test_sync_simulation.js [--live-seed]
//   --live-seed  seed the fake table from a READ-ONLY fetch of the live Supabase rows
//                (the live database is never written)

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const WS_ID = 'ws_crewlixukltd';
const LIVE_URL = 'https://efpywnwavldrycjspdel.supabase.co/rest/v1/workspaces';
const LIVE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImVmcHl3bndhdmxkcnljanNwZGVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTMwMzE4MDEsImV4cCI6MjEwODYwNzgwMX0.i0wlV3E3CiLL9uZ5JCVr5hfYnkwywhWUCvjDp5zcz0s';

// ---------------------------------------------------------------------------
// Browser shims
// ---------------------------------------------------------------------------
const memoryStorage = new Map();
globalThis.localStorage = {
  getItem: (k) => (memoryStorage.has(k) ? memoryStorage.get(k) : null),
  setItem: (k, v) => memoryStorage.set(k, String(v)),
  removeItem: (k) => memoryStorage.delete(k),
  clear: () => memoryStorage.clear()
};

// ---------------------------------------------------------------------------
// In-memory fake of the Supabase `workspaces` table
// ---------------------------------------------------------------------------
const table = new Map();
const clone = (v) => (v === undefined ? v : JSON.parse(JSON.stringify(v)));
const stats = { chunkReadFailures: new Set(), chunkWriteFailures: new Set() };

function likeToRegex(pattern) {
  const esc = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/%/g, '.*').replace(/_/g, '.');
  return new RegExp(`^${esc}$`, 'i');
}

class Query {
  constructor(name) { this.name = name; this.op = 'select'; this.filters = []; this.cols = '*'; this.single = false; this.returning = null; }
  select(cols = '*') { if (this.op === 'select') this.cols = cols; else this.returning = cols; return this; }
  update(payload) { this.op = 'update'; this.payload = payload; return this; }
  upsert(payload) { this.op = 'upsert'; this.payload = payload; return this; }
  delete() { this.op = 'delete'; return this; }
  eq(col, val) { this.filters.push(r => String(r[col]) === String(val)); return this; }
  is(col, val) { this.filters.push(r => (r[col] ?? null) === val); return this; }
  in(col, vals) { const s = new Set(vals.map(String)); this.filters.push(r => s.has(String(r[col]))); return this; }
  ilike(col, pattern) { const re = likeToRegex(pattern); this.filters.push(r => re.test(String(r[col]))); return this; }
  // Real SQL LIKE semantics: '_' is a single-character wildcard (what wiped the Crewlix partitions)
  like(col, pattern) { const re = likeToRegex(pattern.replace(/\*/g, '%')); this.filters.push(r => new RegExp(re.source).test(String(r[col]))); return this; }
  order(col, opts = {}) { this.orderBy = { col, asc: opts.ascending !== false }; return this; }
  maybeSingle() { this.single = true; return this; }
  pick(row, cols) {
    if (!cols || cols.trim() === '*') return clone(row);
    const out = {};
    cols.split(',').map(c => c.trim()).forEach(c => { out[c] = clone(row[c]); });
    return out;
  }
  run() {
    const rows = [...table.values()].filter(r => this.filters.every(f => f(r)));
    if (this.op === 'select') {
      if (this.cols.includes('leads') && rows.some(r => stats.chunkReadFailures.has(r.id))) {
        return { data: null, error: { message: 'simulated statement timeout' } };
      }
      if (this.orderBy) {
        const { col, asc } = this.orderBy;
        rows.sort((a, b) => (String(a[col]) < String(b[col]) ? -1 : String(a[col]) > String(b[col]) ? 1 : 0) * (asc ? 1 : -1));
      }
      const data = rows.map(r => this.pick(r, this.cols));
      return { data: this.single ? (data[0] || null) : data, error: null };
    }
    if (this.op === 'update') {
      rows.forEach(r => table.set(r.id, { ...r, ...clone(this.payload) }));
      return { data: this.returning ? rows.map(r => this.pick(table.get(r.id), this.returning)) : null, error: null };
    }
    if (this.op === 'upsert') {
      const p = clone(this.payload);
      if (stats.chunkWriteFailures.has(p.id)) return { data: null, error: { message: 'simulated upload failure' } };
      table.set(p.id, { ...(table.get(p.id) || {}), ...p });
      return { data: null, error: null };
    }
    if (this.op === 'delete') {
      rows.forEach(r => table.delete(r.id));
      return { data: null, error: null };
    }
    return { data: null, error: { message: `unsupported op ${this.op}` } };
  }
  then(resolve, reject) { try { resolve(this.run()); } catch (e) { reject(e); } }
}

const fakeClient = {
  from: (name) => new Query(name),
  channel: () => ({ on() { return this; }, subscribe() { return this; }, send: async () => ({}) }),
  removeChannel: () => {}
};
globalThis.__ROS_FAKE_SUPABASE__ = fakeClient;

// ---------------------------------------------------------------------------
// Load the real service modules (copied to a temp dir so Node can resolve them)
// ---------------------------------------------------------------------------
function buildHarness(srcRoot) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ros-sync-sim-'));
  const files = ['services/db.js', 'services/storage.js', 'services/googleSheetsService.js', 'utils/helpers.js'];
  fs.writeFileSync(path.join(out, 'fakeSupabase.mjs'),
    'export function createClient(url, key) { globalThis.__ROS_CLIENT_ARGS__ = { url, key }; return globalThis.__ROS_FAKE_SUPABASE__; }\n');
  for (const rel of files) {
    let code = fs.readFileSync(path.join(srcRoot, 'src', rel), 'utf8');
    const depth = rel.split('/').length - 1;
    code = code
      .replace(/from '@supabase\/supabase-js'/g, `from '${'../'.repeat(depth)}fakeSupabase.mjs'`)
      .replace(/from '(\.{1,2}\/[^']+?\.json)'/g, "from '$1' with { type: 'json' }")
      .replace(/from '(\.{1,2}\/[^']+?)(?<!\.json)(?<!\.mjs)'/g, "from '$1.mjs'");
    const dest = path.join(out, rel.replace(/\.js$/, '.mjs'));
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, code);
  }
  fs.cpSync(path.join(srcRoot, 'src', 'data'), path.join(out, 'data'), { recursive: true });
  return out;
}

const harness = buildHarness(ROOT);
// A browser that was once pointed at an older project still has those credentials saved
const STALE_URL = 'https://oldprojectoldprojectx.supabase.co';
localStorage.setItem('ros_supabase_url_v2', STALE_URL);
localStorage.setItem('ros_supabase_key_v2', 'eyJhbGciOiJIUzI1NiJ9.eyJyZWYiOiJvbGRwcm9qZWN0In0.stalestalestalestalestalestalestalestalestale');
const db = await import(pathToFileURL(path.join(harness, 'services', 'db.mjs')).href);
const storage = await import(pathToFileURL(path.join(harness, 'services', 'storage.mjs')).href);
const baseline = JSON.parse(fs.readFileSync(path.join(ROOT, 'src', 'data', 'crewlixAuthoritative20113.json'), 'utf8'));

// ---------------------------------------------------------------------------
// Seed
// ---------------------------------------------------------------------------
const HOUR = 3600 * 1000;
const iso = (ms) => new Date(ms).toISOString();
const T0 = Date.now() - 6 * HOUR;

async function seedFromLive() {
  const H = { apikey: LIVE_KEY, Authorization: `Bearer ${LIVE_KEY}` };
  const get = async (q) => { const r = await fetch(`${LIVE_URL}?${q}`, { headers: H }); if (!r.ok) throw new Error(`${r.status} ${await r.text()}`); return r.json(); };
  const rows = await get(`select=*&or=(id.eq.${WS_ID},id.like.__ros_chunk__${WS_ID}__*)`);
  rows.forEach(r => table.set(r.id, r));
  const main = table.get(WS_ID);
  // The scenarios start from a healthy cloud; the rebuild scenario below sets its own flag
  delete main.sequence_config.repairedAt;
  return main.sequence_config.totalLeads;
}

async function seedSynthetic(total) {
  const leads = (baseline.leads || []).map(l => ({ ...l }));
  for (let i = leads.length; i < total; i++) {
    leads.push({
      id: `ld_sim_${String(i).padStart(6, '0')}`,
      email: `lead${i}@example.test`,
      firstName: `Lead ${i}`,
      companyName: `Company ${i % 900}`,
      campaignName: 'Simulated Campaign',
      status: 'pending',
      importedAt: iso(T0 - 48 * HOUR),
      updatedAt: iso(T0 - 48 * HOUR)
    });
  }
  const seedWs = {
    id: WS_ID, name: 'Crewlix UK Ltd', clientName: 'Crewlix UK Ltd', leads,
    deletedLeadIds: [], activityLog: [], updatedAt: iso(T0)
  };
  // Write the seed through the real save path so chunking/hashes match production
  const ok = await db.saveWorkspacesToCloud([seedWs], WS_ID);
  if (!ok) throw new Error(`seed save failed: ${db.getLastCloudError()}`);
  return table.get(WS_ID).sequence_config.totalLeads;
}

// ---------------------------------------------------------------------------
// Assertions
// ---------------------------------------------------------------------------
let failures = 0;
function check(label, cond, detail = '') {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail ? `  (${detail})` : ''}`);
  if (!cond) failures++;
}
const ids = (ws) => new Set((ws?.leads || []).map(l => String(l.id)));
const cloudIds = async () => {
  const { data } = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
  return new Set((data?.leads || []).map(l => String(l.id)));
};
const crewlix = (list) => (list || []).find(w => w && w.id === WS_ID);
const sameSet = (a, b) => a.size === b.size && [...a].every(x => b.has(x));

// Mirrors the second merge syncFromCloud does in WorkspaceContext.jsx
function deviceBoot(localWs, cloudWs) {
  const deletedLeadIds = [...(localWs.deletedLeadIds || []), ...(cloudWs.deletedLeadIds || [])];
  const leads = storage.mergeWorkspaceLeads(localWs.leads, cloudWs.leads, {
    workspaceId: WS_ID, deletedLeadIds,
    localOnlyCutoff: db.localOnlyCutoffFor ? db.localOnlyCutoffFor(localWs, cloudWs.cloudSyncedAt || cloudWs.updatedAt, cloudWs.sequenceConfig) : undefined
  });
  return { ...localWs, ...cloudWs, leads, deletedLeadIds: Array.from(new Set(deletedLeadIds)), cloudSyncedAt: cloudWs.cloudSyncedAt };
}

// ---------------------------------------------------------------------------
// Scenario
// ---------------------------------------------------------------------------
const live = process.argv.includes('--live-seed');

const seeded = live ? await seedFromLive() : await seedSynthetic(54408);
console.log(`Seeded cloud (${live ? 'live read-only snapshot' : 'synthetic'}): ${seeded} leads, ${[...table.keys()].filter(k => k.startsWith('__ros_chunk__')).length} partition rows\n`);

// --- Stale per-browser credentials must never redirect the portal
if (db.SUPABASE_PROJECT_REF) {
  console.log('--- Locked Supabase project');
  db.getSupabaseClient();
  const used = globalThis.__ROS_CLIENT_ARGS__ || {};
  check('Client ignores credentials saved for an older project', used.url === `https://${db.SUPABASE_PROJECT_REF}.supabase.co`, used.url);
  check('Stale saved credentials are purged from the browser', localStorage.getItem('ros_supabase_url_v2') === null && localStorage.getItem('ros_supabase_key_v2') === null);
  check('Settings modal cannot save a different project', db.saveSupabaseConfig(STALE_URL, 'eyJx.eyJy.zzz') === false && db.getSupabaseConfig().url === used.url);
  const oldCache = { cloudSyncedAt: iso(T0 - HOUR), cloudSyncedProject: 'oldprojectoldprojectx' };
  check('A sync marker from another project is not trusted', db.localOnlyCutoffFor(oldCache, iso(T0)) === new Date(iso(T0)).getTime());
  console.log('');
}

// --- Device A boots fresh and pulls everything
let deviceA = crewlix(await db.fetchWorkspacesFromCloud([], WS_ID));
check('Device A loads the full cloud copy', deviceA && deviceA.leads.length === seeded, `${deviceA?.leads.length}`);

// Device B's cache as of that same moment (it will go stale)
const staleB = clone(deviceA);

// --- Device A deletes 100 leads (10 of them baseline leads) and saves
const baselineIds = new Set((baseline.leads || []).map(l => String(l.id)));
const aLeadIds = deviceA.leads.map(l => String(l.id));
const toDelete = [
  ...aLeadIds.filter(id => baselineIds.has(id)).slice(0, 10),
  ...aLeadIds.filter(id => !baselineIds.has(id)).slice(0, 90)
];
const delSet = new Set(toDelete);
deviceA = {
  ...deviceA,
  leads: deviceA.leads.filter(l => !delSet.has(String(l.id))),
  deletedLeadIds: [...(deviceA.deletedLeadIds || []), ...toDelete],
  updatedAt: new Date().toISOString()
};
check('Device A save after deleting 100 leads', await db.saveWorkspacesToCloud([deviceA], WS_ID), db.getLastCloudError() || '');
const afterDelete = await cloudIds();
check('Cloud holds exactly A\'s lead count after delete', afterDelete.size === seeded - 100, `${afterDelete.size} vs ${seeded - 100}`);
check('No deleted lead left in the cloud', toDelete.every(id => !afterDelete.has(id)));

// --- Device B's stale cache: pre-delete leads, plus leads deleted long ago whose tombstones were lost,
// plus one offline import made after its last sync that never uploaded
const ghosts = Array.from({ length: 25 }, (_, i) => ({
  id: `ld_ghost_${i}`, email: `ghost${i}@example.test`, firstName: 'Ghost', campaignName: 'Old',
  importedAt: iso(T0 - 72 * HOUR), updatedAt: iso(T0 - 72 * HOUR)
}));
const pending = { id: 'ld_pending_import', email: 'pending@example.test', firstName: 'Pending', campaignName: 'Offline',
  importedAt: iso(Date.now() - 1000), updatedAt: iso(Date.now() - 1000) };

for (const variant of ['B with sync marker', 'B pre-fix cache (no sync marker)']) {
  console.log(`\n--- ${variant}`);
  // Restore the cloud to "A just deleted" state for each variant
  const snapshot = new Map([...table.entries()].map(([k, v]) => [k, clone(v)]));

  const localB = {
    ...clone(staleB),
    leads: [...clone(staleB.leads), ...ghosts, ...(variant.startsWith('B with') ? [pending] : [])],
    updatedAt: staleB.updatedAt
  };
  if (variant.startsWith('B pre-fix')) delete localB.cloudSyncedAt;

  const cloudB = crewlix(await db.fetchWorkspacesFromCloud([localB], WS_ID));
  const bootB = deviceBoot(localB, cloudB);
  const bIds = ids(bootB);
  const expected = new Set(afterDelete);
  if (variant.startsWith('B with')) expected.add(pending.id);

  check('B resolves to exactly the cloud lead set (+ its own pending import)', sameSet(bIds, expected), `B=${bIds.size}, expected=${expected.size}`);
  check('B dropped every lead A deleted', toDelete.every(id => !bIds.has(id)));
  check('B dropped untombstoned ghosts from its stale cache', ghosts.every(g => !bIds.has(g.id)));
  if (variant.startsWith('B with')) check('B kept its pending offline import', bIds.has(pending.id));

  // B autosaves; then A pulls again: both must match
  bootB.updatedAt = new Date().toISOString();
  check('B save succeeds', await db.saveWorkspacesToCloud([bootB], WS_ID), db.getLastCloudError() || '');
  const cloudAfterB = await cloudIds();
  check('B\'s save resurrected nothing', toDelete.every(id => !cloudAfterB.has(id)) && ghosts.every(g => !cloudAfterB.has(g.id)));

  const pullA = crewlix(await db.fetchWorkspacesFromCloud([deviceA], WS_ID));
  const pullB = crewlix(await db.fetchWorkspacesFromCloud([bootB], WS_ID));
  check('A and B hold the identical lead set', sameSet(ids(pullA), ids(pullB)), `A=${pullA.leads.length}, B=${pullB.leads.length}, cloud=${cloudAfterB.size}`);
  check('Device count equals cloud count', pullB.leads.length === cloudAfterB.size);

  table.clear();
  snapshot.forEach((v, k) => table.set(k, v));
}

// --- Stitcher robustness
console.log('\n--- Partition stitching');
const main = table.get(WS_ID);
const chunkCount = main.sequence_config.chunkCount;
const staleId = `__ros_chunk__${WS_ID}__${String(chunkCount).padStart(4, '0')}`;
table.set(staleId, { id: staleId, leads: toDelete.map(id => ({ id, email: `${id}@stale.test` })), updated_at: main.updated_at });
const stitched = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('Stale partition past chunkCount is ignored', !stitched.error && stitched.data.leads.length === main.sequence_config.totalLeads, `${stitched.data?.leads.length}`);
table.delete(staleId);

// Partitions this device already has cached aren't downloaded again; a timeout only matters for
// one that changed since (rewritten by another device), so touch it first
const touch = (id) => table.set(id, { ...table.get(id), updated_at: iso(Date.now() + 1) });
touch(`__ros_chunk__${WS_ID}__0003`);
stats.chunkReadFailures.add(`__ros_chunk__${WS_ID}__0003`);
const partial = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('A partition that fails to load makes the read an error, not a partial copy', !!partial.error && !partial.data, String(partial.error?.message || ''));
const beforeFail = crewlix([deviceA]).leads.length;
const failedPull = await db.fetchWorkspacesFromCloud([deviceA], WS_ID);
check('fetchWorkspacesFromCloud reports the failure instead of passing local data off as cloud',
  (db.getLastCloudFetchOk ? !db.getLastCloudFetchOk() : false) && crewlix(failedPull).leads.length === beforeFail);
stats.chunkReadFailures.clear();

// --- Boot-time purge of retired workspaces must never touch Crewlix
console.log('\n--- Purge of retired workspaces');
const crewlixRowsBefore = [...table.keys()].filter(k => k === WS_ID || k.startsWith(`__ros_chunk__${WS_ID}__`)).sort();
table.set('ws_crewlix', { id: 'ws_crewlix', leads: [], updated_at: iso(T0) });
table.set('__ros_chunk__ws_crewlix__0001', { id: '__ros_chunk__ws_crewlix__0001', leads: [], updated_at: iso(T0) });
await db.purgeUnwantedWorkspacesFromCloud();
const crewlixRowsAfter = [...table.keys()].filter(k => k === WS_ID || k.startsWith(`__ros_chunk__${WS_ID}__`)).sort();
check('Purge leaves every Crewlix partition in place', sameSet(new Set(crewlixRowsBefore), new Set(crewlixRowsAfter)), `${crewlixRowsBefore.length} -> ${crewlixRowsAfter.length} rows`);
check('Purge still removes the retired workspace and its partitions', !table.has('ws_crewlix') && !table.has('__ros_chunk__ws_crewlix__0001'));

// --- Recovery after partitions were wiped (the 2026-10-28 incident)
console.log('\n--- Rebuild after partitions were wiped');
const fullSet = await cloudIds();
const fullDevice = crewlix(await db.fetchWorkspacesFromCloud([], WS_ID));
// Device C synced before the wipe and holds 30 leads nobody else has
const extras = Array.from({ length: 30 }, (_, i) => ({ id: `ld_only_on_c_${i}`, email: `onlyc${i}@example.test`, campaignName: 'Only C',
  importedAt: iso(T0 - 24 * HOUR), updatedAt: iso(T0 - 24 * HOUR) }));
const deviceC = { ...clone(fullDevice), leads: [...clone(fullDevice.leads), ...extras] };
const wipe = () => [...table.keys()].filter(k => k.startsWith(`__ros_chunk__${WS_ID}__`)).forEach(k => table.delete(k));
wipe();
check('Wiped cloud is rejected by readers', !!(await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID)).error);

const baselineOnly = { ...clone(fullDevice), leads: clone(baseline.leads), updatedAt: new Date().toISOString() };
check('A device holding only the baseline may NOT rebuild the cloud', (await db.saveWorkspacesToCloud([baselineOnly], WS_ID)) === false, db.getLastCloudError() || '');

const editedDevice = { ...clone(fullDevice), updatedAt: new Date().toISOString() };
editedDevice.leads[5] = { ...editedDevice.leads[5], notes: 'edited while cloud was broken', updatedAt: new Date().toISOString() };
check('The device with the full set rebuilds the cloud', await db.saveWorkspacesToCloud([editedDevice], WS_ID), db.getLastCloudError() || '');
const rebuilt = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('Rebuilt cloud is complete and readable', !rebuilt.error && sameSet(ids(rebuilt.data), fullSet), `${rebuilt.data?.leads.length} of ${fullSet.size}`);
check('Its pending edit reached the cloud', rebuilt.data?.leads.some(l => l.notes === 'edited while cloud was broken'));
check('Rebuild is flagged (repairedAt) for other devices', !!rebuilt.data?.sequence_config?.repairedAt);

const pulledC = crewlix(await db.fetchWorkspacesFromCloud([deviceC], WS_ID));
const bootC = deviceBoot(deviceC, pulledC);
check('Device C keeps leads only it held (union after a rebuild)', extras.every(e => ids(bootC).has(e.id)), `${bootC.leads.length}`);
bootC.updatedAt = new Date().toISOString();
check('Device C uploads them', await db.saveWorkspacesToCloud([bootC], WS_ID), db.getLastCloudError() || '');
const pulledFull = crewlix(await db.fetchWorkspacesFromCloud([editedDevice], WS_ID));
check('Every device converges on the recovered set', sameSet(ids(pulledFull), await cloudIds()) && extras.every(e => ids(pulledFull).has(e.id)), `${pulledFull.leads.length}`);

touch(`__ros_chunk__${WS_ID}__0002`);
stats.chunkReadFailures.add(`__ros_chunk__${WS_ID}__0002`);
const updatedBefore = table.get(WS_ID).updated_at;
check('A read timeout never triggers a rebuild write', (await db.saveWorkspacesToCloud([{ ...editedDevice, updatedAt: new Date().toISOString() }], WS_ID)) === false && table.get(WS_ID).updated_at === updatedBefore);
stats.chunkReadFailures.clear();

// --- Lead edits (sent marks) must reach every device, whatever order the portals save in
const SENT = 'Email Sent - 31/12/99'; // a date no seeded lead carries
const sentCount = (leads) => (leads || []).filter(l => l && l.email1 === SENT).length;
const cloudSent = async () => sentCount((await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID)).data?.leads);
const markSent = (ws, from, n) => {
  const now = Date.now();
  const leads = ws.leads.map((l, i) => (i >= from && i < from + n ? { ...l, email1: SENT, status: 'sent_1', updatedAt: iso(now) } : l));
  return { ...ws, leads, updatedAt: iso(now) };
};
const tick = () => new Promise(r => setTimeout(r, 5));

console.log('\n--- Sent marks whose upload failed, then another portal saved');
let you = crewlix(await db.fetchWorkspacesFromCloud([], WS_ID));
let warrior = crewlix(await db.fetchWorkspacesFromCloud([], WS_ID));
await tick();
you = markSent(you, 40000, 525); // this portal's upload never went through
await tick();
warrior = markSent(warrior, 50000, 75);
check('Warrior saves its 75 sends', await db.saveWorkspacesToCloud([warrior], WS_ID), db.getLastCloudError() || '');
const cloudAfterWarrior = table.get(WS_ID).updated_at;
const oldRuleSaysSynced = !you.leads.some(l => new Date(l.updatedAt || 0).getTime() > new Date(cloudAfterWarrior).getTime());
const youBoot = crewlix(await db.fetchWorkspacesFromCloud([you], WS_ID));
check('Old rule (edited after the cloud\'s last write) would have called these sends synced', oldRuleSaysSynced);
check('Reload detects the 525 sends missing from the cloud', youBoot.localAheadOfCloud === 525, `ahead=${youBoot.localAheadOfCloud}`);
check('This portal still shows all 600 sends', sentCount(youBoot.leads) === 600, `${sentCount(youBoot.leads)}`);
check('Upload of the missing sends succeeds', await db.saveWorkspacesToCloud([youBoot], WS_ID), db.getLastCloudError() || '');
check('Cloud now holds all 600 sends', (await cloudSent()) === 600, `${await cloudSent()}`);
const warriorPull = crewlix(await db.fetchWorkspacesFromCloud([warrior], WS_ID));
check('Warrior\'s portal shows the same 600 sends', sentCount(warriorPull.leads) === 600, `${sentCount(warriorPull.leads)}`);
check('A device already in step is not asked to upload again', warriorPull.localAheadOfCloud === 0, `ahead=${warriorPull.localAheadOfCloud}`);

console.log('\n--- A partition upload failure commits nothing');
const commitBefore = table.get(WS_ID).updated_at;
let failer = markSent(warriorPull, 30000, 10);
const failedPartition = `__ros_chunk__${WS_ID}__0010`;
stats.chunkWriteFailures.add(failedPartition);
check('Save reports failure when a partition cannot be uploaded', (await db.saveWorkspacesToCloud([failer], WS_ID)) === false, db.getLastCloudError() || '');
check('Main row was not committed', table.get(WS_ID).updated_at === commitBefore);
check('Cloud still reads as one consistent copy', !(await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID)).error);
stats.chunkWriteFailures.clear();
check('Retry uploads it', await db.saveWorkspacesToCloud([failer], WS_ID), db.getLastCloudError() || '');
check('Cloud holds the retried sends', (await cloudSent()) === 610, `${await cloudSent()}`);

console.log('\n--- Another portal\'s save still uploading its partitions');
const cleanPartition = clone(table.get(failedPartition));
const commitDuring = table.get(WS_ID).updated_at;
const uploading = clone(cleanPartition);
uploading.leads[1] = { ...uploading.leads[1], notes: 'not committed yet', updatedAt: iso(Date.now()) };
uploading.sequence_config = { ...uploading.sequence_config, hash: 'uploading' };
uploading.updated_at = iso(Date.now() + 1000);
table.set(failedPartition, uploading);
const midSave = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('Readers skip the read but do NOT treat it as damage (no save storm)', !!midSave.error && midSave.error.cloudDamaged === false, String(midSave.error?.message || ''));
const waiter = markSent(crewlix(await db.fetchWorkspacesFromCloud([failer], WS_ID)) || failer, 25000, 3);
check('A save waits for the other portal instead of racing it', (await db.saveWorkspacesToCloud([waiter], WS_ID)) === false && db.getLastSaveDeferred() && table.get(WS_ID).updated_at === commitDuring, db.getLastCloudError() || '');
table.set(failedPartition, cleanPartition); // the other portal's save gave up; its partition is back in step
check('Once it is done, the waiting save goes through', await db.saveWorkspacesToCloud([waiter], WS_ID), db.getLastCloudError() || '');

console.log('\n--- A save that lost the race and never retried');
const repairedBefore = table.get(WS_ID).sequence_config.repairedAt;
const half = clone(table.get(failedPartition));
half.leads[0] = { ...half.leads[0], notes: 'written by an interrupted save', updatedAt: iso(Date.now()) };
half.sequence_config = { ...half.sequence_config, hash: 'interrupted' };
half.updated_at = iso(new Date(table.get(WS_ID).updated_at).getTime() - 1000); // before the last commit
table.set(failedPartition, half);
const outOfStep = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('Readers notice the partition is out of step with the commit', !!outOfStep.error && outOfStep.error.cloudDamaged === true, String(outOfStep.error?.message || ''));
await tick();
const fixer = markSent(crewlix(await db.fetchWorkspacesFromCloud([failer], WS_ID)) || failer, 20000, 5);
check('Next save commits a consistent copy', await db.saveWorkspacesToCloud([fixer], WS_ID), db.getLastCloudError() || '');
const healed = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('Cloud reads cleanly again', !healed.error);
check('The interrupted save\'s edit was kept', healed.data?.leads.some(l => l.notes === 'written by an interrupted save'));
check('No rebuild flag for an out-of-step partition', healed.data?.sequence_config?.repairedAt === repairedBefore);

console.log('\n--- Two portals saving at the same moment');
const base = crewlix(await db.fetchWorkspacesFromCloud([], WS_ID));
await tick();
const p1 = markSent(base, 41000, 75);
const p2 = markSent(clone(base), 41100, 75); // same partition as p1
const [r1, r2] = await Promise.all([db.saveWorkspacesToCloud([p1], WS_ID), db.saveWorkspacesToCloud([p2], WS_ID)]);
// A portal whose save failed retries on its next cycle
if (!r1) await db.saveWorkspacesToCloud([p1], WS_ID);
if (!r2) await db.saveWorkspacesToCloud([p2], WS_ID);
const concurrent = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('Cloud is consistent after concurrent saves', !concurrent.error, String(concurrent.error?.message || ''));
const both = new Set((concurrent.data?.leads || []).filter(l => l.email1 === SENT).map(l => l.id));
const p1Ids = p1.leads.slice(41000, 41075).map(l => l.id);
const p2Ids = p2.leads.slice(41100, 41175).map(l => l.id);
check('Both portals\' sends are in the cloud', p1Ids.every(id => both.has(id)) && p2Ids.every(id => both.has(id)), `${both.size} sent leads`);
const v1 = crewlix(await db.fetchWorkspacesFromCloud([p1], WS_ID));
const v2 = crewlix(await db.fetchWorkspacesFromCloud([p2], WS_ID));
console.log('\n--- A small edit rewrites only its own partition');
const shuffled = crewlix(await db.fetchWorkspacesFromCloud([], WS_ID));
shuffled.leads.reverse(); // this device holds its leads in a different order
await tick();
const edited = markSent(shuffled, 100, 1);
const stampsBefore = new Map([...table.entries()].filter(([k]) => k.startsWith('__ros_chunk__')).map(([k, v]) => [k, v.updated_at]));
check('Edit save succeeds', await db.saveWorkspacesToCloud([edited], WS_ID), db.getLastCloudError() || '');
const rewritten = [...stampsBefore.keys()].filter(k => table.get(k)?.updated_at !== stampsBefore.get(k));
check('Only the partition holding the edited lead was rewritten', rewritten.length <= 1, `${rewritten.length} partitions rewritten`);
const afterEdit = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('No lead id is stored twice', afterEdit.data.leads.length === new Set(afterEdit.data.leads.map(l => l.id)).size);

console.log('\n--- A save with nothing new writes nothing');
const inStep = crewlix(await db.fetchWorkspacesFromCloud([], WS_ID));
const rowsBefore = new Map([...table.entries()].map(([k, v]) => [k, v.updated_at]));
check('Save of an unchanged copy succeeds', await db.saveWorkspacesToCloud([{ ...inStep, updatedAt: iso(Date.now()) }], WS_ID), db.getLastCloudError() || '');
check('...without committing or touching any row (other portals have nothing to pull)',
  db.getLastSaveWasNoop() && [...rowsBefore.entries()].every(([k, t]) => table.get(k)?.updated_at === t));

check('Both portals show the same Sent count', sentCount(v1.leads) === sentCount(v2.leads) && sentCount(v1.leads) === both.size, `${sentCount(v1.leads)} / ${sentCount(v2.leads)} / cloud ${both.size}`);

fs.rmSync(harness, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
