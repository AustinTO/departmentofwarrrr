import { describe, expect, it } from 'vitest';
import { WeaponType } from './config';
import { RunState } from '../state/RunState';
import { previewTransfer } from './ReadinessTransfers';

describe('readiness transfer preview', () => {
    it('shows reserve transfers without readiness loss or state mutation', () => {
        const run = new RunState();
        const before = run.theaters.reserve.inventory[WeaponType.INTERCEPTOR];
        const p = previewTransfer(run, 'reserve', WeaponType.INTERCEPTOR, 10);
        expect(p).not.toBeNull();
        expect(p?.sourceAfter).toBe(before - 10);
        expect(p?.activeAfter).toBe(run.theaters.active.inventory[WeaponType.INTERCEPTOR] + 10);
        expect(p?.globalAfter).toBe(100);
        expect(run.theaters.reserve.inventory[WeaponType.INTERCEPTOR]).toBe(before);
    });

    it('reproduces readiness penalty for a forward theater and caps to stock', () => {
        const run = new RunState();
        const p = previewTransfer(run, 'europe', WeaponType.HYDRA, 100);
        expect(p?.quantity).toBe(2);
        expect(p?.sourceReadinessAfter).toBe(99.5);
        expect(p?.globalAfter).toBe(99);
    });

    it('rejects invalid transfers', () => {
        const run = new RunState();
        expect(previewTransfer(run, 'active', WeaponType.INTERCEPTOR, 1)).toBeNull();
        expect(previewTransfer(run, 'reserve', WeaponType.INTERCEPTOR, 0)).toBeNull();
        expect(previewTransfer(run, 'unknown', WeaponType.INTERCEPTOR, 4)).toBeNull();
    });
});
