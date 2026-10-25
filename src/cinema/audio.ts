/**
 * Procedural sound: everything is synthesized live (no audio files).
 * Beds (ocean, wind, hum, hiss) have levels the director can fade.
 */
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';

export type CreatureId = 'cleaverback' | 'burned_accomplice' | 'hound' | 'grin_cat' | 'ink_man'
    | 'speaker_tower' | 'long_neck' | 'morrow_moppet' | 'velocity_wraith' | 'fox_figure'
    | 'watcher' | 'splicemaster' | 'miss_merrily' | 'buttonbell' | 'tall_smile' | 'mr_stillwell'
    | 'white_figure' | 'ritual_presence';
export type CreatureTrigger = 'approach' | 'reveal' | 'twitch' | 'blink' | 'dropout' | 'lie';

// Lifecycle reporting remains registered once in GameCanvas, never per creature.
export class CinemaAudio {
    ctx: AudioContext;
    master: GainNode;
    private beds: Record<string, GainNode> = {};
    private noiseBuf: AudioBuffer;
    private wow: GainNode;
    private motionQuietUntil = 0;
    private lastCreature = new Map<CreatureId, number>();
    private lastMotionSound = -10;
    constructor() {
        const AC = window.AudioContext || (window as any).webkitAudioContext;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 3;
        this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
            const w = Math.random() * 2 - 1;
            last = (last + 0.02 * w) / 1.02; // brown-ish
            d[i] = w * 0.5 + last * 8;
        }
        this.wow = this.ctx.createGain();
        this.makeOcean();
        this.makeWind();
        this.makeHum();
        this.makeHiss();
    }

    private noiseSrc(): AudioBufferSourceNode {
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        s.loop = true;
        s.start(0, Math.random() * 2);
        return s;
    }

    private bed(name: string): GainNode {
        const g = this.ctx.createGain();
        g.gain.value = 0;
        g.connect(this.master);
        this.beds[name] = g;
        return g;
    }

    private makeOcean() {
        const g = this.bed('ocean');
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 600;
        const lfoGain = this.ctx.createGain();
        lfoGain.gain.value = 0.5;
        const swell = this.ctx.createGain();
        swell.gain.value = 0.5;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.11; // one wave every ~9s
        lfo.connect(lfoGain).connect(swell.gain);
        lfo.start();
        this.noiseSrc().connect(f).connect(swell).connect(g);
    }

    private makeWind() {
        const g = this.bed('wind');
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 400;
        f.Q.value = 0.8;
        const lfo = this.ctx.createOscillator();
        lfo.frequency.value = 0.2;
        const lg = this.ctx.createGain();
        lg.gain.value = 200;
        lfo.connect(lg).connect(f.frequency);
        lfo.start();
        this.noiseSrc().connect(f).connect(g);
    }

    private makeHum() {
        const g = this.bed('hum');
        for (const fr of [50, 100, 150]) {
            const o = this.ctx.createOscillator();
            o.type = 'sawtooth';
            o.frequency.value = fr;
            const og = this.ctx.createGain();
            og.gain.value = 0.15 / (fr / 50);
            o.connect(og).connect(g);
            o.start();
        }
    }

    private makeHiss() {
        const g = this.bed('hiss');
        const f = this.ctx.createBiquadFilter();
        f.type = 'highpass';
        f.frequency.value = 3500;
        this.noiseSrc().connect(f).connect(g);
    }

    /** Fade a bed to a level (0..1) over `secs`. */
    level(name: string, v: number, secs = 1) {
        const g = this.beds[name];
        if (!g) return;
        const t = this.ctx.currentTime;
        g.gain.cancelScheduledValues(t);
        g.gain.setValueAtTime(g.gain.value, t);
        g.gain.linearRampToValueAtTime(v, t + secs);
    }

    /** Short noise burst, e.g. a footstep on sand. */
    step(strength = 1) {
        const t = this.ctx.currentTime;
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 500 + Math.random() * 300;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0.35 * strength, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
        s.connect(f).connect(g).connect(this.master);
        s.start(t, Math.random() * 2, 0.2);
    }

    /** Sub-bass thump / impact. */
    thump(freq = 50, vol = 0.9, len = 1.2) {
        const t = this.ctx.currentTime;
        const o = this.ctx.createOscillator();
        o.frequency.setValueAtTime(freq * 2, t);
        o.frequency.exponentialRampToValueAtTime(freq * 0.5, t + len);
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + len);
        o.connect(g).connect(this.master);
        o.start(t);
        o.stop(t + len);
    }

    /** Radio / tape static burst. */
    staticBurst(secs = 0.6, vol = 0.5) {
        const t = this.ctx.currentTime;
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 2200;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.linearRampToValueAtTime(0, t + secs);
        s.connect(f).connect(g).connect(this.master);
        s.start(t, Math.random() * 2, secs + 0.1);
    }

    /** Breathing: filtered noise swell. */
    breath(vol = 0.25) {
        const t = this.ctx.currentTime;
        const s = this.ctx.createBufferSource();
        s.buffer = this.noiseBuf;
        const f = this.ctx.createBiquadFilter();
        f.type = 'bandpass';
        f.frequency.value = 900;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + 0.5);
        g.gain.linearRampToValueAtTime(0, t + 1.1);
        s.connect(f).connect(g).connect(this.master);
        s.start(t, Math.random() * 2, 1.2);
    }

    /** Tape wow/flutter: detune master playback is not possible, so wobble volume. */
    flutter(amount: number) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setValueAtTime(0.9 - amount * 0.5, t);
        this.master.gain.linearRampToValueAtTime(0.9, t + 0.4);
    }

    /** Discrete authored beat; quiet holds suppress incidental creature noises, not dialogue. */
    horrorBeat(episode: string, beat: string, phase: 'build' | 'scare' | 'release',
        beds: Partial<Record<'wind' | 'ocean' | 'hum' | 'hiss', number>>, quietSeconds = 0) {
        RundotGameAPI.analytics.recordCustomEvent('horror_beat_started', { episode, beat, phase });
        for (const [name, value] of Object.entries(beds)) this.level(name, value!, phase === 'scare' ? 0.3 : 1.2);
        this.motionQuietUntil = this.ctx.currentTime + quietSeconds;
    }

    /** Finite, softly attacked sources. Every node is released when its source ends. */
    private creatureNoise(hz: number, seconds: number, vol: number, delay = 0, endHz = hz, pan = 0) {
        const t = this.ctx.currentTime + delay;
        const s = this.ctx.createBufferSource(); s.buffer = this.noiseBuf; s.loop = true;
        const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4;
        f.frequency.setValueAtTime(hz, t); f.frequency.exponentialRampToValueAtTime(Math.max(25, endHz), t + seconds);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + Math.min(0.22, seconds * 0.3));
        g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
        const p = this.ctx.createStereoPanner(); p.pan.value = pan;
        s.connect(f).connect(g).connect(p).connect(this.master);
        s.onended = () => { s.disconnect(); f.disconnect(); g.disconnect(); p.disconnect(); };
        s.start(t, Math.random() * 2); s.stop(t + seconds + 0.03);
    }
    private creatureTone(hz: number, endHz: number, seconds: number, vol: number,
        shape: OscillatorType = 'sine', delay = 0, pan = 0) {
        const t = this.ctx.currentTime + delay;
        const o = this.ctx.createOscillator(); o.type = shape;
        o.frequency.setValueAtTime(hz, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, endHz), t + seconds);
        const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = Math.max(hz * 3, 300);
        const g = this.ctx.createGain(); g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(vol, t + Math.min(0.18, seconds * 0.25));
        g.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
        const p = this.ctx.createStereoPanner(); p.pan.value = pan;
        o.connect(f).connect(g).connect(p).connect(this.master);
        o.onended = () => { o.disconnect(); f.disconnect(); g.disconnect(); p.disconnect(); };
        o.start(t); o.stop(t + seconds + 0.03);
    }
    private creatureBreath(hz: number, vol: number, seconds = 1.6, pan = 0, endHz = hz * 0.65) {
        this.creatureNoise(hz, seconds, vol, 0, endHz, pan);
    }
    private wetClick(vol: number, delay = 0, pan = 0) {
        this.creatureNoise(850, 0.14, vol, delay, 160, pan);
        this.creatureTone(210, 65, 0.17, vol * 0.35, 'sine', delay, pan);
    }
    private skitter(vol: number, wooden = false, pan = 0) {
        [0, 0.11, 0.28, 0.34, 0.57].forEach((d, i) => {
            this.creatureNoise(wooden ? 1400 : 2400, 0.065, vol * 0.55, d, wooden ? 450 : 1100, pan);
            if (wooden) this.creatureTone(360 + i * 27, 140, 0.09, vol * 0.25, 'triangle', d, pan);
        });
    }
    private speakerHowl(vol: number, pan = 0) {
        this.creatureTone(108, 74, 2.3, vol * 0.45, 'sawtooth', 0, pan);
        this.creatureTone(163, 111, 2.2, vol * 0.25, 'triangle', 0.08, pan);
        this.creatureNoise(620, 2, vol * 0.45, 0.1, 330, pan);
    }
    /** All creature cues report once per actual sound, never once per animation frame. */
    creatureSound(creature: CreatureId, distance = 20, trigger: CreatureTrigger = 'approach', pan = 0) {
        const now = this.ctx.currentTime;
        const motion = trigger === 'twitch' || trigger === 'blink' || trigger === 'dropout';
        // These gates suppress incidental sounds themselves; no played sound misses its event.
        if (this.ctx.state !== 'running') return;
        if (motion && (now < this.motionQuietUntil || now - (this.lastCreature.get(creature) ?? -10) < 3.5
            || now - this.lastMotionSound < 1.1 || distance > 65)) return;
        this.lastCreature.set(creature, now);
        if (motion) this.lastMotionSound = now;
        const near = 1 / (1 + Math.max(0, distance) / 7);
        const vol = (0.015 + near * 0.12) * (motion ? 0.35 : 1);
        const side = Math.max(-0.8, Math.min(0.8, pan));
        RundotGameAPI.analytics.recordCustomEvent('creature_sound_played', {
            creature, trigger, distance: Math.round(distance), proximity: distance < 8 ? 'close' : 'distant',
        });
        // Blinks and tape skips are tiny material details rather than repeated jump stings.
        if (motion) {
            if (['ink_man', 'burned_accomplice', 'hound', 'long_neck'].includes(creature)) this.wetClick(vol, 0, side);
            else if (['morrow_moppet', 'mr_stillwell', 'buttonbell'].includes(creature)) this.creatureNoise(1200, 0.12, vol, 0, 450, side);
            else this.creatureNoise(creature === 'tall_smile' ? 360 : 1800, 0.15, vol, 0, 600, side);
            return;
        }
        switch (creature) {
            case 'cleaverback': // bark chest, split jaw, dragging blade
                this.creatureBreath(135, vol, 1.9, side);
                this.creatureTone(57, 34, 1.7, vol * 0.45, 'sawtooth', 0, side);
                this.creatureNoise(740, 0.6, vol * 0.45, 0.7, 290, side); break;
            case 'burned_accomplice':
                this.skitter(vol, false, side); this.wetClick(vol * 0.8, 0.65, side);
                this.creatureBreath(1300, vol * 0.5, 0.9, side); break;
            case 'hound':
                this.creatureBreath(190, vol, 1.8, side);
                this.creatureTone(73, 39, 1.4, vol * 0.55, 'triangle', 0.3, side); break;
            case 'grin_cat': // rubber stretch above a broken purr
                this.creatureTone(94, 143, 1.2, vol * 0.6, 'triangle', 0, side);
                this.creatureTone(430, 190, 0.8, vol * 0.35, 'sine', 0.55, side);
                this.creatureBreath(470, vol * 0.5, 0.7, side); break;
            case 'ink_man':
                [0, 0.32, 0.8].forEach(d => this.wetClick(vol, d, side));
                this.creatureBreath(95, vol * 0.7, 1.7, side); break;
            case 'speaker_tower': this.speakerHowl(vol, side); break;
            case 'long_neck':
                this.creatureBreath(980, vol, 2.1, side);
                this.creatureTone(380, 92, 1.7, vol * 0.4, 'sine', 0.25, side); break;
            case 'morrow_moppet':
                this.skitter(vol, true, side);
                this.creatureTone(670, 440, 0.9, vol * 0.28, 'triangle', 0.4, side); break;
            case 'velocity_wraith':
                this.creatureNoise(2200, 1.3, vol, 0, 220, side);
                this.creatureTone(760, 110, 1.2, vol * 0.35, 'triangle', 0, side); break;
            case 'fox_figure':
                this.creatureTone(610, 390, 0.35, vol * 0.3, 'sine', 0, side);
                this.creatureTone(390, 290, 0.4, vol * 0.25, 'sine', 0.55, side);
                this.creatureBreath(1700, vol * 0.6, 1.2, side); break;
            case 'watcher': // inhalation rises when the body remains still
                this.creatureBreath(650, vol, 2.2, side, 1900); break;
            case 'splicemaster':
                this.skitter(vol * 0.7, false, side);
                [71, 107, 143].forEach(hz => this.creatureTone(hz, hz * 0.7, 2, vol * 0.22, 'sawtooth', 0, side));
                this.creatureBreath(2600, vol * 0.5, 1.6, side); break;
            case 'miss_merrily': // porcelain settling, a sweetness with no voice
                [0, 0.26, 0.75].forEach((d, i) => this.creatureTone(960 - i * 150, 420, 0.15, vol * 0.3, 'triangle', d, side));
                this.creatureBreath(1400, vol * 0.6, 1.4, side); break;
            case 'buttonbell':
                this.creatureBreath(2100, vol * 0.6, 0.7, side);
                // Canon: brass bells ring only on its cover-story lie, never on a truthful warning.
                if (trigger === 'lie') [880, 1327, 1793].forEach(hz => this.creatureTone(hz, hz * 0.995, 1.1, vol * 0.28, 'sine', 0, side));
                break;
            case 'tall_smile':
                this.creatureTone(180, 72, 1.5, vol * 0.55, 'sawtooth', 0, side);
                this.skitter(vol * 0.5, false, side); break;
            case 'mr_stillwell':
                this.creatureTone(205, 86, 1.9, vol * 0.4, 'triangle', 0, side);
                this.creatureBreath(2600, vol * 0.65, 0.7, side); break;
            case 'white_figure': this.creatureBreath(1700, vol * 0.6, 1.9, side); break;
            case 'ritual_presence': this.creatureBreath(110, vol, 2, side); break;
        }
    }
    suspend() { void this.ctx.suspend().catch(() => {}); }
    resume() { void this.ctx.resume().catch(() => {}); }
    dispose() { try { void this.ctx.close().catch(() => {}); } catch { /* closed */ } }
}
