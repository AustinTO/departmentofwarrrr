import { WeaponType, ThreatType, WEAPON_CONFIGS, THREAT_CONFIGS } from './config';
import { currentRun } from '../state/RunState';

export interface CombatStats {
    taxpayerBurn: number;
    threatValueDestroyed: number;
    procurementPressure: number;
    readinessLoss: number;
    interceptorsFired: number;
    overmatchTotal: number;
}

export class CombatSystem {
    private stats: CombatStats = {
        taxpayerBurn: 0,
        threatValueDestroyed: 0,
        procurementPressure: 0,
        readinessLoss: 0,
        interceptorsFired: 0,
        overmatchTotal: 0
    };

    public recordWeaponFire(type: WeaponType) {
        const config = WEAPON_CONFIGS[type];
        const multiplier = currentRun.activeDoctrine?.effect.costMultiplier || 1.0;
        const finalCost = config.cost * multiplier;
        
        this.stats.taxpayerBurn += finalCost;
        
        if (type === WeaponType.INTERCEPTOR || type === WeaponType.INTERCEPTOR_BLOCK_II) {
            this.stats.interceptorsFired++;
            // Base pressure from spending expensive munitions
            this.stats.procurementPressure += finalCost / 1_000_000;
        }
    }

    public recordThreatDestroyed(threatType: ThreatType, weaponType: WeaponType): number {
        const threatConfig = THREAT_CONFIGS[threatType];
        const weaponConfig = WEAPON_CONFIGS[weaponType];
        const costMultiplier = currentRun.activeDoctrine?.effect.costMultiplier || 1.0;
        
        this.stats.threatValueDestroyed += threatConfig.value;

        let overmatchRatio = 1;
        if (weaponType === WeaponType.INTERCEPTOR || weaponType === WeaponType.INTERCEPTOR_BLOCK_II) {
            overmatchRatio = Math.floor((weaponConfig.cost * costMultiplier) / threatConfig.value);
            this.stats.overmatchTotal += overmatchRatio;
            
            // Overmatch creates significant pressure
            this.stats.procurementPressure += overmatchRatio / 500;
        }

        return overmatchRatio;
    }

    public recordReadinessLoss(amount: number) {
        this.stats.readinessLoss += amount;
        // Readiness loss creates extreme procurement pressure ("Emergency!")
        this.stats.procurementPressure += amount * 10;
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
            overmatchTotal: 0
        };
    }
}
