import * as Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { currentRun } from '../state/RunState';
import { NewsTicker } from '../ui/NewsTicker';
import { WeaponType, WEAPON_CONFIGS } from '../game/config';
import { scenarioForFiscalYear } from '../game/CombatScenarios';
import { previewTransfer } from '../game/ReadinessTransfers';

export class ReadinessScene extends Phaser.Scene {
    private transferBatch = 1;
    private selectedSourceId: string = 'reserve';
    private feedback?: Phaser.GameObjects.Text;

    constructor() {
        super('ReadinessScene');
    }

    create() {
        this.input.enabled = true;
        const { width, height } = this.scale;

        this.add.image(width / 2, height / 2, 'readiness_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0);

        audioManager.setScene(this);
        audioManager.playMusic('menu_music', true);

        this.add.text(width / 2, 62, 'THEATER READINESS', {
            fontSize: '54px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 7
        }).setOrigin(0.5);

        const next = scenarioForFiscalYear(currentRun.currentFY + 1, currentRun.campaignSeed);
        this.add.text(40, 118, `NEXT YEAR · FY ${currentRun.currentFY + 1} · ${next.location}`, {
            fontSize: '23px', color: '#8fffff', fontStyle: 'bold', wordWrap: { width: width - 80 }
        });
        this.add.text(40, 148, `OBJECTIVE: ${next.objective}`, {
            fontSize: '24px', color: '#ffffff', fontStyle: 'bold', wordWrap: { width: width - 80 }
        });

        const visibleBatches = currentRun.productionQueue.slice(0, 4);
        const queueSummary = currentRun.productionQueue.length
            ? `${visibleBatches.map(batch =>
                `${WEAPON_CONFIGS[batch.weaponType]?.shortLabel ?? batch.weaponType} ×${batch.quantity} · FY ${batch.fiscalYear} → ${batch.destination === 'active' ? 'ACTIVE THEATER' : 'STRATEGIC RESERVE'}`
            ).join('   |   ')}${currentRun.productionQueue.length > visibleBatches.length ? `   |   +${currentRun.productionQueue.length - visibleBatches.length} more queued` : ''}`
            : 'DELIVERY QUEUE: EMPTY';
        this.add.text(40, 183, queueSummary, {
            fontSize: '16px', color: '#ffe6a1', wordWrap: { width: width - 80 }, lineSpacing: 1
        });

        this.renderTheaters(width);

        this.add.rectangle(width / 2 + 220, height - 100, 400, 100, 0x006600)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.sound.stopAll();
                this.scene.start('ProcurementScene');
            });
        this.add.text(width / 2 + 220, height - 100, 'PROCUREMENT', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5);

