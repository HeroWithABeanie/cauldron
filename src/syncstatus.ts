// The text of the sync line in the footer ("Sync: connected" and so on). Kept apart from sync.ts (which needs
// Firebase) so it can be tested.
export type SyncKind = 'ok' | 'wait' | 'error' | 'offline';

export interface SyncStatus { kind: SyncKind; text: string; danger: boolean }

/** `wait` (still connecting) is shown as `offline` when the device has no connection. */
export function syncStatus(kind: SyncKind, msg: string | undefined, online: boolean): SyncStatus {
  const k: SyncKind = kind === 'wait' && !online ? 'offline' : kind;
  const base = k === 'ok' ? 'Sync: connected'
    : k === 'error' ? 'Sync problem: ' + msg + ' (check Firestore rules and database)'
    : k === 'offline' ? 'Sync: offline'
    : 'Sync: connecting\u2026';
  return { kind: k, text: base + ' \u00b7', danger: k === 'error' };
}
