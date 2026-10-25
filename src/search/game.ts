import * as THREE from 'three';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { Sfx } from './audio.ts';
import { kvGet, kvSet, kvRemove } from './kv.ts';
import { buildCleaverback, type CleaverbackRig } from './cleaverback.ts';
import { buildBunker, type Bunker } from './bunker.ts';
import { Day1, type D1Ctx } from './day1.ts';
import { Day2 } from './day2.ts';
import { Day3 } from './day3.ts';
import { Day4 } from './day4.ts';
import { Day5 } from './day5.ts';
import { Day6 } from './day6.ts';
import { Day7 } from './day7.ts';
import { Passages, type PassageKind } from './passages.ts';
import { playTape } from './tapes.ts';
import { BeachDog } from './beachDog.ts';
import { Boat, BOAT_X } from './boat.ts';
import { placeModel } from './models.ts';
import { Gauntlet, GAUNTLET_END_Z } from './gauntlet.ts';
import { buildSurvivor, type SurvivorRig } from './survivor.ts';
import { buildWorld, glowSprite, pathX, CAMP_X, CAMP_Z, LOG_Z, BUN_X, BUN_DOOR_Z, X0, type World } from './world.ts';

export function track(name: string, props?: Record<string, unknown>): void {
    try {
        void Promise.resolve(RundotGameAPI.analytics.recordCustomEvent(name, props as never)).catch(() => undefined);
    } catch {
        /* running outside the RUN host */
    }
}

RundotGameAPI.lifecycles.onPause(() => track('game_paused'));
RundotGameAPI.lifecycles.onResume(() => track('game_resumed'));
RundotGameAPI.lifecycles.onSleep(() => track('game_sleep'));
RundotGameAPI.lifecycles.onQuit(() => track('game_quit'));

type GState = 'START' | 'PLAY' | 'CINE' | 'PAUSE' | 'CAPTURED' | 'END';
type CState = 'DORMANT' | 'CUT' | 'REVEAL' | 'ADVANCE' | 'CHARGE' | 'PAUSE' | 'WAIT';
type Mode = 'out' | 'in' | 'd1' | 'd2' | 'd3' | 'd4' | 'd5' | 'd6' | 'd7' | 'passage';

interface Interactable {
    id: string;
    label: string;
    pos: THREE.Vector3;
    range: number;
    mode: Mode;
    enabled: () => boolean;
    run: () => void;
    /** set once the player has used it, so the HUD waypoint moves on */
    used?: boolean;
}
interface Checkpoint { id: string; x: number; z: number; yaw: number; mode: Mode; chase: boolean }
interface Settings { reducedFlash: boolean; reducedMotion: boolean }

/** How the combined game drives the search side. Everything is optional: with no options the game behaves standalone. */
export interface SearchSnapshot {
    cp: Checkpoint; flash: boolean; clues: string[]; bolted: boolean;
    loopPass?: number; friendsAlive?: string[]; tapesFound?: number[]; tapesWatched?: number[]; pendingTape?: { n: number; next: string } | null;
}
export interface SearchOptions {
    /** 'new': boat opening. 'afterTape': come back from the recording and carry on. 'tapeDay': cycle-2 guided recording of one day. */
    autostart?: 'new' | 'afterTape' | 'tapeDay';
    /** Saved state to restore when autostart is 'afterTape'. */
    restore?: SearchSnapshot | null;
    /** For autostart 'tapeDay': which day (1-7) to play as a guided recording. */
    tapeDay?: number;
    /** The player put cassette n in the player: the journey takes over the screen. */
    onTape?: (n: number, snapshot: SearchSnapshot) => void;
    /** The living room is behind you: the journey continues on the other side. */
    onLoop?: (snapshot: SearchSnapshot) => void;
    /** Guided recording of a day has ended. */
    onTapeDayEnd?: () => void;
    /** The hidden dog ending: the player woke up. */
    onWake?: () => void;
}

export const SAVE_KEY = 'sevendays_prologue_v1';
export const SET_KEY = 'sevendays_settings_v1';
const COLORS: Record<string, string> = { PROTAGONIST: '#e8e8e8', SURVIVOR: '#ffb86b', GUIDE: '#ffb86b', BOATMAN: '#9fb8a0', MITZI: '#e8a0c0', ALAN: '#c8d0d8', SLOPPY: '#ffe14a', OLIVER: '#b8b8ff', SPLICEMASTER: '#ff6b6b', RADIO: '#ffd27a', SYSTEM: '#8fd0ff', CLEAVERBACK: '#ff9a4a' };

function loadSettings(): Settings {
    try {
        return { reducedFlash: false, reducedMotion: false, ...(JSON.parse(kvGet(SET_KEY) || '{}') as Partial<Settings>) };
    } catch {
        return { reducedFlash: false, reducedMotion: false };
    }
}

function el(tag: string, css: string, parent?: HTMLElement, text?: string): HTMLElement {
    const e = document.createElement(tag);
    e.style.cssText = css;
    if (text) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
}

