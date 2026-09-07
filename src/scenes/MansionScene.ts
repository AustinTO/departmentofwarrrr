import * as Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { NewsTicker } from '../ui/NewsTicker';
import { currentRun } from '../state/RunState';
import { DISTRICTS, type EstateRecord } from '../data/mansions';
import { mansionSystem } from '../game/MansionSystem';

export class MansionScene extends Phaser.Scene {
    private mapRoot!: Phaser.GameObjects.Container;
    private mapScroll = 0;

    constructor() {
        super('MansionScene');
    }

    create() {
        const { width, height } = this.scale;
        this.add.image(width / 2, height / 2, 'mansion_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x00130c, 0.42).setOrigin(0);
        audioManager.setScene(this);
        audioManager.playMusic('menu_music', true);

        const newBuilds = mansionSystem.reconcile();
        mansionSystem.ensureLedger();
        currentRun.syncUnlocks();
        currentRun.save();

        this.add.text(width / 2, 58, 'MCLEAN EXPANSION AUTHORITY', {
            fontSize: '48px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5);
        this.add.text(width / 2, 108, `MANSIONS: ${currentRun.mansionsBuilt}  •  PROFIT: ${this.formatBudget(currentRun.contractorProfit)}  •  DISTRICTS: ${mansionSystem.unlockedDistricts().length}/6`, {
            fontSize: '22px', color: '#a8ff93', fontStyle: 'bold'
        }).setOrigin(0.5);

        this.renderInfrastructureStrip(width);
        this.mapRoot = this.add.container(0, 0);
        this.renderEstateMap(width, height);

        // Drag / swipe to scroll dense district stacks.
        this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
            if (!pointer.isDown) return;
            this.mapScroll = Phaser.Math.Clamp(this.mapScroll + pointer.velocity.y * 0.08, -420, 0);
            this.mapRoot.y = this.mapScroll;
        });

        this.add.rectangle(width / 2, height - 100, 430, 100, 0x004400)
            .setStrokeStyle(3, 0xa8ff93)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.sound.stopAll();
                this.scene.start('EventScene');
            });
        this.add.text(width / 2, height - 100, 'NEXT FISCAL YEAR', {
            fontSize: '38px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5);
        new NewsTicker(this, height - 180);

        if (newBuilds.length > 0) {
            this.playNewBuildSequence(newBuilds[newBuilds.length - 1]);
        }
    }

    private renderInfrastructureStrip(width: number) {
        const unlocked = mansionSystem.unlockedInfra();
        unlocked.forEach((item, index) => {
            const x = 90 + index * 165;
            this.add.image(x, 165, 'sheet_mansion_infra', item.frame).setDisplaySize(72, 72);
            this.add.text(x, 210, item.label, {
                fontSize: '11px', color: '#d6e1e5', fontStyle: 'bold', align: 'center', wordWrap: { width: 140 }
            }).setOrigin(0.5, 0);
        });
        if (unlocked.length === 0) {
            this.add.text(width / 2, 175, 'INFRASTRUCTURE UNLOCKS AS MCLEAN GROWS', {
                fontSize: '18px', color: '#8aa7b2', fontStyle: 'bold'
            }).setOrigin(0.5);
        }
    }

    private renderEstateMap(width: number, height: number) {
        const built = currentRun.mansionsBuilt;
        const districts = DISTRICTS.filter((district, index) =>
            district.unlockAt <= built || index === DISTRICTS.findIndex((next) => next.unlockAt > built)
        );
        const startY = 250;
        const districtHeight = Math.min(280, Math.max(210, (height - 520) / Math.min(districts.length, 4)));

        districts.forEach((district, districtIndex) => {
            const y = startY + districtIndex * districtHeight;
            const unlocked = built >= district.unlockAt;
            const panel = this.add.rectangle(width / 2, y + districtHeight / 2 - 8, width - 70, districtHeight - 20, district.color, unlocked ? 0.78 : 0.28)
                .setStrokeStyle(3, unlocked ? 0xd6c680 : 0x56616c);
            this.mapRoot.add(panel);
            this.mapRoot.add(this.add.text(55, y + 16, district.name, {
                fontSize: '22px', color: unlocked ? '#fff3bd' : '#87939d', fontStyle: 'bold'
            }));
            this.mapRoot.add(this.add.text(55, y + 44, unlocked ? district.subtitle : `UNLOCK AT ${district.unlockAt} MANSIONS`, {
                fontSize: '15px', color: '#d6e1e5'
            }));

            if (!unlocked) return;

            const { visible, overflow } = mansionSystem.visibleEstates(district.id);
            visible.forEach((estate, slot) => {
                const x = 120 + (slot % 6) * 155;
                const lotY = y + 105 + Math.floor(slot / 6) * 85;
                this.mapRoot.add(this.add.circle(x, lotY, 40, 0x133526, 0.62).setStrokeStyle(2, 0x99bd79, 0.65));
                this.buildMansion(x, lotY, 0.36, estate);
            });
            if (overflow > 0) {
                this.mapRoot.add(this.add.text(width - 80, y + districtHeight - 42, `+${overflow} CLUSTERED ESTATES`, {
                    fontSize: '17px', color: '#fff3bd', fontStyle: 'bold'
                }).setOrigin(1));
            }

            // Fresh district unlock pulse.
            if (built === district.unlockAt && district.unlockAt > 0) {
                panel.setStrokeStyle(6, 0xa8ff93);
                this.tweens.add({ targets: panel, alpha: 0.45, yoyo: true, duration: 280, repeat: 3 });
            }
        });

        const next = mansionSystem.nextDistrict();
        const nextLabel = next ? `${next.name} UNLOCKS AT ${next.unlockAt}` : 'THE ENTIRE COUNTY HAS BEEN OPTIMIZED';
        this.add.text(width / 2, height - 255, `NEXT ESTATE: ${this.formatBudget(currentRun.mansionCost())}  •  ${nextLabel}`, {
            fontSize: '18px', color: '#ffe68c', align: 'center', wordWrap: { width: width - 80 }
        }).setOrigin(0.5);
    }

    private buildMansion(x: number, y: number, scale: number, estate: EstateRecord) {
        const variant = mansionSystem.variantById(estate.variantId);
        this.mapRoot.add(this.add.circle(x, y + 18, 48 * scale, variant.accent, 0.28));
        const sprite = this.add.image(x, y, 'sheet_mansion_estates', variant.frame)
            .setDisplaySize(210 * scale, 150 * scale)
            .setTint(variant.tint)
            .setAlpha(0.98);
        this.mapRoot.add(sprite);
        this.mapRoot.add(this.add.text(x, y + 46 * scale, variant.name, {
            fontSize: `${Math.max(10, Math.round(16 * scale))}px`,
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 3
        }).setOrigin(0.5));
    }

    private playNewBuildSequence(estate: EstateRecord) {
        const { width, height } = this.scale;
        const variant = mansionSystem.variantById(estate.variantId);
        const district = DISTRICTS.find((entry) => entry.id === estate.districtId);
        const card = this.add.container(width / 2, height / 2).setDepth(2000).setAlpha(0);

        card.add(this.add.rectangle(0, 0, 820, 520, 0x102418, 0.96).setStrokeStyle(5, 0xd6c680));
        card.add(this.add.text(0, -200, 'NEW BUILD AUTHORIZED', {
            fontSize: '40px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0.5));
        card.add(this.add.image(0, -40, 'sheet_mansion_estates', variant.frame).setDisplaySize(280, 190));
        card.add(this.add.text(0, 100, variant.name, {
            fontSize: '34px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));
        card.add(this.add.text(0, 150, `${district?.name ?? 'MCLEAN'}  •  FY ${estate.fiscalYear}`, {
            fontSize: '22px', color: '#a8ff93', fontStyle: 'bold'
        }).setOrigin(0.5));
        card.add(this.add.text(0, 195, `FUNDED BY: ${estate.program}`, {
            fontSize: '20px', color: '#d6e1e5', fontStyle: 'bold', align: 'center', wordWrap: { width: 700 }
        }).setOrigin(0.5));

        this.tweens.add({
            targets: card, alpha: 1, scale: { from: 0.9, to: 1 }, duration: 280, ease: 'Back.out'
        });
        this.time.delayedCall(2800, () => {
            this.tweens.add({
                targets: card, alpha: 0, y: height / 2 - 40, duration: 320,
                onComplete: () => card.destroy()
            });
        });
    }

    private formatBudget(value: number) {
        return value >= 1e12 ? `$${(value / 1e12).toFixed(2)}T` : `$${(value / 1e9).toFixed(1)}B`;
    }
}
