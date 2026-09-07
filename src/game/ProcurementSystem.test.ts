import { describe, expect, it, beforeEach } from 'vitest';
import { ProcurementSystem } from './ProcurementSystem';
import { PROCUREMENT_BUMPERS } from './ProcurementTableDefinition';
import { currentRun } from '../state/RunState';
import { WeaponType } from './config';

describe('ProcurementSystem', () => {
    beforeEach(() => {
        currentRun.reset();
    });

    it('inflates contract value and tracks inventory from bumpers', () => {
        const system = new ProcurementSystem();
        const jackpot = PROCUREMENT_BUMPERS.find((bumper) => bumper.id === 'jackpot')!;
        const result = system.applyBumper(jackpot);

        expect(result.scaledValue).toBeGreaterThan(0);
        expect(system.state.value).toBe(result.scaledValue);
        expect(system.state.items[WeaponType.INTERCEPTOR_BLOCK_II]).toBe(20);
        expect(currentRun.taxpayerBurn).toBe(result.scaledValue);
    });

    it('shrinks contracts on efficiency bumpers and resets combo', () => {
        const system = new ProcurementSystem();
        const jackpot = PROCUREMENT_BUMPERS.find((bumper) => bumper.id === 'jackpot')!;
        const efficiency = PROCUREMENT_BUMPERS.find((bumper) => bumper.id === 'fixed-price')!;
        system.applyBumper(jackpot);
        system.applyBumper(jackpot);
        expect(system.state.combo).toBe(2);
        system.applyBumper(efficiency);
        expect(system.state.combo).toBe(0);
        expect(system.state.value).toBeLessThan(jackpot.value * 2);
    });

    it('records skill shots and authorizes delivery batches', () => {
        const system = new ProcurementSystem();
        system.recordSkillShot();
        expect(system.state.skillShots).toBe(1);
        expect(system.state.value).toBeGreaterThan(0);

        const { batches, summary } = system.authorize();
        expect(batches.length).toBeGreaterThan(0);
        expect(summary).toContain('Authorized');
        expect(currentRun.productionQueue.length).toBe(batches.length);
    });

    it('flags emergency supplemental for multiball', () => {
        const system = new ProcurementSystem();
        const emergency = PROCUREMENT_BUMPERS.find((bumper) => bumper.id === 'emergency-supplemental')!;
        system.applyBumper(emergency);
        expect(system.state.multiballTriggered).toBe(true);
    });
});
