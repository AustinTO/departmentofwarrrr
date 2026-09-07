import { currentRun } from '../state/RunState';
import {
    DISTRICTS,
    INFRA_UNLOCKS,
    MANSION_VARIANTS,
    type DistrictDef,
    type EstateRecord,
    type InfraUnlock,
    type MansionVariant
} from '../data/mansions';

const PROGRAMS = [
    'Freedom Shield Block II',
    'Silent Shield Sustainment',
    'Emergency Supplemental Bridge',
    'Overmatch Initiative Spares',
    'Cost-Plus Continuity Package',
    'Strategic Pivot Realignment'
];

/** Estate map logic: districts, ledger, infrastructure thresholds. */
export class MansionSystem {
    reconcile(): EstateRecord[] {
        const before = currentRun.mansionsBuilt;
        currentRun.reconcileMansions();
        const after = currentRun.mansionsBuilt;
        const created: EstateRecord[] = [];

        for (let index = before; index < after; index++) {
            const record = this.buildRecord(index);
            currentRun.estateLedger.push(record);
            created.push(record);
        }
        return created;
    }

    buildRecord(index: number): EstateRecord {
        const district = this.districtForIndex(index);
        const variant = this.pickVariant(district.id, index);
        return {
            index,
            variantId: variant.id,
            districtId: district.id,
            fiscalYear: currentRun.currentFY,
            program: PROGRAMS[index % PROGRAMS.length]
        };
    }

    ensureLedger(): void {
        while (currentRun.estateLedger.length < currentRun.mansionsBuilt) {
            currentRun.estateLedger.push(this.buildRecord(currentRun.estateLedger.length));
        }
        if (currentRun.estateLedger.length > currentRun.mansionsBuilt) {
            currentRun.estateLedger = currentRun.estateLedger.slice(0, currentRun.mansionsBuilt);
        }
    }

    districtForIndex(index: number): DistrictDef {
        let chosen = DISTRICTS[0];
        for (const district of DISTRICTS) {
            if (index >= district.unlockAt) chosen = district;
        }
        return chosen;
    }

    pickVariant(districtId: string, index: number): MansionVariant {
        const preferred = MANSION_VARIANTS.filter((variant) => variant.districts.includes(districtId));
        const pool = preferred.length > 0 ? preferred : MANSION_VARIANTS;
        return pool[index % pool.length];
    }

    variantById(id: string): MansionVariant {
        return MANSION_VARIANTS.find((variant) => variant.id === id) ?? MANSION_VARIANTS[0];
    }

    unlockedDistricts(built = currentRun.mansionsBuilt): DistrictDef[] {
        return DISTRICTS.filter((district) => district.unlockAt <= built);
    }

    nextDistrict(built = currentRun.mansionsBuilt): DistrictDef | undefined {
        return DISTRICTS.find((district) => district.unlockAt > built);
    }

    unlockedInfra(built = currentRun.mansionsBuilt): InfraUnlock[] {
        return INFRA_UNLOCKS.filter((item) => item.unlockAt <= built);
    }

    estatesInDistrict(districtId: string): EstateRecord[] {
        this.ensureLedger();
        return currentRun.estateLedger.filter((estate) => estate.districtId === districtId);
    }

    /** Visible individual lots vs summarized overflow for dense districts. */
    visibleEstates(districtId: string): { visible: EstateRecord[]; overflow: number } {
        const district = DISTRICTS.find((entry) => entry.id === districtId) ?? DISTRICTS[0];
        const all = this.estatesInDistrict(districtId);
        const visible = all.slice(-district.capacity);
        return { visible, overflow: Math.max(0, all.length - visible.length) };
    }

    latestBuild(): EstateRecord | undefined {
        this.ensureLedger();
        return currentRun.estateLedger[currentRun.estateLedger.length - 1];
    }
}

export const mansionSystem = new MansionSystem();
