import { WeaponType } from './config';
import { currentRun } from '../state/RunState';
import type { DeliveryBatch } from '../state/RunState';

export class ProductionSystem {
    private leadTimes: Record<WeaponType, number> = {
        [WeaponType.GUN]: 0,
        [WeaponType.JAMMER]: 1,
        [WeaponType.INTERCEPTOR]: 2,
        [WeaponType.INTERCEPTOR_BLOCK_II]: 4,
        [WeaponType.HYDRA]: 3,
        [WeaponType.RAILGUN]: 2,
        [WeaponType.SEEKER]: 3
    };

    public orderMunitions(type: WeaponType, quantity: number) {
        const leadTime = this.leadTimes[type];
        const speed = currentRun.activeDoctrine?.effect.productionSpeed || 1.0;
        const deliveryYear = currentRun.currentFY + Math.max(0, Math.ceil(leadTime / speed));

        const batch: DeliveryBatch = {
            fiscalYear: deliveryYear,
            weaponType: type,
            quantity: quantity
        };

        currentRun.productionQueue.push(batch);
        return batch;
    }

    public processEndOfYear() {
        currentRun.currentFY++;
        currentRun.syncUnlocks();

        // Deliver ready batches
        const delivered = currentRun.productionQueue.filter(b => b.fiscalYear <= currentRun.currentFY);
        delivered.forEach(batch => {
            const reserve = currentRun.theaters['reserve'];
            reserve.inventory[batch.weaponType] = (reserve.inventory[batch.weaponType] || 0) + batch.quantity;
        });

        // Remove delivered from queue
        currentRun.productionQueue = currentRun.productionQueue.filter(b => b.fiscalYear > currentRun.currentFY);

        const readinessMult = currentRun.activeDoctrine?.effect.readinessMultiplier ?? 1.0;

        Object.values(currentRun.theaters).forEach(theater => {
            if (theater.id === 'homeland' || theater.id === 'reserve') {
                // Quiet theaters recover; doctrine scales how fast.
                const recovery = 4 * readinessMult;
                theater.readiness = Math.min(100, theater.readiness + recovery);
            } else {
                // Forward theaters still grind down, but good doctrines soften it.
                const loss = 2 / readinessMult;
                theater.readiness = Math.max(0, theater.readiness - loss);
            }
        });

        // Active theater gets a doctrine-scaled readiness patch after each FY.
        const active = currentRun.theaters.active;
        active.readiness = Math.min(100, active.readiness + 3 * readinessMult);

        currentRun.updateGlobalReadiness();
    }
}
