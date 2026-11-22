import { describe, it, expect } from 'vitest';
import { syncStatus } from '../src/syncstatus';

describe('syncStatus', () => {
  it('connected', () => expect(syncStatus('ok', undefined, true)).toEqual({ kind: 'ok', text: 'Sync: connected \u00b7', danger: false }));
  it('connecting while online', () => expect(syncStatus('wait', undefined, true)).toEqual({ kind: 'wait', text: 'Sync: connecting\u2026 \u00b7', danger: false }));
  it('offline instead of connecting when the device has no connection', () => {
    expect(syncStatus('wait', undefined, false)).toEqual({ kind: 'offline', text: 'Sync: offline \u00b7', danger: false });
  });
  it('offline is shown as offline, online or not', () => {
    expect(syncStatus('offline', undefined, true).text).toBe('Sync: offline \u00b7');
    expect(syncStatus('offline', undefined, false).text).toBe('Sync: offline \u00b7');
  });
  it('connected stays connected when the browser reports offline (the server just answered)', () => {
    expect(syncStatus('ok', undefined, false).text).toBe('Sync: connected \u00b7');
  });
  it('an error shows its message and is marked as danger, online or offline', () => {
    const e = syncStatus('error', 'items: permission-denied', true);
    expect(e.text).toBe('Sync problem: items: permission-denied (check Firestore rules and database) \u00b7');
    expect(e.danger).toBe(true);
    expect(syncStatus('error', 'x', false).kind).toBe('error');
  });
});
