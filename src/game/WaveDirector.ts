import { ThreatType } from './config';

export interface WaveStep {
    delay: number;
    types: ThreatType[];
    count: number;
}

export class WaveDirector {
    private elapsedTime: number = 0;
    private intensity: number = 1;
    private lastTime: number | null = null;
    private sinceFriendly = 0;
    private readonly random: () => number;

    constructor(fy: number = 1, random: () => number = Math.random) {
        // Keep later years harder without multiplying an already-fast spawn loop.
        this.intensity = 1 + Math.min(0.5, Math.max(0, fy - 1) * 0.08);
        this.random = random;
        // First allied contact arrives mid-wave, not immediately.
        this.sinceFriendly = 4;
    }

    public getNextSpawn(time: number): { type: ThreatType, delay: number } {
        const delta = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
        this.lastTime = time;
        this.elapsedTime += delta;
        this.sinceFriendly++;

        // Combat is capped at 60 seconds; ramp smoothly over that real window.
        const waveProgress = Math.min(1, this.elapsedTime / 60000);
        const currentIntensity = this.intensity * (1 + waveProgress * 0.3);

        let type: ThreatType;
        const roll = this.random();

        // Allies are rare decision points: ~1 every 14–18 spawns, ~3% random chance.
        if (this.sinceFriendly >= 16 || (this.sinceFriendly >= 10 && roll < 0.03)) {
            type = ThreatType.FRIENDLY;
            this.sinceFriendly = 0;
        } else if (roll < 0.42 / currentIntensity) {
            type = ThreatType.LAWN_MOWER;
        } else if (roll < 0.58) {
            type = ThreatType.DECOY;
        } else if (roll < 0.76) {
            type = ThreatType.SCOOTER;
        } else if (roll < 0.86) {
            type = ThreatType.SWARM;
        } else if (roll < 0.93) {
            type = ThreatType.MYSTERY;
        } else {
            type = ThreatType.MISSILE;
        }

        // Delay decreases as intensity increases
        const baseDelay = 2000;
        // Protect the on-screen threat budget from unbounded FY/scenario multipliers.
        const delay = Math.max(900, baseDelay / currentIntensity);

        return { type, delay };
    }
}
