import * as Phaser from 'phaser';
import { audioManager } from '../managers/AudioManager';
import { currentRun } from '../state/RunState';
import { NewsTicker } from '../ui/NewsTicker';
import { WeaponType } from '../game/config';

export class ReadinessScene extends Phaser.Scene {
    constructor() {
        super('ReadinessScene');
    }

    create() {
        this.input.enabled = true;
        const { width, height } = this.scale;

        // Background
        this.add.image(width / 2, height / 2, 'readiness_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0);

        audioManager.setScene(this);
        audioManager.playMusic('menu_music', true);

        this.add.text(width / 2, 80, 'THEATER READINESS', {
            fontSize: '64px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.renderTheaters(width, height);

        // Navigation
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

    private renderTheaters(width: number, _height: number) {
        const theaters = Object.values(currentRun.theaters);
        const startY = 200;
        const spacing = 280;

        theaters.forEach((theater, i) => {
            const y = startY + i * spacing;
            this.add.rectangle(width / 2, y, width - 80, 240, 0x2a3a4a).setOrigin(0.5);
            
            this.add.text(60, y - 80, theater.name.toUpperCase(), {
                fontSize: '48px',
                color: '#00ffff',
                fontStyle: 'bold'
            });

            const readinessColor = theater.readiness > 70 ? '#00ff00' : theater.readiness > 40 ? '#ffff00' : '#ff0000';
            this.add.text(width - 60, y - 80, `READINESS: ${Math.floor(theater.readiness)}%`, {
                fontSize: '42px',
                color: readinessColor,
                fontStyle: 'bold'
            }).setOrigin(1, 0);

            // Munition counts
            const lines = [
                [`SM-3: ${theater.inventory[WeaponType.INTERCEPTOR] || 0}`, WeaponType.INTERCEPTOR, 0x006666],
                [`SM-6: ${theater.inventory[WeaponType.INTERCEPTOR_BLOCK_II] || 0}`, WeaponType.INTERCEPTOR_BLOCK_II, 0x666600],
                [`HYDRA: ${theater.inventory[WeaponType.HYDRA] || 0}`, WeaponType.HYDRA, 0x884422],
                [`RAIL: ${theater.inventory[WeaponType.RAILGUN] || 0}`, WeaponType.RAILGUN, 0x226688],
                [`SEEKER: ${theater.inventory[WeaponType.SEEKER] || 0}`, WeaponType.SEEKER, 0x228866]
            ] as const;

            lines.forEach(([label], idx) => {
                this.add.text(80, y - 10 + idx * 32, label, {
                    fontSize: '26px',
                    color: idx < 2 ? (idx === 0 ? '#ffffff' : '#ffaa00') : '#cfe8ff'
                });
            });

            if (theater.id !== 'active') {
                lines.forEach(([, type, color], idx) => {
                    const bx = width - 120;
                    const by = y - 20 + idx * 36;
                    this.add.rectangle(bx, by, 180, 32, color)
                        .setInteractive({ useHandCursor: true })
                        .on('pointerdown', () => this.handleTransfer(theater.id, 'active', type));
                    this.add.text(bx, by, 'XFER', { fontSize: '18px', color: '#ffffff' }).setOrigin(0.5);
                });
            }
        });
    }

    private handleTransfer(fromId: string, toId: string, weaponType: WeaponType) {
        // Transfer up to a fixed batch, allowing smaller inventories to transfer too.
        const available = currentRun.theaters[fromId]?.inventory[weaponType] || 0;
        const quantity = Math.min(10, available);
        if (quantity <= 0) return;

        const success = currentRun.transferInventory(fromId, toId, weaponType, quantity);
        if (success) {
            this.cameras.main.flash(200, 0, 255, 255);
            this.scene.restart(); // Refresh UI
        }
    }
}
