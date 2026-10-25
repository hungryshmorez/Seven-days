/**
 * CinemaEngine: owns the Three.js renderer, the bodycam rig, the VHS pass,
 * audio, and runs a scene's timeline. React only starts/stops it.
 */
import * as THREE from 'three';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { CinemaAudio } from './audio.ts';
import { Director, type Env, type Fx } from './director.ts';
import { BodycamRig } from './rig.ts';
import { VhsPass } from './vhs.ts';
import { LookLayer } from './look.ts';
import { tickCreatureSkins } from './creatureSkin.ts';
import { buildPrologue } from './prologue.ts';
import { buildDay1 } from './day1.ts';
import { buildDay3 } from './day3.ts';
import { buildDay4 } from './day4.ts';
import { buildDay5 } from './day5.ts';
import { buildDay6 } from './day6.ts';
import { buildDay2 } from './day2.ts';
import { buildDay7 } from './day7.ts';
import { buildHospital } from './hospital.ts';
import { buildPulse } from './pulse.ts';
import { buildHospitalFatal } from './hospitalFatal.ts';
import { buildVcrRoom } from './vcrRoom.ts';
import { store, saveProgress } from '../state/store.ts';
import { completeEpisode, nextEpisode } from '../story/progression.ts';
import { attachClipAudio, clipFrame, stopClip, scareHaptic, haptic, funnel, submitCampaignStats, submitSurvivalScore, scheduleTapeReminder } from '../sdk/platform.ts';

export interface EpisodeDef {
    id: string;
    label: string;
    subtitle: string;
    build?: (env: Env) => void;
    /** Timeline speed for this chapter. 1 = authored pace. */
    speed?: number;
}

/** Pacing for the first seven days (creator direction: faster, ~22 minutes total). */
export const CAMPAIGN_SPEED = 0.7;

export const EPISODES: EpisodeDef[] = [
    { id: 'prologue', label: 'Prologue', subtitle: 'The Island', build: buildPrologue, speed: CAMPAIGN_SPEED },
    { id: 'day1', label: 'Day One', subtitle: 'Hollowmere Galleria — Abandoned Mall', build: buildDay1, speed: CAMPAIGN_SPEED },
    { id: 'day2', label: 'Day Two', subtitle: 'The Nostalgia Warehouse', build: buildDay2, speed: CAMPAIGN_SPEED },
    { id: 'day3', label: 'Day Three', subtitle: 'Render Distance', build: buildDay3, speed: CAMPAIGN_SPEED },
    { id: 'day4', label: 'Day Four', subtitle: '404 Forest / One Long Night', build: buildDay4, speed: CAMPAIGN_SPEED },
    { id: 'day5', label: 'Day Five', subtitle: 'Everybody Smiles Here', build: buildDay5, speed: CAMPAIGN_SPEED },
    { id: 'day6', label: 'Day Six', subtitle: 'The Broadcast', build: buildDay6, speed: CAMPAIGN_SPEED },
    { id: 'day7', label: 'Day Seven', subtitle: 'The Sub-Bass Core', build: buildDay7, speed: CAMPAIGN_SPEED },
    // The hospital is the true ending on the second cycle; see progression.ts for its gate.
    { id: 'hospital', label: 'The Hospital', subtitle: 'The true ending', build: buildHospital },
    // First-cycle hospital is fatal; see GameCanvas, which picks this build when loopCount is 0.
    { id: 'hospitalFatal', label: 'The Hospital', subtitle: 'First cycle: fatal', build: buildHospitalFatal },
];

/** The eight chapters that gate each other, in order. Each requires every earlier one (see story/progression.ts). */
export type EpisodeId = 'prologue' | 'day1' | 'day2' | 'day3' | 'day4' | 'day5' | 'day6' | 'day7' | 'hospital';
export const EPISODE_ORDER: readonly EpisodeId[] = ['prologue', 'day1', 'day2', 'day3', 'day4', 'day5', 'day6', 'day7'];
/** The true ending; unlocked only after every chapter in EPISODE_ORDER is complete. */
export const HOSPITAL_AFTER = 'hospital' as const;

