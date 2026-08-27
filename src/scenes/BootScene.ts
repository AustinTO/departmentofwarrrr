import * as Phaser from 'phaser';
import { currentRun } from '../state/RunState';

export class BootScene extends Phaser.Scene {
    constructor() {
        super('BootScene');
    }

    preload() {
        // Load save data
        currentRun.load();
    }

    create() {
        this.scene.start('PreloaderScene');
    }
}
