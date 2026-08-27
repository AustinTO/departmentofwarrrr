
import * as Phaser from 'phaser';

export class AudioManager {
    private static instance: AudioManager;
    private scene: Phaser.Scene | null = null;
    private currentMusic: Phaser.Sound.BaseSound | null = null;

    private constructor() { }

    public static getInstance(): AudioManager {
        if (!AudioManager.instance) {
            AudioManager.instance = new AudioManager();
        }
        return AudioManager.instance;
    }

    public setScene(scene: Phaser.Scene) {
        this.scene = scene;
    }

    public play(key: string, config?: Phaser.Types.Sound.SoundConfig | Phaser.Types.Sound.SoundMarker) {
        if (this.scene) {
            this.scene.sound.play(key, config);
        }
    }

    public add(key: string, config: Phaser.Types.Sound.SoundConfig) {
        if (this.scene) {
            this.scene.sound.add(key, config);
        }
    }

    // Example of how you might load all your audio assets
    public static preload(scene: Phaser.Scene) {
        scene.load.audio('interceptor_fire', 'assets/audio/interceptor_fire.mp3');
        scene.load.audio('threat_explode', 'assets/audio/threat_explode.mp3');
        scene.load.audio('base_hit', 'assets/audio/base_hit.mp3');
        scene.load.audio('menu_music', 'assets/audio/menu_music.mp3');
        scene.load.audio('combat_music', 'assets/audio/combat_music.mp3');
    }

    public playMusic(key: string, loop: boolean = false) {
        if (this.currentMusic) {
            this.currentMusic.stop();
        }
        if (this.scene) {
            this.currentMusic = this.scene.sound.add(key, { loop });
            this.currentMusic.play();
        }
    }

    public stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic = null;
        }
    }
}

export const audioManager = AudioManager.getInstance();
