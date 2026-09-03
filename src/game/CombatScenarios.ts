import { ThreatType } from './config';

export interface CombatScenario {
    id: string;
    location: string;
    objective: string;
    baseName: string;
    baseColor: number;
    threatBias: ThreatType[];
    spawnRate: number;
    mode?: 'defend' | 'strike';
    strikeTarget?: string;
    backgroundKey?: string;
}

export const COMBAT_SCENARIOS: CombatScenario[] = [
    { id: 'carrier', location: 'NORTH ATLANTIC CARRIER GROUP', objective: 'DEFEND THE FLOATING POWERPOINT', baseName: 'FORWARD COMMAND SHIP', baseColor: 0x3ddcff, threatBias: [ThreatType.LAWN_MOWER, ThreatType.DECOY], spawnRate: 1 },
    { id: 'desert', location: 'DESERT AIRBASE 17', objective: 'KEEP THE RUNWAY EXPENSIVE', baseName: 'HARDENED AIRBASE', baseColor: 0xe3b15d, threatBias: [ThreatType.SCOOTER, ThreatType.SWARM], spawnRate: 1.2, backgroundKey: 'scenario_desert' },
    { id: 'island', location: 'INDO-PACIFIC FORWARD OUTPOST', objective: 'DEFEND THE STRATEGIC SNACK BAR', baseName: 'ISLAND RADAR BASE', baseColor: 0x7effd4, threatBias: [ThreatType.MISSILE, ThreatType.MYSTERY], spawnRate: 0.82, backgroundKey: 'scenario_island' },
    { id: 'homeland', location: 'HOMELAND INTEGRATED DEFENSE ZONE', objective: 'PROTECT THE BUDGET HEARING', baseName: 'CAPITOL DEFENSE NODE', baseColor: 0xc8a6ff, threatBias: [ThreatType.DECOY, ThreatType.MYSTERY], spawnRate: 1.35, backgroundKey: 'scenario_homeland' }
    ,{ id: 'strike', location: 'FORWARD PRECISION OPTIMIZATION', objective: 'DESTROY THE STRATEGIC SNACK DEPOT', baseName: 'EXPEDITIONARY LAUNCH PLATFORM', baseColor: 0xff8c5d, threatBias: [ThreatType.SCOOTER, ThreatType.DECOY], spawnRate: 0.9, mode: 'strike', strikeTarget: 'STRATEGIC SNACK DEPOT' }
];

export const scenarioForFiscalYear = (fy: number) => COMBAT_SCENARIOS[(fy - 2026 + COMBAT_SCENARIOS.length) % COMBAT_SCENARIOS.length];
