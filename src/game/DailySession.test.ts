import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatSystem } from './CombatSystem';
import { currentRun } from '../state/RunState';
import {
    abandonDaily, beginDaily, chooseDailyPolicy, currentDaily,
    finishDaily, isDailyActive, recordDailyCombat
} from './DailySession';

const values = new Map<string, string>();
const localStorageMock = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, data: string) => { values.set(key, data); },
    removeItem: (key: string) => { values.delete(key); }
};

describe('daily scratch run isolation', () => {
    beforeEach(() => {
        values.clear();
        vi.stubGlobal('localStorage', localStorageMock);
        currentRun.dailyActive = false;
        currentRun.reset();
        currentRun.currentFY = 2031;
        currentRun.taxpayerBurn = 6000000;
        currentRun.save();
    });
    afterEach(() => {
        abandonDaily();
        vi.unstubAllGlobals();
    });

    it('never overwrites the saved campaign, even after abandoned daily progress', () => {
        const original = values.get('warrr_save_v1');
        const daily = beginDaily(new Date('2026-11-08T16:00:00Z'));
        expect(daily.day).toBe('2026-11-08');
        expect(isDailyActive()).toBe(true);
        currentRun.taxpayerBurn = 2000000000;
        currentRun.save();
        expect(values.get('warrr_save_v1')).toBe(original);
        abandonDaily();
        expect(currentRun.currentFY).toBe(2031);
        expect(currentRun.taxpayerBurn).toBe(6000000);
        expect(isDailyActive()).toBe(false);
        expect(currentDaily()).toBeNull();
    });

    it('resolves one policy, records eligible completion and restores the campaign', () => {
        beginDaily(new Date('2026-11-08T12:00:00Z'));
        const combat = new CombatSystem();
        combat.recordFriendlySpared();
        recordDailyCombat(combat.getStats(), combat.getGradeBreakdown());
        const before = currentRun.theaters.active.readiness;
        expect(chooseDailyPolicy('fast-track')).toBe(true);
        expect(chooseDailyPolicy('audit')).toBe(false);
        expect(currentRun.theaters.active.readiness).toBe(before - 8);
        currentRun.taxpayerBurn = 10000000000;
        currentRun.contractorProfit = 1000000000;
        currentRun.authorizedProcurementFY = 2026;
        const result = finishDaily(false, localStorageMock);
        expect(result?.eligible).toBe(true);
        expect(result?.authorized).toBe(true);
        expect(result?.contractValue).toBeGreaterThan(0);
        expect(currentRun.currentFY).toBe(2031);
        expect(values.has('warrr_daily_best_v1')).toBe(true);
    });

    it('does not record a defeated attempt as a local best', () => {
        beginDaily(new Date('2026-11-08'));
        const result = finishDaily(true, localStorageMock);
        expect(result?.defeated).toBe(true);
        expect(result?.eligible).toBe(false);
        expect(values.has('warrr_daily_best_v1')).toBe(false);
    });
});
