// @ts-nocheck  (remove once this file is typed)
import { initializeApp } from "firebase/app";
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut } from "firebase/auth";
import * as store from "./store";
import { openHistory, checkNotes } from "./patchnotes";
import { initializeFirestore, getFirestore, persistentLocalCache, persistentMultipleTabManager, doc, collection, onSnapshot, setDoc, writeBatch, getDocFromServer, getDocsFromServer, waitForPendingWrites } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyB_QBoK1LglV-g0WqlyaBn8ituXra0tTIs",
  authDomain: "cauldron-b0627.firebaseapp.com",
  projectId: "cauldron-b0627",
  storageBucket: "cauldron-b0627.firebasestorage.app",
  messagingSenderId: "161562466233",
  appId: "1:161562466233:web:a2bc40ee05c16d2d2e0868"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch (e) {
  db = getFirestore(app);
}

// ---- Sync v2: every item / recipe / history entry is its own Firestore document -----------------------------
// household/{items|recipes|history}/entries/{id}  ->  the entry plus "updated" (ms). A deleted entry stays behind
// as { deleted:true, updated } so a phone with an old copy can never bring it back. Newest "updated" wins.
// household/meta {v:2} marks that the old whole-list documents (household/items etc.) have been converted.
const KINDS = ['items', 'recipes', 'history'];
const FLAG = 'cauldron-sync-v2';
const DAY = 86400000;
const metaRef = doc(db, 'household', 'meta');
const colRef = (k) => collection(db, 'household', k, 'entries');
const entryRef = (k, id) => doc(db, 'household', k, 'entries', id);

const clean = (v) => JSON.parse(JSON.stringify(v));
const stable = (v) => JSON.stringify(v, (k, x) =>
  x && typeof x === 'object' && !Array.isArray(x)
    ? Object.keys(x).sort().reduce((o, key) => (o[key] = x[key], o), {})
    : x);
const local = (k) => store.get(k);
const hid = (t) => 'h' + encodeURIComponent(String(t).trim().toLowerCase()).replace(/\./g, '%2E');
const idOf = (k, it) => k === 'items' ? (it.id || '') : k === 'recipes' ? (it.id == null ? '' : String(it.id)) : (it.text ? hid(it.text) : '');
const body = (k, it) => { const o = clean(it); delete o.updated; delete o.deleted; return o; };
const ser = (k, it) => stable(body(k, it));
const mid = (i) => '0' + String(i).padStart(5, '0');   // stable ids for the one-time conversion

// What this phone believes the server holds: id -> { j: content, u: updated, del: deleted? }. Kept in localStorage
// so changes made while the app was closed or offline are still noticed.
const state = {};
KINDS.forEach((k) => {
  let known;
  try { known = new Map(JSON.parse(localStorage.getItem('cauldron-shadow-' + k) || '[]')); } catch (e) { known = new Map(); }
  state[k] = { known, ready: false, repair: new Set() };
});
const saveShadow = (k) => { try { localStorage.setItem('cauldron-shadow-' + k, JSON.stringify([...state[k].known])); } catch (e) {} };
const fail = (kind) => (e) => { console.error('sync', e); setStat('error', kind + ': ' + (e.code || e.message)); };

let started = false, gen = 0, unsubs = [];
const timers = {};

function commit(writes) {
  const jobs = [];
  for (let i = 0; i < writes.length; i += 400) {
    const b = writeBatch(db);
    writes.slice(i, i + 400).forEach((w) => b.set(entryRef(w.k, w.id), w.data));
    jobs.push(b.commit());
  }
  return Promise.all(jobs);
}

// Compare this phone's list with what the server is known to hold, and send only the differences.
function flush(kind) {
  const st = state[kind];
  if (!started || !auth.currentUser || !st.ready) return;
  const list = local(kind), known = st.known, seen = new Set(), writes = [], done = new Set(), now = Date.now();
  const stamp = (id) => { const k = known.get(id); return Math.max(now, k ? k.u + 1 : 0); };
  list.forEach((it) => {
    const id = idOf(kind, it);
    if (!id) return;
    seen.add(id);
    const j = ser(kind, it), k = known.get(id);
    if (!k || k.del || k.j !== j) {
      const u = stamp(id);
      writes.push({ k: kind, id, data: Object.assign(body(kind, it), { updated: u }) });
      known.set(id, { j, u, del: false });
      done.add(id);
    }
  });
  if (kind !== 'history') {
    known.forEach((k, id) => {
      if (!k.del && !seen.has(id)) {
        const u = stamp(id);
        writes.push({ k: kind, id, data: { deleted: true, updated: u } });
        known.set(id, { j: '', u, del: true });
        done.add(id);
      }
    });
  }
  // the server holds something older than what we know (a stale phone overwrote it): put our newer version back
  st.repair.forEach((id) => {
    const k = known.get(id);
    if (!k || done.has(id)) return;
    if (k.del) writes.push({ k: kind, id, data: { deleted: true, updated: k.u } });
    else {
      const it = list.find((x) => idOf(kind, x) === id);
      if (it) writes.push({ k: kind, id, data: Object.assign(body(kind, it), { updated: k.u }) });
    }
  });
  st.repair.clear();
  if (!writes.length) return;
  saveShadow(kind);
  commit(writes).then(() => setStat('ok')).catch(fail(kind));
}
function schedule(kind) { clearTimeout(timers[kind]); timers[kind] = setTimeout(() => flush(kind), 150); }
// The app saved a list on this device: send the difference (this replaced the old global push() hook).
KINDS.forEach((k) => store.onLocalChange(k, () => { if (started && auth.currentUser) schedule(k); }));

