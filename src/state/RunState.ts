import { WeaponType, STARTER_WEAPONS, WEAPON_CONFIGS, isWeaponUnlocked } from '../game/config';
import type { Doctrine } from '../game/config';
import type { EstateRecord } from '../data/mansions';
import type { PinballBoardId } from '../game/PinballBoards';
import { isBoardUnlocked, PINBALL_BOARD_ORDER } from '../game/PinballBoards';

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
    /** Persistent McLean estate ledger — one record per mansion built. */
    public estateLedger: EstateRecord[] = [];
    /** Explicit unlock grants (also auto-unlocked by FY / mansions). */
    public unlockedWeapons: WeaponType[] = [...STARTER_WEAPONS];
    public unlockedBoards: PinballBoardId[] = ['appropriations'];
    public selectedBoard: PinballBoardId = 'appropriations';

    public theaters: Record<string, TheaterState> = {
        'active': {
            id: 'active',
            name: 'Active Operation',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 55,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 8,
                [WeaponType.HYDRA]: 0,
                [WeaponType.RAILGUN]: 0,
                [WeaponType.SEEKER]: 0
            }
        },
        'indo_pacific': {
            id: 'indo_pacific',
            name: 'Indo-Pacific',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 120,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 20,
                [WeaponType.HYDRA]: 4,
                [WeaponType.RAILGUN]: 6,
                [WeaponType.SEEKER]: 3
            }
        },
        'europe': {
            id: 'europe',
            name: 'Europe',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 80,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 10,
                [WeaponType.HYDRA]: 2,
                [WeaponType.RAILGUN]: 4,
                [WeaponType.SEEKER]: 2
            }
        },
        'homeland': {
            id: 'homeland',
            name: 'Homeland',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 50,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 5,
                [WeaponType.HYDRA]: 1,
                [WeaponType.RAILGUN]: 2,
                [WeaponType.SEEKER]: 1
            }
        },
        'reserve': {
            id: 'reserve',
            name: 'Strategic Reserve',
            readiness: 100,
            inventory: {
                [WeaponType.INTERCEPTOR]: 200,
                [WeaponType.INTERCEPTOR_BLOCK_II]: 50,
                [WeaponType.HYDRA]: 10,
                [WeaponType.RAILGUN]: 15,
                [WeaponType.SEEKER]: 8
            }
        }
    };

    public productionQueue: DeliveryBatch[] = [];

    /** True when a campaign has progress worth continuing from the title screen. */
    public hasProgress(): boolean {
        return this.currentFY > 2026
            || this.taxpayerBurn > 0
            || this.contractorProfit > 0
            || this.mansionsBuilt > 0
            || this.productionQueue.length > 0;
    }

    /** Refresh unlock lists from FY / mansion thresholds. Returns newly unlocked weapon names. */
    public syncUnlocks(): { weapons: WeaponType[]; boards: PinballBoardId[] } {
        const newWeapons: WeaponType[] = [];
        const newBoards: PinballBoardId[] = [];
        (Object.values(WeaponType) as WeaponType[]).forEach((type) => {
            if (isWeaponUnlocked(type, this.currentFY, this.mansionsBuilt, this.unlockedWeapons)
                && !this.unlockedWeapons.includes(type)) {
                this.unlockedWeapons.push(type);
                newWeapons.push(type);
                // Seed a starter clip into active theater when first unlocked.
                const active = this.theaters.active;
                if ((active.inventory[type] || 0) <= 0 && WEAPON_CONFIGS[type].limitedAmmo) {
                    active.inventory[type] = type === WeaponType.HYDRA ? 6
                        : type === WeaponType.RAILGUN ? 10
                            : type === WeaponType.SEEKER ? 5 : 4;
                }
            }
        });
        PINBALL_BOARD_ORDER.forEach((id) => {
            if (isBoardUnlocked(id, this.currentFY, this.mansionsBuilt, this.unlockedBoards)
                && !this.unlockedBoards.includes(id)) {
                this.unlockedBoards.push(id);
                newBoards.push(id);
            }
        });
        return { weapons: newWeapons, boards: newBoards };
    }

    public availableWeapons(): WeaponType[] {
        this.syncUnlocks();
        return (Object.values(WeaponType) as WeaponType[])
            .filter((type) => isWeaponUnlocked(type, this.currentFY, this.mansionsBuilt, this.unlockedWeapons));
    }

    public availableBoards(): PinballBoardId[] {
        this.syncUnlocks();
        return PINBALL_BOARD_ORDER.filter((id) =>
            isBoardUnlocked(id, this.currentFY, this.mansionsBuilt, this.unlockedBoards));
    }

    /** Mansion prices escalate so each new expansion takes another good year of bad decisions. */
    public reconcileMansions() {
        let nextCost = this.mansionCost(this.mansionsBuilt);
        while (this.contractorProfit >= nextCost) {
            this.mansionsBuilt++;
            nextCost = this.mansionCost(this.mansionsBuilt);
        }
        this.syncUnlocks();
    }

    public mansionCost(index: number = this.mansionsBuilt): number {
        return Math.round(2_000_000_000 * Math.pow(1.22, index));
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
        this.estateLedger = [];
        this.unlockedWeapons = [...STARTER_WEAPONS];
        this.unlockedBoards = ['appropriations'];
        this.selectedBoard = 'appropriations';
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
            estateLedger: this.estateLedger,
            unlockedWeapons: this.unlockedWeapons,
            unlockedBoards: this.unlockedBoards,
            selectedBoard: this.selectedBoard,
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
            if (Array.isArray(data.estateLedger)) this.estateLedger = data.estateLedger;
            if (Array.isArray(data.unlockedWeapons)) this.unlockedWeapons = data.unlockedWeapons as WeaponType[];
            if (Array.isArray(data.unlockedBoards)) this.unlockedBoards = data.unlockedBoards as PinballBoardId[];
            if (typeof data.selectedBoard === 'string') this.selectedBoard = data.selectedBoard as PinballBoardId;
            if (Array.isArray(data.productionQueue)) this.productionQueue = data.productionQueue;
            this.syncUnlocks();

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
