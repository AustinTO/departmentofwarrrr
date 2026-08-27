import * as Phaser from 'phaser';
import { DOCTRINES } from '../game/config';
import type { Doctrine } from '../game/config';
import { currentRun } from '../state/RunState';

export class DoctrineScene extends Phaser.Scene {
    constructor() {
        super('DoctrineScene');
    }

    create() {
        this.input.enabled = true;
        const { width, height } = this.scale;

        this.add.image(width / 2, height / 2, 'doctrine_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.5).setOrigin(0);

        this.add.text(width / 2, 150, 'SELECT FISCAL YEAR DOCTRINE', {
            fontSize: '56px',
            color: '#ffffff',
            fontStyle: 'bold',
            stroke: '#000000',
            strokeThickness: 8
        }).setOrigin(0.5);

        this.renderDoctrines(width, height);
    }

    private renderDoctrines(width: number, _height: number) {
        // Randomly pick 3 doctrines to show
        const shuffled = [...DOCTRINES].sort(() => 0.5 - Math.random());
        const selected = shuffled.slice(0, 3);

        selected.forEach((doctrine, i) => {
            const x = width / 2;
            const y = 400 + i * 400;

            const card = this.add.rectangle(x, y, width - 120, 350, 0x2a3a4a)
                .setStrokeStyle(6, 0x00ffff)
                .setInteractive()
                .on('pointerdown', () => this.selectDoctrine(doctrine));

            this.add.text(x, y - 100, doctrine.name, {
                fontSize: '42px',
                color: '#00ffff',
                fontStyle: 'bold'
            }).setOrigin(0.5);

            this.add.text(x, y, doctrine.description, {
                fontSize: '32px',
                color: '#ffffff',
                align: 'center',
                wordWrap: { width: width - 200 }
            }).setOrigin(0.5);

            // Hover effect
            card.on('pointerover', () => card.setStrokeStyle(8, 0xffffff));
            card.on('pointerout', () => card.setStrokeStyle(6, 0x00ffff));
        });
    }

    private selectDoctrine(doctrine: Doctrine) {
        currentRun.activeDoctrine = doctrine;
        this.cameras.main.flash(500, 0, 255, 255);
        this.time.delayedCall(500, () => this.scene.start('CombatScene'));
    }
}
