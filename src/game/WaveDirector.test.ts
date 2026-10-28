import { describe, expect, it } from 'vitest';
import { WaveDirector } from './WaveDirector';
import { ThreatType } from './config';

describe('WaveDirector pacing', () => {
    it('uses a deterministic injected stream and caps late-wave spawn pressure', () => {
        const random = () => 0.99;
        const early = new WaveDirector(1, random);
        const late = new WaveDirector(100, random);

        early.getNextSpawn(0);
        late.getNextSpawn(0);
        const earlySpawn = early.getNextSpawn(1000);
        const lateSpawn = late.getNextSpawn(60_000);

        expect(earlySpawn.type).toBe(ThreatType.MISSILE);
        expect(lateSpawn.delay).toBeGreaterThanOrEqual(900);
        expect(lateSpawn.type).toBe(ThreatType.MISSILE);
    });

    it('ramps over the actual 60-second combat duration', () => {
        const director = new WaveDirector(1, () => 0.5);
        const first = director.getNextSpawn(0);
        const atMidpoint = director.getNextSpawn(30_000);
        const atEnd = director.getNextSpawn(60_000);

        expect(first.delay).toBe(2000);
        expect(atMidpoint.delay).toBeLessThan(first.delay);
        expect(atEnd.delay).toBeLessThanOrEqual(atMidpoint.delay);
        expect(atEnd.delay).toBeGreaterThanOrEqual(900);
    });
});
