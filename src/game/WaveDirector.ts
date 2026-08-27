import { ThreatType } from './config';

export interface WaveStep {
    delay: number;
    types: ThreatType[];
    count: number;
}

export class WaveDirector {
    private elapsedTime: number = 0;
    private intensity: number = 1;

    constructor(fy: number = 1) {
        this.intensity = 1 + (fy - 1) * 0.5;
    }

    public getNextSpawn(time: number): { type: ThreatType, delay: number } {
        this.elapsedTime += time;
        
        // Intensity increases over the course of the wave (60-100 seconds)
        const waveProgress = Math.min(1, this.elapsedTime / 90000);
        const currentIntensity = this.intensity * (1 + waveProgress);

        let type: ThreatType;
        const roll = Math.random();

        if (roll < 0.4 / currentIntensity) {
            type = ThreatType.LAWN_MOWER;
        } else if (roll < 0.6) {
            type = ThreatType.DECOY;
        } else if (roll < 0.8) {
            type = ThreatType.SCOOTER;
        } else if (roll < 0.9) {
            type = ThreatType.SWARM;
        } else if (roll < 0.95) {
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