/** Shortest signed angle from a to b. */
function angDiff(a: number, b: number): number {
    return ((((b - a + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2)) - Math.PI;
}

export class PrologueGame {
    private root: HTMLElement;
    private renderer: THREE.WebGLRenderer;
    private camera: THREE.PerspectiveCamera;
    private world: World;
    private bunker: Bunker;
    private day1!: Day1;
    private day2!: Day2;
    private day3!: Day3;
    private day4!: Day4;
    private day5!: Day5;
    private day6!: Day6;
    private day7!: Day7;
    private passages!: Passages;
    private gauntlet!: Gauntlet;
    private boat!: Boat;
    private boatStart = 0;
    private cabinOn = false;
    private cabinStress = 0.02;
    private tapesFound = new Set<number>();
    private tapesWatched = new Set<number>();
    private pendingTape: { n: number; next: string } | null = null;
    private survivor!: THREE.Group;
    private survivorParts!: SurvivorRig;
    private survivorState: 'camp' | 'follow' | 'grabbed' | 'gone' = 'camp';
    private survivorTalked = false;
    private survivorIt!: Interactable;
    private cutYaw0 = 0;
    private loopPass = 0;
    /** The friends still alive. Each day one can be lost; the rest carry on. */
    private friendsAlive: string[] = ['Alan', 'Sloppy', 'Mitzi', 'Oliver'];
    private d7Drone = 0.03;
    private finBtn: HTMLElement | null = null;
    private extraHint: string | null = null;
    private fistMat!: THREE.MeshStandardMaterial;
    private headOverride: number | null = null;
    private forceCrouch = false;
    private speedMul = 1;
    private sfx = new Sfx();
    private rig: CleaverbackRig;
    private raf = 0;
    private last = performance.now();
    private disposed = false;
    private settings = loadSettings();

    private state: GState = 'START';
    private clock = 0;
    private timers: { at: number; fn: () => void }[] = [];
    private keys = new Set<string>();
    private touchMove = new THREE.Vector2();
    private touchRun = false;
    private touchCrouch = false;
    private touchSeen = false;
    private touchHome: () => void = () => undefined;
    private invOpen = false;
    private compass!: HTMLElement;
    private compassEls: HTMLElement[] = [];
    private compassTarget!: HTMLElement;
    private compassDist!: HTMLElement;
    private wp!: HTMLElement;
    private invBody!: HTMLElement;
    private maxPR = 1;
    private pr = 1;
    private lowPower = false;
    private perfAcc = 0;
    private perfN = 0;
    private interactables: Interactable[] = [];
    private currentInteract: Interactable | null = null;

    // player
    private p = new THREE.Vector3(0, 0, 1.5);
    private vy = 0;
    private yaw = 0;
    private pitch = 0;
    private vel = new THREE.Vector2();
    private stamina = 100;
    private exhausted = false;
    private head = 1.6;
    private bobT = 0;
    private stepAcc = 0;
    private mode: Mode = 'out';
    private lockMove = false;
    private forcedLook: { x: number; z: number; until: number } | null = null;
    private pullT = -1;
    // chase cutaway (third-person shot after the creature appears)
    private cutT = -1;
    private cutZ0 = 0;
    private cutX0 = 0;
    private cutRun = 26;
    private runner!: THREE.Group;
    private runnerParts!: { legs: THREE.Group[]; arms: THREE.Group[]; head: THREE.Group };
    private tmpCam = new THREE.Camera();

    // story flags
    private hasFlashlight = false;
    private lightOn = false;
    private clues = new Set<string>();
    private scraped = false;
    private campArrived = false;
    // the quiet ending: sit with the dog on the opening beach long enough and you wake up
    private beachDog!: BeachDog;
    private dogIt!: Interactable;
    private dogSit = false;
    private dogT0 = 0;
    private dogEv = 0;
    private dogBeepT = 0;
    private dogWaking = false;
    private dogFaded = false;
    private revealed = false;
    private forkDone = false;
    private bolted = false;
    private powered = false;
    private hasTape = false;
    private tapeIn = false;
    private unplugged = false;
    private cp: Checkpoint = { id: 'beach', x: 0, z: 1.5, yaw: 0, mode: 'out', chase: false };

    // creature
    private cState: CState = 'DORMANT';
    private cTimer = 0;
    private cPauseIn = 10;
    private cThuds = 0;
    private cPhase = 0;
    private cScrapeT = 2;
    private cYaw = 0;
    private beatT = 0;

    // fx
    private rain: THREE.LineSegments;
    private spot: THREE.SpotLight;
    private hands = new THREE.Group();
    private flashMesh: THREE.Mesh;
    private lightningT = 12;
    private flashAmt = 0;
    private crtMode: 'off' | 'static' | 'face' | 'frozen' = 'off';
    private crtT = 0;
    private talk = 0;
    private shake = 0;
    private capT = 0;
    private recSeconds = 0;

    // dom
    private ui!: {
        sub: HTMLElement; prompt: HTMLElement; hint: HTMLElement; obj: HTMLElement; stam: HTMLElement; fade: HTMLElement;
        start: HTMLElement; pause: HTMLElement; end: HTMLElement; endText: HTMLElement; rec: HTMLElement; signal: HTMLElement; touch: HTMLElement; card: HTMLElement; inv: HTMLElement;
    };
    private subTimer = 0;
    private cleanup: (() => void)[] = [];

    constructor(container: HTMLElement, private onExit: () => void, private opts: SearchOptions = {}) {
        this.root = el('div', 'position:fixed;inset:0;z-index:50;background:#000;overflow:hidden;font-family:ui-monospace,Menlo,monospace;color:#fff;user-select:none;touch-action:none', container);
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        const nav = navigator as Navigator & { deviceMemory?: number };
        const weak = (nav.deviceMemory ?? 8) <= 4 || (navigator.hardwareConcurrency ?? 8) <= 4;
        const mobile = window.matchMedia('(pointer:coarse)').matches || window.matchMedia('(hover:none)').matches;
        this.lowPower = mobile || weak;
        this.maxPR = mobile ? (weak ? 0.75 : 1) : Math.min(window.devicePixelRatio, 1.5);
        this.pr = this.maxPR;
        this.renderer.setPixelRatio(this.pr);
        this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
        this.renderer.toneMappingExposure = 1.15;
        this.renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%';
        this.root.appendChild(this.renderer.domElement);

        this.world = buildWorld();
        this.bunker = buildBunker();
        const scene = this.world.scene;
        scene.add(this.bunker.group);
        this.camera = new THREE.PerspectiveCamera(75, 1, 0.05, 260);
        this.camera.rotation.order = 'YXZ';
        scene.add(this.camera);

        this.rig = buildCleaverback();
        this.rig.group.visible = false;
        scene.add(this.rig.group);
        this.buildRunner();

        this.spot = new THREE.SpotLight(0xfff3d6, 220, 50, 0.42, 0.5, 1.6);
        this.spot.position.set(0.2, -0.1, 0);
        this.spot.visible = false;
        this.camera.add(this.spot, this.spot.target);
        this.spot.target.position.set(0, 0, -6);

        // hands (sleeve, fist, torn wristband, flashlight)
        const sleeve = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.1, 0.55), new THREE.MeshStandardMaterial({ color: 0x3a4a3a, emissive: 0x0a110a }));
        sleeve.position.set(0.26, -0.28, -0.5);
        sleeve.rotation.set(0.15, 0.12, 0);
        const fist = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.08, 0.11), new THREE.MeshStandardMaterial({ color: 0xb58a74, emissive: 0x2a1a12 }));
        fist.position.set(0.25, -0.26, -0.82);
        this.fistMat = fist.material as THREE.MeshStandardMaterial;
        const band = new THREE.Mesh(new THREE.BoxGeometry(0.108, 0.03, 0.108), new THREE.MeshStandardMaterial({ color: 0xaa2222, emissive: 0x330000 }));
        band.position.set(0.255, -0.27, -0.72);
        this.flashMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.042, 0.22, 8), new THREE.MeshStandardMaterial({ color: 0x222222, metalness: 0.7, emissive: 0x111111 }));
        this.flashMesh.rotation.x = Math.PI / 2;
        this.flashMesh.position.set(0.25, -0.25, -0.92);
        this.flashMesh.visible = false;
        this.hands.add(sleeve, fist, band, this.flashMesh);
        this.camera.add(this.hands);

        // rain
        // Thin falling streaks. Large square points near the lens read as TV static.
        const N = 1100;
        const pos = new Float32Array(N * 6);
        for (let i = 0; i < N; i++) {
            const x = (Math.random() - 0.5) * 36, y = Math.random() * 18, z = (Math.random() - 0.5) * 36;
            pos.set([x, y, z, x + 0.03, y + 0.45, z], i * 6);
        }
        const rg = new THREE.BufferGeometry();
        rg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
        this.rain = new THREE.LineSegments(rg, new THREE.LineBasicMaterial({ color: 0x8fa4b8, transparent: true, opacity: 0.28, depthWrite: false }));
        this.rain.frustumCulled = false;
        if (this.lowPower) rg.setDrawRange(0, 500 * 2);
        scene.add(this.rain);

        // Industrial buildings rise beyond the fence, on the approach to the bunker.
        placeModel(this.world.outdoor, 'assets/industrial/Industrial_exterior_v2.glb', pathX(-215) + 46, -228, 34, -0.4);
        this.buildInteractables();
        this.buildChapters();
        this.passages = new Passages(this.makeCtx(), {
            found: (n) => { this.tapesFound.add(n); this.writeSave(); },
            play: (n, done) => {
                if (this.opts.onTape) { this.sfx.setMaster(0); this.writeSave(); this.opts.onTape(n, this.snapshot()); return; }
                playTape(n, { cycle: this.loopPass > 0 ? 2 : 1, root: this.root, sfx: this.sfx, reducedFlash: this.settings.reducedFlash, done });
            },
            finished: (n) => this.finishTape(n),
        });
        scene.add(this.passages.group);
        for (const it of this.passages.interactables) this.interactables.push({ ...it, mode: 'passage' });
        this.refreshHallwayCast();
        this.buildUi();
        this.survivorParts = buildSurvivor();
        this.survivor = this.survivorParts.group;
        this.survivor.position.set(CAMP_X + 3.4, 0, CAMP_Z + 1.8);
        this.world.outdoor.add(this.survivor);
        this.add('survivor', 'Talk to the survivor', CAMP_X + 3.4, 1.3, CAMP_Z + 1.8, 'out', () => this.talkSurvivor(), () => this.campArrived && !this.survivorTalked && this.survivorState === 'camp', 3.6);
        this.survivorIt = this.interactables[this.interactables.length - 1];
        this.boat = new Boat();
        this.beachDog = new BeachDog(this.world.outdoor);
        this.add('dog_sit', 'Sit down with the dog', 0, 0.7, 0, 'out', () => this.dogSitDown(), () => this.dogAvailable(), 3.4);
        this.dogIt = this.interactables[this.interactables.length - 1];
        this.world.scene.add(this.boat.group);
        this.gauntlet = new Gauntlet({
            parent: this.world.outdoor, p: this.p, rig: this.rig, sfx: this.sfx, root: this.root,
            say: (w, t, d) => this.say(w, t, d), track, objective: (t) => this.objective(t),
            checkpoint: () => this.checkpoint('chase', true), capture: () => this.capture(),
            shake: (v) => { this.shake = Math.max(this.shake, v); }, setHead: (h) => { this.headOverride = h; },
            jumpPhysics: () => this.jumpPhysics(), finished: (gap) => this.gauntletDone(gap),
            flash: () => {
                if (this.settings.reducedFlash) return;
                this.ui.fade.style.background = '#7a0000'; this.fadeTo(0.55, 0.05);
                this.after(0.15, () => { this.fadeTo(0, 0.35); this.after(0.45, () => { this.ui.fade.style.background = '#000'; }); });
            },
        });
        this.bindInput();
        this.resize();
        this.applyMode('out');
        this.placePlayer(this.cp);
        this.world.mapMesh.visible = true;
        this.raf = requestAnimationFrame(this.loop);
        (window as unknown as { __sd_search?: unknown }).__sd_search = this;
        if (this.opts.autostart === 'new') window.setTimeout(() => { if (!this.disposed && this.state === 'START') this.begin(false); }, 50);
        else if (this.opts.autostart === 'afterTape') window.setTimeout(() => { if (!this.disposed && this.state === 'START') this.beginAfterTape(); }, 50);
        else if (this.opts.autostart === 'tapeDay') window.setTimeout(() => { if (!this.disposed && this.state === 'START') this.beginTapeDay(this.opts.tapeDay ?? 1); }, 50);
        else if (navigator.webdriver) window.setTimeout(() => { if (!this.disposed && this.state === 'START') this.begin(false); }, 300);
    }

    private buildChapters(): void {
        this.day1 = new Day1(this.makeCtx()); this.day2 = new Day2(this.makeCtx());
        this.day3 = new Day3(this.makeCtx()); this.day4 = new Day4(this.makeCtx());
        this.day5 = new Day5(this.makeCtx()); this.day6 = new Day6(this.makeCtx()); this.day7 = new Day7(this.makeCtx());
        const chapters = [this.day1, this.day2, this.day3, this.day4, this.day5, this.day6, this.day7];
        chapters.forEach((day, i) => {
            this.world.scene.add(day.group);
            for (const it of day.interactables) this.interactables.push(Object.assign(Object.create(it), { mode: ('d' + (i + 1)) as Mode }));
        });
    }

    private refreshHallwayCast(): void {
        this.passages.setCast([{ name: 'Cleaverback', model: this.rig.group }, ...this.day1.echoes(), ...this.day3.echoes(), ...this.day4.echoes(), ...this.day5.echoes(), this.day6.echo(), ...this.day7.echoes()]);
    }

    /** True once the player has reached the living room and started the second pass through the seven days.
     *  Day levels can read this to change how the friends behave (hostile on the second pass). */
    isSecondCycle(): boolean {
        return this.loopPass > 0;
    }

    /** Is this friend still in the group? */
    isFriendAlive(name: string): boolean {
        return this.friendsAlive.includes(name);
    }

    /** A friend dies: removed from the group for this and every later day. Saved with progress. */
    killFriend(name: string): void {
        if (!this.friendsAlive.includes(name)) return;
        this.friendsAlive = this.friendsAlive.filter((n) => n !== name);
        track('friend_lost', { friend: name, remaining: this.friendsAlive.length });
        this.writeSave();
    }

    /** After each day the player finds a tape and plays it before the next chapter begins. */
    private interceptTape(id: string): boolean {
        const after: Record<string, number> = { d2: 1, d3: 2, d3home: 3, d5: 4, d6: 5, d7: 6, home_or_hospital: 7 };
        const n = after[id];
        // Each tape plays once per pass: guided the first time round, explorable on the second.
        if (!n || this.tapesWatched.has(n + (this.loopPass > 0 ? 100 : 0)) || (id === 'home_or_hospital' && this.loopPass > 0)) return false;
        this.pendingTape = { n, next: id };
        this.writeSave();
        track('tape_scene_started', { tape: n });
        this.startPassage('tape');
        return true;
    }

    private finishTape(n: number): void {
        this.tapesFound.add(n);
        this.tapesWatched.add(n + (this.loopPass > 0 ? 100 : 0));
        const next = this.pendingTape?.next;
        this.pendingTape = null;
        this.writeSave();
        track('tape_completed', { tape: n });
        if (next) this.makeCtx().nextChapter(next);
        else this.onExit();
    }

    private startPassage(kind: PassageKind): void {
        this.gauntlet.stop();
        this.timers = []; this.cutT = -1; this.pullT = -1; this.runner.visible = false; this.hideCreature();
        this.currentInteract = null; this.extraHint = null; this.ui.signal.style.opacity = '0';
        this.finaleClear(); this.state = 'CINE'; this.lockMove = true; this.vel.set(0, 0); this.fadeTo(1, 0.6);
        this.after(0.7, () => { this.applyMode('passage'); this.passages.begin(kind, this.pendingTape?.n); });
    }

    private startReturnLoop(): void {
        this.timers = []; this.loopPass = 1; this.finaleClear(); this.ui.end.style.display = 'none';
        this.state = 'CINE'; this.lockMove = true; this.fadeTo(1, 0.4);
        this.after(0.5, () => {
            this.day7.releaseOverlay();
            this.interactables = this.interactables.filter((it) => it.mode === 'out' || it.mode === 'in' || it.mode === 'passage');
            const seen = new Set<THREE.Texture | THREE.Material | THREE.BufferGeometry>();
            for (const day of [this.day1, this.day2, this.day3, this.day4, this.day5, this.day6, this.day7]) {
                day.group.removeFromParent();
                day.group.traverse((o) => {
                    if (!(o instanceof THREE.Mesh)) return;
                    if (!seen.has(o.geometry)) { seen.add(o.geometry); o.geometry.dispose(); }
                    for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
                        if (seen.has(mat)) continue; seen.add(mat);
                        for (const value of Object.values(mat)) if (value instanceof THREE.Texture && !seen.has(value)) { seen.add(value); value.dispose(); }
                        mat.dispose();
                    }
                });
            }
            this.buildChapters(); this.refreshHallwayCast(); this.stamina = 100; this.speedMul = 1;
            this.forceCrouch = false; this.headOverride = null; this.hands.visible = true; this.vy = 0;
            track('story_return_loop_started'); this.startDay1();
        });
    }

    // ───────────────────────── UI ─────────────────────────
    private buildUi(): void {
        const r = this.root;
        const vhs = el('div', 'position:absolute;inset:0;pointer-events:none;background:repeating-linear-gradient(0deg,rgba(0,0,0,0.22) 0 1px,transparent 1px 3px),radial-gradient(ellipse at center,transparent 55%,rgba(0,0,0,0.65) 100%)', r);
        vhs.style.mixBlendMode = 'multiply';
        // Clean dark scan lines only: no full-screen white-noise layer.
        const rec = el('div', 'position:absolute;top:12px;right:14px;font-size:14px;color:#ff4040;text-shadow:0 0 6px #000;pointer-events:none', r);
        const obj = el('div', 'position:absolute;top:38px;left:14px;max-width:55%;font-size:13px;color:#cfe3ff;text-shadow:0 0 6px #000;pointer-events:none', r);
        const stamWrap = el('div', 'position:absolute;left:50%;transform:translateX(-50%);bottom:calc(10px + env(safe-area-inset-bottom,0px));width:140px;height:5px;background:rgba(255,255,255,0.15);pointer-events:none', r);
        const stam = el('div', 'height:100%;width:100%;background:#9fd8ff', stamWrap);
        const sub = el('div', 'position:absolute;left:50%;bottom:11%;transform:translateX(-50%);width:min(92%,760px);text-align:center;font-size:clamp(14px,2.4vw,20px);line-height:1.35;text-shadow:0 0 4px #000,0 0 8px #000;pointer-events:none', r);
        const prompt = el('div', 'position:absolute;left:50%;top:60%;transform:translateX(-50%);padding:6px 14px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.35);border-radius:6px;font-size:15px;display:none;pointer-events:none', r);
        const hint = el('div', 'position:absolute;left:50%;top:70%;transform:translateX(-50%);font-size:13px;color:#ffd27a;display:none;pointer-events:none;text-shadow:0 0 4px #000', r);
        const signal = el('div', 'position:absolute;inset:0;background:#000;opacity:0;display:flex;align-items:center;justify-content:center;font-size:28px;letter-spacing:6px;color:#ff4040;pointer-events:none;transition:opacity .4s', r, 'SIGNAL LOST');
        const fade = el('div', 'position:absolute;inset:0;background:#000;opacity:1;pointer-events:none;transition:opacity 1.5s', r);

        this.compass = el('div', 'position:absolute;top:8px;left:50%;transform:translateX(-50%);width:min(260px,52%);height:24px;overflow:hidden;border-bottom:1px solid rgba(255,255,255,0.35);pointer-events:none;font-size:13px;text-shadow:0 0 4px #000', r);
        for (const l of ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE']) this.compassEls.push(el('div', 'position:absolute;top:2px;width:30px;margin-left:-15px;text-align:center;color:#ddd', this.compass, l));
        this.compassTarget = el('div', 'position:absolute;top:0;width:30px;margin-left:-15px;text-align:center;color:#ffd24a;font-size:17px', this.compass, '◆');
        this.compassDist = el('div', 'position:absolute;top:30px;left:50%;transform:translateX(-50%);font-size:12px;color:#ffd24a;text-shadow:0 0 4px #000;pointer-events:none;white-space:nowrap', r);
        this.wp = el('div', 'position:absolute;display:none;transform:translate(-50%,-50%);text-align:center;color:#ffd24a;font-size:12px;text-shadow:0 0 4px #000;pointer-events:none;line-height:1.1;white-space:nowrap', r);
        const card = el('div', 'position:absolute;inset:0;display:none;flex-direction:column;align-items:center;justify-content:center;text-align:center;font-size:clamp(18px,3.6vw,34px);letter-spacing:4px;pointer-events:none;text-shadow:0 0 14px #fff;gap:10px;padding:20px', r);
        const touch = this.buildTouch(r);

        const start = el('div', 'position:absolute;inset:0;background:rgba(0,0,0,0.88);display:flex;flex-direction:column;align-items:center;justify-content:safe center;gap:12px;padding:20px;text-align:center;overflow-y:auto', r);
        el('div', 'font-size:clamp(28px,6vw,52px);letter-spacing:8px;font-weight:bold', start, 'SEVEN DAYS');
        el('div', 'font-size:14px;color:#9ab;letter-spacing:3px', start, 'PROLOGUE — THE LAST NIGHT ON THE ISLAND');
        const mkBtn = (txt: string, fn: () => void) => {
            const b = el('button', 'padding:12px 34px;min-height:48px;font:inherit;font-size:16px;background:#d8d8d8;color:#000;border:0;border-radius:6px;cursor:pointer;min-width:220px', start, txt);
            b.addEventListener('click', fn);
            return b;
        };
        mkBtn('NEW GAME', () => this.begin(false));
        // Testing: jump straight to any day. Each starts that day's own opening.
        const pick = el('div', 'display:flex;flex-wrap:wrap;gap:6px;justify-content:center;max-width:520px', start);
        el('div', 'width:100%;font-size:12px;color:#889;letter-spacing:2px', pick, 'TEST A DAY');
        const dayBtn = (label: string, fn: () => void, alive: string[]) => {
            const b = el('button', 'padding:8px 12px;min-height:40px;font:inherit;font-size:13px;background:#444;color:#fff;border:1px solid #666;border-radius:6px;cursor:pointer', pick, label);
            b.addEventListener('click', () => { track('day_select_clicked', { day: label }); this.startTestDay(fn, alive); });
        };
        // Each test day starts with only the friends still alive at that point in the story.
        dayBtn('DAY 1 · Mall', () => this.startDay1(), ['Alan', 'Sloppy', 'Mitzi', 'Oliver']);
        dayBtn('DAY 2 · Warehouse', () => this.startDay2(), ['Alan', 'Sloppy', 'Mitzi', 'Oliver']);
        dayBtn('DAY 3 · Render', () => this.startDay3(), ['Alan', 'Sloppy', 'Mitzi']);
        dayBtn('DAY 4 · Night', () => this.startDay4(), ['Alan', 'Sloppy']);
        dayBtn('DAY 5', () => this.startDay5(), ['Alan', 'Sloppy']);
        dayBtn('DAY 6', () => this.startDay6(), ['Sloppy']);
        dayBtn('DAY 7', () => this.startDay7(), ['Sloppy']);
        const saved = this.readSave();
        if (saved) mkBtn('CONTINUE (' + saved.cp.id.toUpperCase() + ')', () => this.begin(true));
        const opts = el('div', 'display:flex;flex-direction:column;gap:6px;font-size:13px;color:#ccc;margin-top:8px', start);
        const chk = (label: string, key: keyof Settings) => {
            const l = el('label', 'display:flex;gap:8px;align-items:center;cursor:pointer', opts);
            const c = document.createElement('input');
            c.type = 'checkbox';
            c.checked = this.settings[key];
            c.addEventListener('change', () => {
                this.settings[key] = c.checked;
                kvSet(SET_KEY, JSON.stringify(this.settings));
                track('settings_changed', { key, value: c.checked });
            });
            l.appendChild(c);
            l.appendChild(document.createTextNode(label));
        };
        chk('Reduced flashes (no lightning)', 'reducedFlash');
        chk('Reduced camera motion (no bob / shake)', 'reducedMotion');
        el('div', 'font-size:12px;color:#889;max-width:460px;line-height:1.5;margin-top:6px', start,
            'WASD move · Mouse look · Shift sprint · C crouch · Space jump/vault · E interact · F flashlight · Esc pause. Touch: left side move, right side look. Dialogue is subtitle-only (no voice acting yet).');
        mkBtn('BACK', () => { track('menu_back_clicked'); this.onExit(); }).style.background = '#555';
        start.lastElementChild!.setAttribute('style', start.lastElementChild!.getAttribute('style') + ';color:#fff');

        const pause = el('div', 'position:absolute;inset:0;background:rgba(0,0,0,0.8);display:none;flex-direction:column;align-items:center;justify-content:center;gap:12px', r);
        el('div', 'font-size:28px;letter-spacing:6px', pause, 'PAUSED');
        const pb = (txt: string, fn: () => void) => {
            const b = el('button', 'padding:12px 30px;min-height:48px;font:inherit;font-size:16px;background:#d8d8d8;color:#000;border:0;border-radius:6px;min-width:240px;cursor:pointer', pause, txt);
            b.addEventListener('click', fn);
        };
        pb('RESUME', () => { track('pause_resume_clicked'); this.resume(); });
        pb('RESTART FROM CHECKPOINT', () => { track('pause_restart_clicked', { checkpoint: this.cp.id }); this.respawn(); this.resume(); });
        pb('QUIT TO MENU', () => { track('pause_quit_clicked'); this.onExit(); });

        const inv = el('div', 'position:absolute;inset:0;background:rgba(0,0,0,0.88);display:none;flex-direction:column;align-items:center;justify-content:safe center;gap:12px;padding:20px;text-align:center;overflow-y:auto', r);
        el('div', 'font-size:24px;letter-spacing:5px', inv, 'OBJECTIVES');
        this.invBody = el('div', 'font-size:14px;line-height:1.7;max-width:480px;color:#dde', inv);
        const ib = el('button', 'padding:12px 30px;min-height:48px;font:inherit;font-size:16px;background:#d8d8d8;color:#000;border:0;border-radius:6px;cursor:pointer;min-width:200px', inv, 'CLOSE');
        ib.addEventListener('click', () => this.toggleInventory());

        const end = el('div', 'position:absolute;inset:0;background:#000;display:none;flex-direction:column;align-items:center;justify-content:center;gap:16px;text-align:center;padding:20px', r);
        const endText = el('div', 'font-size:clamp(20px,4vw,34px);letter-spacing:4px', end);
        const eb = el('button', 'display:none;padding:12px 30px;min-height:48px;font:inherit;font-size:16px;background:#d8d8d8;color:#000;border:0;border-radius:6px;cursor:pointer', end, 'BACK TO MENU');
        eb.addEventListener('click', () => { track('prologue_end_menu_clicked'); this.onExit(); });
        (endText as HTMLElement & { _btn?: HTMLElement })._btn = eb;

        this.ui = { sub, prompt, hint, obj, stam, fade, start, pause, end, endText, rec, signal, touch, card, inv };
        if (this.isTouch()) this.showTouch();
    }

    private say(who: string, text: string, dur = 3.2): void {
        const c = COLORS[who] ?? '#fff';
        this.ui.sub.innerHTML = '';
        const tag = el('span', `color:${c};font-weight:bold`, this.ui.sub, who + ': ');
        tag.setAttribute('aria-hidden', 'true');
        el('span', 'color:#fff', this.ui.sub, text);
        this.subTimer = dur;
        track('dialogue_line', { speaker: who });
    }

    private objective(t: string): void {
        this.ui.obj.textContent = t ? 'OBJECTIVE: ' + t : '';
    }

    private after(t: number, fn: () => void): void {
        this.timers.push({ at: this.clock + t, fn });
    }

    private fadeTo(opacity: number, secs: number): void {
        this.ui.fade.style.transition = `opacity ${secs}s`;
        this.ui.fade.style.opacity = String(opacity);
    }

    // ───────────────────────── input ─────────────────────────
    private bindInput(): void {
        const on = (t: Window | Document | HTMLElement, ev: string, fn: (e: never) => void) => {
            t.addEventListener(ev, fn as EventListener);
            this.cleanup.push(() => t.removeEventListener(ev, fn as EventListener));
        };
        on(window, 'resize', () => { this.resize(); this.touchHome(); });
        on(window, 'keydown', (e: KeyboardEvent) => {
            this.keys.add(e.code);
            if (this.gauntlet?.active) {
                if (e.code === 'KeyC' || e.code === 'ArrowDown' || e.code === 'KeyS' || e.code === 'ControlLeft') this.gauntlet.press('duck');
                if (e.code === 'KeyW' || e.code === 'ArrowUp') this.jump();
            }
            if (e.code === 'KeyE') this.interact();
            if (e.code === 'KeyF') this.toggleLight();
            if (e.code === 'Tab') { e.preventDefault(); this.toggleInventory(); }
            if (e.code === 'Space') { e.preventDefault(); this.jump(); }
        });
        on(window, 'keyup', (e: KeyboardEvent) => this.keys.delete(e.code));
        on(document, 'mousemove', (e: MouseEvent) => {
            if (document.pointerLockElement !== this.renderer.domElement) return;
            this.look(e.movementX * 0.0022, e.movementY * 0.0022);
        });
        on(document, 'pointerlockchange', () => {
            if (!document.pointerLockElement && this.state === 'PLAY' && !this.isTouch()) this.pauseGame();
        });
        on(this.renderer.domElement, 'click', () => {
            if ((this.state === 'PLAY' || this.state === 'CINE') && !this.isTouch() && !document.pointerLockElement) void this.renderer.domElement.requestPointerLock();
        });
        on(window, 'touchstart', () => { if (!this.touchSeen) { this.touchSeen = true; this.showTouch(); } });
        on(document, 'visibilitychange', () => { if (document.hidden && this.state === 'PLAY') this.pauseGame(); });
    }

    private makeCtx(): D1Ctx {
        return {
            camera: this.camera, sfx: this.sfx, p: this.p, vel: this.vel,
            say: (w, t, d) => this.say(w, t, d), objective: (t) => this.objective(t), after: (t, fn) => this.after(t, fn),
            fadeTo: (o, s) => this.fadeTo(o, s), card: (l, ms) => this.card(l, ms),
            checkpoint: (id) => this.checkpoint(id), capture: () => this.capture(), track,
            getYaw: () => this.yaw, setYaw: (y) => { this.yaw = y; }, setPitch: (p) => { this.pitch = p; },
            lock: (b) => { if (this.state === 'PLAY' || this.state === 'CINE') { this.lockMove = b; this.state = b ? 'CINE' : 'PLAY'; } },
            setHead: (h) => { this.headOverride = h; }, setForceCrouch: (b) => { this.forceCrouch = b; }, setSpeedMul: (m) => { this.speedMul = m; },
            isCrouching: () => this.keys.has('KeyC') || this.keys.has('ControlLeft') || this.forceCrouch || this.touchCrouch,
            isSecondCycle: () => this.isSecondCycle(),
            isFriendAlive: (n) => this.isFriendAlive(n),
            killFriend: (n) => this.killFriend(n),
            setHandColor: (col) => { this.fistMat.color.set(col ?? 0xb58a74); },
            setAmbient: (v) => { (this.world.scene.getObjectByName('hemi') as THREE.HemisphereLight).intensity = v; },
            giveFlashlight: () => {
                if (!this.hasFlashlight) { this.hasFlashlight = true; this.world.flashlightMesh.visible = false; this.flashMesh.visible = true; }
                this.lightOn = true;
                this.spot.visible = true;
            },
            resetRec: () => { this.recSeconds = 0; },
            endChapter: (lines, note) => this.endCard(lines, true, note),
            nextChapter: (id) => {
                if (this.tapeMode) { if (id !== 'd7_core_return' && id !== 'hospital_echo') { this.endTapeDay(); return; } }
                if (this.interceptTape(id)) return;
                if (id === 'd3home') { this.startPassage('home3'); return; }
                if (id === 'stones_hall') { this.startPassage('hall'); return; }
                if (id === 'hospital_echo') { this.startPassage('hospital_echo'); return; }
                if (id === 'hospital_death') { this.startPassage('hospital_death'); return; }
                if (id === 'd7_core_return') { this.timers = []; this.applyMode('d7'); this.day7.resumeArrival(); return; }
                if (id === 'home_or_hospital') {
                    if (this.loopPass > 0) { this.startPassage('hospital_death'); }
                    else { this.day7.returnHome(); }
                    return;
                }
                if (id === 'return_seven_days') { if (this.opts.onLoop) { this.writeSave(); this.opts.onLoop(this.snapshot()); } else this.startReturnLoop(); return; }
                if (id === 'd2') this.startDay2(); if (id === 'd3') this.startDay3(); if (id === 'd4') this.startDay4(); if (id === 'd5') this.startDay5(); if (id === 'd6') this.startDay6(); if (id === 'd7') this.startDay7(); },
            mute: (b) => this.sfx.setMaster(b ? 0 : 0.8),
            hint: (t) => { this.extraHint = t; },
            reducedFlash: () => this.settings.reducedFlash,
            fadeColor: (css) => { this.ui.fade.style.background = css; },
            showHands: (b) => { this.hands.visible = b; },
            setDrone: (v) => { this.d7Drone = v; },
            finaleLine: (t) => this.finaleLine(t),
            finaleClear: () => this.finaleClear(),
            finaleButton: (l, fn) => this.finaleButton(l, fn),
            exitToMenu: () => this.onExit(),
            wake: () => {
                track('ending_wake_completed');
                if (this.opts.onWake) { this.opts.onWake(); return; }
                this.finaleLine('SEVEN DAYS'); this.finaleLine('HE WOKE UP');
                this.finaleButton('MAIN MENU', () => this.onExit());
            },
        };
    }

    // ───────────────────────── the dog ending ─────────────────────────
    private dogAvailable(): boolean {
        return this.state === 'PLAY' && this.mode === 'out' && !this.dogSit && !this.dogWaking && !this.tapeMode && this.loopPass === 0
            && !this.campArrived && this.p.z > -14 && !this.gauntlet.active && !this.cabinOn;
    }

    private dogSitDown(): void {
        this.dogSit = true; this.dogT0 = this.clock; this.dogEv = 0; this.dogBeepT = 0; this.dogFaded = false;
        this.vel.set(0, 0); this.headOverride = 0.55;
        this.extraHint = 'Move to stand up';
        this.objective('');
        track('dog_sit_started');
    }

    private dogStand(): void {
        this.dogSit = false; this.headOverride = null; this.extraHint = null;
        this.ui.fade.style.background = '#000'; this.fadeTo(0, 1.2);
        this.objective('Find the campsite. Follow the glow through the pines.');
        track('dog_sit_ended', { seconds: Math.round(this.clock - this.dogT0) });
    }

    private static readonly DOG_WAIT = 600;
    private static readonly DOG_LINES: [number, string, string, number][] = [
        [2, 'PROTAGONIST', 'Hey. Hey, you. Come here.', 3],
        [7, 'PROTAGONIST', 'He leans his whole weight against me. He is warm.', 5],
        [35, 'BOATMAN', 'Take your time. Nobody is waiting on you here.', 5],
        [100, 'PROTAGONIST', 'The sea keeps its slow rhythm. I could stay here.', 5],
        [190, 'PROTAGONIST', 'My friends are somewhere in those trees. I should be afraid. I am not.', 6],
        [300, 'BOATMAN', 'The tide has not moved since you sat down. It does that, here.', 5],
        [420, 'PROTAGONIST', 'There is a sound under the waves. A soft, steady beep.', 5],
        [510, 'BOATMAN', 'They are very worried about you. Go on. They are calling.', 5],
        [565, 'PROTAGONIST', 'Someone is saying my name.', 4],
    ];

    private updateDog(dt: number): void {
        if (!this.beachDog) return;
        this.beachDog.update(dt, this.p.x, this.p.z, this.yaw, this.dogSit);
        this.beachDog.interactPoint(this.dogIt.pos);
        if (!this.dogSit) return;
        const t = this.clock - this.dogT0;
        while (this.dogEv < PrologueGame.DOG_LINES.length && PrologueGame.DOG_LINES[this.dogEv][0] <= t) {
            const [, who, text, dur] = PrologueGame.DOG_LINES[this.dogEv++];
            this.say(who, text, dur);
        }
        if (t > 400) {
            // far away, under everything: a monitor, keeping time
            this.dogBeepT -= dt;
            if (this.dogBeepT <= 0) {
                this.dogBeepT = 1.7 - Math.min(0.7, (t - 400) / 250);
                this.sfx.tone(880, 0.09, 0.008 + Math.min(1, (t - 400) / 200) * 0.05, 0);
            }
        }
        if (t > 540 && !this.dogFaded) { this.dogFaded = true; this.ui.fade.style.background = '#fff'; this.fadeTo(0.55, 55); }
        if (t >= PrologueGame.DOG_WAIT) this.dogWake();
    }

    private dogWake(): void {
        this.dogWaking = true; this.dogSit = false; this.extraHint = null;
        this.lockMove = true; this.state = 'CINE'; this.vel.set(0, 0);
        track('ending_wake_started');
        this.ui.fade.style.background = '#fff'; this.fadeTo(1, 4);
        this.after(4.6, () => { this.dogWaking = false; this.startPassage('hospital_wake'); });
    }

    private card(lines: string[], ms: number): void {
        const c = this.ui.card;
        c.innerHTML = '';
        lines.forEach((l) => el('div', '', c, l));
        c.style.display = 'flex';
        window.setTimeout(() => { if (!this.disposed) c.style.display = 'none'; }, ms);
    }

    /** Start a single day for testing: hides the menu, sets safe defaults, then runs that day's opening. */
    private startTestDay(start: () => void, alive: string[]): void {
        this.sfx.init();
        this.ui.start.style.display = 'none';
        this.state = 'PLAY';
        this.loopPass = 0;
        this.friendsAlive = [...alive];
        this.hasFlashlight = true;
        this.world.flashlightMesh.visible = false; this.flashMesh.visible = true; this.lightOn = true; this.spot.visible = true;
        this.fadeTo(0, 1);
        if (!this.isTouch()) void this.renderer.domElement.requestPointerLock();
        start();
    }


    // ───────────────────────── combined game: coming back from a recording ─────────────────────────
    /** The cinematic recording ended; carry on from the tape room into the next day. */
    private beginAfterTape(): void {
        this.sfx.init();
        const s = this.readSave();
        this.ui.start.style.display = 'none';
        if (!s || !s.pendingTape) { this.begin(!!s); return; }
        this.cp = s.cp; this.loopPass = s.loopPass ?? 0;
        this.friendsAlive = s.friendsAlive ?? ['Alan', 'Sloppy', 'Mitzi', 'Oliver'];
        this.tapesFound = new Set(s.tapesFound ?? []); this.tapesWatched = new Set(s.tapesWatched ?? []); this.pendingTape = s.pendingTape;
        this.hasFlashlight = s.flash; s.clues.forEach((c) => this.clues.add(c)); this.bolted = s.bolted;
        if (this.hasFlashlight) { this.world.flashlightMesh.visible = false; this.flashMesh.visible = true; this.lightOn = true; this.spot.visible = true; }
        this.state = 'PLAY';
        this.fadeTo(1, 0.01);
        this.rig.group.visible = false;
        const pt = s.pendingTape;
        track('tape_returned', { tape: pt.n });
        this.finishTape(pt.n);
        const wait = pt.next === 'd2' ? 3.1 : pt.next === 'd3' ? 3.4 : pt.next === 'd3home' ? 0 : 0.6;
        if (wait > 0) this.after(wait, () => this.fadeTo(0, 1.4));
    }

    // ───────────────────────── cycle two: a day played as a guided recording ─────────────────────────
    private tapeMode = false;
    private tapeDayN = 0;
    private tapeRoute: Interactable[] = [];
    private tapeUsed = new Set<Interactable>();
    private tapeWait = 0;
    private tapeStall = 0;
    private tapeIdle = 0;
    private tapeClock = 0;
    private tapeEnded = false;
    private tapeCaptures = 0;
    private tapeFast = false;
    private tapeLast = new THREE.Vector2();
    private tapeVeil: HTMLElement | null = null;
    private tapeBadge: HTMLElement | null = null;
    private tapeLookT = 0;

    private static readonly TAPE_LINES: Record<number, string[]> = {
        1: ['This is not happening to me. It is a recording. I am watching it.', 'Somewhere a machine is breathing for me. I can hear it under the mall.'],
        2: ['Wake up. Wake up. There is a bed somewhere and I am in it.', 'They are not my friends right now. They are what this tape made of them.'],
        3: ['The world loads in a ring around me. Beyond it there is only the room I am really in.'],
        4: ['Seven days. Seven tapes. The same man in all of them, and he is me.'],
        5: ['Everybody smiles here because the tape cannot show the face of the one holding the camera.'],
        6: ['Let me out. I am done looking for them. I was looking for myself.'],
        7: ['Last tape. If I stop this, somebody switches the machine off. Who is it who is crying?'],
    };

    private beginTapeDay(day: number): void {
        this.sfx.init();
        const d = Math.max(1, Math.min(7, day));
        this.tapeMode = true; this.tapeDayN = d; this.loopPass = 1;
        this.ui.start.style.display = 'none';
        this.state = 'PLAY';
        this.friendsAlive = ['Alan', 'Sloppy', 'Mitzi', 'Oliver'];
        this.hasFlashlight = true;
        this.world.flashlightMesh.visible = false; this.flashMesh.visible = true; this.lightOn = true; this.spot.visible = true;
        this.rig.group.visible = false;
        this.buildTapeVeil();
        this.tapeRoute = [];
        this.fadeTo(0, 1.2);
        track('tape_day_started', { day: d });
        const start = [() => this.startDay1(), () => this.startDay2(), () => this.startDay3(), () => this.startDay4(), () => this.startDay5(), () => this.startDay6(), () => this.startDay7()][d - 1];
        start();
        // The route is every interactable of the day, in the order the day registered them.
        this.tapeRoute = this.interactables.filter((it) => it.mode === ('d' + d as Mode));
        const lines = PrologueGame.TAPE_LINES[d] ?? [];
        lines.forEach((l, i) => this.after(9 + i * 26, () => { if (!this.tapeEnded && this.state === 'PLAY') this.say('PROTAGONIST', l, 5.2); }));
    }

    private buildTapeVeil(): void {
        const cv = this.renderer.domElement;
        cv.style.filter = 'contrast(1.14) saturate(0.5) sepia(0.28) hue-rotate(-14deg) brightness(0.96)';
        const veil = el('div', 'position:absolute;inset:0;pointer-events:none;z-index:5;overflow:hidden', this.root);
        el('div', 'position:absolute;inset:0;background:repeating-linear-gradient(0deg,rgba(0,0,0,0.18) 0 1px,transparent 1px 3px)', veil);
        const band = el('div', 'position:absolute;left:0;right:0;height:46px;top:-60px;background:linear-gradient(180deg,transparent,rgba(255,255,255,0.10),transparent);mix-blend-mode:screen;filter:blur(1px)', veil);
        el('style', '', veil, '@keyframes sdTrack{0%{top:-60px}100%{top:105%}}');
        band.style.animation = 'sdTrack 6.5s linear infinite';
        this.tapeBadge = el('div', 'position:absolute;left:16px;top:14px;font-size:clamp(15px,2.6vw,22px);letter-spacing:3px;color:#fff;text-shadow:0 0 6px #000,2px 0 0 rgba(255,0,0,.5),-2px 0 0 rgba(0,255,255,.5)', veil, '▶ PLAY');
        this.tapeVeil = veil;
        for (const k of ['obj'] as const) this.ui[k].style.display = 'none';
        this.ui.stam.parentElement!.style.display = 'none';
    }

    private tapeAuto(dt: number): THREE.Vector2 | null {
        if (this.tapeEnded) return null;
        this.tapeClock += dt;
        if (this.tapeClock > (this.tapeDayN === 7 ? 190 : 120) || this.tapeCaptures >= 3) { this.endTapeDay(); return null; }
        const pool = this.tapeRoute.filter((it) => !this.tapeUsed.has(it) && it.enabled());
        let best: Interactable | null = null; let bd = 1e9;
        for (const it of pool) { const d = Math.hypot(it.pos.x - this.p.x, it.pos.z - this.p.z); if (d < bd) { bd = d; best = it; } }
        if (!best) {
            // nothing to do yet: stand and let the day come to us, and if it never does, skip along the tape
            this.tapeIdle += dt;
            // everything on the route has been done: let the last beat breathe, then the tape runs out
            if (this.tapeIdle > 7 && this.tapeRoute.every((it) => this.tapeUsed.has(it)) && this.tapeClock > 25) { this.endTapeDay(); return null; }
            if (this.tapeIdle > 9) {
                this.tapeIdle = 0;
                const next = this.tapeRoute.find((it) => !this.tapeUsed.has(it));
                if (next) { this.tapeUsed.add(next); this.tapeGlitchTo(next.pos.x, next.pos.z); }
            }
            return null;
        }
        this.tapeIdle = 0;
        const dx = best.pos.x - this.p.x, dz = best.pos.z - this.p.z;
        const reach = Math.max(1.3, best.range * 0.55);
        if (bd < reach) {
            this.tapeWait += dt;
            if (this.tapeWait > 1.1) {
                this.tapeWait = 0; this.tapeUsed.add(best);
                // face it, like the tape-maker leaning in
                this.yaw = Math.atan2(-dx, -dz); this.tapeLookT = 1.2;
                try { best.run(); } catch { /* a broken beat never breaks the tape */ }
                track('tape_day_interact', { day: this.tapeDayN, id: best.id });
            }
            return null;
        }
        this.tapeWait = 0;
        const moved = Math.hypot(this.p.x - this.tapeLast.x, this.p.z - this.tapeLast.y);
        this.tapeLast.set(this.p.x, this.p.z);
        if (moved < 0.35 * dt) this.tapeStall += dt; else this.tapeStall = 0;
        if (this.tapeStall > 1.5) { this.tapeStall = 0; const k = Math.min(bd, 6) / bd; this.tapeGlitchTo(this.p.x + dx * k, this.p.z + dz * k); return null; }
        return new THREE.Vector2(dx / bd, dz / bd);
    }

    /** The tape skips: a burst of static and the picture jumps ahead. */
    private tapeGlitchTo(x: number, z: number): void {
        this.sfx.staticBurst(0.25, 0.05);
        this.ui.fade.style.transition = 'opacity .05s'; this.ui.fade.style.opacity = '0.9';
        this.p.x = x; this.p.z = z; this.vel.set(0, 0);
        window.setTimeout(() => { if (!this.disposed) this.fadeTo(0, 0.3); }, 90);
        track('tape_skip', { day: this.tapeDayN });
    }

    private endTapeDay(): void {
        if (this.tapeEnded) return;
        this.tapeEnded = true;
        this.timers = [];
        this.state = 'CINE'; this.lockMove = true;
        this.gauntlet.stop();
        if (this.tapeBadge) this.tapeBadge.textContent = '■ STOP';
        this.sfx.staticBurst(0.9, 0.08);
        this.ui.signal.textContent = 'END OF TAPE';
        this.ui.signal.style.opacity = '1';
        track('tape_day_ended', { day: this.tapeDayN });
        window.setTimeout(() => { if (!this.disposed) this.opts.onTapeDayEnd?.(); }, 2600);
    }

    private startDay1(): void {
        this.pullT = -1;
        this.bunker.crtGroup.scale.setScalar(1);
        this.state = 'CINE';
        this.lockMove = true;
        this.sfx.beep();
        this.card(['SESSION INITIALIZED.'], 2600);
        this.after(3.2, () => { this.card(['DAY ONE'], 2200); this.sfx.tone(220, 1.5, 0.08); });
        this.after(5.8, () => { this.applyMode('d1'); this.day1.begin(); });
    }

    private startDay2(): void {
        this.state = 'CINE';
        this.lockMove = true;
        this.card(['DAY TWO'], 2600);
        this.sfx.tone(392, 1.2, 0.06);
        this.after(3, () => { this.applyMode('d2'); this.day2.begin(); });
    }

    private startDay3(): void {
        this.state = 'CINE';
        this.lockMove = true;
        this.card(['DAY THREE', 'RENDER DISTANCE'], 2800);
        this.sfx.tone(523, 1.2, 0.05);
        this.after(3.2, () => { this.applyMode('d3'); this.day3.begin(); });
    }

    private startDay4(): void {
        this.state = 'CINE';
        this.lockMove = true;
        this.after(0.4, () => { this.applyMode('d4'); this.day4.begin(); });
    }

    private startDay5(): void {
        this.state = 'CINE';
        this.lockMove = true;
        this.sfx.tone(523, 1, 0.05);
        this.after(0.4, () => { this.applyMode('d5'); this.day5.begin(); });
    }

    private startDay6(): void {
        this.state = 'CINE';
        this.lockMove = true;
        this.sfx.tone(659, 1, 0.05);
        this.after(0.4, () => { this.applyMode('d6'); this.day6.begin(); });
    }

    private startDay7(): void {
        this.state = 'CINE';
        this.lockMove = true;
        this.sfx.tone(40, 2, 0.1);
        this.after(0.4, () => { this.applyMode('d7'); this.day7.begin(); });
    }

    private finaleLine(t: string): void {
        this.ui.end.style.display = 'flex';
        el('div', 'margin:8px;font-size:clamp(18px,3.6vw,30px);letter-spacing:4px', this.ui.endText, t);
    }

    private finaleClear(): void {
        this.ui.endText.innerHTML = '';
        this.ui.end.style.display = 'none';
        this.finBtn?.remove();
        this.finBtn = null;
    }

    private finaleButton(label: string | null, fn?: () => void): void {
        this.finBtn?.remove();
        this.finBtn = null;
        if (label === null) return;
        this.ui.end.style.display = 'flex';
        const b = el('button', 'padding:14px 34px;min-height:52px;font:inherit;font-size:18px;background:#d8d8d8;color:#000;border:0;border-radius:6px;cursor:pointer;margin-top:12px', this.ui.end, label);
        b.addEventListener('click', () => { track('finale_button_clicked', { label }); fn?.(); });
        this.finBtn = b;
    }

    private isTouch(): boolean {
        return this.touchSeen || window.matchMedia('(pointer:coarse)').matches || window.matchMedia('(hover:none)').matches;
    }

    private showTouch(): void {
        this.ui.touch.style.display = 'block';
        this.ui.sub.style.bottom = '27%';
        this.ui.sub.style.fontSize = '15px';
        this.ui.prompt.style.top = '44%';
        this.ui.hint.style.top = '52%';
        this.ui.obj.style.fontSize = '12px';
        this.ui.obj.style.maxWidth = '45%';
        this.touchHome();
    }

    private buildTouch(r: HTMLElement): HTMLElement {
        const SB = 'env(safe-area-inset-bottom,0px)';
        const root = el('div', 'position:absolute;inset:0;display:none;pointer-events:none;touch-action:none;-webkit-user-select:none', r);
        const left = el('div', 'position:absolute;left:0;top:0;width:45%;height:100%;pointer-events:auto;touch-action:none', root);
        const right = el('div', 'position:absolute;right:0;top:0;width:55%;height:100%;pointer-events:auto;touch-action:none', root);
        const base = el('div', 'position:absolute;width:120px;height:120px;margin:-60px 0 0 -60px;border-radius:50%;border:2px solid rgba(255,255,255,0.3);background:rgba(255,255,255,0.07);pointer-events:none', root);
        const knob = el('div', 'position:absolute;left:50%;top:50%;width:54px;height:54px;margin:-27px 0 0 -27px;border-radius:50%;background:rgba(255,255,255,0.35)', base);
        const place = (x: number, y: number) => { base.style.left = x + 'px'; base.style.top = y + 'px'; };
        this.touchHome = () => {
            const h = root.clientHeight || window.innerHeight;
            place(Math.min(100, (root.clientWidth || 300) * 0.28), h - 140);
            knob.style.transform = 'translate(0px,0px)';
        };
        let jid = -1, ocx = 0, ocy = 0;
        left.addEventListener('pointerdown', (e) => {
            if (jid >= 0) return;
            jid = e.pointerId;
            left.setPointerCapture(e.pointerId);
            ocx = e.clientX; ocy = e.clientY;
            const rc = root.getBoundingClientRect();
            place(ocx - rc.left, ocy - rc.top);
        });
        left.addEventListener('pointermove', (e) => {
            if (e.pointerId !== jid) return;
            const dx = e.clientX - ocx, dy = e.clientY - ocy;
            const len = Math.hypot(dx, dy);
            const R = 55;
            if (len < 6) { this.touchMove.set(0, 0); knob.style.transform = 'translate(0px,0px)'; return; }
            const k = Math.min(1, len / R);
            this.touchMove.set((dx / len) * k, (dy / len) * k);
            knob.style.transform = `translate(${(dx / len) * k * R}px,${(dy / len) * k * R}px)`;
        });
        const endJ = (e: PointerEvent) => {
            if (e.pointerId !== jid) return;
            jid = -1;
            this.touchMove.set(0, 0);
            this.touchHome();
        };
        left.addEventListener('pointerup', endJ);
        left.addEventListener('pointercancel', endJ);
        let lid = -1, lx = 0, ly = 0;
        right.addEventListener('pointerdown', (e) => {
            if (lid >= 0) return;
            lid = e.pointerId;
            right.setPointerCapture(e.pointerId);
            lx = e.clientX; ly = e.clientY;
        });
        right.addEventListener('pointermove', (e) => {
            if (e.pointerId !== lid) return;
            this.look((e.clientX - lx) * 0.0055, (e.clientY - ly) * 0.0055);
            lx = e.clientX; ly = e.clientY;
        });
        const endL = (e: PointerEvent) => { if (e.pointerId === lid) lid = -1; };
        right.addEventListener('pointerup', endL);
        right.addEventListener('pointercancel', endL);

        const btn = (txt: string, css: string, size: number, down: (b: HTMLElement) => void, up?: () => void, toggle = false) => {
            const b = el('div', `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,0.14);border:2px solid rgba(255,255,255,0.45);display:flex;align-items:center;justify-content:center;font-size:${size > 60 ? 15 : 12}px;font-weight:bold;pointer-events:auto;touch-action:none;${css}`, root, txt);
            b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); if (!toggle) b.style.background = 'rgba(255,255,255,0.4)'; down(b); });
            const rel = () => { if (!toggle) b.style.background = 'rgba(255,255,255,0.14)'; up?.(); };
            b.addEventListener('pointerup', rel);
            b.addEventListener('pointercancel', rel);
            b.addEventListener('pointerleave', rel);
        };
        btn('JUMP', `right:16px;bottom:calc(28px + ${SB})`, 58, () => this.jump());
        btn('RUN', `right:84px;bottom:calc(28px + ${SB})`, 58, () => { this.touchRun = true; }, () => { this.touchRun = false; });
        btn('CROUCH', `right:152px;bottom:calc(28px + ${SB})`, 58, (b) => {
            this.touchCrouch = !this.touchCrouch;
            b.style.background = this.touchCrouch ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.14)';
        }, undefined, true);
        btn('E', `right:16px;bottom:calc(100px + ${SB})`, 68, () => this.interact());
        btn('FLASH', `right:98px;bottom:calc(100px + ${SB})`, 52, () => this.toggleLight());
        btn('OBJ', 'right:70px;top:46px', 44, () => this.toggleInventory());
        btn('II', 'right:16px;top:46px', 44, () => { track('touch_pause_clicked'); this.pauseGame(); });
        return root;
    }

    private toggleInventory(): void {
        if (this.invOpen) {
            this.invOpen = false;
            this.ui.inv.style.display = 'none';
            this.state = 'PLAY';
            if (!this.isTouch()) void this.renderer.domElement.requestPointerLock();
            track('inventory_closed');
            return;
        }
        if (this.state !== 'PLAY') return;
        this.invOpen = true;
        this.state = 'PAUSE';
        const f = this.day1.flags();
        const lines = ['OBJECTIVE', this.ui.obj.textContent?.replace('OBJECTIVE: ', '') ?? '', '', 'ITEMS',
            this.hasFlashlight ? 'Flashlight' : 'No flashlight yet', this.hasTape ? 'Splice Tape' : '',
            this.campArrived ? 'Camp clues found: ' + this.clues.size + ' / 4' : '',
            f.reassignment_rule_known ? 'Learned: the system reassigns users.' : '', f.mascot_tag_seen ? 'Found: sewn-in identity tag' : '', ...this.day2.itemsText().filter(() => this.mode === 'd2')];
        this.invBody.innerHTML = '';
        lines.filter((l, i) => l !== '' || i === 2).forEach((l) => el('div', l === 'OBJECTIVE' || l === 'ITEMS' ? 'color:#9ab;letter-spacing:3px;margin-top:6px' : '', this.invBody, l || ' '));
        this.ui.inv.style.display = 'flex';
        if (document.pointerLockElement) document.exitPointerLock();
        track('inventory_opened');
    }

    private look(dx: number, dy: number): void {
        if (this.state !== 'PLAY' && this.state !== 'CINE') return;
        if (this.pullT >= 0 || this.forcedLook || this.cutT >= 0 || this.gauntlet?.active) return;
        this.yaw -= dx;
        this.pitch = Math.max(-1.35, Math.min(1.35, this.pitch - dy));
    }

    private resize(): void {
        const w = this.root.clientWidth || window.innerWidth;
        const h = this.root.clientHeight || window.innerHeight;
        this.renderer.setSize(w, h, false);
        this.camera.aspect = w / h;
        this.camera.updateProjectionMatrix();
    }

    // ───────────────────────── flow ─────────────────────────
    /** Everything the journey needs to bring the player back after a tape. */
    snapshot(): SearchSnapshot {
        return { cp: this.cp, flash: this.hasFlashlight, clues: [...this.clues], bolted: this.bolted, loopPass: this.loopPass, friendsAlive: [...this.friendsAlive], tapesFound: [...this.tapesFound], tapesWatched: [...this.tapesWatched], pendingTape: this.pendingTape };
    }

    private readSave(): { cp: Checkpoint; flash: boolean; clues: string[]; bolted: boolean; d1?: ReturnType<Day1['save']>; d2?: ReturnType<Day2['save']>; d3?: ReturnType<Day3['save']>; d4?: ReturnType<Day4['save']>; d5?: ReturnType<Day5['save']>; d6?: ReturnType<Day6['save']>; d7?: ReturnType<Day7['save']>; loopPass?: number; friendsAlive?: string[]; tapesFound?: number[]; tapesWatched?: number[]; pendingTape?: { n: number; next: string } | null } | null {
        try {
            if (this.opts.restore) return this.opts.restore as never;
            const s = kvGet(SAVE_KEY);
            return s ? JSON.parse(s) : null;
        } catch {
            return null;
        }
    }

    private writeSave(): void {
        // Automated opening checks must never replace the creator's actual progress.
        if (navigator.webdriver || this.opts.autostart) return;
        try {
            kvSet(SAVE_KEY, JSON.stringify({ cp: this.cp, flash: this.hasFlashlight, clues: [...this.clues], bolted: this.bolted, d1: this.day1?.save(), d2: this.day2?.save(), d3: this.day3?.save(), d4: this.day4?.save(), d5: this.day5?.save(), d6: this.day6?.save(), d7: this.day7?.save(), loopPass: this.loopPass, friendsAlive: this.friendsAlive, tapesFound: [...this.tapesFound], tapesWatched: [...this.tapesWatched], pendingTape: this.pendingTape }));
        } catch { /* storage unavailable */ }
    }

    private checkpoint(id: string, chase = false): void {
        this.cp = { id, x: this.p.x, z: this.p.z, yaw: this.yaw, mode: this.mode, chase };
        this.writeSave();
        track('checkpoint_reached', { id });
    }

    private begin(cont: boolean): void {
        this.sfx.init();
        track('prologue_started', { continued: cont });
        const s = cont ? this.readSave() : null;
        if (s) {
            this.cp = s.cp; this.loopPass = s.loopPass ?? 0;
            this.friendsAlive = s.friendsAlive ?? ['Alan', 'Sloppy', 'Mitzi', 'Oliver'];
            this.tapesFound = new Set(s.tapesFound ?? []); this.tapesWatched = new Set(s.tapesWatched ?? []); this.pendingTape = s.pendingTape ?? null;
            this.hasFlashlight = s.flash;
            s.clues.forEach((c) => this.clues.add(c));
            this.bolted = s.bolted;
            this.day1.load(s.d1);
            this.day2.load(s.d2);
            this.day3.load(s.d3);
            if (this.hasFlashlight) { this.world.flashlightMesh.visible = false; this.flashMesh.visible = true; this.lightOn = true; this.spot.visible = true; }
        } else {
            this.loopPass = 0;
            this.friendsAlive = ['Alan', 'Sloppy', 'Mitzi', 'Oliver'];
            this.tapesFound.clear(); this.tapesWatched.clear(); this.pendingTape = null;
            if (!navigator.webdriver) { try { kvRemove(SAVE_KEY); } catch { /* ignore */ } }
        }
        this.ui.start.style.display = 'none';
        this.state = 'PLAY';
        if (this.cp.mode !== 'out') this.applyMode(this.cp.mode);
        this.respawn(true);
        if (!this.isTouch()) void this.renderer.domElement.requestPointerLock();
        if (!s) {
            this.playBoat(() => {
            this.state = 'CINE';
            this.lockMove = true;
            this.pitch = 0;
            this.fadeTo(0, 3);
            this.after(1, () => this.sfx.beep());
            this.after(3.5, () => { this.pitch = 0; });
            this.after(5, () => {
                this.lockMove = false;
                this.state = 'PLAY';
                this.objective('Find the campsite. Follow the glow through the pines.');
                this.say('PROTAGONIST', 'This is the place. Find the guide at the old camp.', 3.5);
            });
            });
        } else {
            this.fadeTo(0, 1);
            this.objective(this.objectiveFor());
        }
    }

    /** Opening: you arrive by boat at night. The boatman tells you who to find: the guide who was hired to meet your friends. */
    private playBoat(onDone: () => void): void {
        const hemi = this.world.scene.getObjectByName('hemi') as THREE.HemisphereLight;
        track('intro_boat_started');
        this.cabinOn = true; this.cabinStress = 0.015; this.boatStart = this.clock;
        this.world.outdoor.visible = false; this.rain.visible = false; this.boat.group.visible = true;
        // Clear moonlit night for the ride: the island must read as a silhouette, not vanish into fog.
        const scene = this.world.scene;
        const prevFog = scene.fog;
        const prevBg = (scene.background as THREE.Color).clone();
        scene.fog = new THREE.FogExp2(0x1b2b3d, 0.004);
        (scene.background as THREE.Color).setHex(0x1b2b3d);
        hemi.intensity = 0.9;
        this.hands.visible = false;
        // Stern viewpoint: the camera stands by the wheel and looks forward past the bow toward the island.
        this.boat.place();
        this.camera.near = 0.05; this.camera.far = 400; this.camera.updateProjectionMatrix();
        const home = this.boat.cameraHome();
        this.p.set(home.x, 0, home.z); this.head = home.y; this.yaw = Math.PI; this.pitch = -0.2; this.vel.set(0, 0); this.vy = 0;
        this.state = 'CINE'; this.lockMove = true; this.headOverride = null;
        this.ui.fade.style.background = '#000'; this.fadeTo(1, 0.01);
        this.after(0.1, () => this.fadeTo(0, 3));
        this.objective('');
        const say = (t: number, who: string, text: string, d: number) => this.after(t, () => this.say(who, text, d));
        say(2, 'BOATMAN', "That's it. The island. Nobody comes out here on purpose.", 4.5);
        say(7.5, 'PROTAGONIST', 'My friends did. Four of them. Three weeks ago. They never called.', 4.5);
        say(13, 'BOATMAN', "Their plane went down off the north coast. I won't go near that water.", 4.6);
        say(18.5, 'BOATMAN', "There's a guide up at the old camp. He was hired to meet your people. If he's still there, he knows more than I do.", 6);
        say(25.5, 'PROTAGONIST', "Then that's where I start.", 3);
        this.after(28, () => { this.sfx.scrape(0.25, 0.8); this.cabinStress = 0.04; });
        say(29, 'BOATMAN', "I'll hold the boat till dawn. Not a minute past. Some nights, that island answers back.", 5);
        this.after(33.6, () => { this.sfx.scrape(0.5, 1.2); this.shake = 1.0; this.pitch = 0.0; });
        this.after(34, () => {
            this.sfx.thud(0.9); this.shake = 3; this.cabinStress = 0.02; this.pitch = -0.25; this.vel.set(0, 0);
            track('intro_boat_crashed', { elapsed: 34 });
        });
        this.after(34.6, () => { this.sfx.thud(0.5); this.shake = 1.5; this.pitch = 0.1; });
        this.after(35.5, () => { this.pitch = 0; });
        say(35, 'BOATMAN', 'Go on.', 2);
        this.after(37.5, () => this.fadeTo(1, 1.5));
        this.after(39.5, () => {
            this.cabinOn = false; this.hands.visible = true; this.boat.group.visible = false; this.world.outdoor.visible = true; this.rain.visible = true;
            scene.fog = prevFog; (scene.background as THREE.Color).copy(prevBg);
            hemi.intensity = 1.4; this.headOverride = null;
            this.placePlayer(this.cp);
            track('intro_boat_completed');
            onDone();
        });
    }

    private objectiveFor(): string {
        if (this.mode === 'd1') return this.day1.objectiveText();
        if (this.mode === 'd2') return this.day2.objectiveText();
        if (this.mode === 'd3') return this.day3.objectiveText();
        if (this.mode === 'd4') return this.day4.objectiveText();
        if (this.mode === 'd5') return this.day5.objectiveText();
        if (this.mode === 'd6') return this.day6.objectiveText();
        if (this.mode === 'd7') return this.day7.objectiveText();
        if (this.mode === 'passage') return this.passages.objectiveText();
        if (this.mode === 'in') return this.powered ? 'Insert the tape.' : this.bolted ? 'Restore power. Check the generator switch.' : 'Bolt the door.';
        if (this.cp.chase) return 'RUN. Reach the bunker.';
        if (this.campArrived) return 'Search the camp.';
        return 'Find the campsite. Follow the glow through the pines.';
    }

    private pauseGame(): void {
        if (this.state !== 'PLAY') return;
        this.state = 'PAUSE';
        this.ui.pause.style.display = 'flex';
        track('game_paused_ui');
    }

    private resume(): void {
        this.ui.pause.style.display = 'none';
        this.state = 'PLAY';
        if (!this.isTouch()) void this.renderer.domElement.requestPointerLock();
    }

    private placePlayer(c: Checkpoint): void {
        this.p.set(c.x, 0, c.z);
        this.yaw = c.yaw;
        this.pitch = 0;
        this.vy = 0;
        this.vel.set(0, 0);
    }

    private respawn(initial = false): void {
        this.timers = [];
        for (const it of this.interactables) it.used = false;
        if (this.cutT >= 0) { this.cutT = -1; this.runner.visible = false; this.hands.visible = true; this.lockMove = false; this.state = 'PLAY'; }
        this.placePlayer(this.cp);
        this.ui.signal.style.opacity = '0';
        if (this.mode !== this.cp.mode) this.applyMode(this.cp.mode);
        if (this.cp.mode === 'd1') this.day1.respawn(this.cp.id);
        if (this.cp.mode === 'd2') this.day2.respawn(this.cp.id);
        if (this.cp.mode === 'd3') this.day3.respawn(this.cp.id);
        if (this.cp.mode === 'd4') this.day4.respawn(this.cp.id);
        if (this.cp.mode === 'd5') this.day5.respawn(this.cp.id);
        if (this.cp.mode === 'd6') this.day6.respawn(this.cp.id);
        if (this.cp.mode === 'd7') this.day7.respawn(this.cp.id);
        if (this.cp.mode === 'passage') this.passages.respawn(this.cp.id, this.pendingTape?.n);
        if (this.cp.chase && this.cp.mode === 'out' && this.cp.z > GAUNTLET_END_Z) {
            // restart the obstacle run from the last checkpoint
            this.revealed = true; this.cState = 'DORMANT'; this.cPauseIn = 9;
            this.rig.group.visible = true;
            this.gauntlet.start(true);
        } else if (this.cp.chase && this.cp.mode === 'out') {
            this.gauntlet.stop();
            this.revealed = true;
            const bz = Math.min(this.cp.z + 26, 0);
            this.rig.group.position.set(pathX(bz), 0, bz);
            this.cState = 'CHARGE';
            this.cPauseIn = 9;
            this.rig.group.visible = true;
        } else {
            this.gauntlet.stop();
            if (!initial || this.cState !== 'DORMANT') this.hideCreature();
            this.revealed = false;
        }
        if (this.state === 'CAPTURED') {
            this.state = 'PLAY';
            this.fadeTo(0, 1);
        }
        this.camera.rotation.z = 0;
        this.resetSurvivor();
        this.ui.fade.style.background = '#000';
    }

    private hideCreature(): void {
        this.cState = 'DORMANT';
        this.rig.group.visible = false;
    }

    private capture(): void {
        if (this.state !== 'PLAY' && this.state !== 'CINE') return;
        // Real death (hospital ending): losing the ritual duel, or any capture during the return through the seven days.
        const fatal = !this.tapeMode && (this.mode === 'd6' || this.loopPass > 0);
        if (this.tapeMode) this.tapeCaptures++;
        this.gauntlet.stop();
        this.state = 'CAPTURED'; this.capT = 0; this.timers = []; this.cutT = -1;
        track('player_captured', { checkpoint: this.cp.id, fatal });
        this.sfx.thud(0.5); this.sfx.staticBurst(0.5, 0.07);
        if (!fatal) {
            this.after(0.5, () => { this.ui.signal.style.opacity = '1'; });
            this.after(2.4, () => { this.fadeTo(1, 0.01); this.respawn(); this.fadeTo(0, 1); });
            return;
        }
        track('ending_player_died', { chapter: this.mode, returnLoop: this.loopPass > 0 });
        this.runner.visible = true; this.runner.position.copy(this.p); this.runner.rotation.y = this.yaw;
        this.hands.visible = false; this.lockMove = true;
        this.after(1.7, () => this.fadeTo(1, 0.6));
        this.after(2.5, () => { this.runner.visible = false; this.hands.visible = true; this.startPassage('hospital_death'); });
    }

    private applyMode(m: Mode): void {
        this.mode = m;
        const hemi = this.world.scene.getObjectByName('hemi') as THREE.HemisphereLight;
        const moon = this.world.scene.getObjectByName('moon') as THREE.DirectionalLight;
        const inside = m !== 'out';
        hemi.intensity = m === 'in' ? 0.12 : m === 'd1' ? 0.55 : m === 'd2' ? 0.6 : m === 'd3' ? 0.9 : m === 'd4' ? 0.45 : m === 'd5' ? 0.9 : m === 'd6' ? 1.0 : m === 'd7' ? 0.8 : 1.4;
        hemi.color.set(m === 'd1' ? 0xfff2b0 : m === 'd2' ? 0xffe0b8 : m === 'd3' ? 0xaabbff : m === 'd4' ? 0x6a7a9a : m === 'd5' ? 0xffffff : m === 'd6' ? 0xfff0e0 : m === 'd7' ? 0xbfd0ff : 0x3a4e66);
        hemi.groundColor.set(m === 'd1' ? 0x6a5a20 : m === 'd2' ? 0x5a4020 : m === 'd3' ? 0x222233 : m === 'd4' ? 0x101810 : m === 'd5' ? 0x777777 : m === 'd6' ? 0xc08050 : m === 'd7' ? 0x101018 : 0x15130f);
        moon.intensity = inside ? 0 : 0.4;
        this.world.outdoor.visible = m === 'out';
        this.bunker.group.visible = m === 'in';
        this.day1.group.visible = m === 'd1';
        this.day2.group.visible = m === 'd2';
        this.day3.group.visible = m === 'd3';
        this.day4.group.visible = m === 'd4';
        this.day5.group.visible = m === 'd5';
        this.day6.group.visible = m === 'd6';
        this.day7.group.visible = m === 'd7';
        this.passages.group.visible = m === 'passage';
        this.rain.visible = m === 'out';
        const fogCol = m === 'in' ? 0x050505 : m === 'd1' ? 0x2a2410 : m === 'd2' ? 0x2a2018 : m === 'd3' ? 0x05060c : m === 'd4' ? 0x0a0e14 : m === 'd5' ? 0x151515 : m === 'd6' ? 0x2a1a2a : m === 'd7' ? 0x04040a : 0x0d1822;
        this.world.scene.fog = new THREE.FogExp2(fogCol, m === 'in' ? 0.02 : m === 'd1' ? 0.022 : m === 'd2' ? 0.012 : m === 'd3' ? 0.007 : m === 'd4' ? 0.02 : m === 'd5' ? 0.008 : m === 'd6' ? 0.006 : m === 'd7' ? 0.008 : 0.03);
        (this.world.scene.background as THREE.Color).set(fogCol);
        if (m === 'passage') { this.world.scene.fog = new THREE.FogExp2(0xadb6ac, 0.014); (this.world.scene.background as THREE.Color).setHex(0xadb6ac); hemi.color.setHex(0xffefce); hemi.groundColor.setHex(0x697578); }
        if (inside) this.rig.group.visible = false;
        this.restoreInterior();
    }

    private restoreInterior(): void {
        this.bunker.boltMesh.position.x = X0 + (this.bolted ? -0.5 : -0.9);
        this.bunker.tapeMesh.visible = !this.hasTape;
    }

    // ───────────────────────── interactables ─────────────────────────
    private add(id: string, label: string, x: number, y: number, z: number, mode: Mode, run: () => void, enabled: () => boolean = () => true, range = 2.6): void {
        this.interactables.push({ id, label, pos: new THREE.Vector3(x, y, z), range, mode, enabled, run });
    }

    private buildInteractables(): void {
        const w = this.world;
        const done = new Set<string>();
        const once = (id: string) => () => !done.has(id);
        const mark = (id: string) => done.add(id);

        this.add('flashlight', 'Pick up flashlight', 1.2, 0.2, -3, 'out', () => {
            mark('fl');
            this.hasFlashlight = true;
            this.lightOn = true;
            this.spot.visible = true;
            w.flashlightMesh.visible = false;
            this.flashMesh.visible = true;
            this.sfx.click();
            this.say('PROTAGONIST', "Still works. Thank God.");
            track('item_collected', { item: 'flashlight' });
            this.writeSave();
        }, () => !this.hasFlashlight);
        this.add('map', 'Inspect waterlogged map', -1.5, 0.2, -5, 'out', () => {
            mark('map');
            this.say('PROTAGONIST', "The ink's run, but there's a fire marked inland. Past the pines.", 4.5);
            track('interact_map');
        }, once('map'));
        this.add('canoe', 'Examine canoe', 4, 0.8, -2, 'out', () => {
            mark('canoe');
            this.say('PROTAGONIST', "Hull's split open. Nobody's paddling out of here.");
            track('interact_canoe');
        }, once('canoe'), 3.2);
        this.add('prints', 'Examine boot prints', -0.7, 0.1, -4.5, 'out', () => {
            mark('prints');
            this.say('PROTAGONIST', "These prints... they stop right where I woke up. They're mine?", 4.5);
            track('interact_prints');
        }, once('prints'), 3.4);
        this.add('mast', 'Test emergency radio', pathX(-25) + 5, 1, -24, 'out', () => {
            mark('mast');
            this.sfx.staticBurst(1.2, 0.1);
            this.say('RADIO', "...don't open the door. Don't let it hear you breathe.", 4.5);
            this.after(4.6, () => this.say('PROTAGONIST', "That's... that's my voice."));
            track('interact_mast_radio');
        }, once('mast'), 3.5);

        const clue = (id: string, label: string, x: number, y: number, z: number, line: string, extra?: () => void) => {
            this.add(id, label, x, y, z, 'out', () => {
                this.clues.add(id);
                this.say('PROTAGONIST', line, 4.5);
                this.sfx.click(0.2);
                extra?.();
                track('clue_inspected', { id, total: this.clues.size });
                this.writeSave();
            }, () => !this.clues.has(id) && this.campArrived, 3);
        };
        clue('tent', 'Inspect tent zipper', CAMP_X - 6, 1, CAMP_Z - 1.5, "Zipper's torn from the outside. Whoever left, didn't leave on their own.");
        clue('radio', 'Inspect broken radio', CAMP_X - 3, 0.4, CAMP_Z + 2, "Smashed. Just static... and something under it. Breathing?");
        clue('phone', 'Inspect phone', CAMP_X + 5, 0.9, CAMP_Z + 2.1, "A children's tune. Distorted. Why would it still be playing?");
        clue('paper', 'Inspect scrap of paper', CAMP_X + 8, 0.2, CAMP_Z - 1, "A hand-drawn symbol. Some kind of... bunker?");
        this.add('trail', 'Follow the drag marks', CAMP_X + 1, 0.1, CAMP_Z - 4, 'out', () => {
            mark('trail');
            this.say('PROTAGONIST', "Something was dragged into the trees. Several somethings.");
            track('interact_trail');
        }, () => this.campArrived && !done.has('trail'), 3);
        this.add('recorder', 'Pick up recorder', CAMP_X - 3.5, 0.1, CAMP_Z - 3.5, 'out', () => {
            mark('rec');
            w.recorderMesh.visible = false;
            this.sfx.click();
            this.say('PROTAGONIST', "A recorder. Still has a clip on it...");
            this.after(3.4, () => this.say('PROTAGONIST', "(recording) Seven days. And I'll tell it all again.", 4.5));
            this.after(8.2, () => this.say('PROTAGONIST', "I never said that. I never said that."));
            track('item_collected', { item: 'recorder' });
        }, () => this.campArrived && !done.has('rec'), 3);

        this.add('bunkerdoor', 'Squeeze inside', BUN_X, 1.1, BUN_DOOR_Z + 0.6, 'out', () => this.enterBunker(), () => this.revealed, 3);

        // inside
        this.add('bolt', 'Slide the bolt', X0 - 0.9, 1.2, 3.2, 'in', () => {
            this.bolted = true;
            this.bunker.boltMesh.position.x = X0 - 0.5;
            this.sfx.thud(0.35);
            this.sfx.click(0.5);
            this.objective('Restore power. Check the generator switch.');
            this.checkpoint('bunker');
            this.after(1.2, () => { this.sfx.scrape(0.5, -0.3); this.say('PROTAGONIST', "It's dragging the blade along the door...", 3.5); });
            this.after(5, () => { this.sfx.thud(0.5, -0.3); });
            track('interact_bolt');
        }, () => !this.bolted, 3);
        this.add('generator', 'Flip generator switch', X0 + 3, 1.2, 0.6, 'in', () => {
            this.powered = true;
            this.bunker.leverMesh.rotation.z = -0.6;
            this.bunker.light.color.set(0xeaf4ff);
            this.bunker.light.intensity = 16;
            this.sfx.thud(0.4);
            this.crtMode = 'static';
            this.bunker.tray.visible = true;
            this.sfx.staticBurst(0.8, 0.1);
            this.objective('Pick up the tape and insert it into the VCR.');
            this.say('PROTAGONIST', "Power's on. The CRT came up by itself... and the tray's open.", 4.5);
            track('interact_generator');
        }, () => this.bolted && !this.powered, 3);
        this.add('tape', 'Take tape: SPLICEMASTER — FORBIDDEN EPISODE', X0 - 3.1, 1.1, -0.5, 'in', () => {
            this.hasTape = true;
            this.bunker.tapeMesh.visible = false;
            this.sfx.click();
            this.say('PROTAGONIST', "'SPLICEMASTER: FORBIDDEN EPISODE.' Handwritten. Whose handwriting is that?", 4.5);
            track('item_collected', { item: 'splice_tape' });
        }, () => !this.hasTape, 3);
        this.add('vcr', 'Insert tape', X0 + 0.75, 0.9, -2.5, 'in', () => this.tapeSequence(), () => this.powered && this.hasTape && !this.tapeIn, 3);
        this.add('unplug', 'Unplug the CRT', X0 - 1.4, 0.4, -2.2, 'in', () => {
            this.unplugged = true;
            this.sfx.click(0.5);
            this.say('PROTAGONIST', "It's unplugged! Why is it still on?!", 3);
            track('interact_unplug');
        }, () => this.tapeIn && this.crtMode === 'frozen' && !this.unplugged && this.pullT < 0, 3.2);
        this.add('scratch', 'Read the scratches on the wall', X0 - 3.2, 1.3, 1.4, 'in', () => {
            this.say('PROTAGONIST', "Tally marks. Hundreds. And one line: 'IT WATCHES THROUGH YOU.'", 4.5);
            track('interact_scratches');
        }, () => this.bolted, 3);
    }

    private interact(): void {
        if (this.gauntlet?.active) { this.gauntlet.press('swat'); return; }
        if (this.tapeMode || this.state !== 'PLAY' || !this.currentInteract) return;
        this.currentInteract.used = true;
        this.currentInteract.run();
    }

    private toggleLight(): void {
        if (!this.hasFlashlight || (this.state !== 'PLAY' && this.state !== 'CINE')) return;
        this.lightOn = !this.lightOn;
        this.spot.visible = this.lightOn;
        this.sfx.click(0.25);
        track('flashlight_toggled', { on: this.lightOn });
    }

    private jump(): void {
        if (this.gauntlet?.active) { this.gauntlet.press('jump'); return; }
        this.jumpPhysics();
    }

    private jumpPhysics(): void {
        if (this.state !== 'PLAY' || this.lockMove) return;
        if (this.vy === 0 && this.groundAt(this.p.x, this.p.z) >= this.p.y - 0.01 && this.stamina > 8) {
            this.vy = 4.9;
            this.stamina -= 8;
        }
    }

    // ───────────────────────── sequences ─────────────────────────
    private enterBunker(): void {
        track('bunker_entered');
        this.state = 'CINE';
        this.lockMove = true;
        this.hideCreatureSoft();
        this.fadeTo(1, 0.7);
        this.sfx.thud(0.4);
        this.after(0.9, () => {
            this.applyMode('in');
            this.p.set(X0, 0, 2.3);
            this.yaw = 0;
            this.pitch = 0;
            this.vel.set(0, 0);
            this.crtMode = 'off';
            this.drawCrt();
            this.fadeTo(0, 1.2);
            this.sfx.thud(0.6);
            this.sfx.click(0.5);
            this.objective('Bolt the door.');
            this.say('PROTAGONIST', "Door's shut. Bolt. Now. *breathing*", 3.5);
        });
        this.after(3.2, () => { this.lockMove = false; this.state = 'PLAY'; });
        this.after(5.5, () => this.sfx.scrape(0.5, 0.3));
        this.after(9.5, () => { this.sfx.thud(0.5, 0.3); });
    }

    private hideCreatureSoft(): void {
        this.cState = 'WAIT';
    }

    private tapeSequence(): void {
        this.tapeIn = true;
        this.state = 'CINE';
        this.lockMove = true;
        this.objective('...');
        this.sfx.click(0.5);
        this.sfx.tone(120, 0.5, 0.15, 0, 'sawtooth');
        this.checkpoint('tape');
        track('tape_inserted');
        const b = this.bunker;
        b.tray.visible = false;
        this.crtMode = 'face';
        const line = (t: number, who: string, text: string, dur: number, talk = false) =>
            this.after(t, () => { this.say(who, text, dur); this.talk = talk ? dur : 0; });
        line(1.5, 'SPLICEMASTER', "There you are. We've been waiting.", 3.2, true);
        this.after(5, () => { this.crtMode = 'frozen'; this.sfx.staticBurst(0.4, 0.1); });
        line(5.2, 'SPLICEMASTER', "You weren't supposed to survive the island.", 3.6, true);
        line(9.2, 'PROTAGONIST', "What the hell is this?", 2.5);
        line(12, 'SPLICEMASTER', "Seven days. That's all you've got.", 3.4, true);
        this.after(15.5, () => {
            this.lockMove = false;
            this.state = 'PLAY';
            this.objective('Unplug the CRT!');
        });
        this.after(18, () => {
            b.doors.forEach((d) => { d.visible = true; });
            this.sfx.thud(0.6);
            this.say('PROTAGONIST', "The door... there's more of them. Three doors. Every wall.", 3.5);
            this.shake = 1;
        });
        this.after(18.5, () => this.sfx.tone(300, 3, 0.08, 0, 'sawtooth', 70));
        this.after(21.5, () => {
            this.state = 'CINE';
            this.lockMove = true;
            this.pullT = 0;
            this.say('PROTAGONIST', "Something's pulling me— I can't— no!", 3.5);
            this.sfx.scrape(0.5, -0.4);
            this.sfx.thud(0.7, -0.4);
        });
        this.after(27, () => this.fadeTo(1, 2.5));
        this.after(30.2, () => this.startDay1());
    }

    private endCard(lines: string[], btn: boolean, note = 'End of the chapter.'): void {
        this.state = 'END';
        if (document.pointerLockElement) document.exitPointerLock();
        this.ui.end.style.display = 'flex';
        this.ui.endText.innerHTML = '';
        this.sfx.beep();
        lines.forEach((l, i) => {
            window.setTimeout(() => {
                if (this.disposed) return;
                el('div', 'margin:8px', this.ui.endText, l);
            }, i * 1800);
        });
        window.setTimeout(() => {
            if (this.disposed) return;
            el('div', 'font-size:13px;color:#889;margin-top:30px;max-width:420px;line-height:1.5', this.ui.endText,
                note);
            const b = (this.ui.endText as HTMLElement & { _btn?: HTMLElement })._btn;
            if (b && btn) b.style.display = 'block';
        }, lines.length * 1800 + 600);
        track('chapter_completed', { note });
    }

    // ───────────────────────── simulation ─────────────────────────
    private groundAt(x: number, z: number): number {
        let g = 0;
        if (this.mode === 'd2') return this.day2.groundAt(x, z, this.p.y);
        if (this.mode === 'd6') return this.day6.groundAt(x, z);
        if (this.mode === 'passage') return this.passages.groundAt(z);
        if (this.mode !== 'out') return 0;
        for (const b of this.world.boxes) {
            if (x > b.minx && x < b.maxx && z > b.minz && z < b.maxz && this.p.y >= b.h - 0.12) g = Math.max(g, b.h);
        }
        return g;
    }

    private collide(): void {
        const p = this.p;
        const R = 0.35;
        if (this.mode === 'd1') { this.day1.collide(p); return; }
        if (this.mode === 'd2') { this.day2.collide(p); return; }
        if (this.mode === 'd3') { this.day3.collide(p); return; }
        if (this.mode === 'd4') { this.day4.collide(p); return; }
        if (this.mode === 'd5') { this.day5.collide(p); return; }
        if (this.mode === 'd6') { this.day6.collide(p); return; }
        if (this.mode === 'd7') { this.day7.collide(p); return; }
        if (this.mode === 'passage') { this.passages.collide(p); return; }
        if (this.mode === 'in') {
            p.x = Math.max(X0 - 3.2, Math.min(X0 + 3.2, p.x));
            p.z = Math.max(-3.2, Math.min(3.2, p.z));
            // table
            if (Math.abs(p.x - X0) < 1.6 && p.z < -2.3) p.z = -2.3;
            return;
        }
        p.x = Math.max(pathX(p.z) - 13, Math.min(pathX(p.z) + 13, p.x));
        p.z = Math.min(p.z, 5);
        if (this.gauntlet?.active) return;
        for (const c of this.world.colliders) {
            const dx = p.x - c.x;
            const dz = p.z - c.z;
            if (Math.abs(dx) > 2 || Math.abs(dz) > 2) continue;
            const d = Math.hypot(dx, dz);
            const m = c.r + R;
            if (d < m && d > 0.0001) {
                p.x = c.x + (dx / d) * m;
                p.z = c.z + (dz / d) * m;
            }
        }
        for (const b of this.world.boxes) {
            if (p.y >= b.h - 0.1) continue;
            const ex = b.minx - R, fx = b.maxx + R, ez = b.minz - R, fz = b.maxz + R;
            if (p.x > ex && p.x < fx && p.z > ez && p.z < fz) {
                const pen = [p.x - ex, fx - p.x, p.z - ez, fz - p.z];
                const mi = pen.indexOf(Math.min(...pen));
                if (mi === 0) p.x = ex;
                else if (mi === 1) p.x = fx;
                else if (mi === 2) p.z = ez;
                else p.z = fz;
            }
        }
    }

    private updatePlayer(dt: number): void {
        const k = this.keys;
        let mx = this.touchMove.x;
        let mz = this.touchMove.y;
        if (!this.lockMove && this.pullT < 0) {
            if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1;
            if (k.has('KeyS') || k.has('ArrowDown')) mz += 1;
            if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
            if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
        } else { mx = 0; mz = 0; }
        if (this.dogSit) { if (Math.hypot(mx, mz) > 0.3) this.dogStand(); else { mx = 0; mz = 0; } }
        const gOn = this.gauntlet.active;
        if (gOn) {
            // the long run: the path carries you forward; the player only reacts to what is on it
            mx = 0; mz = -1;
            this.yaw += angDiff(this.yaw, this.gauntlet.heading(this.p.z)) * Math.min(1, dt * 6);
            this.pitch += (0 - this.pitch) * Math.min(1, dt * 5);
            this.p.x += (pathX(this.p.z) - this.p.x) * Math.min(1, dt * 3);
        }
        let auto: THREE.Vector2 | null = null;
        if (this.tapeMode && !gOn && !this.lockMove && this.pullT < 0 && this.state === 'PLAY') {
            auto = this.tapeAuto(dt);
            // the player may only hurry the tape along (or look around); they cannot choose where to walk
            this.tapeFast = k.has('ShiftLeft') || k.has('ShiftRight') || k.has('KeyW') || k.has('ArrowUp') || this.touchRun || this.touchMove.lengthSq() > 0.1;
            if (this.tapeBadge) this.tapeBadge.textContent = this.tapeEnded ? '■ STOP' : this.tapeFast ? '▶▶ FF' : '▶ PLAY';
            if (this.tapeLookT > 0) this.tapeLookT -= dt;
            if (auto && this.tapeLookT <= 0) this.yaw += angDiff(this.yaw, Math.atan2(-auto.x, -auto.y)) * Math.min(1, dt * 1.6);
            mx = 0; mz = auto ? -1 : 0;
        }
        const len = Math.hypot(mx, mz);
        if (len > 1) { mx /= len; mz /= len; }
        const moving = len > 0.1;
        const crouch = !gOn && (((k.has('KeyC') || k.has('ControlLeft')) && !this.lockMove) || this.forceCrouch || this.touchCrouch);
        const wantSprint = k.has('ShiftLeft') || k.has('ShiftRight') || this.touchRun;
        const sprint = gOn || (wantSprint && moving && !crouch && !this.exhausted && this.stamina > 0);
        if (gOn) { this.stamina = 100; this.exhausted = false; } else if (sprint) this.stamina -= 20 * dt;
        else this.stamina = Math.min(100, this.stamina + (moving ? 10 : 18) * dt);
        if (this.stamina <= 0) { this.exhausted = true; this.stamina = 0; }
        if (this.exhausted && this.stamina > 28) this.exhausted = false;
        const speed = gOn ? 5.4 * this.gauntlet.speedFactor : this.tapeMode ? 3.0 * (this.tapeFast ? 2.3 : 1) * this.speedMul : (crouch ? 1.6 : sprint ? 5.6 : 3.2) * this.speedMul;
        const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
        const tvx = auto ? auto.x * speed : (mx * c + mz * s) * speed;
        const tvz = auto ? auto.y * speed : (-mx * s + mz * c) * speed;
        const a = 1 - Math.exp(-12 * dt);
        this.vel.x += (tvx - this.vel.x) * a;
        this.vel.y += (tvz - this.vel.y) * a;
        this.p.x += this.vel.x * dt;
        this.p.z += this.vel.y * dt;
        this.collide();
        // vertical
        const ground = this.groundAt(this.p.x, this.p.z);
        if (this.p.y > ground || this.vy > 0) {
            this.vy -= 14 * dt;
            this.p.y += this.vy * dt;
            if (this.p.y <= ground) { this.p.y = ground; this.vy = 0; this.sfx.step(this.surface(), 0.8); }
        } else { this.p.y = ground; this.vy = 0; }
        // steps
        const sp = Math.hypot(this.vel.x, this.vel.y);
        if (this.p.y <= ground + 0.01) {
            this.stepAcc += sp * dt;
            this.bobT += sp * dt;
            const stride = sprint ? 1.9 : crouch ? 1.0 : 1.4;
            if (this.stepAcc > stride) {
                this.stepAcc = 0;
                this.sfx.step(this.surface(), sprint ? 1.4 : crouch ? 0.4 : 0.9);
            }
        }
        const target = this.headOverride ?? (crouch ? 0.95 : 1.35);
        this.head += (target - this.head) * (1 - Math.exp(-10 * dt));
        if (this.headOverride !== null) this.head = this.headOverride;
    }

    private surface(): 'sand' | 'dirt' | 'concrete' {
        if (this.mode === 'd1') return 'sand';
        if (this.mode === 'd2' || this.mode === 'd3') return 'concrete';
        if (this.mode === 'd4') return 'dirt';
        if (this.mode === 'd5' || this.mode === 'd6' || this.mode === 'd7') return 'concrete';
        if (this.mode === 'in') return 'concrete';
        return this.p.z > -7 ? 'sand' : 'dirt';
    }

    private creatureUpdate(dt: number): void {
        const g = this.rig.group;
        if (this.cState === 'DORMANT' || this.cState === 'CUT') return;
        const px = this.p.x, pz = this.p.z;
        let dx = px - g.position.x;
        let dz = pz - g.position.z;
        const dist = Math.hypot(dx, dz);
        const targetYaw = Math.atan2(-dx, -dz);
        let dy = targetYaw - this.cYaw;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        this.cYaw += dy * Math.min(1, dt * (this.cState === 'CHARGE' ? 6 : 3));
        g.rotation.y = this.cYaw;
        let moveSpeed = 0;
        const pan = this.panTo(g.position.x, g.position.z, dist);
        const near = Math.max(0, 1 - dist / 40);

        switch (this.cState) {
            case 'REVEAL':
                this.cTimer -= dt;
                this.rig.head.rotation.z = Math.sin(this.clock * 1.5) * 0.25;
                this.rig.jawL.rotation.z = 0.5;
                this.rig.jawR.rotation.z = -0.5;
                if (this.cTimer <= 0 || dist < 6) { this.cState = 'ADVANCE'; this.cTimer = 3.8; }
                break;
            case 'ADVANCE':
                moveSpeed = 1.7;
                this.cTimer -= dt;
                if (this.cTimer <= 0) {
                    this.cState = 'CHARGE';
                    this.cPauseIn = 9;
                    this.checkpoint('chase', true);
                    this.objective('RUN. Reach the bunker.');
                    this.say('PROTAGONIST', 'Move. MOVE!', 2);
                    this.sfx.scrape(0.6, pan);
                    track('cleaverback_charge');
                }
                break;
            case 'CHARGE': {
                const onLog = Math.abs(g.position.z - LOG_Z) < 1.6;
                moveSpeed = 5.0 * (onLog ? 0.55 : 1) * (dist > 35 ? 1.3 : 1);
                // intercept: aim slightly ahead of the player's travel
                dx = px + this.vel.x * 0.45 - g.position.x;
                dz = pz + this.vel.y * 0.45 - g.position.z;
                this.cPauseIn -= dt;
                if (this.cPauseIn <= 0) { this.cState = 'PAUSE'; this.cTimer = 4.2; this.cThuds = 0; }
                break;
            }
            case 'PAUSE': {
                // tell: three slow impacts against wood, then it resumes
                const t = 4.2 - this.cTimer;
                this.cTimer -= dt;
                const due = t > 2.8 ? 3 : t > 1.8 ? 2 : t > 0.8 ? 1 : 0;
                if (this.cThuds < due) { this.cThuds++; this.sfx.thud(0.5 * Math.max(0.3, near + 0.3), pan); this.shake = Math.max(this.shake, 0.4 * near); }
                if (this.cTimer <= 0) { this.cState = 'CHARGE'; this.cPauseIn = 9 + Math.random() * 4; }
                break;
            }
            case 'WAIT':
                this.rig.jawL.rotation.z = 0.3;
                this.rig.jawR.rotation.z = -0.3;
                break;
            default:
        }
        if (moveSpeed > 0) {
            const d2 = Math.hypot(dx, dz) || 1;
            g.position.x += (dx / d2) * moveSpeed * dt;
            g.position.z += (dz / d2) * moveSpeed * dt;
            this.cPhase += dt * moveSpeed * 1.8;
            this.cScrapeT -= dt;
            if (this.cScrapeT <= 0) {
                this.cScrapeT = 1.6 + Math.random() * 2.2;
                this.sfx.scrape(0.5 * Math.max(0.15, near), pan);
            }
        }
        // limb animation
        const m = moveSpeed > 0 ? 1 : 0;
        this.rig.arms.forEach((a, i) => { a.rotation.x = Math.sin(this.cPhase + i * 1.6) * 0.7 * m + (this.cState === 'CHARGE' ? -0.6 : 0); });
        this.rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.cPhase + i * Math.PI) * 0.6 * m; });
        this.rig.torso.position.y = 2.2 + Math.sin(this.clock * 2) * 0.04 + Math.abs(Math.sin(this.cPhase)) * 0.1 * m;
        if (this.cState !== 'REVEAL' && this.cState !== 'WAIT') {
            this.rig.head.rotation.z *= 0.9;
            const open = this.cState === 'CHARGE' ? 0.35 : 0.1;
            this.rig.jawL.rotation.z = open;
            this.rig.jawR.rotation.z = -open;
        }
        // heartbeat / dread
        if (this.cState === 'ADVANCE' || this.cState === 'CHARGE' || this.cState === 'PAUSE') {
            this.beatT -= dt;
            if (this.beatT <= 0 && near > 0.05) {
                this.beatT = 0.45 + (1 - near) * 0.7;
                this.sfx.tone(55, 0.25, 0.25 * near, 0, 'sine', 40);
            }
            if ((this.cState === 'ADVANCE' || this.cState === 'CHARGE' || this.cState === 'PAUSE') && dist < 1.9 && this.mode === 'out') this.capture();
        }
    }

    private panTo(x: number, z: number, dist: number): number {
        const rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
        return ((x - this.p.x) * rx + (z - this.p.z) * rz) / Math.max(dist, 1);
    }

    private buildRunner(): void {
        const g = new THREE.Group();
        const jacket = new THREE.MeshStandardMaterial({ color: 0x3a4a3a, roughness: 1 });
        const skin = new THREE.MeshStandardMaterial({ color: 0xb58a74, roughness: 1 });
        const pants = new THREE.MeshStandardMaterial({ color: 0x2a2e38, roughness: 1 });
        const body = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.28), jacket);
        body.position.y = 1.2;
        g.add(body);
        const cam = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.08, 0.06), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        cam.position.set(0, 1.4, -0.16);
        g.add(cam);
        const dot = new THREE.Mesh(new THREE.SphereGeometry(0.015, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
        dot.position.set(0.03, 1.42, -0.2);
        g.add(dot);
        const head = new THREE.Group();
        head.position.y = 1.65;
        const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), skin);
        skull.position.y = 0.15;
        head.add(skull);
        g.add(head);
        const limb = (mat: THREE.Material, w: number, len: number, x: number, y: number): THREE.Group => {
            const pivot = new THREE.Group();
            pivot.position.set(x, y, 0);
            const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
            m.position.y = -len / 2;
            pivot.add(m);
            g.add(pivot);
            return pivot;
        };
        const legs = [limb(pants, 0.17, 0.8, -0.14, 0.8), limb(pants, 0.17, 0.8, 0.14, 0.8)];
        const arms = [limb(jacket, 0.12, 0.6, -0.34, 1.55), limb(jacket, 0.12, 0.6, 0.34, 1.55)];
        g.visible = false;
        this.world.scene.add(g);
        this.runner = g;
        this.runnerParts = { legs, arms, head };
    }

    private cutRunX(run: number, rz: number): number {
        return this.cutX0 + (pathX(rz) - this.cutX0) * Math.min(1, run / 2);
    }

    private talkSurvivor(): void {
        this.survivorTalked = true;
        this.survivorState = 'follow';
        track('survivor_talked');
        this.say('GUIDE', "You made it. Good. I'm the guide they hired to meet your friends out here. Keep your voice down.", 5);
        this.after(5.4, () => this.say('GUIDE', 'Their plane came down north of here. I found their camera tapes. Then something found me. Huge. Wrong-shaped. It carries a blade like a cleaver.', 7.4));
        this.after(13.2, () => this.say('GUIDE', 'It always comes back. Search the camp. There are notes about a bunker. I will stay close.', 5.5));
        this.after(19.2, () => this.say('PROTAGONIST', 'Okay. Okay. Let us be quick.', 3));
        this.objective('Search the camp for clues. The survivor will stay close.');
    }

    private resetSurvivor(): void {
        const s = this.survivor;
        if (this.cp.chase || this.revealed) { this.survivorState = 'gone'; s.visible = false; return; }
        this.survivorState = this.survivorTalked ? 'follow' : 'camp';
        s.visible = true;
        if (this.survivorState === 'follow') s.position.set(pathX(this.p.z + 5), 0, this.p.z + 5);
        else s.position.set(CAMP_X + 3.4, 0, CAMP_Z + 1.8);
        s.rotation.set(0, 0, 0);
    }

    private updateSurvivor(dt: number): void {
        const s = this.survivor, sp = this.survivorParts, p = this.p;
        if (this.mode !== 'out' || this.cutT >= 0) return;
        if (this.survivorState === 'gone' || this.survivorState === 'grabbed') { s.visible = false; return; }
        const dx = p.x - s.position.x, dz = p.z - s.position.z, d = Math.hypot(dx, dz) || 1;
        let moving = 0;
        if (this.survivorState === 'follow') {
            if (d > 15) s.position.set(pathX(p.z + 7), 0, p.z + 7);
            else if (d > 4.2) {
                moving = 1;
                s.position.x += (dx / d) * 3.4 * dt; s.position.z += (dz / d) * 3.4 * dt;
            }
        }
        const face = Math.atan2(-dx, -dz);
        s.rotation.y += angDiff(s.rotation.y, face) * Math.min(1, dt * 4);
        sp.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.clock * 8 + i * Math.PI) * 0.6 * moving; });
        sp.arms.forEach((a, i) => { a.rotation.x = Math.sin(this.clock * 8 + i * Math.PI + Math.PI) * 0.4 * moving; });
        s.rotation.z = moving ? Math.sin(this.clock * 4) * 0.05 : 0;
        s.position.y = 0;
        this.survivorIt.pos.set(s.position.x, 1.3, s.position.z);
    }

    private gauntletDone(gap: number): void {
        this.cState = 'CHARGE';
        this.cPauseIn = 9;
        const gz = this.p.z + Math.max(gap, 13);
        this.rig.group.visible = true;
        this.rig.group.position.set(pathX(gz), 0, gz);
        this.objective('The bunker door. Get inside!');
        this.say('PROTAGONIST', 'The fence! The bunker. GO!', 2.4);
        track('chase_final_stretch');
    }

    /** First-person reveal: freeze, look back, watch the creature take the survivor, then turn forward and run. */
    private startReveal(): void {
        this.revealed = true;
        const bx = this.p.x, bz = this.p.z;
        this.cutZ0 = bz; this.cutX0 = bx; this.cutYaw0 = this.yaw;
        this.cutT = 0;
        this.cState = 'CUT';
        this.rig.group.visible = true;
        this.rig.group.position.set(pathX(bz + 34), 0, bz + 34);
        this.rig.group.rotation.y = 0;
        this.survivorState = 'grabbed';
        this.survivor.visible = true;
        this.survivor.position.set(bx + 1.1, 0, bz + 4.6);
        this.survivor.rotation.set(0, 0, 0);
        this.state = 'CINE';
        this.lockMove = true;
        this.vel.set(0, 0);
        this.objective('...');
        this.sfx.staticBurst(0.4, 0.12);
        this.sfx.thud(0.6);
        if (!this.settings.reducedFlash) {
            this.ui.fade.style.background = '#fff'; this.fadeTo(0.5, 0.04);
            this.after(0.14, () => { this.fadeTo(0, 0.5); this.after(0.7, () => { this.ui.fade.style.background = '#000'; }); });
        }
        this.after(0.5, () => this.say('GUIDE', "Don't turn around. Please... don't.", 2.6));
        this.after(2.3, () => { this.sfx.scrape(0.6, 0); this.say('GUIDE', 'It found us— RUN!', 2.4); });
        for (let i = 0; i < 8; i++) this.after(2.3 + i * 0.4, () => { this.sfx.thud(0.25 + i * 0.08, 0); this.shake = Math.max(this.shake, 0.2 + i * 0.07); });
        this.after(5.3, () => { this.sfx.tone(950, 1.6, 0.15, 0, 'sawtooth', 260); this.sfx.noise(1.5, 2200, 1, 0.1, 0, 'bandpass', 500); this.shake = 1; track('survivor_killed'); });
        this.after(6.9, () => { this.sfx.thud(0.9); this.sfx.staticBurst(0.15, 0.1); });
        this.after(7.4, () => { this.sfx.lastCry(); this.shake = 1; });
        this.after(8.1, () => this.say('PROTAGONIST', 'No. No, no, no. RUN.', 2.4));
        track('cleaverback_revealed');
    }

    private cutUpdate(dt: number): void {
        if (this.cutT < 0) return;
        this.cutT += dt;
        const t = this.cutT;
        const ss = (a: number, b: number, v: number) => { const k = Math.max(0, Math.min(1, (v - a) / (b - a))); return k * k * (3 - 2 * k); };
        const rig = this.rig, sv = this.survivor, sp = this.survivorParts;
        const bx = this.cutX0, bz = this.cutZ0;
        const sx = bx + 1.1, sz = bz + 4.6;
        const cx0 = pathX(bz + 34), cz0 = bz + 34;
        const gx = sx, gz = sz + 1.9;
        // camera: freeze, whip back toward the creature, hold, then turn forward again
        const face = Math.atan2(-(cx0 - bx), -(cz0 - bz));
        const faceAdj = this.cutYaw0 + angDiff(this.cutYaw0, face);
        const fwd = faceAdj + angDiff(faceAdj, Math.atan2(0.315 * Math.cos(bz * 0.045), 1));
        const turnIn = ss(0.9, 2.2, t), turnOut = ss(8.8, 10, t);
        this.yaw = t > 8.8 ? faceAdj + (fwd - faceAdj) * turnOut : this.cutYaw0 + (faceAdj - this.cutYaw0) * turnIn;
        this.pitch = 0.1 * turnIn * (1 - turnOut);
        // creature: runs in, seizes the survivor, then stares at you and roars
        let cxp = cx0, czp = cz0;
        if (t >= 2.2) { const k = Math.min(1, (t - 2.2) / 3.1); cxp = cx0 + (gx - cx0) * k; czp = cz0 + (gz - cz0) * k; }
        rig.group.position.set(cxp, 0, czp);
        const running = t >= 2.2 && t < 5.3;
        if (running) {
            this.cPhase += dt * 14;
            rig.arms.forEach((a, i) => { a.rotation.x = Math.sin(this.cPhase + i * 1.6) * 0.7 - 0.6; });
            rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.cPhase + i * Math.PI) * 0.7; });
            rig.torso.position.y = 2.2 + Math.abs(Math.sin(this.cPhase)) * 0.12;
            rig.jawL.rotation.z = 0.4; rig.jawR.rotation.z = -0.4;
        } else if (t >= 5.3) {
            rig.arms.forEach((a) => { a.rotation.x = -2.0; });
            rig.legs.forEach((l) => { l.rotation.x = 0; });
            const roar = t >= 7.4 && t < 8.8;
            const open = roar ? 0.9 : 0.5;
            rig.jawL.rotation.z = open; rig.jawR.rotation.z = -open;
            if (roar) { rig.group.position.x += Math.sin(t * 60) * 0.03; this.shake = Math.max(this.shake, 0.6); }
        } else {
            rig.jawL.rotation.z = 0.15; rig.jawR.rotation.z = -0.15;
        }
        // survivor: warns, turns, is lifted, then is gone
        if (t < 6.9) {
            if (t < 2.3) sv.rotation.y = 0;
            else if (t < 5.3) {
                sv.rotation.y += angDiff(sv.rotation.y, Math.PI) * Math.min(1, dt * 8);
                sp.arms.forEach((a) => { a.rotation.x = -0.9 + Math.sin(t * 12) * 0.2; });
            } else {
                sv.position.set(rig.group.position.x, 2.7 + Math.sin(t * 18) * 0.12, rig.group.position.z - 1.0);
                sv.rotation.z = Math.sin(t * 26) * 0.7;
                sp.arms.forEach((a, i) => { a.rotation.x = Math.sin(t * 30 + i * 2) * 1.3; });
                sp.legs.forEach((l, i) => { l.rotation.x = Math.sin(t * 24 + i * 2) * 0.9; });
            }
            sv.visible = true;
        } else sv.visible = false;
        this.beatT -= dt;
        if (this.beatT <= 0 && t < 5.3) { this.beatT = 0.6; this.sfx.tone(55, 0.25, 0.2, 0, 'sine', 40); }
        if (t < 10) return;
        // hand control back: turn forward and start the obstacle run
        this.cutT = -1;
        this.cState = 'DORMANT';
        this.survivorState = 'gone';
        sv.visible = false;
        rig.arms.forEach((a) => { a.rotation.x = 0; });
        rig.jawL.rotation.z = 0.3; rig.jawR.rotation.z = -0.3;
        this.yaw = fwd;
        this.pitch = 0;
        this.vel.set(0, 0);
        this.lockMove = false;
        this.state = 'PLAY';
        this.sfx.scrape(0.6, 0);
        track('cleaverback_charge');
        this.gauntlet.start(false);
    }

    private cutCamera(): void {
        // The reveal stays in first person: updateCamera already follows yaw/pitch.
    }

    private updateTriggers(): void {
        if (this.mode !== 'out') return;
        const p = this.p;
        if (!this.forkDone && p.z < -30) { this.forkDone = true; this.checkpoint('fork'); }
        if (!this.campArrived && Math.hypot(p.x - CAMP_X, p.z - CAMP_Z) < 14) {
            this.campArrived = true;
            this.checkpoint('camp');
            this.say('PROTAGONIST', 'Hello? Anybody? Where the hell is everybody?', 4);
            this.objective('Search the camp (find clues).');
        }
        if (this.campArrived && !this.scraped && this.clues.size >= 2) {
            this.scraped = true;
            this.sfx.scrape(0.35, 0.8);
            this.after(1.8, () => this.say('PROTAGONIST', '...Did you hear that? Something metal. In the trees.', 3.5));
        }
        if (this.campArrived && !this.revealed && this.state === 'PLAY' && (this.clues.size >= 4 || p.z < -68)) this.startReveal();
        if (this.revealed && this.cState === 'CHARGE') {
            if (p.z < LOG_Z - 8 && this.cp.id !== 'log' && this.cp.id !== 'gate' && this.cp.id !== 'bunker') this.checkpoint('log', true);
            if (p.z < -190 && this.cp.id !== 'gate') { this.checkpoint('gate', true); this.objective('The bunker door. Get inside!'); }
        }
    }

    private updateInteraction(): void {
        let best: Interactable | null = null;
        let bd = 1e9;
        if (this.state === 'PLAY') {
            const cam = this.camera.position;
            const fwd = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
            for (const it of this.interactables) {
                if (it.mode !== this.mode || !it.enabled()) continue;
                const to = it.pos.clone().sub(cam);
                const d = to.length();
                if (d > it.range + 0.4) continue;
                to.normalize();
                if (to.dot(fwd) < 0.55 && d > 1.2) continue;
                if (d < bd) { bd = d; best = it; }
            }
        }
        if (this.tapeMode) best = null;
        this.currentInteract = best;
        this.ui.prompt.style.display = best ? 'block' : 'none';
        if (best) this.ui.prompt.textContent = (this.isTouch() ? '[E] ' : '[E]  ') + best.label;
        const nearLog = this.mode === 'out' && !this.gauntlet.active && Math.abs(this.p.z - LOG_Z) < 3.2 && this.p.z > LOG_Z && this.p.y < 0.3;
        const hintText = this.extraHint ?? (nearLog ? 'SPACE — vault over the log' : null);
        this.ui.hint.style.display = hintText && this.state === 'PLAY' ? 'block' : 'none';
        this.ui.hint.textContent = hintText ?? '';
    }

    private updateWorld(dt: number): void {
        const w = this.world;
        w.fire.intensity = 55 + Math.sin(this.clock * 17) * 8 + Math.random() * 8;
        w.beaconGlow.scale.setScalar(14 + Math.sin(this.clock * 2) * 2);
        w.mastLight.visible = Math.floor(this.clock * 0.9) % 2 === 0;
        w.floodLight.intensity = Math.random() < 0.04 && !this.settings.reducedFlash ? 15 : 70;
        w.phone.position.x += Math.sin(this.clock * 40) * 0.0004 * (Math.sin(this.clock * 0.7) > 0.8 ? 1 : 0);
        // rain follows the camera
        const attr = this.rain.geometry.getAttribute('position') as THREE.BufferAttribute;
        const arr = attr.array as Float32Array;
        const cx = this.camera.position.x, cz = this.camera.position.z;
        for (let i = 0; i < arr.length; i += 6) {
            arr[i + 1] -= 22 * dt; arr[i + 4] -= 22 * dt;
            if (arr[i + 1] < 0) {
                let x = cx + (Math.random() - 0.5) * 36;
                const z = cz + (Math.random() - 0.5) * 36;
                if (Math.hypot(x - cx, z - cz) < 1.6) x += 2.5; // keep drops off the lens
                const y = 16 + Math.random() * 2;
                arr[i] = x; arr[i + 1] = y; arr[i + 2] = z;
                arr[i + 3] = x + 0.03; arr[i + 4] = y + 0.45; arr[i + 5] = z;
            }
        }
        attr.needsUpdate = true;
        // lightning (single gentle pulse; disabled with reduced flashes)
        const hemi = w.scene.getObjectByName('hemi') as THREE.HemisphereLight;
        if (this.mode === 'out' && !this.cabinOn) {
            if (!this.settings.reducedFlash) {
                this.lightningT -= dt;
                if (this.lightningT <= 0) { this.lightningT = 16 + Math.random() * 18; this.flashAmt = 0.6; }
            }
            this.flashAmt = Math.max(0, this.flashAmt - dt * 2.2);
            hemi.intensity = 1.4 + this.flashAmt * 1.3;
        }
        // bunker lights
        if (this.mode === 'in') {
            const b = this.bunker;
            if (this.powered) b.light.intensity = (Math.random() < 0.03 ? 6 : 16);
            else b.light.intensity = 3.5 + Math.sin(this.clock * 3) * 0.6;
            b.clockHand.rotation.z = -this.clock * (this.tapeIn ? -3 : 0.5);
            this.crtT -= dt;
            if (this.crtT <= 0 && this.crtMode !== 'frozen' && this.crtMode !== 'off') { this.crtT = 0.07; this.drawCrt(); }
            if (this.talk > 0) this.talk -= dt;
            for (const d of b.doors) if (d.visible && d.scale.y < 1) d.scale.y = Math.min(1, d.scale.y + dt * 0.7);
            if (this.tapeIn && this.powered) {
                b.walls.rotation.z = Math.sin(this.clock * 1.3) * 0.015 * (this.doorsOut() ? 1 : 0);
            }
            if (this.pullT >= 0) {
                this.pullT += dt;
                const k = Math.min(1, this.pullT / 5.5);
                b.crtGroup.scale.setScalar(1 + k * k * 5);
                const tx = X0 - 0.5, tz = -2.9 + 1.2;
                this.p.x += (tx - this.p.x) * dt * 0.7;
                this.p.z += (tz - this.p.z) * dt * 0.5;
                const ang = Math.atan2(-(tx - this.p.x), -(-2.9 - this.p.z));
                let d = ang - this.yaw;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                this.yaw += d * dt * 3;
                this.pitch += (0.1 - this.pitch) * dt * 3;
                this.camera.fov = 75 + k * 25;
                this.camera.updateProjectionMatrix();
                this.shake = Math.max(this.shake, 0.3 + k * 0.5);
                if (this.crtMode === 'frozen') this.crtMode = 'face';
            }
        }
    }

    private doorsOut(): boolean {
        return this.bunker.doors[0].visible;
    }

    private drawCrt(): void {
        const c = this.bunker.crtCanvas;
        const x = c.getContext('2d')!;
        const W = c.width, H = c.height;
        if (this.crtMode === 'off') {
            x.fillStyle = '#050505';
            x.fillRect(0, 0, W, H);
        } else if (this.crtMode === 'static') {
            for (let i = 0; i < 120; i++) {
                const v = Math.random() * 255 | 0;
                x.fillStyle = `rgb(${v},${v},${v})`;
                x.fillRect(Math.random() * W, Math.random() * H, 30 + Math.random() * 40, 3 + Math.random() * 6);
            }
        } else {
            // corrupted children's set: pastel stripes behind a figure of cassette spools and tape ribbon
            const cols = ['#5a4a6a', '#4a6a6a', '#6a5a4a', '#4a5a7a'];
            for (let i = 0; i < 8; i++) { x.fillStyle = cols[i % 4]; x.fillRect((i * W) / 8, 0, W / 8 + 1, H); }
            x.fillStyle = '#0a0a0c';
            x.beginPath(); x.moveTo(60, H); x.lineTo(90, 100); x.lineTo(166, 100); x.lineTo(196, H); x.fill();
            x.fillStyle = '#151518';
            x.fillRect(88, 30, 80, 70);
            const t = this.clock * 4;
            for (const ex of [108, 148]) {
                x.fillStyle = '#e6a020';
                x.beginPath(); x.arc(ex, 62, 15, 0, 7); x.fill();
                x.strokeStyle = '#2a1a00'; x.lineWidth = 3;
                for (let s = 0; s < 3; s++) {
                    const a = t + (s * Math.PI * 2) / 3;
                    x.beginPath(); x.moveTo(ex, 62); x.lineTo(ex + Math.cos(a) * 13, 62 + Math.sin(a) * 13); x.stroke();
                }
            }
            x.strokeStyle = '#b8b8c0'; x.lineWidth = 2; x.beginPath(); x.moveTo(98, 88);
            const amp = this.talk > 0 ? 3 + Math.random() * 8 : 1;
            for (let i = 0; i < 12; i++) x.lineTo(98 + i * 6, 88 + (i % 2 ? amp : -amp * 0.4));
            x.stroke();
            for (let i = 0; i < 24; i++) {
                x.fillStyle = `rgba(255,255,255,${Math.random() * 0.25})`;
                x.fillRect(0, Math.random() * H, W, 1 + Math.random() * 2);
            }
        }
        this.bunker.crtTex.needsUpdate = true;
    }

    private updateCamera(dt: number): void {
        const cam = this.camera;
        const rm = this.settings.reducedMotion ? 0.15 : 1;
        const sp = Math.hypot(this.vel.x, this.vel.y);
        const stress = this.cState === 'CHARGE' || this.cState === 'ADVANCE' || this.cState === 'PAUSE'
            ? Math.max(0, 1 - Math.hypot(this.rig.group.position.x - this.p.x, this.rig.group.position.z - this.p.z) / 35) : 0;
        const bob = Math.sin(this.bobT * 4.2) * 0.035 * Math.min(1, sp / 3) * rm;
        const tremor = (0.002 + stress * 0.006) * rm;
        this.shake = Math.max(0, this.shake - dt * 1.5);
        const sh = this.shake * 0.04 * rm;
        let y = this.p.y + this.head + bob;
        let roll = -this.vel.x * 0.002 * rm + (this.cabinOn ? Math.sin(this.clock * 1.3) * 0.035 * rm : 0);
        if (this.state === 'CAPTURED') {
            this.capT += dt;
            const k = Math.min(1, this.capT / 0.6);
            y = this.p.y + this.head * (1 - 0.75 * k);
            roll = 0.9 * k;
            this.pitch += (-0.8 - this.pitch) * dt * 5;
        }
        if (this.forcedLook) {
            const f = this.forcedLook;
            if (this.clock > f.until) this.forcedLook = null;
            else {
                const ang = Math.atan2(-(f.x - this.p.x), -(f.z - this.p.z));
                let d = ang - this.yaw;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                d = Math.max(-1.2, Math.min(1.2, d)); // never a full 180° snap
                this.yaw += d * Math.min(1, dt * 2.5);
            }
        }
        cam.position.set(this.p.x + (Math.random() - 0.5) * sh, y + (Math.random() - 0.5) * sh, this.p.z + (Math.random() - 0.5) * sh);
        cam.rotation.set(this.pitch + (Math.random() - 0.5) * tremor, this.yaw + (Math.random() - 0.5) * tremor, roll);
        this.hands.position.y = Math.sin(this.bobT * 4.2 + 1) * 0.008 * rm + Math.sin(this.clock * 9) * tremor * 2;
        if (this.pullT < 0 && cam.fov !== 75) { cam.fov = 75; cam.updateProjectionMatrix(); }
        if (this.cutT >= 0) this.cutCamera();
        if (this.state === 'CAPTURED') {
            this.runner.position.y = this.p.y - Math.min(0.5, this.capT * 0.3);
            cam.position.set(this.p.x + 2.8, this.p.y + 1.5, this.p.z + 4.5); cam.lookAt(this.p.x, this.p.y + 0.75, this.p.z);
        }
        if (this.mode === 'passage') this.passages.camera();
    }

    private adaptQuality(dt: number): void {
        this.perfAcc += dt;
        this.perfN++;
        if (this.perfAcc < 2) return;
        const avg = this.perfAcc / this.perfN;
        this.perfAcc = 0;
        this.perfN = 0;
        let next = this.pr;
        if (avg > 1 / 28 && this.pr > 0.55) next = Math.max(0.55, this.pr * 0.8);
        else if (avg < 1 / 52 && this.pr < this.maxPR) next = Math.min(this.maxPR, this.pr * 1.15);
        if (Math.abs(next - this.pr) > 0.01) {
            this.pr = next;
            this.renderer.setPixelRatio(next);
            this.resize();
            track('quality_scaled', { ratio: Math.round(next * 100) / 100 });
        }
    }

    /** The next thing to do, indoors: a day's own explicit target, else the first open, unused interaction in route order. */
    private objectiveTarget(): { x: number; y: number; z: number; label: string } | null {
        if (this.mode === 'd1') { const w = this.day1.waypoint(); if (w) return w; }
        const it = this.interactables.find((i) => i.mode === this.mode && !i.used && i.enabled());
        if (!it) return null;
        return { x: it.pos.x, y: it.pos.y + 0.3, z: it.pos.z, label: it.label.toUpperCase() };
    }

    private updateWayfinding(): void {
        const outdoor = this.mode === 'out' && !this.cabinOn && !this.tapeMode && (this.state === 'PLAY' || this.state === 'CINE');
        const inside = this.mode !== 'out';
        const indoor = inside && !this.cabinOn && !this.tapeMode && this.state === 'PLAY' && !this.lockMove && !this.gauntlet.active;
        const show = outdoor || indoor;
        let tx = 0, tz = 0, ty = 2, label = '';
        if (outdoor) {
            if (this.revealed || this.clues.has('paper')) { tx = BUN_X; tz = BUN_DOOR_Z; ty = 3; label = 'BUNKER'; }
            else if (!this.campArrived) { tx = CAMP_X; tz = CAMP_Z; label = 'CAMP'; }
        } else if (indoor) {
            const t = this.objectiveTarget();
            // close enough to act on it: the prompt takes over, the marker steps aside
            if (t && Math.hypot(t.x - this.p.x, t.z - this.p.z) > 2.4) { tx = t.x; ty = t.y; tz = t.z; label = t.label; }
        }
        const on = show && label !== '';
        this.compass.style.display = show ? 'block' : 'none';
        this.compassDist.style.display = on ? 'block' : 'none';
        this.wp.style.display = on ? 'block' : 'none';
        if (!show) return;
        const half = 130;
        const ppd = 2.1;
        const yawDeg = (this.yaw * 180) / Math.PI;
        const norm = (d: number) => ((((d + 180) % 360) + 360) % 360) - 180;
        this.compassEls.forEach((e, i) => {
            const d = norm(i * 45 - yawDeg);
            e.style.display = Math.abs(d) < 62 ? 'block' : 'none';
            e.style.left = half - d * ppd + 'px';
        });
        if (!on) { this.compassTarget.style.display = 'none'; return; }
        const dx = tx - this.p.x, dz = tz - this.p.z;
        const dist = Math.hypot(dx, dz);
        const rel = norm((Math.atan2(-dx, -dz) * 180) / Math.PI - yawDeg);
        this.compassTarget.style.display = Math.abs(rel) < 62 ? 'block' : 'none';
        this.compassTarget.style.left = half - rel * ppd + 'px';
        this.compassDist.textContent = label + ' ' + Math.round(dist) + ' m';
        const v = new THREE.Vector3(tx, ty, tz).project(this.camera);
        let sx = v.x, sy = v.y;
        if (v.z > 1) { sx = rel > 0 ? -0.9 : 0.9; sy = 0; }
        sx = Math.max(-0.88, Math.min(0.88, sx));
        sy = Math.max(-0.7, Math.min(0.75, sy));
        this.wp.style.left = (sx * 0.5 + 0.5) * 100 + '%';
        this.wp.style.top = (-sy * 0.5 + 0.5) * 100 + '%';
        this.wp.innerHTML = '◆<br>' + label + '<br>' + Math.round(dist) + ' m';
    }

    private audioLevels(): void {
        if (this.cabinOn) { this.sfx.setLevels(0, 0.07, 0.03, this.cabinStress); return; }
        if (this.mode === 'd1') { this.sfx.setLevels(0, 0, 0.05, 0.02); return; }
        if (this.mode === 'd2') { this.sfx.setLevels(0, 0, 0.02, 0.02); return; }
        if (this.mode === 'd3') { this.sfx.setLevels(0, 0, 0.005, 0.03); return; }
        if (this.mode === 'd4') { this.sfx.setLevels(0.03, 0, 0, 0.03); return; }
        if (this.mode === 'd5') { this.sfx.setLevels(0, 0, 0, 0.015); return; }
        if (this.mode === 'd6') { this.sfx.setLevels(0, 0, 0.01, 0.015); return; }
        if (this.mode === 'd7') { this.sfx.setLevels(0, 0, 0.004, this.d7Drone); return; }
        if (this.mode === 'passage') { this.sfx.setLevels(0, 0, 0, 0); return; }
        if (this.mode === 'in') {
            this.sfx.setLevels(0.02, 0, this.powered ? 0.04 : 0.008, 0.02);
        } else {
            const surf = Math.max(0, 1 - Math.abs(this.p.z) / 45) * 0.22;
            const bd = Math.hypot(this.p.x - BUN_X, this.p.z - BUN_DOOR_Z);
            this.sfx.setLevels(0.045, surf, Math.pow(Math.max(0, 1 - bd / 90), 1.6) * 0.14, this.cState === 'CHARGE' ? 0.05 : 0);
        }
    }

    private loop = (now: number): void => {
        if (this.disposed) return;
        this.raf = requestAnimationFrame(this.loop);
        const dt = Math.min(0.05, (now - this.last) / 1000);
        this.last = now;
        if (this.state !== 'PAUSE' && this.state !== 'START') {
            this.clock += dt;
            this.adaptQuality(dt);
            for (let i = this.timers.length - 1; i >= 0; i--) {
                const t0 = this.timers[i];
                if (t0 && this.clock >= t0.at) {
                    this.timers.splice(i, 1);
                    t0.fn();
                }
            }
            if (this.state === 'PLAY' || this.state === 'CINE') {
                this.updatePlayer(dt);
                this.creatureUpdate(dt);
                this.cutUpdate(dt);
                this.gauntlet.update(dt);
                if (this.cabinOn) this.boat.tick(dt, Math.min(1, (this.clock - this.boatStart) / 34));
                this.updateSurvivor(dt);
                this.updateDog(dt);
                if (this.mode === 'd1') this.day1.update(dt);
                if (this.mode === 'd2') this.day2.update(dt);
                if (this.mode === 'd3') this.day3.update(dt);
                if (this.mode === 'd4') this.day4.update(dt);
                if (this.mode === 'd5') this.day5.update(dt);
                if (this.mode === 'd6') this.day6.update(dt);
                if (this.mode === 'd7') this.day7.update(dt);
                if (this.mode === 'passage') this.passages.update(dt);
                if (this.state === 'PLAY') this.updateTriggers();
            } else if (this.state === 'CAPTURED') {
                this.vel.set(0, 0);
            }
            this.updateWorld(dt);
            this.updateInteraction();
            this.updateWayfinding();
            this.audioLevels();
            this.recSeconds += dt;
            if (this.subTimer > 0) {
                this.subTimer -= dt;
                if (this.subTimer <= 0) this.ui.sub.innerHTML = '';
            }
            this.ui.stam.style.width = this.stamina + '%';
            this.ui.stam.style.background = this.exhausted ? '#ff8a6a' : '#9fd8ff';
            const s = Math.floor(this.recSeconds);
            const pad = (n: number) => String(n).padStart(2, '0');
            this.ui.rec.textContent = (Math.floor(this.recSeconds * 2) % 2 ? '● ' : '○ ') + 'REC ' + pad(Math.floor(s / 3600)) + ':' + pad(Math.floor(s / 60) % 60) + ':' + pad(s % 60);
        }
        this.updateCamera(state0(this.state) ? 0 : dt);
        if (this.state === 'START') {
            this.camera.position.set(0, 1.6, 1.5);
            this.camera.rotation.set(0, Math.sin(now / 4000) * 0.4, 0);
        }
        if (!(window as unknown as { __sd_norender?: boolean }).__sd_norender) this.renderer.render(this.world.scene, this.camera);
    };

    dispose(): void {
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        this.cleanup.forEach((f) => f());
        if (document.pointerLockElement) document.exitPointerLock();
        this.renderer.dispose();
        this.world.scene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.geometry) m.geometry.dispose();
        });
        void this.sfx.ctx?.close();
        this.root.remove();
    }
}

function state0(s: GState): boolean {
    return s === 'PAUSE' || s === 'START';
}

// keep glowSprite referenced for tree-shaking-safe future use
void glowSprite;
