import { beforeEach, describe, expect, it } from 'vitest';
import { currentRun } from '../state/RunState';
import { MansionSystem } from './MansionSystem';
import { DISTRICTS } from '../data/mansions';

describe('MansionSystem', () => {
    beforeEach(() => {
        currentRun.reset();
    });

    it('creates ledger entries when mansions are reconciled', () => {
        const system = new MansionSystem();
        currentRun.contractorProfit = 2_000_000_000;
        const created = system.reconcile();
        expect(created).toHaveLength(1);
        expect(currentRun.estateLedger).toHaveLength(1);
        expect(currentRun.estateLedger[0].program).toContain('Freedom Shield');
    });

    it('unlocks six districts across the campaign', () => {
        expect(DISTRICTS).toHaveLength(6);
        const system = new MansionSystem();
        expect(system.unlockedDistricts(0).map((d) => d.id)).toEqual(['original']);
        expect(system.unlockedDistricts(40).map((d) => d.id)).toHaveLength(6);
    });

    it('summarizes overflow estates beyond district capacity', () => {
        const system = new MansionSystem();
        currentRun.mansionsBuilt = 20;
        system.ensureLedger();
        const { overflow } = system.visibleEstates('original');
        expect(overflow).toBeGreaterThanOrEqual(0);
        expect(system.unlockedInfra(20).some((item) => item.id === 'helicopter')).toBe(true);
    });
});
