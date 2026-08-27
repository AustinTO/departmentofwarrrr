
import * as Phaser from 'phaser';
import { headlines } from '../helpers/NewsHeadlines';

export class NewsTicker extends Phaser.GameObjects.Container {
    private text: Phaser.GameObjects.Text;

    constructor(scene: Phaser.Scene, y: number) {
        super(scene, 0, y);

        const { width } = scene.scale;

        // Create a background for the ticker
        const background = scene.add.rectangle(0, 0, width, 40, 0x000000, 0.8).setOrigin(0);
        this.add(background);

        // Join headlines and create the text object
        const tickerText = headlines.join('   ***   ');
        this.text = scene.add.text(width, 10, tickerText, {
            fontSize: '24px',
            color: '#ffff00',
            fontStyle: 'bold'
        });
        this.add(this.text);

        // Create a mask for the scrolling effect
        const shape = scene.make.graphics({});
        shape.fillStyle(0xffffff);
        shape.beginPath();
        shape.fillRect(0, y, width, 40);
        const mask = shape.createGeometryMask();
        this.setMask(mask);

        // Add the ticker to the scene
        scene.add.existing(this);

        // Start the scrolling animation
        this.startScrolling(width);
    }

    private startScrolling(width: number) {
        this.scene.tweens.add({
            targets: this.text,
            x: -this.text.width, // scroll until the text is off-screen
            duration: 60000, // adjust duration for scroll speed
            ease: 'Linear',
            repeat: -1, // loop forever
            onRepeat: () => {
                this.text.x = width; // reset position when loop repeats
            }
        });
    }
}
