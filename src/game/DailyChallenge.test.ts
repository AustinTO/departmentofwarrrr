import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CombatSystem } from './CombatSystem';
import {
    dailyDefinition, dailyResult, dailyShareText, loadDailyBest, saveDailyBest, seedForDay, utcDayKey
} from './DailyChallenge';

function storage() {
    const data = new Map<string, string>();
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); }
    };
}

describe('daily challenge definitions and scores', () => {
    beforeEach(() => vi.useRealTimers());

    it('uses UTC day boundaries and stable public seeds', () => {
        expect(utcDayKey(new Date('2026-11-08T23:59:59Z'))).toBe('2026-11-08');
        expect(utcDayKey(new Date('2026-11-09T00:00:00Z'))).toBe('2026-11-09');
        const a = dailyDefinition(new Date('2026-11-08T04:00:00Z'));
        const b = dailyDefinition(new Date('2026-11-08T22:00:00Z'));
        expect(a).toEqual(b);
        expect(a.seed).toBe(seedForDay(a.day));
        expect(a.seed).not.toBe(dailyDefinition(new Date('2026-11-09')).seed);
    });

    it('counts actual play, keeps procurement bounded, and disqualifies early exits', () => {
        const def = dailyDefinition(new Date('2026-11-08'));
        const combat = new CombatSystem();
        combat.recordFriendlySpared();
        combat.noteCombo(7);
        const good = dailyResult(def, { stats: combat.getStats(), grade: combat.getGradeBreakdown() },
            { readiness: 92, taxpayerBurn: 12e9, contractorProfit: 3e9, contractValue: 10e9, authorized: true },
            'audit', false);
        const noContract = dailyResult(def, { stats: combat.getStats(), grade: combat.getGradeBreakdown() },
            { readiness: 92, taxpayerBurn: 12e9, contractorProfit: 3e9, contractValue: 0, authorized: false },
            'audit', false);
        expect(good.eligible).toBe(true);
        expect(good.score).toBeGreaterThan(noContract.score);
        expect(dailyShareText(good)).toContain(def.day);
        combat.recordEarlyExit();
        const early = dailyResult(def, { stats: combat.getStats(), grade: combat.getGradeBreakdown() },
            { readiness: 92, taxpayerBurn: 1e9, contractorProfit: 0, contractValue: 0, authorized: false },
            'audit', false);
        expect(early.eligible).toBe(false);
    });

    it('keeps local best only on improvement, rejects mismatched seeds and broken storage', () => {
        const local = storage();
        const def = dailyDefinition(new Date('2026-11-08'));
        const combat = new CombatSystem();
        const base = dailyResult(def, { stats: combat.getStats(), grade: combat.getGradeBreakdown() },
            { readiness: 100, taxpayerBurn: 0, contractorProfit: 0, contractValue: 0, authorized: false }, 'audit', false);
        expect(saveDailyBest(local, base)).toBe(true);
        expect(saveDailyBest(local, base)).toBe(false);
        expect(saveDailyBest(local, { ...base, score: base.score + 1, seed: 123 })).toBe(false);
        const improved = { ...base, score: base.score + 1 };
        expect(saveDailyBest(local, improved)).toBe(true);
        expect(loadDailyBest(local)[def.day].score).toBe(improved.score);
        local.setItem('warrr_daily_best_v1', '{invalid');
        expect(loadDailyBest(local)).toEqual({});
    });
});
