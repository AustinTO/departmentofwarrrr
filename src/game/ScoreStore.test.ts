import { describe, expect, it } from 'vitest';
import { loadScores, recordScore, SCORE_KEY } from './ScoreStore';

function storage() {
    const data = new Map<string, string>();
    return {
        getItem: (key: string) => data.get(key) ?? null,
        setItem: (key: string, value: string) => { data.set(key, value); },
        removeItem: (key: string) => { data.delete(key); }
    };
}

describe('ScoreStore', () => {
    it('recovers corrupt saved scores rather than crashing the game-over route', () => {
        const store = storage();
        store.setItem(SCORE_KEY, '{broken');
        expect(loadScores(store)).toEqual([]);
        expect(store.getItem(SCORE_KEY)).toBeNull();
        expect(recordScore(store, { fiscalYear: 2027, mansions: 3, burn: 500 }).length).toBe(1);
    });

    it('keeps ten best scores and ignores malformed entries', () => {
        const store = storage();
        for (let i = 0; i < 13; i++) {
            recordScore(store, { fiscalYear: 2026, mansions: i, burn: i * 100 });
        }
        const entries = loadScores(store);
        expect(entries).toHaveLength(10);
        expect(entries[0].burn).toBe(1200);
        expect(entries[9].burn).toBe(300);
        store.setItem(SCORE_KEY, JSON.stringify([...entries, { fiscalYear: 2027, mansions: -1, burn: NaN }]));
        expect(loadScores(store)).toHaveLength(10);
    });

    it('does not accept invalid non-finite score values', () => {
        const store = storage();
        expect(recordScore(store, { fiscalYear: 2026, mansions: 0, burn: Infinity })).toEqual([]);
        expect(store.getItem(SCORE_KEY)).toBeNull();
    });
});
