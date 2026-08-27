import { RunState } from './RunState';
import { WeaponType } from '../game/config';

describe('RunState inventory transfers', () => {
    it('moves inventory, reduces the raided theater readiness, and saves the run', () => {
        const run = new RunState();
        const initialReadiness = run.theaters.indo_pacific.readiness;

        expect(run.transferInventory('indo_pacific', 'active', WeaponType.INTERCEPTOR, 10)).toBe(true);

        expect(run.theaters.indo_pacific.inventory[WeaponType.INTERCEPTOR]).toBe(110);
        expect(run.theaters.active.inventory[WeaponType.INTERCEPTOR]).toBe(50);
        expect(run.theaters.indo_pacific.readiness).toBeLessThan(initialReadiness);
        expect(localStorage.getItem('warrr_save_v1')).not.toBeNull();
    });

    it('refuses transfers that exceed the available inventory', () => {
        const run = new RunState();

        expect(run.transferInventory('homeland', 'active', WeaponType.INTERCEPTOR_BLOCK_II, 10)).toBe(false);
        expect(run.theaters.homeland.inventory[WeaponType.INTERCEPTOR_BLOCK_II]).toBe(5);
    });
});

describe('RunState campaign lifecycle', () => {
    it('persists the selected doctrine and restores it on load', () => {
        const run = new RunState();
        run.activeDoctrine = {
            id: 'test',
            name: 'TEST DOCTRINE',
            description: 'test',
            effect: { costMultiplier: 2 }
        };
        run.save();

        const restored = new RunState();
        restored.load();

        expect(restored.activeDoctrine?.id).toBe('test');
        expect(restored.activeDoctrine?.effect.costMultiplier).toBe(2);
    });

    it('resets progress without leaving stale inventory or doctrine state', () => {
        const run = new RunState();
        run.currentFY = 2034;
        run.contractorProfit = 900000000;
        run.activeDoctrine = { id: 'old', name: 'OLD', description: '', effect: {} };
        run.theaters.active.inventory[WeaponType.INTERCEPTOR] = 0;

        run.reset();

        expect(run.currentFY).toBe(2026);
        expect(run.contractorProfit).toBe(0);
        expect(run.activeDoctrine).toBeNull();
        expect(run.theaters.active.inventory[WeaponType.INTERCEPTOR]).toBe(40);
    });
});
