export enum WeaponType {
    GUN = 'VULCAN 20MM CANNON',
    JAMMER = 'SILENT SHIELD JAMMER',
    INTERCEPTOR = 'FREEDOM SHIELD SM-3',
    INTERCEPTOR_BLOCK_II = 'GOD-EYE SM-6 BLOCK IB'
}

export enum ThreatType {
    LAWN_MOWER = 'SHAHED-136',
    SCOOTER = 'QASEF-2K',
    DECOY = 'TIED-TOGETHER BALLOONS',
    SWARM = 'MESSENGER DRONE SWARM',
    MYSTERY = 'UNIDENTIFIED ANOMALY',
    MISSILE = 'HYPERSONIC GLIDE VEHICLE'
}

export interface WeaponConfig {
    name: WeaponType;
    cost: number;
    range: number;
    reloadTime: number;
    color: number;
    radius: number;
    description: string;
}

export interface ThreatConfig {
    type: ThreatType;
    value: number;
    speed: number;
    color: number;
    radius: number;
    description: string;
}

export const WEAPON_CONFIGS: Record<WeaponType, WeaponConfig> = {
    [WeaponType.GUN]: { 
        name: WeaponType.GUN, 
        cost: 1500, 
        range: 400, 
        reloadTime: 100, 
        color: 0xcccccc, 
        radius: 20,
        description: "Cheap, reliable, and uses up the lead stockpiles."
    },
    [WeaponType.JAMMER]: { 
        name: WeaponType.JAMMER, 
        cost: 125000, 
        range: 600, 
        reloadTime: 4000, 
        color: 0x00ffff, 
        radius: 350,
        description: "Non-kinetic disruption. High contractor markup for 'software updates'."
    },
    [WeaponType.INTERCEPTOR]: { 
        name: WeaponType.INTERCEPTOR, 
        cost: 12500000, 
        range: 2000, 
        reloadTime: 1500, 
        color: 0xffff00, 
        radius: 250,
        description: "Standard kinetic kill vehicle. A flying mansion."
    },
    [WeaponType.INTERCEPTOR_BLOCK_II]: { 
        name: WeaponType.INTERCEPTOR_BLOCK_II, 
        cost: 32400000, 
        range: 2000, 
        reloadTime: 6000, 
        color: 0xffaa00, 
        radius: 550,
        description: "Experimental overmatch capability. Requires 4 new hangars per unit."
    }
};

export const THREAT_CONFIGS: Record<ThreatType, ThreatConfig> = {
    [ThreatType.LAWN_MOWER]: { 
        type: ThreatType.LAWN_MOWER, 
        value: 1200, 
        speed: 160, 
        color: 0xff3333, 
        radius: 25,
        description: "Engine from a 1994 mower. Costs less than a Pentagon stapler."
    },
    [ThreatType.SCOOTER]: { 
        type: ThreatType.SCOOTER, 
        value: 6500, 
        speed: 320, 
        color: 0xff6600, 
        radius: 18,
        description: "Fast, loud, and annoying. Like a lobbyist at 5pm."
    },
    [ThreatType.DECOY]: { 
        type: ThreatType.DECOY, 
        value: 50, 
        speed: 280, 
        color: 0xff00ff, 
        radius: 15,
        description: "Literally party balloons. Triggers $12M responses every time."
    },
    [ThreatType.SWARM]: { 
        type: ThreatType.SWARM, 
        value: 800, 
        speed: 210, 
        color: 0xaa0000, 
        radius: 12,
        description: "Quantity has a quality of its own. Especially for procurement quotas."
    },
    [ThreatType.MYSTERY]: { 
        type: ThreatType.MYSTERY, 
        value: 3500, 
        speed: 240, 
        color: 0x444444, 
        radius: 20,
        description: "Could be a bird, could be an ICBM. Better use the Block II just in case."
    },
    [ThreatType.MISSILE]: { 
        type: ThreatType.MISSILE, 
        value: 75000, 
        speed: 550, 
        color: 0xffffff, 
        radius: 12,
        description: "Actually expensive. Ruining the profit margin ratio."
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
        description: 'Increased threat frequency, but faster production lines.',
        effect: { threatFrequency: 1.5, readinessMultiplier: 1.2 }
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
        description: 'Explosion radius +50%, but contracts cost 30% more.',
        effect: { costMultiplier: 1.3 }
    }
];
