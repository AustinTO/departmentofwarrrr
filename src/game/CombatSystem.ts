import { WeaponType, ThreatType, WEAPON_CONFIGS, THREAT_CONFIGS } from './config';
import { currentRun } from '../state/RunState';

export interface CombatStats {
    taxpayerBurn: number;
    threatValueDestroyed: number;
    procurementPressure: number;
    readinessLoss: number;
    interceptorsFired: number;
    overmatchTotal: number;
    threatsDestroyed: number;
    friendliesSpared: number;
    friendliesHit: number;
    comboPeak: number;
    restraintBonus: number;
}

export class CombatSystem {
    private stats: CombatStats = {
        taxpayerBurn: 0,
        threatValueDestroyed: 0,
        procurementPressure: 0,
        readinessLoss: 0,
        interceptorsFired: 0,
        overmatchTotal: 0,
        threatsDestroyed: 0,
        friendliesSpared: 0,
        friendliesHit: 0,
        comboPeak: 0,
        restraintBonus: 0
    };

    public recordWeaponFire(type: WeaponType) {
        const config = WEAPON_CONFIGS[type];
        const multiplier = currentRun.activeDoctrine?.effect.costMultiplier || 1.0;
        const finalCost = config.cost * multiplier;

        this.stats.taxpayerBurn += finalCost;

        if (type === WeaponType.INTERCEPTOR || type === WeaponType.INTERCEPTOR_BLOCK_II
            || type === WeaponType.HYDRA || type === WeaponType.RAILGUN || type === WeaponType.SEEKER) {
            this.stats.interceptorsFired++;
            this.stats.procurementPressure += finalCost / 1_000_000;
        }
    }

    public recordThreatDestroyed(threatType: ThreatType, weaponType: WeaponType): number {
        const threatConfig = THREAT_CONFIGS[threatType];
        const weaponConfig = WEAPON_CONFIGS[weaponType];
        const costMultiplier = currentRun.activeDoctrine?.effect.costMultiplier || 1.0;

        if (threatConfig.friendly) {
            this.stats.friendliesHit++;
            this.stats.procurementPressure += 90;
            return 0;
        }

        this.stats.threatValueDestroyed += threatConfig.value;
        this.stats.threatsDestroyed++;

        let overmatchRatio = 1;
        if (weaponType === WeaponType.INTERCEPTOR || weaponType === WeaponType.INTERCEPTOR_BLOCK_II
            || weaponType === WeaponType.HYDRA || weaponType === WeaponType.RAILGUN || weaponType === WeaponType.SEEKER) {
            overmatchRatio = Math.floor((weaponConfig.cost * costMultiplier) / Math.max(1, threatConfig.value));
            this.stats.overmatchTotal += overmatchRatio;
            this.stats.procurementPressure += overmatchRatio / 500;
        } else if (weaponType === WeaponType.GUN && threatType === ThreatType.MISSILE) {
            // Cheap kill on an expensive threat — rare and satisfying.
            overmatchRatio = 0;
            this.stats.procurementPressure = Math.max(0, this.stats.procurementPressure - 8);
        }

        return overmatchRatio;
    }

    public recordFriendlySpared() {
        this.stats.friendliesSpared++;
        const bonus = 18_000_000;
        this.stats.restraintBonus += bonus;
        this.stats.procurementPressure = Math.max(0, this.stats.procurementPressure - 12);
    }

    public noteCombo(combo: number) {
        this.stats.comboPeak = Math.max(this.stats.comboPeak, combo);
    }

    public recordReadinessLoss(amount: number) {
        this.stats.readinessLoss += amount;
        this.stats.procurementPressure += amount * 10;
    }

    public getGrade(): string {
        if (this.stats.friendliesHit >= 3) return 'F';
        if (this.stats.friendliesHit >= 1 && this.stats.comboPeak < 5) return 'C';
        if (this.stats.friendliesHit === 0 && this.stats.comboPeak >= 10 && this.stats.friendliesSpared >= 2) return 'S';
        if (this.stats.friendliesHit === 0 && this.stats.friendliesSpared >= 1) return 'A';
        if (this.stats.friendliesHit === 0) return 'B';
        return 'C';
    }

    public getStats(): CombatStats {
        return { ...this.stats };
    }

    public reset() {
        this.stats = {
            taxpayerBurn: 0,
            threatValueDestroyed: 0,
            procurementPressure: 0,
            readinessLoss: 0,
            interceptorsFired: 0,
            overmatchTotal: 0,
            threatsDestroyed: 0,
            friendliesSpared: 0,
            friendliesHit: 0,
            comboPeak: 0,
            restraintBonus: 0
        };
    }
}
