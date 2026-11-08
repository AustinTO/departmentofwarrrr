import * as Phaser from 'phaser';

export function dailyBackdrop(scene: Phaser.Scene, texture = 'doctrine_bg'): void {
    const { width, height } = scene.scale;
    scene.add.image(width / 2, height / 2, texture).setDisplaySize(width, height);
    scene.add.rectangle(0, 0, width, height, 0x03111a, 0.83).setOrigin(0);
    scene.add.rectangle(width / 2, 135, width - 84, 8, 0xffd166, 0.9);
}

/** Large touch target, with label on top and the rectangle owning input. */
export function dailyButton(scene: Phaser.Scene, y: number, label: string, onClick: () => void,
    options: { x?: number; width?: number; color?: number; outline?: number; fontSize?: number } = {}
): void {
    const width = options.width ?? 760;
    const x = options.x ?? scene.scale.width / 2;
    const fill = options.color ?? 0x116b4c;
    const outline = options.outline ?? 0xa8ff93;
    const box = scene.add.rectangle(x, y, width, 118, fill, 0.98)
        .setStrokeStyle(4, outline).setDepth(20)
        .setInteractive({ useHandCursor: true }).on('pointerdown', onClick);
    box.on('pointerover', () => box.setStrokeStyle(5, 0xffffff));
    box.on('pointerout', () => box.setStrokeStyle(4, outline));
    scene.add.text(x, y, label, {
        fontSize: String(options.fontSize ?? 32) + 'px', color: '#ffffff', fontStyle: 'bold',
        align: 'center', wordWrap: { width: width - 28 }
    }).setOrigin(0.5).setDepth(21);
}
