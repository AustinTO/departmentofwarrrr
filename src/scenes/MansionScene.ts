import * as Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { NewsTicker } from '../ui/NewsTicker';
import { currentRun } from '../state/RunState';
import { MANSION_VARIANTS } from '../data/mansions';

type District = { name: string; unlockAt: number; color: number; subtitle: string };

const DISTRICTS: District[] = [
    { name: 'ORIGINAL ESTATE', unlockAt: 0, color: 0x4f7d54, subtitle: 'ONE TASTEfully DEFENSIBLE MANSION' },
    { name: 'CUL-DE-SAC OF NECESSITY', unlockAt: 6, color: 0x658f59, subtitle: 'SIX HOMES, ZERO QUESTIONS' },
    { name: 'GATED PROCUREMENT HEIGHTS', unlockAt: 18, color: 0x847a4b, subtitle: 'ACCESS RESTRICTED FOR SECURITY' },
    { name: 'HELICOPTER ENCLAVE', unlockAt: 45, color: 0x73546e, subtitle: 'NOW WITH STRATEGIC AIRLIFT' },
    { name: 'GREATER MCLEAN ESTATE ZONE', unlockAt: 90, color: 0x5a667d, subtitle: 'THE MAP HAS BEEN REZONED' }
];

export class MansionScene extends Phaser.Scene {
    constructor() {
        super('MansionScene');
    }

    create() {
        const { width, height } = this.scale;
        this.add.image(width / 2, height / 2, 'mansion_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x00130c, 0.42).setOrigin(0);
        audioManager.setScene(this);
        audioManager.play('menu_music', { loop: true });

        currentRun.reconcileMansions();
        currentRun.save();
        this.add.text(width / 2, 70, 'MCLEAN EXPANSION AUTHORITY', { fontSize: '52px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 8 }).setOrigin(0.5);
        this.add.text(width / 2, 125, `MANSIONS: ${currentRun.mansionsBuilt}  •  PROFIT: ${this.formatBudget(currentRun.contractorProfit)}`, { fontSize: '27px', color: '#a8ff93', fontStyle: 'bold' }).setOrigin(0.5);
        this.renderEstateMap(width, height);

        this.add.rectangle(width / 2, height - 100, 430, 100, 0x004400).setStrokeStyle(3, 0xa8ff93).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
            this.sound.stopAll();
            this.scene.start('EventScene');
        });
        this.add.text(width / 2, height - 100, 'NEXT FISCAL YEAR', { fontSize: '38px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        new NewsTicker(this, height - 180);
    }

    private renderEstateMap(width: number, height: number) {
        const built = currentRun.mansionsBuilt;
        const visibleDistricts = DISTRICTS.filter((district, index) => district.unlockAt <= built || index === DISTRICTS.findIndex((next) => next.unlockAt > built));
        const startY = 220;
        const districtHeight = Math.min(250, (height - 470) / visibleDistricts.length);

        visibleDistricts.forEach((district, districtIndex) => {
            const y = startY + districtIndex * districtHeight;
            const unlocked = built >= district.unlockAt;
            this.add.rectangle(width / 2, y + districtHeight / 2 - 8, width - 70, districtHeight - 20, district.color, unlocked ? 0.75 : 0.28)
                .setStrokeStyle(3, unlocked ? 0xd6c680 : 0x56616c);
            this.add.text(55, y + 18, district.name, { fontSize: '21px', color: unlocked ? '#fff3bd' : '#87939d', fontStyle: 'bold' });
            this.add.text(55, y + 47, unlocked ? district.subtitle : `UNLOCK AT ${district.unlockAt} MANSIONS`, { fontSize: '15px', color: '#d6e1e5' });
            if (!unlocked) return;

            const districtStart = district.unlockAt;
            const nextUnlock = DISTRICTS[districtIndex + 1]?.unlockAt ?? Number.MAX_SAFE_INTEGER;
            const count = Math.max(0, Math.min(built - districtStart, nextUnlock - districtStart));
            const slots = 12;
            for (let slot = 0; slot < slots; slot++) {
                const x = 120 + (slot % 6) * 170;
                const lotY = y + 100 + Math.floor(slot / 6) * 80;
                this.add.circle(x, lotY, 43, 0x133526, 0.62).setStrokeStyle(2, 0x99bd79, 0.65);
                if (slot < Math.min(count, slots)) this.buildMansion(x, lotY, 0.38, districtStart + slot);
            }
            if (count > slots) this.add.text(width - 80, y + districtHeight - 48, `+${count - slots} MORE ESTATES`, { fontSize: '18px', color: '#fff3bd', fontStyle: 'bold' }).setOrigin(1);
        });

        const next = DISTRICTS.find((district) => district.unlockAt > built);
        const nextLabel = next ? `${next.name} UNLOCKS AT ${next.unlockAt}` : 'THE ENTIRE COUNTY HAS BEEN OPTIMIZED';
        this.add.text(width / 2, height - 255, `NEXT ESTATE: ${this.formatBudget(currentRun.mansionCost())}  •  ${nextLabel}`, { fontSize: '18px', color: '#ffe68c', align: 'center', wordWrap: { width: width - 80 } }).setOrigin(0.5);
    }

    private buildMansion(x: number, y: number, scale: number, estateIndex: number) {
        const variant = MANSION_VARIANTS[estateIndex % MANSION_VARIANTS.length];
        this.add.circle(x, y + 18, 51 * scale, variant.accent, 0.28);
        const sprite = this.add.sprite(x, y, 'luxury_mansion').setDisplaySize(220 * scale, 180 * scale);
        sprite.setTint(variant.tint);
        sprite.setAlpha(0.96);
        this.add.text(x, y + 44 * scale, variant.name, { fontSize: `${Math.max(10, Math.round(20 * scale))}px`, color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 3 }).setOrigin(0.5);
    }

    private formatBudget(value: number) {
        return value >= 1e12 ? `$${(value / 1e12).toFixed(2)}T` : `$${(value / 1e9).toFixed(1)}B`;
    }
}
