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
// Also checks the stitcher ignores stale partitions past chunkCount and refuses partial copies.
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
const stats = { chunkReadFailures: new Set() };

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
    localOnlyCutoff: db.localOnlyCutoffFor ? db.localOnlyCutoffFor(localWs, cloudWs.cloudSyncedAt || cloudWs.updatedAt) : undefined
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

stats.chunkReadFailures.add(`__ros_chunk__${WS_ID}__0003`);
const partial = await db.fetchFullCloudWorkspaceRow(fakeClient, WS_ID);
check('A partition that fails to load makes the read an error, not a partial copy', !!partial.error && !partial.data, String(partial.error?.message || ''));
const beforeFail = crewlix([deviceA]).leads.length;
const failedPull = await db.fetchWorkspacesFromCloud([deviceA], WS_ID);
check('fetchWorkspacesFromCloud reports the failure instead of passing local data off as cloud',
  (db.getLastCloudFetchOk ? !db.getLastCloudFetchOk() : false) && crewlix(failedPull).leads.length === beforeFail);
stats.chunkReadFailures.clear();

fs.rmSync(harness, { recursive: true, force: true });
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`);
process.exit(failures === 0 ? 0 : 1);
