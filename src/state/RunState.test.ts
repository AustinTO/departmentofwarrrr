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