/** Hidden survival ending: reached only by the idle trigger, never listed in the menu. */
export const PULSE_EPISODE: EpisodeDef = { id: 'pulse', label: 'The Pulse', subtitle: 'Hidden', build: buildPulse };

/** How the combined game drives a cinematic chapter. All optional: with none the engine behaves as before. */
export interface EngineOptions {
    /** Second-cycle exploration: the player walks and looks anywhere near the story instead of riding the rail. */
    freeRoam?: boolean;
    /** Second cycle: when the chapter ends, the player walks into a living room, takes the tape and puts it in the VCR. */
    vcr?: boolean;
    /** Tape number shown on the cassette in the VCR room. */
    tapeNo?: number;
    /** Cut the chapter here (authored seconds) with a fade; used when the other game owns the chapter's ending. */
    endAt?: number;
    /** Prologue free-roam: hold the timeline at the camp until the player walks up to it. */
    holdAtCamp?: boolean;
}

const smoothStep = (p: number) => p * p * (3 - 2 * p);
const CAMP_X = -3.4, CAMP_Z = -7.4;
const PROLOGUE_BEACH_START = 70;

function track(name: string, props: Record<string, unknown> = {}) {
    try {
        RundotGameAPI.analytics.recordCustomEvent(name, props);
    } catch { /* analytics unavailable */ }
}

