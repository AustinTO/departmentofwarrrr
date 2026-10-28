import { describe, expect, it } from 'vitest';
import { createSeededRandom, seededShuffle } from './SeededRandom';
import { scenarioForFiscalYear } from './CombatScenarios';

describe('campaign randomness', () => {
    it('repeats the same sequence and shuffle for the same seed', () => {
        const a = createSeededRandom(90210);
        const b = createSeededRandom(90210);
        expect([a(), a(), a()]).toEqual([b(), b(), b()]);
        expect(seededShuffle([1, 2, 3, 4, 5], createSeededRandom(77)))
            .toEqual(seededShuffle([1, 2, 3, 4, 5], createSeededRandom(77)));
    });

    it('selects a repeatable but seed-varied scenario', () => {
        expect(scenarioForFiscalYear(2026, 12).id).toBe(scenarioForFiscalYear(2026, 12).id);
        expect(scenarioForFiscalYear(2026, 12).id).not.toBe(scenarioForFiscalYear(2026, 13).id);
    });
});
