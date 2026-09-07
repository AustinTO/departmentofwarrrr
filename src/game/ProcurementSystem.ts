import { WeaponType } from './config';
import { currentRun } from '../state/RunState';
import type { DeliveryBatch } from '../state/RunState';
import type { ProcurementBumper } from './ProcurementTableDefinition';

export interface ContractState {
    items: Partial<Record<WeaponType, number>>;
    value: number;
    leadTimeDelay: number;
    combo: number;
    skillShots: number;
    multiballTriggered: boolean;
    consequence: string;
}

/** Pure contract arithmetic for the procurement table. */
export class ProcurementSystem {
    readonly state: ContractState = {
        items: {},
        value: 0,
        leadTimeDelay: 0,
        combo: 0,
        skillShots: 0,
        multiballTriggered: false,
        consequence: 'No requirement filed yet.'
    };

    reset() {
        this.state.items = {};
        this.state.value = 0;
        this.state.leadTimeDelay = 0;
        this.state.combo = 0;
        this.state.skillShots = 0;
        this.state.multiballTriggered = false;
        this.state.consequence = 'No requirement filed yet.';
    }

    comboMultiplier(): number {
        return Math.min(4, 1 + Math.floor(this.state.combo / 3));
    }

    applyBumper(bumper: ProcurementBumper, nowCombo = true): { scaledValue: number; multiplier: number; status: string } {
        const isInflate = bumper.outcome === 'inflate' && bumper.value > 0;
        if (nowCombo) {
            this.state.combo = isInflate ? this.state.combo + 1 : 0;
        }
        const multiplier = bumper.value > 0 ? this.comboMultiplier() : 1;
        const costMult = currentRun.activeDoctrine?.effect.costMultiplier ?? 1;
        const profitMult = currentRun.activeDoctrine?.effect.profitMargin ?? 1;
        const scaledValue = bumper.value * multiplier * costMult;

        if (bumper.quantity > 0) {
            this.state.items[bumper.weapon] = (this.state.items[bumper.weapon] ?? 0) + bumper.quantity;
        }
        this.state.leadTimeDelay = Math.max(0, this.state.leadTimeDelay + bumper.delay);
        this.state.value = Math.max(0, this.state.value + scaledValue);
        currentRun.taxpayerBurn = Math.max(0, currentRun.taxpayerBurn + scaledValue);
        currentRun.contractorProfit = Math.max(0, currentRun.contractorProfit + scaledValue * 0.15 * profitMult);

        if (bumper.id === 'emergency-supplemental') {
            this.state.multiballTriggered = true;
        }

        this.state.consequence = this.describeConsequence(bumper, scaledValue);
        const status = scaledValue > 0
            ? 'EMERGENCY REQUIREMENT EXPANDED — KEEP HITTING BUMPERS'
            : 'EFFICIENCY DETECTED — CONTRACT SHRINKING';
        return { scaledValue, multiplier, status };
    }

    recordSkillShot(): { scaledValue: number; status: string } {
        this.state.skillShots += 1;
        this.state.combo += 1;
        const bumperLike: ProcurementBumper = {
            id: 'skill-shot',
            x: 0, y: 0, radius: 0,
            label: 'SUPPLEMENTAL APPROPRIATION',
            value: 15_000_000_000,
            delay: 0.4,
            color: 0xffca4f,
            weapon: WeaponType.INTERCEPTOR,
            quantity: 8,
            outcome: 'inflate',
            badgeFrame: 0
        };
        const result = this.applyBumper(bumperLike, false);
        this.state.consequence = 'Skill-shot supplemental appropriation locked in before debate.';
        return {
            scaledValue: result.scaledValue,
            status: 'SKILL SHOT — SUPPLEMENTAL APPROPRIATION SECURED'
        };
    }

    private describeConsequence(bumper: ProcurementBumper, scaledValue: number): string {
        if (bumper.outcome === 'efficiency') {
            return `${bumper.label}: auditors found a number that was accidentally accurate.`;
        }
        if (bumper.id === 'emergency-supplemental') {
            return 'Emergency supplemental opens a temporary multiball feeding frenzy.';
        }
        if (scaledValue >= 50_000_000_000) {
            return `${bumper.label}: capability arrives late, mansions arrive early.`;
        }
        return `${bumper.label}: money now, readiness later.`;
    }

    authorize(): { batches: DeliveryBatch[]; summary: string } {
        const productionSpeed = currentRun.activeDoctrine?.effect.productionSpeed ?? 1;
        const deliveryYear = currentRun.currentFY + Math.max(0, Math.ceil(this.state.leadTimeDelay / productionSpeed));
        const batches: DeliveryBatch[] = Object.entries(this.state.items).map(([weapon, quantity]) => ({
            fiscalYear: deliveryYear,
            weaponType: weapon as WeaponType,
            quantity: quantity!
        }));
        batches.forEach((batch) => currentRun.productionQueue.push(batch));
        currentRun.save();
        const summary = batches.length === 0
            ? 'Authorized a beautifully empty contract.'
            : `Authorized ${batches.reduce((n, b) => n + b.quantity, 0)} units arriving FY ${deliveryYear}.`;
        return { batches, summary };
    }

    formatBudget(value: number) {
        if (Math.abs(value) >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
        if (Math.abs(value) >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (Math.abs(value) >= 1e6) return `$${(value / 1e6).toFixed(1)}M`;
        return `$${Math.round(value).toLocaleString()}`;
    }
}
