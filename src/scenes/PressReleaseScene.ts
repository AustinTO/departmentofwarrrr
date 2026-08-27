
import * as Phaser from 'phaser';
import { generatePressRelease } from '../helpers/PressReleaseGenerator';

export class PressReleaseScene extends Phaser.Scene {
    constructor() {
        super('PressReleaseScene');
    }

    create() {
        const { width, height } = this.scale;

        this.add.image(width / 2, height / 2, 'event_bg').setDisplaySize(width, height);
        this.add.rectangle(0, 0, width, height, 0x000000, 0.8).setOrigin(0);

        const release = generatePressRelease();

        this.add.text(width / 2, 100, 'FOR IMMEDIATE RELEASE', {
            fontSize: '32px',
            color: '#aaaaaa',
            fontStyle: 'bold',
        }).setOrigin(0.5);

        this.add.text(width / 2, 200, release.headline, {
            fontSize: '48px',
            color: '#ffff00',
            fontStyle: 'bold',
            align: 'center',
            wordWrap: { width: width - 100 }
        }).setOrigin(0.5);

        this.add.text(width / 2, height / 2 + 50, release.body, {
            fontSize: '28px',
            color: '#ffffff',
            align: 'left',
            wordWrap: { width: width - 200 },
            lineSpacing: 10
        }).setOrigin(0.5);


        // Continue Button
        this.add.rectangle(width / 2, height - 100, 400, 80, 0x006600)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => this.scene.start('DoctrineScene'));
        this.add.text(width / 2, height - 100, 'NEXT FISCAL YEAR', { fontSize: '36px', color: '#ffffff' }).setOrigin(0.5);
    }
}
