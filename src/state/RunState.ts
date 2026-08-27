import { WeaponType } from '../game/config';
import type { Doctrine } from '../game/config';

export interface TheaterState {
    id: string;
    name: string;
    readiness: number;
    inventory: Record<string, number>;
}

export interface DeliveryBatch {
    fiscalYear: number;
    weaponType: WeaponType;
    quantity: number;
}

export class RunState {
    public currentFY: number = 2026;
    public globalReadiness: number = 100;
    public taxpayerBurn: number = 0;
    public contractorProfit: number = 0;
    public executiveWealth: number = 0;
    public mansionsBuilt: number = 0;
    public activeDoctrine: Doctrine | null = null;
    
    public theaters: Record<string, TheaterState> = {
        'active': {
            id: 'active',
            name: 'Active Operation',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 40,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 5
            }
        },
        'indo_pacific': {
            id: 'indo_pacific',
            name: 'Indo-Pacific',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 120,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 20
            }
        },
        'europe': {
            id: 'europe',
            name: 'Europe',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 80,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 10
            }
        },
        'homeland': {
            id: 'homeland',
            name: 'Homeland',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 50,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 5
            }
        },
        'reserve': {
            id: 'reserve',
            name: 'Strategic Reserve',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 200,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 50
            }
        }
    };

    public productionQueue: DeliveryBatch[] = [];

    public updateGlobalReadiness() {
        const theaterValues = Object.values(this.theaters);
        const sum = theaterValues.reduce((acc, t) => acc + t.readiness, 0);
        this.globalReadiness = Math.floor(sum / theaterValues.length);
    }

    public transferInventory(fromId: string, toId: string, weaponType: WeaponType, quantity: number) {
        const fromTheater = this.theaters[fromId];
        const toTheater = this.theaters[toId];

        if (!fromTheater || !toTheater) return false;
        if ((fromTheater.inventory[weaponType] || 0) < quantity) return false;

        fromTheater.inventory[weaponType] -= quantity;
        toTheater.inventory[weaponType] = (toTheater.inventory[weaponType] || 0) + quantity;

        // Readiness penalty for raiding a theater
        if (fromId !== 'reserve') {
            const penalty = (quantity / 20) * 5;
            fromTheater.readiness = Math.max(0, fromTheater.readiness - penalty);
            this.updateGlobalReadiness();
        }

        this.save();
        return true;
    }

    public save() {
        const data = {
            currentFY: this.currentFY,
            taxpayerBurn: this.taxpayerBurn,
            contractorProfit: this.contractorProfit,
            executiveWealth: this.executiveWealth,
            mansionsBuilt: this.mansionsBuilt,
            theaters: this.theaters,
            productionQueue: this.productionQueue
        };
        localStorage.setItem('warrr_save_v1', JSON.stringify(data));
    }

    public load() {
        const saved = localStorage.getItem('warrr_save_v1');
        if (saved) {
            const data = JSON.parse(saved);
            Object.assign(this, data);
            this.updateGlobalReadiness();
        }
    }
}

// Singleton instance for the current run
export const currentRun = new RunState();
