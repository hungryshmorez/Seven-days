/** Procedural audio for the Prologue (no sound files needed). Dialogue is subtitle-only. */
export class Sfx {
    ctx: AudioContext | null = null;
    private master!: GainNode;
    private masterVol = 0.8;
    private noiseBuf!: AudioBuffer;
    private rain!: GainNode;
    private surf!: GainNode;
    private hum!: GainNode;
    private drone!: GainNode;
    private humOsc!: OscillatorNode;

    init(): void {
        if (this.ctx) {
            void this.ctx.resume();
            return;
        }
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = 0.8;
        this.master.connect(ctx.destination);
        const len = ctx.sampleRate * 2;
        this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noiseBuf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        const loop = (filterType: BiquadFilterType, freq: number): GainNode => {
            const src = ctx.createBufferSource();
            src.buffer = this.noiseBuf;
            src.loop = true;
            const f = ctx.createBiquadFilter();
            f.type = filterType;
            f.frequency.value = freq;
            const g = ctx.createGain();
            g.gain.value = 0;
            src.connect(f).connect(g).connect(this.master);
            src.start();
            return g;
        };
        this.rain = loop('highpass', 1500);
        this.surf = loop('lowpass', 500);
        const o1 = ctx.createOscillator();
        o1.frequency.value = 100;
        this.humOsc = o1;
        const o2 = ctx.createOscillator();
        o2.frequency.value = 50;
        o2.type = 'triangle';
        this.hum = ctx.createGain();
        this.hum.gain.value = 0;
        o1.connect(this.hum);
        o2.connect(this.hum);
        this.hum.connect(this.master);
        o1.start();
        o2.start();
        const o3 = ctx.createOscillator();
        o3.frequency.value = 38;
        this.drone = ctx.createGain();
        this.drone.gain.value = 0;
        o3.connect(this.drone).connect(this.master);
        o3.start();
    }

    setLevels(rain: number, surf: number, hum: number, drone: number): void {
        if (!this.ctx) return;
        const t = this.ctx.currentTime;
        this.rain.gain.setTargetAtTime(rain, t, 0.3);
        this.surf.gain.setTargetAtTime(surf, t, 0.3);
        this.hum.gain.setTargetAtTime(hum, t, 0.3);
        this.drone.gain.setTargetAtTime(drone, t, 0.3);
    }

    setMaster(v: number): void {
        if (this.ctx && v !== this.masterVol) { this.masterVol = v; this.master.gain.setTargetAtTime(v, this.ctx.currentTime, 0.1); }
    }

    setHumPitch(f: number): void {
        if (this.ctx) this.humOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.2);
    }

    noise(dur: number, freq: number, q: number, gain: number, pan = 0, type: BiquadFilterType = 'bandpass', sweepTo?: number): void {
        const ctx = this.ctx;
        if (!ctx || gain <= 0.001) return;
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuf;
        const f = ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q;
        if (sweepTo) f.frequency.linearRampToValueAtTime(sweepTo, ctx.currentTime + dur);
        const g = ctx.createGain();
        const t = ctx.currentTime;
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + Math.min(0.03, dur / 3));
        g.gain.linearRampToValueAtTime(0, t + dur);
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        src.connect(f).connect(g).connect(p).connect(this.master);
        src.start(t, Math.random(), dur + 0.05);
    }

    tone(freq: number, dur: number, gain: number, pan = 0, type: OscillatorType = 'sine', endFreq?: number): void {
        const ctx = this.ctx;
        if (!ctx || gain <= 0.001) return;
        const o = ctx.createOscillator();
        o.type = type;
        const t = ctx.currentTime;
        o.frequency.setValueAtTime(freq, t);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, t);
        g.gain.linearRampToValueAtTime(gain, t + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        const p = ctx.createStereoPanner();
        p.pan.value = Math.max(-1, Math.min(1, pan));
        o.connect(g).connect(p).connect(this.master);
        o.start(t);
        o.stop(t + dur + 0.05);
    }

    step(surface: 'sand' | 'dirt' | 'concrete', loud: number): void {
        if (surface === 'sand') this.noise(0.12, 350, 0.5, 0.12 * loud, 0, 'lowpass');
        else if (surface === 'dirt') this.noise(0.1, 500, 0.7, 0.14 * loud, 0, 'lowpass');
        else {
            this.noise(0.07, 1200, 1, 0.12 * loud, 0, 'bandpass');
            this.tone(90, 0.1, 0.08 * loud);
        }
    }

    thud(gain: number, pan = 0): void {
        this.tone(70, 0.35, gain, pan, 'sine', 35);
        this.noise(0.15, 200, 0.6, gain * 0.5, pan, 'lowpass');
    }

    scrape(gain: number, pan = 0): void {
        this.noise(0.9, 1600, 4, gain, pan, 'bandpass', 2600);
        this.tone(180, 0.8, gain * 0.15, pan, 'sawtooth', 150);
    }

    click(gain = 0.3): void {
        this.noise(0.04, 2500, 2, gain);
    }

    beep(): void {
        this.tone(660, 0.18, 0.12, 0, 'square');
        this.tone(990, 0.3, 0.1, 0, 'square');
    }

    staticBurst(dur: number, gain: number): void {
        this.noise(dur, 4000, 0.3, gain, 0, 'highpass');
    }

    /** Synthetic vocal-like cues; dialogue itself remains subtitled. */
    lastCry(): void {
        this.tone(83, 2.5, 0.17, 0, 'sawtooth', 31);
        this.tone(124, 2.1, 0.08, -0.18, 'triangle', 42);
        this.noise(2.3, 470, 3, 0.13, 0.1, 'bandpass', 110);
    }

    laugh(pan: number, pitch = 92): void {
        const ctx = this.ctx;
        if (!ctx) return;
        for (let i = 0; i < 4; i++) {
            const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner();
            const t = ctx.currentTime + i * 0.19;
            o.type = 'triangle'; o.frequency.setValueAtTime(pitch + i % 2 * 13, t);
            o.frequency.exponentialRampToValueAtTime(pitch * 0.62, t + 0.14);
            g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.065, t + 0.025); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
            p.pan.value = pan; o.connect(g).connect(p).connect(this.master); o.start(t); o.stop(t + 0.18);
        }
    }

    flatline(duration: number): void {
        const ctx = this.ctx;
        if (!ctx) return;
        const o = ctx.createOscillator(), g = ctx.createGain();
        const t = ctx.currentTime;
        o.frequency.value = 880;
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.07, t + 0.1);
        g.gain.setValueAtTime(0.07, t + duration - 0.3); g.gain.linearRampToValueAtTime(0, t + duration);
        o.connect(g).connect(this.master); o.start(t); o.stop(t + duration);
    }
}
