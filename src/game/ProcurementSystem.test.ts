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
        expect(currentRun.taxpayerBurn).toBe(0);
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
        expect(batches.every(batch => batch.destination === 'active')).toBe(true);
    });

    it('keeps draft costs and profit out of the campaign until authorization', () => {
        const system = new ProcurementSystem();
        system.recordSkillShot();
        expect(currentRun.taxpayerBurn).toBe(0);
        expect(currentRun.contractorProfit).toBe(0);
        expect(currentRun.productionQueue).toHaveLength(0);
        system.authorize();
        expect(currentRun.taxpayerBurn).toBe(system.state.value);
        expect(currentRun.contractorProfit).toBe(system.state.value * 0.15);
    });

    it('settles at most once per fiscal year, including through a second system instance', () => {
        const system = new ProcurementSystem();
        system.recordSkillShot();
        const first = system.authorize();
        const later = new ProcurementSystem().authorize();
        expect(first.authorized).toBe(true);
        expect(later.authorized).toBe(false);
        expect(later.batches).toHaveLength(0);
        expect(currentRun.taxpayerBurn).toBe(system.state.value);
        expect(currentRun.productionQueue).toHaveLength(first.batches.length);
    });

    it('discards an unapproved draft without changing campaign balances', () => {
        const system = new ProcurementSystem();
        system.recordSkillShot();
        expect(system.discard().summary).toContain('No funds');
        expect(currentRun.taxpayerBurn).toBe(0);
        expect(currentRun.contractorProfit).toBe(0);
        expect(currentRun.productionQueue).toHaveLength(0);
    });

    it('uses distinct combo rules for each unlocked board', () => {
        const standard = new ProcurementSystem('appropriations');
        const audit = new ProcurementSystem('audit_chamber');
        const stadium = new ProcurementSystem('supplemental_stadium');
        standard.state.combo = audit.state.combo = stadium.state.combo = 2;
        expect(standard.comboMultiplier()).toBe(1);
        expect(audit.comboMultiplier()).toBe(2);
        stadium.state.combo = 4;
        expect(stadium.comboMultiplier()).toBe(2);
    });

    it('flags emergency supplemental for multiball', () => {
        const system = new ProcurementSystem();
        const emergency = PROCUREMENT_BUMPERS.find((bumper) => bumper.id === 'emergency-supplemental')!;
        system.applyBumper(emergency);
        expect(system.state.multiballTriggered).toBe(true);
        expect(system.claimEmergencyMultiball()).toBe(true);
        system.applyBumper(emergency);
        expect(system.claimEmergencyMultiball()).toBe(false);
    });
});
