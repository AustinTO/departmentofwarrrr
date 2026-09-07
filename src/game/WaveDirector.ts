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

    constructor(fy: number = 1) {
        this.intensity = 1 + (fy - 1) * 0.5;
        // First allied contact arrives mid-wave, not immediately.
        this.sinceFriendly = 4;
    }

    public getNextSpawn(time: number): { type: ThreatType, delay: number } {
        const delta = this.lastTime === null ? 0 : Math.max(0, time - this.lastTime);
        this.lastTime = time;
        this.elapsedTime += delta;
        this.sinceFriendly++;

        // Intensity increases over the course of the wave (60-100 seconds)
        const waveProgress = Math.min(1, this.elapsedTime / 90000);
        const currentIntensity = this.intensity * (1 + waveProgress);

        let type: ThreatType;
        const roll = Math.random();

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
        const delay = Math.max(400, baseDelay / currentIntensity);

        return { type, delay };
    }
}
