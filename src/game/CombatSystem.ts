import { WeaponType, ThreatType, WEAPON_CONFIGS, THREAT_CONFIGS } from './config';
import { currentRun } from '../state/RunState';

/** A defeated operation is determined by the theater actually under attack. */
export function isActiveTheaterDefeated(activeReadiness: number): boolean {
    return Number.isFinite(activeReadiness) && activeReadiness <= 0;
}

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
    endedEarly: boolean;
}

export interface GradeBreakdown {
    grade: string;
    score: number;
    survival: number;
    restraint: number;
    efficiency: number;
    chain: number;
    reasons: string[];
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
        restraintBonus: 0,
        endedEarly: false
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
        return this.getGradeBreakdown().grade;
    }

    public recordEarlyExit() {
        this.stats.endedEarly = true;
    }

    public getGradeBreakdown(): GradeBreakdown {
        const survival = Math.max(0, 100 - this.stats.readinessLoss * 2);
        const restraint = Math.max(0, Math.min(100, 75 + this.stats.friendliesSpared * 8 - this.stats.friendliesHit * 18));
        const valuePerMillion = this.stats.threatValueDestroyed / Math.max(1, this.stats.taxpayerBurn / 1_000_000);
        const efficiency = Math.min(100, 65 + valuePerMillion * 3);
        const chain = Math.min(100, 40 + this.stats.comboPeak * 6);
        let score = Math.round(survival * 0.3 + restraint * 0.3 + efficiency * 0.2 + chain * 0.2);
        if (this.stats.endedEarly) score = Math.max(0, score - 20);
        let grade = score >= 90 ? 'S' : score >= 75 ? 'A' : score >= 60 ? 'B' : score >= 45 ? 'C' : 'D';
        if (this.stats.friendliesHit >= 3) {
            score = Math.min(score, 44);
            grade = 'F';
        }
        const reasons = [
            `SURVIVAL ${Math.round(survival)}/100 — ${this.stats.readinessLoss} readiness lost`,
            `RESTRAINT ${Math.round(restraint)}/100 — ${this.stats.friendliesSpared} allies spared, ${this.stats.friendliesHit} hit`,
            `EFFICIENCY ${Math.round(efficiency)}/100 — ${this.stats.threatsDestroyed} threats for $${Math.round(this.stats.taxpayerBurn).toLocaleString()}`,
            `CHAIN ${Math.round(chain)}/100 — best chain x${this.stats.comboPeak}`
        ];
        if (this.stats.endedEarly) reasons.push('EARLY EXIT: final grade reduced by 20 points; grade bonus forfeited');
        if (this.stats.friendliesHit >= 3) reasons.push('SEVERE FRIENDLY FIRE: three incidents cap the grade at F');
        return { grade, score, survival, restraint, efficiency, chain, reasons };
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
            restraintBonus: 0,
            endedEarly: false
        };
    }
}
