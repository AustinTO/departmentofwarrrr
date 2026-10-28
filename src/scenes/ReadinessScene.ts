import * as Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { currentRun } from '../state/RunState';
import { NewsTicker } from '../ui/NewsTicker';
import { WeaponType, WEAPON_CONFIGS } from '../game/config';
import { scenarioForFiscalYear } from '../game/CombatScenarios';

export class ReadinessScene extends Phaser.Scene {
    private transferBatch = 1;
    private pendingTransfer: { key: string; quantity: number } | null = null;

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

    private renderTheaters(width: number) {
        const theaters = Object.values(currentRun.theaters);
        const startY = 414;
        const spacing = 238;
        const cardHeight = 222;
        const lines = [
            ['SM-3', WeaponType.INTERCEPTOR, 0x006666],
            ['SM-6', WeaponType.INTERCEPTOR_BLOCK_II, 0x666600],
            ['HYDRA', WeaponType.HYDRA, 0x884422],
            ['RAIL', WeaponType.RAILGUN, 0x226688],
            ['SEEKER', WeaponType.SEEKER, 0x228866]
        ] as const;

        theaters.forEach((theater, i) => {
            const y = startY + i * spacing;
            this.add.rectangle(width / 2, y, width - 48, cardHeight, 0x2a3a4a, 0.94).setOrigin(0.5);

            const role = theater.id === 'active' ? 'ACTIVE' : theater.id === 'reserve' ? 'RESERVE' : 'FORWARD';
            const readinessColor = theater.readiness > 70 ? '#00ff88' : theater.readiness > 40 ? '#ffff00' : '#ff6666';
            this.add.text(38, y - 99, `${theater.name.toUpperCase()}  ·  ${role}`, {
                fontSize: '25px', color: theater.id === 'active' ? '#8fffff' : '#ffffff', fontStyle: 'bold',
                wordWrap: { width: width - 320 }
            });
            this.add.text(width - 36, y - 99, `${Math.floor(theater.readiness)}% READY`, {
                fontSize: '23px', color: readinessColor, fontStyle: 'bold'
            }).setOrigin(1, 0);

            lines.forEach(([label, type, color], idx) => {
                const lineY = y - 62 + idx * 32;
                const stock = theater.inventory[type] || 0;
                this.add.text(45, lineY, `${label}: ${stock}`, {
                    fontSize: '21px', color: idx < 2 ? '#ffffff' : '#cfe8ff'
                });

                if (theater.id !== 'active') {
                    const buttonX = width - 115;
                    this.add.rectangle(buttonX, lineY + 12, 150, 27, color)
                        .setInteractive({ useHandCursor: true })
                        .on('pointerdown', () => this.chooseTransfer(theater.id, type, label));
                    this.add.text(buttonX, lineY + 12, `MOVE ${this.transferBatch}`, {
                        fontSize: '16px', color: '#ffffff', fontStyle: 'bold'
                    }).setOrigin(0.5);
                }
            });
        });

        const selectorY = 238;
        this.add.text(40, selectorY, 'TRANSFER BATCH', { fontSize: '19px', color: '#ffffff', fontStyle: 'bold' });
        [1, 5, 10].forEach((batch, idx) => {
            const x = 220 + idx * 96;
            const selected = this.transferBatch === batch;
            this.add.rectangle(x, selectorY + 15, 78, 36, selected ? 0x00aabb : 0x344454)
                .setInteractive({ useHandCursor: true })
                .on('pointerdown', () => {
                    this.transferBatch = batch;
                    this.scene.restart();
                });
            this.add.text(x, selectorY + 15, `${batch}`, { fontSize: '20px', color: '#ffffff', fontStyle: 'bold' }).setOrigin(0.5);
        });
        this.add.text(525, selectorY + 2, 'Select a source munition to preview exact stock and readiness impact.', {
            fontSize: '17px', color: '#cfe8ff', wordWrap: { width: width - 550 }
        });
    }

    private chooseTransfer(fromId: string, weaponType: WeaponType, label: string) {
        const key = `${fromId}:${weaponType}`;
        const source = currentRun.theaters[fromId];
        const active = currentRun.theaters.active;
        const available = source?.inventory[weaponType] || 0;
        const quantity = Math.min(this.transferBatch, available);
        if (!source || quantity <= 0) {
            this.pendingTransfer = null;
            this.showPreview(`${label}: no stock available in ${source?.name ?? fromId}.`);
            return;
        }

        if (this.pendingTransfer?.key === key) {
            const committedQuantity = this.pendingTransfer.quantity;
            this.pendingTransfer = null;
            if (currentRun.transferInventory(fromId, 'active', weaponType, committedQuantity)) {
                this.cameras.main.flash(200, 0, 255, 255);
                this.scene.restart();
            }
            return;
        }

        const sourceAfter = available - quantity;
        const activeBefore = active.inventory[weaponType] || 0;
        const activeAfter = activeBefore + quantity;
        const readinessPenalty = fromId === 'reserve' ? 0 : (quantity / 20) * 5;
        const readinessAfter = Math.max(0, source.readiness - readinessPenalty);
        const globalBefore = currentRun.globalReadiness;
        const globalAfter = fromId === 'reserve'
            ? globalBefore
            : Math.floor((Object.values(currentRun.theaters).reduce((sum, t) => sum + t.readiness, 0) - source.readiness + readinessAfter)
                / Object.values(currentRun.theaters).length);
        const consequence = fromId === 'reserve'
            ? `reserve readiness unchanged; global ${globalBefore}%`
            : `${source.readiness.toFixed(1)}% → ${readinessAfter.toFixed(1)}% readiness; global ${globalBefore}% → ${globalAfter}%`;
        this.pendingTransfer = { key, quantity };
        this.showPreview(`${quantity} ${label}: ${source.name} stock ${available} → ${sourceAfter}; active stock ${activeBefore} → ${activeAfter}; ${consequence}. Tap the same MOVE button again to transfer.`);
    }

    private showPreview(message: string) {
        // Keep the preview in a consistent space above the theater cards.
        this.children.list.filter(child => child.getData('transferPreview')).forEach(child => child.destroy());
        this.add.text(40, 285, message, {
            fontSize: '17px', color: '#fff3bf', wordWrap: { width: this.scale.width - 80 }, lineSpacing: 2
        }).setData('transferPreview', true);
    }
}