export class CinemaEngine {
    private renderer: THREE.WebGLRenderer;
    private scene = new THREE.Scene();
    private rig: BodycamRig;
    private vhs: VhsPass;
    private look: LookLayer | null = null;
    private audio: CinemaAudio;
    private dir = new Director();
    private fx: Fx = { corr: 0.08, tear: 0, fade: 1, fovKick: 0 };
    private frameCbs: ((dt: number, t: number) => void)[] = [];
    private raf = 0;
    private last = 0;
    private clock = 0;
    private glitchT = 0;
    private glitchS = 0;
    private subEnd = 0;
    private lastTc = -1;
    private paused = false;
    private disposed = false;
    private finished = false;
    private titleRevision = 0;
    private unsub: () => void = () => {};
    private host: HTMLElement;
    private lastPtr: { x: number; y: number } | null = null;
    /** Free exploration: the player walks, the scripted rail stops steering the body. */
    explore = { active: false, speed: 2.2, radius: 60, bounds: null as null | { minX: number; maxX: number; minZ: number; maxZ: number }, collide: null as null | ((x: number, z: number) => boolean), onUse: null as null | (() => void) };
    private keys = new Set<string>();
    /** Free-roam state: the rail keeps playing; the player's own offset and view ride on top of it. */
    private fr = { yaw: 0, pitch: 0, off: new THREE.Vector3(), rail: new THREE.Vector3(), out: new THREE.Vector3(NaN, 0, 0), init: false };
    private vcrActive = false;
    private vcrStarted = false;
    private holdT = 0;
    /** Time of the last press, drag or key: used by the hidden idle (pulse) ending. */
    private lastActivity = 0;
    private onKey = (e: KeyboardEvent) => this.handleKey(e, true);
    private onKeyUp = (e: KeyboardEvent) => this.handleKey(e, false);
    private onUseEvt = () => { this.lastActivity = this.clock; if (this.explore.active || this.vcrActive) this.explore.onUse?.(); };
    private handleKey(e: KeyboardEvent, down: boolean) {
        const k = e.key.toLowerCase();
        this.lastActivity = this.clock;
        if (down) {
            this.keys.add(k);
            if (k === 'e' && this.explore.active) this.explore.onUse?.();
            if (k === 'escape') store.patch({ paused: !store.get().paused });
        } else this.keys.delete(k);
    }
    constructor(host: HTMLElement, private episode: EpisodeDef, private onEnd: (id: string) => void, private onError: (error: unknown) => void = console.warn, private opts: EngineOptions = {}) {
        this.host = host;
        const w = host.clientWidth || 360;
        const h = host.clientHeight || 640;
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        this.renderer.setSize(w, h);
        this.renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;touch-action:none;';
        host.appendChild(this.renderer.domElement);
        this.rig = new BodycamRig(w / h);
        this.vhs = new VhsPass(this.renderer, Math.floor(w * this.renderer.getPixelRatio()), Math.floor(h * this.renderer.getPixelRatio()));
        this.audio = new CinemaAudio();
        attachClipAudio(this.audio.master);
        void this.audio.ctx.resume().catch(() => {});
        const env: Env = {
            scene: this.scene,
            rig: this.rig,
            audio: this.audio,
            dir: this.dir,
            fx: this.fx,
            onFrame: this.frameCbs,
            say: (who, line, opts) => this.say(who, line, opts),
            title: (text, secs = 6) => {
                const revision = ++this.titleRevision;
                store.patch({ title: text });
                this.dir.atAbsolute(this.dir.time + secs, () => {
                    if (revision === this.titleRevision) store.patch({ title: '' });
                });
            },
            glitch: (s, secs = 0.4) => {
                this.glitchS = s;
                this.glitchT = secs;
                if (!store.get().reducedMotion) scareHaptic(s);
            },
            finish: () => this.finish(),
            explore: this.explore,
            idleSeconds: () => this.clock - this.lastActivity,
        };
        this.env = env;
        try {
            this.dir.speed = episode.speed ?? 1;
            episode.build?.(env);
            if (opts.endAt !== undefined) {
                const t = opts.endAt;
                this.dir.tween(t - 3, 3, (p) => (this.fx.fade = Math.max(this.fx.fade, smoothStep(p))));
                this.dir.atAbsolute(t, () => this.finish());
            }
            this.look = new LookLayer(this.scene, this.rig.camera, episode.id, this.renderer);
        } catch (error) {
            // A failed build must not leave a canvas, audio context or scene behind.
            this.dispose();
            throw error;
        }
        const el = this.renderer.domElement;
        el.addEventListener('pointerdown', this.onDown);
        window.addEventListener('pointermove', this.onMove);
        window.addEventListener('pointerup', this.onUp);
        window.addEventListener('resize', this.onResize);
        window.addEventListener('keydown', this.onKey);
        window.addEventListener('keyup', this.onKeyUp);
        window.addEventListener('sd-use', this.onUseEvt);
        if (opts.freeRoam) store.patch({ roam: true });
        this.unsub = store.subscribe(() => this.syncPause());
        this.syncPause();
        (window as unknown as { __sd_cine?: unknown }).__sd_cine = this;
        track('episode_started', { episode: episode.id });
        const chapterIndex = EPISODES.findIndex((e) => e.id === episode.id);
        if (chapterIndex >= 0) funnel(chapterIndex + 1, `start_${episode.id}`);
        store.patch({ subtitle: '', title: '', ended: false, pulseTriggered: false });
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.loop);
    }
    private say(who: string, line: string, opts: { pitch?: number; rate?: number; volume?: number } = {}) {
        const dur = 1.2 + line.length * 0.07;
        const prefix = who === 'YOU' ? '' : `${who}: `;
        store.patch({ subtitle: prefix + line });
        const until = this.dir.time + dur;
        this.subEnd = until;
        this.dir.atAbsolute(until, () => {
            if (this.subEnd <= this.dir.time + 0.01) store.patch({ subtitle: '' });
        });
        // Captions only: no synthesized voice playback. Opts are kept for call-site compatibility.
        void opts;
    }
    /** Walk with WASD/arrows (or the on-screen stick), look with drag. Collides with walls. */
    private stepExplore(dt: number) {
        const ex = this.explore;
        let mx = 0, mz = 0;
        if (this.keys.has('w') || this.keys.has('arrowup')) mz -= 1;
        if (this.keys.has('s') || this.keys.has('arrowdown')) mz += 1;
        if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
        if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
        this.rig.walk = mx || mz ? 1 : 0;
        if (!mx && !mz) return;
        const len = Math.hypot(mx, mz);
        const yaw = this.rig.yaw;
        const dx = ((mx * Math.cos(yaw)) + (mz * Math.sin(yaw))) / len * ex.speed * dt;
        const dz = ((-mx * Math.sin(yaw)) + (mz * Math.cos(yaw))) / len * ex.speed * dt;
        const pos = this.rig.pos;
        const tryX = pos.x + dx, tryZ = pos.z + dz;
        const inside = (x: number, z: number) => !ex.bounds || (x >= ex.bounds.minX && x <= ex.bounds.maxX && z >= ex.bounds.minZ && z <= ex.bounds.maxZ);
        const blocked = (x: number, z: number) => ex.collide?.(x, z) ?? false;
        if (inside(tryX, pos.z) && !blocked(tryX, pos.z)) pos.x = tryX;
        if (inside(pos.x, tryZ) && !blocked(pos.x, tryZ)) pos.z = tryZ;
    }

    /** Free roam: the scripted rail goes on playing; the player's own offset and view are layered on top and tethered to it. */
    private stepFreeRoam(dt: number) {
        const rig = this.rig, fr = this.fr, ex = this.explore;
        // prologue: the plane crash plays as a recording; the beach after it is the player's to walk
        if (this.opts.holdAtCamp && this.dir.time < PROLOGUE_BEACH_START) { fr.init = false; fr.out.set(NaN, 0, 0); return; }
        if (!fr.init) { fr.init = true; fr.yaw = rig.yaw; fr.pitch = rig.pitch; fr.rail.copy(rig.pos); fr.off.set(0, 0, 0); }
        // prologue hold: let the player roam the beach and camp; the radio beat waits for them
        if (this.opts.holdAtCamp && this.dir.time > PROLOGUE_BEACH_START + 34.9 && !this.holdDone) {
            this.holdT += dt;
            this.dir.time = PROLOGUE_BEACH_START + 34.9;
            const dx = rig.pos.x - CAMP_X, dz = rig.pos.z - CAMP_Z;
            if (Math.hypot(dx, dz) < 5 || this.holdT > 150) {
                this.holdDone = true; ex.active = false;
                // the scripted beats take over from wherever the player is standing
                fr.rail.copy(rig.pos); fr.off.set(0, 0, 0);
            }
        }
        if (!rig.pos.equals(fr.out)) fr.rail.copy(rig.pos); // the scene moved the rail this frame
        let mx = 0, mz = 0;
        if (this.keys.has('w') || this.keys.has('arrowup')) mz -= 1;
        if (this.keys.has('s') || this.keys.has('arrowdown')) mz += 1;
        if (this.keys.has('a') || this.keys.has('arrowleft')) mx -= 1;
        if (this.keys.has('d') || this.keys.has('arrowright')) mx += 1;
        const stick = store.get().moveStick;
        if (stick && (Math.abs(stick.x) > 0.1 || Math.abs(stick.y) > 0.1)) { mx += stick.x; mz += stick.y; }
        const len = Math.hypot(mx, mz);
        const walking = len > 0.05;
        if (walking) {
            const k = Math.min(1, 1 / len);
            const sp = (this.keys.has('shift') ? 4.2 : 2.6) * dt;
            const dx = (mx * Math.cos(fr.yaw) + mz * Math.sin(fr.yaw)) * k * sp;
            const dz = (-mx * Math.sin(fr.yaw) + mz * Math.cos(fr.yaw)) * k * sp;
            const tryOff = (ox: number, oz: number) => {
                const x = fr.rail.x + ox, z = fr.rail.z + oz;
                if (ex.bounds && (x < ex.bounds.minX || x > ex.bounds.maxX || z < ex.bounds.minZ || z > ex.bounds.maxZ)) return false;
                return !(ex.collide?.(x, z));
            };
            if (tryOff(fr.off.x + dx, fr.off.z)) fr.off.x += dx;
            if (tryOff(fr.off.x, fr.off.z + dz)) fr.off.z += dz;
        }
        // the tether: the recording drags you on if you fall too far behind it
        const R = ex.active ? 60 : 9;
        const d = Math.hypot(fr.off.x, fr.off.z);
        if (d > R) { fr.off.x *= R / d; fr.off.z *= R / d; }
        rig.pos.set(fr.rail.x + fr.off.x, fr.rail.y, fr.rail.z + fr.off.z);
        fr.out.copy(rig.pos);
        rig.yaw = fr.yaw; rig.pitch = fr.pitch;
        rig.walk = walking ? 1 : 0;
        rig.lookFreedom = 0;
    }
    private holdDone = false;

    /** The chapter is over: the player is in a living room with the tape and the VCR. */
    private enterVcr() {
        this.vcrStarted = true;
        this.vcrActive = true;
        store.patch({ roam: true });
        const env = this.env!;
        this.dir.clear();
        this.frameCbs.length = 0;
        this.explore.active = false; this.explore.onUse = null; this.explore.collide = null; this.explore.bounds = null;
        this.fx.fade = 1; this.fx.corr = 0.12; this.fx.tear = 0; this.fx.fovKick = 0;
        this.rig.roll = 0; this.rig.shake = 0; this.rig.fovKick = 0;
        this.scene.children.forEach((n) => { n.visible = false; });
        this.scene.fog = null;
        this.holdT = 0;
        buildVcrRoom(env, this.opts.tapeNo ?? 1, () => {
            this.vcrActive = false;
            this.dir.atAbsolute(this.dir.time + 0.01, () => this.finish());
        });
        this.fr.yaw = this.rig.yaw; this.fr.pitch = this.rig.pitch;
    }
    private env: Env | null = null;
    private onDown = (e: PointerEvent) => {
        if (this.paused || this.finished) return;
        this.lastActivity = this.clock;
        this.rig.dragStart();
        this.lastPtr = { x: e.clientX, y: e.clientY };
    };
    private onMove = (e: PointerEvent) => {
        if (this.paused || this.finished || !this.lastPtr) return;
        this.lastActivity = this.clock;
        if ((this.opts.freeRoam && this.fr.init) || this.vcrActive) {
            this.fr.yaw -= (e.clientX - this.lastPtr.x) * 0.0045;
            this.fr.pitch = THREE.MathUtils.clamp(this.fr.pitch - (e.clientY - this.lastPtr.y) * 0.0045, -1.1, 1.1);
        } else this.rig.drag(e.clientX - this.lastPtr.x, e.clientY - this.lastPtr.y);
        this.lastPtr = { x: e.clientX, y: e.clientY };
    };
    private onUp = () => {
        this.rig.dragEnd();
        this.lastPtr = null;
    };
    private onResize = () => {
        const w = this.host.clientWidth;
        const h = this.host.clientHeight;
        if (!w || !h) return;
        this.renderer.setSize(w, h);
        const pr = this.renderer.getPixelRatio();
        this.vhs.setSize(Math.floor(w * pr), Math.floor(h * pr));
        this.rig.camera.aspect = w / h;
        this.rig.camera.updateProjectionMatrix();
    };
    private syncPause() {
        const p = store.get().paused;
        if (p === this.paused) return;
        this.paused = p;
        if (p) {
            this.onUp();
            this.audio.suspend();
            try { window.speechSynthesis.pause(); } catch { /* none */ }
        } else {
            this.audio.resume();
            try { window.speechSynthesis.resume(); } catch { /* none */ }
            this.last = performance.now();
        }
    }
    private finish() {
        if (this.disposed || this.finished) return;
        if (this.opts.vcr && !this.vcrStarted) { this.enterVcr(); return; }
        this.finished = true;
        // The hidden pulse hands off to its own survival epilogue; it is not a normal completion.
        if (store.get().pulseTriggered && this.episode.id === 'prologue') {
            track('episode_pulse_handoff', { episode: this.episode.id });
            this.onEnd('pulse');
            return;
        }
        const s = store.get();
        const completed = completeEpisode(this.episode.id, s.completed);
        store.patch({ completed, pendingBreak: true });
        saveProgress();
        track('episode_completed', { episode: this.episode.id });
        haptic('success', 0);
        // Platform progress hooks fire only for genuine new progress, never for a replay.
        if (completed.length > s.completed.length) {
            const loops = store.get().loopCount;
            void submitCampaignStats(completed.length, loops, this.episode.id);
            void submitSurvivalScore(completed.length, loops, this.clock);
            const next = EPISODES.find((e) => e.id === nextEpisode(completed));
            if (next) {
                void scheduleTapeReminder({
                    title: 'SEVEN DAYS',
                    body: `${next.label}: ${next.subtitle}. The tape is still recording.`,
                    delayHours: store.get().liveops.reminderDelayHours,
                });
            }
        }
        this.onEnd(this.episode.id);
    }
    private loop = () => {
        if (this.disposed || this.finished) return;
        try {
            this.raf = requestAnimationFrame(this.loop);
            const now = performance.now();
            if (this.paused) {
                this.last = now;
                return;
            }
            const dt = Math.min(0.05, (now - this.last) / 1000);
            this.last = now;
            this.clock += dt;
            this.dir.update(dt);
            if (this.disposed || this.finished) return;
            for (const cb of this.frameCbs) cb(dt, this.clock);
            // glitch burst decay
            if (this.glitchT > 0) {
                this.glitchT -= dt;
                this.fx.tear = this.glitchS * (0.5 + 0.5 * Math.random());
            } else this.fx.tear = 0;
            // heavy corruption starts damaging the world itself
            const wobble = this.fx.corr > 0.85 ? Math.sin(this.clock * 40) * 3 : 0;
            const kick = this.rig.fovKick;
            this.rig.fovKick = store.get().reducedMotion ? 0 : kick + wobble;
            if (this.vcrActive) this.stepExplore(dt);
            else if (this.opts.freeRoam) this.stepFreeRoam(dt);
            else if (this.explore.active) this.stepExplore(dt);
            this.rig.update(dt, store.get().reducedMotion);
            this.rig.fovKick = kick;
            const tc = Math.floor(this.dir.time);
            if (tc !== this.lastTc) {
                this.lastTc = tc;
                const m = String(Math.floor(tc / 60)).padStart(2, '0');
                const sec = String(tc % 60).padStart(2, '0');
                store.patch({ timecode: `00:${m}:${sec}` });
            }
            const look = this.look!;
            look.update(dt, this.clock);
            tickCreatureSkins(this.clock);
            this.vhs.render(this.renderer, this.scene, this.rig.camera, this.clock, this.fx, look.look);
            clipFrame();
        } catch (error) {
            this.dispose();
            this.onError(error);
        }
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        this.unsub();
        const el = this.renderer.domElement;
        el.removeEventListener('pointerdown', this.onDown);
        window.removeEventListener('pointermove', this.onMove);
        window.removeEventListener('pointerup', this.onUp);
        window.removeEventListener('resize', this.onResize);
        window.removeEventListener('keydown', this.onKey);
        window.removeEventListener('keyup', this.onKeyUp);
        window.removeEventListener('sd-use', this.onUseEvt);
        store.patch({ roam: false, useLabel: '', moveStick: undefined });
        try { window.speechSynthesis.cancel(); } catch { /* none */ }
        void stopClip(); // a clip in progress is saved, not lost, when the chapter ends or the player leaves
        this.audio.dispose();
        this.vhs.dispose();
        this.look?.dispose();
        const textures = new Set<THREE.Texture>();
        const releaseMaterial = (material: THREE.Material) => {
            const map = (material as THREE.Material & { map?: THREE.Texture | null }).map;
            if (map && !textures.has(map)) { textures.add(map); map.dispose(); }
            material.dispose();
        };
        this.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            m.geometry?.dispose?.();
            const mat = m.material as THREE.Material | THREE.Material[] | undefined;
            if (Array.isArray(mat)) mat.forEach(releaseMaterial);
            else if (mat) releaseMaterial(mat);
        });
        this.renderer.dispose();
        el.remove();
        store.patch({ subtitle: '', title: '' });
    }
}