        this.add.rectangle(width / 2 - 220, height - 100, 400, 100, 0x444444)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.sound.stopAll();
                this.scene.start('MansionScene');
            });
        this.add.text(width / 2 - 220, height - 100, 'TO MCLEAN', { fontSize: '42px', color: '#ffffff' }).setOrigin(0.5);

        new NewsTicker(this, height - 180);
    }

    /** A focused, one-source-at-a-time logistics screen replaces 25 tiny move controls. */
    private renderTheaters(width: number) {
        const active = currentRun.theaters.active;
        const sources = [
            { id: 'reserve', label: 'RESERVE' },
            { id: 'indo_pacific', label: 'INDO-PAC' },
            { id: 'europe', label: 'EUROPE' },
            { id: 'homeland', label: 'HOMELAND' }
        ];
        const source = currentRun.theaters[this.selectedSourceId] ?? currentRun.theaters.reserve;
        const rows = [
            { label: 'SM-3 INTERCEPTOR', type: WeaponType.INTERCEPTOR, color: 0x147b94 },
            { label: 'SM-6 BLOCK II', type: WeaponType.INTERCEPTOR_BLOCK_II, color: 0x89702b },
            { label: 'HYDRA CLUSTER', type: WeaponType.HYDRA, color: 0x8b5337 },
            { label: 'RAILGUN', type: WeaponType.RAILGUN, color: 0x376c99 },
            { label: 'SEEKER DRONES', type: WeaponType.SEEKER, color: 0x257c68 }
        ];

        this.add.rectangle(width / 2, 291, width - 70, 158, 0x081d2b, 0.96)
            .setStrokeStyle(3, 0x5de6ff);
        this.add.text(75, 224, 'ACTIVE THEATER INVENTORY', {
            fontSize: '29px', color: '#7df4ff', fontStyle: 'bold'
        });
        this.add.text(width - 75, 227, `${Math.floor(active.readiness)}% READY`, {
            fontSize: '25px', color: active.readiness > 40 ? '#a8ff93' : '#ff765e', fontStyle: 'bold'
        }).setOrigin(1, 0);
        const inv = active.inventory;
        this.add.text(75, 278, `SM-3 ${inv[WeaponType.INTERCEPTOR] ?? 0}  •  SM-6 ${inv[WeaponType.INTERCEPTOR_BLOCK_II] ?? 0}  •  HYDRA ${inv[WeaponType.HYDRA] ?? 0}`, {
            fontSize: '28px', color: '#ffffff', fontStyle: 'bold'
        });
        this.add.text(75, 328, `RAIL ${inv[WeaponType.RAILGUN] ?? 0}  •  SEEKER ${inv[WeaponType.SEEKER] ?? 0}`, {
            fontSize: '28px', color: '#ffffff', fontStyle: 'bold'
        });

        this.add.text(58, 414, '1  •  CHOOSE SUPPLY SOURCE', {
            fontSize: '29px', color: '#ffdf8d', fontStyle: 'bold'
        });
        sources.forEach((option, i) => {
            const x = 150 + i * 258;
            const selected = option.id === this.selectedSourceId;
            const box = this.add.rectangle(x, 500, 236, 108, selected ? 0x126a87 : 0x203444, 0.98)
                .setStrokeStyle(selected ? 5 : 2, selected ? 0xa8ff93 : 0x517589)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    if (this.selectedSourceId === option.id) return;
                    this.selectedSourceId = option.id;
                    this.scene.restart();
                });
            box.setDepth(4);
            this.add.text(x, 500, option.label, {
                fontSize: '27px', color: selected ? '#ffffff' : '#d8ecf4', fontStyle: 'bold'
            }).setOrigin(0.5).setDepth(5);
        });

        this.add.text(58, 579, `2  •  MOVE FROM ${source.name.toUpperCase()}  (${Math.floor(source.readiness)}% READY)`, {
            fontSize: '28px', color: '#ffdf8d', fontStyle: 'bold',
            wordWrap: { width: width - 116 }
        });

        rows.forEach(({ label, type, color }, i) => {
            const y = 682 + i * 166;
            const available = source.inventory[type] || 0;
            const current = active.inventory[type] || 0;
            const amount = Math.min(this.transferBatch, available);
            this.add.rectangle(width / 2, y, width - 76, 146, 0x102937, 0.97)
                .setStrokeStyle(2, 0x507186);
            this.add.rectangle(48, y - 58, 8, 115, color, 1).setOrigin(0, 0);
            this.add.text(76, y - 53, label, {
                fontSize: '33px', color: '#ffffff', fontStyle: 'bold'
            });
            this.add.text(76, y + 5, `SOURCE: ${available}    →    ACTIVE: ${current}`, {
                fontSize: '26px', color: '#bdddea'
            });
            this.add.rectangle(width - 190, y, 285, 112, amount ? color : 0x34404a, 1)
                .setStrokeStyle(3, amount ? 0xffffff : 0x63737d)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => this.chooseTransfer(this.selectedSourceId, type, label));
            this.add.text(width - 190, y, amount ? `MOVE ${amount}` : 'NO STOCK', {
                fontSize: '29px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);
        });

        this.add.text(58, 1516, 'TRANSFER AMOUNT', {
            fontSize: '27px', color: '#ffdf8d', fontStyle: 'bold'
        });
        [1, 5, 10].forEach((batch, i) => {
            const x = 560 + i * 175;
            const selected = this.transferBatch === batch;
            this.add.rectangle(x, 1532, 150, 100, selected ? 0x087a42 : 0x314858, 1)
                .setStrokeStyle(selected ? 5 : 2, selected ? 0xa8ff93 : 0x6794a5)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.transferBatch = batch;
                    this.scene.restart();
                });
            this.add.text(x, 1532, `${batch}`, {
                fontSize: '35px', color: '#ffffff', fontStyle: 'bold'
            }).setOrigin(0.5);
        });
        this.feedback = this.add.text(width / 2, 1643, 'Tap MOVE to preview source, destination and readiness impact before confirming.', {
            fontSize: '24px', color: '#d4ecf3', align: 'center',
            wordWrap: { width: width - 110 }
        }).setOrigin(0.5);
    }

    private chooseTransfer(fromId: string, weaponType: WeaponType, label: string) {
        const preview = previewTransfer(currentRun, fromId, weaponType, this.transferBatch);
        if (!preview) {
            this.feedback?.setText(`NO ${label} STOCK AVAILABLE IN THIS SOURCE.`).setColor('#ffb29d');
            return;
        }
        const { width, height } = this.scale;
        const source = currentRun.theaters[fromId];
        const panel = this.add.container(0, 0).setDepth(5000);
        panel.add(this.add.rectangle(width / 2, height / 2, width, height, 0x010811, 0.88)
            .setInteractive());
        panel.add(this.add.rectangle(width / 2, height / 2, width - 100, 820, 0x0b2735, 0.99)
            .setStrokeStyle(4, 0x7df4ff));
        panel.add(this.add.text(width / 2, height / 2 - 320, 'CONFIRM TRANSFER', {
            fontSize: '48px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));
        panel.add(this.add.text(width / 2, height / 2 - 240, `${preview.quantity} × ${label}`, {
            fontSize: '33px', color: '#ffdf8d', fontStyle: 'bold'
        }).setOrigin(0.5));
        const details = [
            `${source.name}: ${preview.sourceBefore} → ${preview.sourceAfter}`,
            `ACTIVE THEATER: ${preview.activeBefore} → ${preview.activeAfter}`,
            `SOURCE READINESS: ${preview.sourceReadinessBefore.toFixed(1)}% → ${preview.sourceReadinessAfter.toFixed(1)}%`,
            `GLOBAL READINESS: ${preview.globalBefore}% → ${preview.globalAfter}%`
        ];
        panel.add(this.add.text(width / 2, height / 2 - 60, details.join('\n'), {
            fontSize: '30px', color: '#e5f4fa', align: 'center', lineSpacing: 22,
            wordWrap: { width: width - 160 }
        }).setOrigin(0.5));
        panel.add(this.add.text(width / 2, height / 2 + 157, 'This transfer uses existing stock. No purchase or new contract.', {
            fontSize: '22px', color: '#9fc4ce', align: 'center', wordWrap: { width: width - 150 }
        }).setOrigin(0.5));
        const buttonY = height / 2 + 293;
        const cancel = this.add.rectangle(width / 2 - 215, buttonY, 370, 105, 0x364752)
            .setStrokeStyle(3, 0x93aebc).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => panel.destroy(true));
        panel.add(cancel);
        panel.add(this.add.text(width / 2 - 215, buttonY, 'CANCEL', {
            fontSize: '30px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));
        let confirmed = false;
        const confirm = this.add.rectangle(width / 2 + 215, buttonY, 370, 105, 0x087a42)
            .setStrokeStyle(4, 0xa8ff93).setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                if (confirmed) return;
                confirmed = true;
                if (currentRun.transferInventory(fromId, 'active', weaponType, preview.quantity)) {
                    panel.destroy(true);
                    this.scene.restart();
                } else {
                    panel.destroy(true);
                    this.feedback?.setText('TRANSFER DID NOT APPLY. CHECK STOCK AND TRY AGAIN.').setColor('#ffb29d');
                }
            });
        panel.add(confirm);
        panel.add(this.add.text(width / 2 + 215, buttonY, 'CONFIRM', {
            fontSize: '30px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));
    }
}
