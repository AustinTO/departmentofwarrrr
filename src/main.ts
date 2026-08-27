import * as Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { CombatScene } from './scenes/CombatScene';
import { ReadinessScene } from './scenes/ReadinessScene';
import { ProcurementScene } from './scenes/ProcurementScene';
import { MansionScene } from './scenes/MansionScene';
import { DoctrineScene } from './scenes/DoctrineScene';
import { EventScene } from './scenes/EventScene';
import { PreloaderScene } from './scenes/PreloaderScene';

import { PressReleaseScene } from './scenes/PressReleaseScene';
import { LeaderboardScene } from './scenes/LeaderboardScene';

const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 1080,
    height: 1920,
    parent: 'game-container',
    scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH
    },
    physics: {
        default: 'arcade',
        arcade: {
            gravity: { x: 0, y: 0 },
            debug: false
        },
        matter: {
            gravity: { x: 0, y: 1 },
            debug: false
        }
    },
    scene: [BootScene, PreloaderScene, DoctrineScene, CombatScene, ReadinessScene, ProcurementScene, MansionScene, EventScene, PressReleaseScene, LeaderboardScene]
};

new Phaser.Game(config);
