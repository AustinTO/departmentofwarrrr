import * as Phaser from 'phaser';
import { SettingsPanel } from './SettingsPanel';

type PauseMenuOptions = {
    title?: string;
    onResume: () => void;
    onQuitToTitle: () => void;
};

/**
 * In-run pause overlay with settings access. Callers own physics/timer pause
 * state; this only renders and routes button presses.
 */
export class PauseMenu {
    private root: Phaser.GameObjects.Container;
    private settings?: SettingsPanel;

    constructor(scene: Phaser.Scene, options: PauseMenuOptions) {
        const { width, height } = scene.scale;
        this.root = scene.add.container(0, 0).setDepth(4000);

        this.root.add(scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.7)
            .setInteractive());

        this.root.add(scene.add.text(width / 2, height / 2 - 280, options.title ?? 'PAUSED', {
            fontSize: '72px', color: '#00ffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 8
        }).setOrigin(0.5));

        this.root.add(scene.add.text(width / 2, height / 2 - 200, 'THE THREATS CAN WAIT. THE CONTRACTORS CANNOT.', {
            fontSize: '22px', color: '#9bcbd4', fontStyle: 'bold', align: 'center', wordWrap: { width: width - 120 }
        }).setOrigin(0.5));

        this.addButton(scene, width / 2, height / 2 - 60, 520, 100, 0x087a42, 0xa8ff93, 'RESUME', () => {
            this.destroy();
            options.onResume();
        });

        this.addButton(scene, width / 2, height / 2 + 70, 520, 100, 0x126a87, 0x7df4ff, 'SETTINGS', () => {
            this.settings = new SettingsPanel(scene, {
                onClose: () => { this.settings = undefined; }
            });
        });

        this.addButton(scene, width / 2, height / 2 + 200, 520, 100, 0x5a1f1f, 0xff765e, 'QUIT TO TITLE', () => {
            this.destroy();
            options.onQuitToTitle();
        });
    }

    private addButton(
        scene: Phaser.Scene,
        x: number,
        y: number,
        w: number,
        h: number,
        fill: number,
        stroke: number,
        label: string,
        onClick: () => void
    ) {
        const button = scene.add.rectangle(x, y, w, h, fill, 0.95)
            .setStrokeStyle(4, stroke)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', onClick);
        this.root.add(button);
        this.root.add(scene.add.text(x, y, label, {
            fontSize: '36px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));
    }

    destroy() {
        this.settings?.destroy();
        this.root.destroy(true);
    }
}
