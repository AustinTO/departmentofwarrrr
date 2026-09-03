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

    /** Mansion prices escalate so each new expansion takes another good year of bad decisions. */
    public reconcileMansions() {
        let nextCost = this.mansionCost(this.mansionsBuilt);
        while (this.contractorProfit >= nextCost) {
            this.mansionsBuilt++;
            nextCost = this.mansionCost(this.mansionsBuilt);
        }
    }

    public mansionCost(index: number = this.mansionsBuilt): number {
        // Mansions are a late-game visual score. Procurement money moves in
        // billions, so a single suburban house must not exhaust the map.
        return Math.round(8_000_000_000 * Math.pow(1.28, index));
    }

    /** Return the campaign to a clean, playable first-year state. */
    public reset() {
        this.currentFY = 2026;
        this.globalReadiness = 100;
        this.taxpayerBurn = 0;
        this.contractorProfit = 0;
        this.executiveWealth = 0;
        this.mansionsBuilt = 0;
        this.activeDoctrine = null;
        this.productionQueue = [];
        this.theaters = new RunState().theaters;
    }

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
            activeDoctrine: this.activeDoctrine,
            theaters: this.theaters,
            productionQueue: this.productionQueue
        };
        localStorage.setItem('warrr_save_v1', JSON.stringify(data));
    }

    public load() {
        const saved = localStorage.getItem('warrr_save_v1');
        if (!saved) return;

        try {
            const data = JSON.parse(saved) as Partial<RunState>;
            if (typeof data.currentFY === 'number') this.currentFY = data.currentFY;
            if (typeof data.taxpayerBurn === 'number') this.taxpayerBurn = data.taxpayerBurn;
            if (typeof data.contractorProfit === 'number') this.contractorProfit = data.contractorProfit;
            if (typeof data.executiveWealth === 'number') this.executiveWealth = data.executiveWealth;
            if (typeof data.mansionsBuilt === 'number') this.mansionsBuilt = data.mansionsBuilt;
            if (data.activeDoctrine) this.activeDoctrine = data.activeDoctrine;
            if (Array.isArray(data.productionQueue)) this.productionQueue = data.productionQueue;

            // Merge saved theaters into the defaults so an older save cannot remove a theater.
            if (data.theaters) {
                Object.entries(data.theaters).forEach(([id, savedTheater]) => {
                    const theater = this.theaters[id];
                    if (!theater || !savedTheater) return;
                    theater.readiness = typeof savedTheater.readiness === 'number' ? savedTheater.readiness : theater.readiness;
                    theater.inventory = { ...theater.inventory, ...savedTheater.inventory };
                });
            }
            this.updateGlobalReadiness();
        } catch {
            // A corrupt local save should never prevent a new campaign from booting.
            localStorage.removeItem('warrr_save_v1');
        }
    }
}

// Singleton instance for the current run
export const currentRun = new RunState();
