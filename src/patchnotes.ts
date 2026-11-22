// Patch notes UI: the version history window (footer button) and the showcase that is shown once, the first time
// a new version is opened. The texts are in notes.ts and showcase.ts.
import { NOTES, TAGS, vnum } from './notes';
import { SHOWCASE } from './showcase';

const APP_VERSION = __APP_VERSION__;
const VKEY = 'cauldron-last-seen-version';

// Decided when this module loads, before anything is saved: a device with no stored data and no seen version is a new install.
let freshInstall = false;
try { freshInstall = localStorage.getItem('shopping-list-items') === null && localStorage.getItem('shopping-list-recipes') === null && localStorage.getItem(VKEY) === null; } catch (e) { /* storage blocked */ }

const dlgShowcase = document.getElementById('dlgShowcase') as HTMLDialogElement;
const dlgHistory = document.getElementById('dlgHistory') as HTMLDialogElement;
let notesChecked = false;

function markSeen(): void { try { localStorage.setItem(VKEY, APP_VERSION); } catch (e) { /* storage blocked */ } }

function addNoteRows(box: HTMLElement, entries: Array<{ tag: string; title: string; text: string; demo?: string }>): void {
  entries.forEach((e) => {
    const row = document.createElement('div'); row.className = 'nrow';
    const tg = document.createElement('span'); tg.className = 'ntag ' + e.tag; tg.textContent = TAGS[e.tag] || e.tag;
    const col = document.createElement('div');
    const h = document.createElement('div'); h.className = 'nhd'; h.textContent = e.title;
    const t = document.createElement('div'); t.className = 'ntx'; t.textContent = e.text;
    col.appendChild(h); col.appendChild(t);
    if (e.demo && SHOWCASE[e.demo]) {
      const demo = e.demo;
      const sb = document.createElement('button'); sb.type = 'button'; sb.className = 'vpill scbtn'; sb.textContent = 'See how it works';
      sb.setAttribute('aria-label', 'See how it works: ' + e.title);
      sb.addEventListener('click', () => { openShowcase(demo); });
      col.appendChild(sb);
    }
    row.appendChild(tg); row.appendChild(col); box.appendChild(row);
  });
}

// Also used by the "See how it works" buttons in the version history.
function openShowcase(v: string): void {
  const sc = SHOWCASE[v]; if (!sc) return;
  document.getElementById('scVer')!.textContent = v;
  document.getElementById('scTitle')!.textContent = sc.title;
  const st = document.getElementById('scStage')!; st.innerHTML = sc.demo; st.setAttribute('aria-label', sc.alt);
  const box = document.getElementById('scSteps')!; box.innerHTML = '';
  sc.steps.forEach((t, i) => {
    const row = document.createElement('div'); row.className = 'scstep';
    const n = document.createElement('span'); n.className = 'scn'; n.textContent = String(i + 1);
    const x = document.createElement('span'); x.className = 'sct'; x.textContent = t;
    row.appendChild(n); row.appendChild(x); box.appendChild(row);
  });
  dlgShowcase.showModal();
  dlgShowcase.setAttribute('tabindex', '-1');
  dlgShowcase.focus({ preventScroll: true });
}

/** Opens the version history window. */
export function openHistory(): void {
  document.getElementById('histVer')!.textContent = APP_VERSION;
  const box = document.getElementById('histList')!; box.innerHTML = '';
  Object.keys(NOTES).sort((a, b) => vnum(b) - vnum(a)).forEach((k) => {
    const n = NOTES[k];
    const g = document.createElement('div'); g.className = 'ngrp';
    const gv = document.createElement('span'); gv.className = 'ngv'; gv.textContent = k;
    const gd = document.createElement('span'); gd.className = 'ngd'; gd.textContent = n.date;
    const gl = document.createElement('span'); gl.className = 'ngl';
    g.appendChild(gv); g.appendChild(gd); g.appendChild(gl); box.appendChild(g);
    addNoteRows(box, n.entries);
  });
  box.scrollTop = 0;
  dlgHistory.showModal();
  dlgHistory.setAttribute('tabindex', '-1');
  dlgHistory.focus({ preventScroll: true });
}

/** Called once after sign-in: shows the showcase of the current version if the person has not seen it yet. */
export function checkNotes(): void {
  if (notesChecked) return;
  notesChecked = true;
  const force = /[?&]showcase(=|&|$)/.test(location.search);
  let seen: string | null = null; try { seen = localStorage.getItem(VKEY); } catch (e) { /* storage blocked */ }
  if (!force) {
    if (seen === APP_VERSION) return;
    if (freshInstall) { markSeen(); return; }
  }
  if (!SHOWCASE[APP_VERSION]) { markSeen(); return; }
  openShowcase(APP_VERSION);
}

document.getElementById('histOk')!.addEventListener('click', () => { dlgHistory.close(); });
dlgHistory.addEventListener('click', (ev) => { if (ev.target === dlgHistory) dlgHistory.close(); });
dlgShowcase.addEventListener('close', markSeen);
dlgShowcase.addEventListener('click', (ev) => { if (ev.target === dlgShowcase) dlgShowcase.close(); });
document.getElementById('scOk')!.addEventListener('click', () => { dlgShowcase.close(); });
