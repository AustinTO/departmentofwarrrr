import { WeaponType } from './config';
import { currentRun } from '../state/RunState';
import type { DeliveryBatch } from '../state/RunState';

export class ProductionSystem {
    private leadTimes: Record<WeaponType, number> = {
        [WeaponType.GUN]: 0,
        [WeaponType.JAMMER]: 1,
        [WeaponType.INTERCEPTOR]: 2,
        [WeaponType.INTERCEPTOR_BLOCK_II]: 4
    };

    public orderMunitions(type: WeaponType, quantity: number) {
        const leadTime = this.leadTimes[type];
        const deliveryYear = currentRun.currentFY + leadTime;

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
        
        // Deliver ready batches
        const delivered = currentRun.productionQueue.filter(b => b.fiscalYear <= currentRun.currentFY);
        delivered.forEach(batch => {
            const reserve = currentRun.theaters['reserve'];
            reserve.inventory[batch.weaponType] = (reserve.inventory[batch.weaponType] || 0) + batch.quantity;
        });

        // Remove delivered from queue
        currentRun.productionQueue = currentRun.productionQueue.filter(b => b.fiscalYear > currentRun.currentFY);

        // Degrade readiness slightly over time if not in homeland/reserve
        Object.values(currentRun.theaters).forEach(theater => {
            if (theater.id !== 'homeland' && theater.id !== 'reserve') {
                theater.readiness = Math.max(0, theater.readiness - 2);
            }
        });
        
        currentRun.updateGlobalReadiness();
    }
}
