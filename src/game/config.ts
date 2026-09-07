export enum WeaponType {
    GUN = 'VULCAN 20MM CANNON',
    JAMMER = 'SILENT SHIELD JAMMER',
    INTERCEPTOR = 'FREEDOM SHIELD SM-3',
    INTERCEPTOR_BLOCK_II = 'GOD-EYE SM-6 BLOCK IB',
    HYDRA = 'HYDRA CLUSTER MIRV',
    RAILGUN = 'RAILGUN REAPER',
    SEEKER = 'SWARM SEEKER POD'
}

export enum ThreatType {
    LAWN_MOWER = 'SHAHED-136',
    SCOOTER = 'QASEF-2K',
    DECOY = 'TIED-TOGETHER BALLOONS',
    SWARM = 'MESSENGER DRONE SWARM',
    MYSTERY = 'UNIDENTIFIED ANOMALY',
    MISSILE = 'HYPERSONIC GLIDE VEHICLE',
    /** Allied traffic — rewarding to spare, disastrous to shoot. */
    FRIENDLY = 'ALLIED COURIER DRONE'
}

export type WeaponBehavior = 'gun' | 'jammer' | 'interceptor' | 'hydra_split' | 'railgun' | 'seeker_swarm';

export interface WeaponConfig {
    name: WeaponType;
    cost: number;
    range: number;
    reloadTime: number;
    color: number;
    radius: number;
    description: string;
    behavior: WeaponBehavior;
    /** Requires inventory ammo when true. */
    limitedAmmo?: boolean;
    /** Campaign unlock gates — all listed conditions must be met (OR within each axis). */
    unlockFy?: number;
    unlockMansions?: number;
    iconFrame: number;
    shortLabel: string;
}

export interface ThreatConfig {
    type: ThreatType;
    value: number;
    speed: number;
    color: number;
    radius: number;
    description: string;
    /** When true, leaving it alone is the win; destroying it is a scandal. */
    friendly?: boolean;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
    [WeaponType.GUN]: {
        name: WeaponType.GUN,
        cost: 1500,
        range: 500,
        reloadTime: 75,
        color: 0xcccccc,
        radius: 20,
        description: 'Cheap, reliable, and uses up the lead stockpiles.',
        behavior: 'gun',
        iconFrame: 0,
        shortLabel: 'VULCAN'
    },
    [WeaponType.JAMMER]: {
        name: WeaponType.JAMMER,
        cost: 125000,
        range: 600,
        reloadTime: 2800,
        color: 0x00ffff,
        radius: 350,
        description: "Non-kinetic disruption. High contractor markup for 'software updates'.",
        behavior: 'jammer',
        iconFrame: 1,
        shortLabel: 'JAMMER'
    },
    [WeaponType.INTERCEPTOR]: {
        name: WeaponType.INTERCEPTOR,
        cost: 12500000,
        range: 2000,
        reloadTime: 850,
        color: 0xffff00,
        radius: 250,
        description: 'Standard kinetic kill vehicle. A flying mansion.',
        behavior: 'interceptor',
        limitedAmmo: true,
        iconFrame: 2,
        shortLabel: 'SM-3'
    },
    [WeaponType.INTERCEPTOR_BLOCK_II]: {
        name: WeaponType.INTERCEPTOR_BLOCK_II,
        cost: 32400000,
        range: 2000,
        reloadTime: 2800,
        color: 0xffaa00,
        radius: 550,
        description: 'Experimental overmatch capability. Requires 4 new hangars per unit.',
        behavior: 'interceptor',
        limitedAmmo: true,
        iconFrame: 3,
        shortLabel: 'SM-6'
    },
    [WeaponType.HYDRA]: {
        name: WeaponType.HYDRA,
        cost: 48000000,
        range: 2000,
        reloadTime: 2200,
        color: 0xff6633,
        radius: 160,
        description: 'Splits into heat-seeking warheads that chase three separate threats.',
        behavior: 'hydra_split',
        limitedAmmo: true,
        unlockFy: 2027,
        unlockMansions: 1,
        iconFrame: 4,
        shortLabel: 'HYDRA'
    },
    [WeaponType.RAILGUN]: {
        name: WeaponType.RAILGUN,
        cost: 8500000,
        range: 2200,
        reloadTime: 1600,
        color: 0x66ccff,
        radius: 40,
        description: 'Piercing electromagnetic slug. One shot, multiple kills along the line.',
        behavior: 'railgun',
        limitedAmmo: true,
        unlockFy: 2028,
        unlockMansions: 4,
        iconFrame: 5,
        shortLabel: 'RAIL'
    },
    [WeaponType.SEEKER]: {
        name: WeaponType.SEEKER,
        cost: 22000000,
        range: 1800,
        reloadTime: 3000,
        color: 0x44ffcc,
        radius: 90,
        description: 'Deploys a cloud of heat-seeking micro-drones that hunt independently.',
        behavior: 'seeker_swarm',
        limitedAmmo: true,
        unlockFy: 2029,
        unlockMansions: 8,
        iconFrame: 6,
        shortLabel: 'SEEKER'
    }
};

