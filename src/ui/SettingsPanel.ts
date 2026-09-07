import * as Phaser from 'phaser';
import { gameSettings } from '../managers/GameSettings';
import { audioManager } from '../managers/AudioManager';

type SettingsPanelOptions = {
    onClose: () => void;
};

/**
 * Modal volume panel. Keeps interaction local so it can open from the title
 * screen or an in-run pause menu without owning scene lifecycle.
 */
export class SettingsPanel {
    private root: Phaser.GameObjects.Container;

    constructor(scene: Phaser.Scene, options: SettingsPanelOptions) {
        const { width, height } = scene.scale;
        this.root = scene.add.container(0, 0).setDepth(5000);

        const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.72)
            .setInteractive();
        this.root.add(dim);

        const panel = scene.add.rectangle(width / 2, height / 2, 820, 720, 0x132433, 0.98)
            .setStrokeStyle(5, 0x5de6ff);
        this.root.add(panel);

        this.root.add(scene.add.text(width / 2, height / 2 - 280, 'SETTINGS', {
            fontSize: '56px', color: '#ffffff', fontStyle: 'bold', stroke: '#000000', strokeThickness: 6
        }).setOrigin(0.5));

        this.root.add(scene.add.text(width / 2, height / 2 - 210, 'DEFENSE BUDGET FOR YOUR EARS', {
            fontSize: '22px', color: '#9bcbd4', fontStyle: 'bold'
        }).setOrigin(0.5));

        this.buildSlider(scene, width / 2, height / 2 - 80, 'MUSIC', gameSettings.musicVolume, (v) => {
            gameSettings.setMusicVolume(v);
            audioManager.applyVolumes();
        });

        this.buildSlider(scene, width / 2, height / 2 + 90, 'SOUND EFFECTS', gameSettings.sfxVolume, (v) => {
            gameSettings.setSfxVolume(v);
            audioManager.applyVolumes();
        });

        const close = scene.add.rectangle(width / 2, height / 2 + 260, 360, 90, 0x126a87)
            .setStrokeStyle(3, 0x7df4ff)
            .setInteractive({ useHandCursor: true })
            .on('pointerdown', () => {
                this.destroy();
                options.onClose();
            });
        this.root.add(close);
        this.root.add(scene.add.text(width / 2, height / 2 + 260, 'DONE', {
            fontSize: '36px', color: '#ffffff', fontStyle: 'bold'
        }).setOrigin(0.5));
    }

    private buildSlider(
        scene: Phaser.Scene,
        x: number,
        y: number,
        label: string,
        initial: number,
        onChange: (value: number) => void
    ) {
        this.root.add(scene.add.text(x, y - 55, label, {
            fontSize: '28px', color: '#dffbff', fontStyle: 'bold'
        }).setOrigin(0.5));

        const trackWidth = 560;
        const track = scene.add.rectangle(x, y, trackWidth, 28, 0x2a3a4a)
            .setStrokeStyle(3, 0x5c6770)
            .setInteractive({ useHandCursor: true });
        this.root.add(track);

        const fill = scene.add.rectangle(x - trackWidth / 2, y, trackWidth * initial, 28, 0x00c2ff)
            .setOrigin(0, 0.5);
        this.root.add(fill);

        const knob = scene.add.circle(x - trackWidth / 2 + trackWidth * initial, y, 28, 0xffffff)
            .setStrokeStyle(4, 0x5de6ff)
            .setInteractive({ useHandCursor: true, draggable: true });
        this.root.add(knob);

        const valueText = scene.add.text(x, y + 48, `${Math.round(initial * 100)}%`, {
            fontSize: '26px', color: '#ffd166', fontStyle: 'bold'
        }).setOrigin(0.5);
        this.root.add(valueText);

        const apply = (pointerX: number) => {
            const local = Phaser.Math.Clamp(pointerX - (x - trackWidth / 2), 0, trackWidth);
            const value = local / trackWidth;
            fill.width = trackWidth * value;
            knob.x = x - trackWidth / 2 + local;
            valueText.setText(`${Math.round(value * 100)}%`);
            onChange(value);
        };

        track.on('pointerdown', (pointer: Phaser.Input.Pointer) => apply(pointer.x));
        scene.input.setDraggable(knob);
        knob.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number) => apply(dragX));
    }

    destroy() {
        this.root.destroy(true);
    }
}
