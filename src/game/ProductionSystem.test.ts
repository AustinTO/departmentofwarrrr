import { beforeEach, describe, expect, it } from 'vitest';
import { ProductionSystem } from './ProductionSystem';
import { currentRun } from '../state/RunState';
import { WeaponType } from './config';

describe('ProductionSystem delivery allocation', () => {
    beforeEach(() => currentRun.reset());

    it('places due contracts in active theater so the next operation can use them', () => {
        const system = new ProductionSystem();
        currentRun.currentFY = 2027;
        currentRun.syncUnlocks();
        const startingHydra = currentRun.theaters.active.inventory[WeaponType.HYDRA];
        currentRun.productionQueue.push({
            fiscalYear: currentRun.currentFY + 1,
            weaponType: WeaponType.HYDRA,
            quantity: 8,
            destination: 'active'
        });
        system.processEndOfYear();
        expect(currentRun.theaters.active.inventory[WeaponType.HYDRA]).toBe(startingHydra + 8);
        expect(currentRun.productionQueue).toHaveLength(0);
    });

    it('keeps legacy and reserve contracts in the strategic reserve', () => {
        const system = new ProductionSystem();
        currentRun.productionQueue.push({ fiscalYear: currentRun.currentFY + 1, weaponType: WeaponType.RAILGUN, quantity: 3 });
        currentRun.productionQueue.push({ fiscalYear: currentRun.currentFY + 1, weaponType: WeaponType.SEEKER, quantity: 2, destination: 'reserve' });
        system.processEndOfYear();
        expect(currentRun.theaters.reserve.inventory[WeaponType.RAILGUN]).toBe(18);
        expect(currentRun.theaters.reserve.inventory[WeaponType.SEEKER]).toBe(10);
    });
});