// When did this device last hear from the server? Saved on the device; set by a successful pull-to-refresh and by
// every update that arrives from the server, whichever is more recent.
const LSK = 'cauldron-last-sync';
let lastSync = 0, syncChanges = 0;
try { lastSync = parseInt(localStorage.getItem(LSK), 10) || 0; } catch (e) {}
function stampSync() {
  const n = Date.now();
  if (n > lastSync) { lastSync = n; try { localStorage.setItem(LSK, String(n)); } catch (e) {} }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const offlineErr = () => { const e = new Error('offline'); e.offline = true; return e; };

// Pull to refresh: send what is waiting, fetch the current data from the server and report whether anything changed.
// Changes found are applied by the listeners below, like any other update from the server.
export async function refresh() {
  if (!auth.currentUser || !navigator.onLine) throw offlineErr();
  if (!started) { await startSync(); if (!started) throw offlineErr(); }
  const before = syncChanges;
  KINDS.forEach((k) => flush(k));
  try {
    await Promise.race([
      Promise.all([waitForPendingWrites(db)].concat(KINDS.map((k) => getDocsFromServer(colRef(k))))),
      sleep(8000).then(() => { throw offlineErr(); })
    ]);
  } catch (e) { throw offlineErr(); }
  await sleep(300);               // let the listeners apply what arrived
  stampSync();
  return { changed: syncChanges > before };
}

export function lastSyncDate() { return lastSync ? new Date(lastSync) : null; }

function listen(kind) {
  const st = state[kind];
  return onSnapshot(colRef(kind), { includeMetadataChanges: true }, (snap) => {
    const ups = [], rem = [];
    snap.docChanges().forEach((ch) => {
      if (ch.type === 'removed') return;
      if (ch.doc.metadata.hasPendingWrites) return;      // our own change echoing back
      const id = ch.doc.id, d = ch.doc.data(), u = d.updated || 0, k = st.known.get(id);
      if (k && k.u >= u) { if (k.u > u) st.repair.add(id); return; }
      if (d.deleted) { st.known.set(id, { j: '', u, del: true }); rem.push(id); }
      else {
        const it = Object.assign({}, d); delete it.updated; delete it.deleted;
        st.known.set(id, { j: ser(kind, it), u, del: false });
        ups.push(it);
      }
    });
    if (ups.length || rem.length) { store.applyChanges(kind, ups, rem); saveShadow(kind); syncChanges++; if (!snap.metadata.fromCache) stampSync(); }
    if (!snap.metadata.fromCache) { setStat('ok'); if (!lastSync) stampSync(); }
    if (!st.ready) { st.ready = true; flush(kind); }
    else if (st.repair.size) schedule(kind);
  }, (err) => { console.error('sync listener', err); setStat('error', kind + ': ' + (err.code || err.message)); });
}

// One-time conversion of the old whole-list documents. Returns false when we are offline and cannot tell yet.
async function ensureMigrated() {
  let m;
  try { m = await getDocFromServer(metaRef); }
  catch (e) { if (e.code === 'unavailable') return false; throw e; }
  if (m.exists() && (m.data().v || 0) >= 2) {
    // Another phone already converted everything: drop the old local copy and take over what is on the server.
    KINDS.forEach((k) => { state[k].known = new Map(); saveShadow(k); store.replaceAll(k, []); });
    localStorage.setItem(FLAG, '1');
    return true;
  }
  const old = {};
  for (const k of KINDS) {
    const s = await getDocFromServer(doc(db, 'household', k));
    old[k] = s.exists() ? (s.data().list || []) : null;
  }
  const now = Date.now(), writes = [];
  KINDS.forEach((k) => {
    const list = old[k] !== null ? clean(old[k]) : clean(local(k));
    if (k === 'items') list.forEach((it, i) => { it.id = mid(i); });
    store.replaceAll(k, list);
    const st = state[k];
    st.known = new Map();
    local(k).forEach((it) => {
      const id = idOf(k, it);
      if (!id || st.known.has(id)) return;
      st.known.set(id, { j: ser(k, it), u: now, del: false });
      writes.push({ k, id, data: Object.assign(body(k, it), { updated: now }) });
    });
    saveShadow(k);
  });
  await commit(writes);
  await setDoc(metaRef, { v: 2, at: now });
  localStorage.setItem(FLAG, '1');
  return true;
}

function purge() {          // forget deletion markers older than 30 days
  const cutoff = Date.now() - 30 * DAY, jobs = [];
  ['items', 'recipes'].forEach((k) => {
    const dead = [...state[k].known].filter((e) => e[1].del && e[1].u < cutoff);
    for (let i = 0; i < dead.length; i += 400) {
      const b = writeBatch(db);
      dead.slice(i, i + 400).forEach((e) => b.delete(entryRef(k, e[0])));
      jobs.push(b.commit());
    }
    dead.forEach((e) => state[k].known.delete(e[0]));
    if (dead.length) saveShadow(k);
  });
  Promise.all(jobs).catch((e) => console.error('purge', e));
}

function stopSync() {
  gen++; started = false;
  unsubs.forEach((u) => u()); unsubs = [];
  KINDS.forEach((k) => { state[k].ready = false; });
}
async function startSync() {
  stopSync();
  const my = gen;
  setStat('wait');
  try {
    if (localStorage.getItem(FLAG) !== '1') {
      const ok = await ensureMigrated();
      if (my !== gen) return;
      if (!ok) return;                       // offline: try again when the connection is back
    }
  } catch (e) { if (my === gen) fail('convert')(e); return; }
  started = true;
  unsubs = KINDS.map(listen);
  setTimeout(() => { if (my === gen) purge(); }, 20000);
}
window.addEventListener('online', () => { if (auth.currentUser && !started) startSync(); });

const wrap = document.getElementById('auth');
const form = document.getElementById('authForm');
const errEl = document.getElementById('authErr');
const btn = document.getElementById('authBtn');
let foots = [];
let statEls = [];
function setStat(kind, msg) {
  const text = (kind === 'ok' ? 'Sync: connected' : kind === 'error' ? 'Sync problem: ' + msg + ' (check Firestore rules and database)' : 'Sync: connecting\u2026') + ' \u00b7';
  statEls.forEach((el) => { el.textContent = text; el.style.color = kind === 'error' ? 'var(--danger)' : ''; });
}

// Three lines: who is signed in, the sync status, and the version button (opens the update history).
function buildFoot(user) {
  const f = document.createElement('div');
  f.className = 'syncfoot';
  const l1 = document.createElement('span');
  l1.append('Signed in as ' + (user.email || '') + ' \u00b7 ');
  const out = document.createElement('button');
  out.type = 'button';
  out.className = 'lnk';
  out.textContent = 'Sign out';
  out.addEventListener('click', () => signOut(auth));
  l1.appendChild(out);
  l1.append(' \u00b7');
  const l2 = document.createElement('span');
  statEls.push(l2);
  const v = __APP_VERSION__;
  const pill = document.createElement('button');
  pill.type = 'button';
  pill.className = 'vpill';
  pill.textContent = v;
  pill.setAttribute('aria-haspopup', 'dialog');
  pill.setAttribute('aria-label', 'Version ' + v + ', show patch notes');
  pill.addEventListener('click', () => { openHistory(); });
  f.appendChild(l1); f.appendChild(l2); f.appendChild(pill);
  return f;
}

onAuthStateChanged(auth, (user) => {
  if (user) {
    wrap.hidden = true;
    foots.forEach((f) => f.remove());
    foots = []; statEls = [];
    ['#view-list .scroller', '#view-recipes .scroller'].forEach((sel) => {
      const f = buildFoot(user);
      document.querySelector(sel).appendChild(f);
      foots.push(f);
    });
    setStat('wait');
    startSync();
    setTimeout(() => { checkNotes(); }, 500);
  } else {
    stopSync();
    foots.forEach((f) => f.remove());
    foots = []; statEls = [];
    wrap.hidden = false;
  }
});

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  errEl.textContent = '';
  btn.disabled = true;
  try {
    await signInWithEmailAndPassword(auth, document.getElementById('authEmail').value.trim(), document.getElementById('authPw').value);
    document.getElementById('authPw').value = '';
  } catch (ex) {
    errEl.textContent = 'Sign-in failed. Check your email and password.';
  }
  btn.disabled = false;
});