/** Weapons available from FY1 with no mansion gate. */
export const STARTER_WEAPONS: WeaponType[] = [
    WeaponType.GUN,
    WeaponType.JAMMER,
    WeaponType.INTERCEPTOR,
    WeaponType.INTERCEPTOR_BLOCK_II
];

export function isWeaponUnlocked(
    type: WeaponType,
    fy: number,
    mansions: number,
    unlocked: WeaponType[]
): boolean {
    if (STARTER_WEAPONS.includes(type)) return true;
    if (unlocked.includes(type)) return true;
    const config = WEAPON_CONFIGS[type];
    const fyOk = config.unlockFy !== undefined && fy >= config.unlockFy;
    const mansionOk = config.unlockMansions !== undefined && mansions >= config.unlockMansions;
    // Either campaign year or mansion milestone unlocks the system.
    return fyOk || mansionOk;
}

export const THREAT_CONFIGS: Record<ThreatType, ThreatConfig> = {
    [ThreatType.LAWN_MOWER]: {
        type: ThreatType.LAWN_MOWER,
        value: 1200,
        speed: 160,
        color: 0xff3333,
        radius: 25,
        description: 'Engine from a 1994 mower. Costs less than a Pentagon stapler.'
    },
    [ThreatType.SCOOTER]: {
        type: ThreatType.SCOOTER,
        value: 6500,
        speed: 320,
        color: 0xff6600,
        radius: 18,
        description: 'Fast, loud, and annoying. Like a lobbyist at 5pm.'
    },
    [ThreatType.DECOY]: {
        type: ThreatType.DECOY,
        value: 50,
        speed: 280,
        color: 0xff00ff,
        radius: 15,
        description: 'Literally party balloons. Triggers $12M responses every time.'
    },
    [ThreatType.SWARM]: {
        type: ThreatType.SWARM,
        value: 800,
        speed: 210,
        color: 0xaa0000,
        radius: 12,
        description: 'Quantity has a quality of its own. Especially for procurement quotas.'
    },
    [ThreatType.MYSTERY]: {
        type: ThreatType.MYSTERY,
        value: 3500,
        speed: 240,
        color: 0x444444,
        radius: 20,
        description: 'Could be a bird, could be an ICBM. Better use the Block II just in case.'
    },
    [ThreatType.MISSILE]: {
        type: ThreatType.MISSILE,
        value: 75000,
        speed: 550,
        color: 0xffffff,
        radius: 12,
        description: 'Actually expensive. Ruining the profit margin ratio.'
    },
    [ThreatType.FRIENDLY]: {
        type: ThreatType.FRIENDLY,
        value: 480000,
        speed: 145,
        color: 0x44ff88,
        radius: 22,
        description: 'Allied courier with VIP cargo. Shooting it starts a hearing.',
        friendly: true
    }
};

export type Doctrine = {
    id: string;
    name: string;
    description: string;
    effect: {
        costMultiplier?: number;
        readinessMultiplier?: number;
        threatFrequency?: number;
        profitMargin?: number;
        ammoCapacity?: number;
        explosionRadius?: number;
        productionSpeed?: number;
    };
}

export const DOCTRINES: Doctrine[] = [
    {
        id: 'full_spectrum',
        name: 'FULL SPECTRUM DOMINANCE',
        description: 'Double the cost of all munitions. 20% more contractor profit.',
        effect: { costMultiplier: 2.0, profitMargin: 1.2 }
    },
    {
        id: 'strategic_pivot',
        name: 'STRATEGIC PIVOT',
        description: 'Increased threat frequency, but faster production lines and readiness recovery.',
        effect: { threatFrequency: 1.5, readinessMultiplier: 1.2, productionSpeed: 1.35 }
    },
    {
        id: 'cost_plus',
        name: 'COST-PLUS INCENTIVE',
        description: 'Unlimited ammo, but 50% slower readiness recovery.',
        effect: { ammoCapacity: 999, readinessMultiplier: 0.5 }
    },
    {
        id: 'overmatch_doctrine',
        name: 'OVERMATCH INITIATIVE',
        description: 'Explosion radius +50%, but munitions and contracts cost 30% more.',
        effect: { costMultiplier: 1.3, explosionRadius: 1.5 }
    }
];
