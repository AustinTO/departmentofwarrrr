import * as Phaser from 'phaser';
import { gameSettings } from './GameSettings';

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
        this.applyVolumes();
    }

    public play(key: string, config?: Phaser.Types.Sound.SoundConfig) {
        if (!this.scene) return;
        const volume = gameSettings.sfxVolume * (config?.volume ?? 1);
        this.scene.sound.play(key, { ...config, volume });
    }

    public add(key: string, config: Phaser.Types.Sound.SoundConfig) {
        if (this.scene) {
            this.scene.sound.add(key, config);
        }
    }

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
            this.currentMusic.destroy();
            this.currentMusic = null;
        }
        if (!this.scene) return;
        this.currentMusic = this.scene.sound.add(key, {
            loop,
            volume: gameSettings.musicVolume
        });
        this.currentMusic.play();
    }

    public stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.stop();
            this.currentMusic.destroy();
            this.currentMusic = null;
        }
    }

    /** Push current settings onto the active music track. */
    public applyVolumes() {
        if (this.currentMusic && 'setVolume' in this.currentMusic) {
            (this.currentMusic as Phaser.Sound.WebAudioSound | Phaser.Sound.HTML5AudioSound)
                .setVolume(gameSettings.musicVolume);
        }
    }
}

export const audioManager = AudioManager.getInstance();
