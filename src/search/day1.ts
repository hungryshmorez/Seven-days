import * as THREE from 'three';
import type { Sfx } from './audio.ts';
import { buildMoppet, type MoppetRig } from './moppet.ts';

/** DAY ONE — THE ABANDONED MALL. Grid-based mall corridor maze with authored loops (storefronts, tiled floors, dead fountains). */
export const X1 = 600;
const CELL = 4;
const W = 34;
const H = 22;
const WALL_H = 4.2;

export interface D1Interact {
    id: string;
    label: string;
    pos: THREE.Vector3;
    range: number;
    enabled: () => boolean;
    run: () => void;
}

export interface D1Ctx {
    camera: THREE.PerspectiveCamera;
    sfx: Sfx;
    p: THREE.Vector3;
    vel: THREE.Vector2;
    say(who: string, text: string, dur?: number): void;
    objective(t: string): void;
    after(t: number, fn: () => void): void;
    fadeTo(o: number, s: number): void;
    card(lines: string[], ms: number): void;
    checkpoint(id: string): void;
    capture(): void;
    track(n: string, p?: Record<string, unknown>): void;
    getYaw(): number;
    setYaw(y: number): void;
    setPitch(p: number): void;
    lock(b: boolean): void;
    setHead(h: number | null): void;
    setForceCrouch(b: boolean): void;
    setSpeedMul(m: number): void;
    isCrouching(): boolean;
    isSecondCycle(): boolean;
    isFriendAlive(name: string): boolean;
    killFriend(name: string): void;
    setHandColor(c: number | null): void;
    setAmbient(v: number): void;
    giveFlashlight(): void;
    resetRec(): void;
    endChapter(lines: string[], note: string): void;
    nextChapter(id: string): void;
    hint(t: string | null): void;
    mute(b: boolean): void;
    reducedFlash(): boolean;
    fadeColor(css: string): void;
    showHands(b: boolean): void;
    setDrone(v: number): void;
    finaleLine(t: string): void;
    finaleClear(): void;
    finaleButton(label: string | null, fn?: () => void): void;
    exitToMenu(): void;
    /** The quiet ending: the dream lets go. */
    wake(): void;
}

type MState = 'IDLE' | 'ADVANCE' | 'PATROL' | 'NOTICE' | 'PURSUE' | 'SEARCH' | 'SCRIPTED' | 'DOOR';
type Stage = 'none' | 'intro' | 'explore' | 'sighted' | 'chase' | 'closet' | 'blocked' | 'powered' | 'watching' | 'finale' | 'collapse' | 'done';

const cx = (c: number) => X1 + (c + 0.5) * CELL;
const cz = (r: number) => (r + 0.5) * CELL;

function canvasTex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, rep?: [number, number]): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
}

export class Day1 {
    group = new THREE.Group();
    interactables: D1Interact[] = [];
    private grid = new Uint8Array(W * H).fill(1);
    private t = 0;
    private stage: Stage = 'none';
    private wallGroup = new THREE.Group();
    private ceiling!: THREE.Mesh;
    private panels!: THREE.InstancedMesh;
    private panelPos: THREE.Vector3[] = [];
    private panelOn: boolean[] = [];
    private panelRed: boolean[] = [];
    private fixN = 0; private fixE = 0; private fixS = 0;
    private lights: THREE.PointLight[] = [];
    private lightT = 0;
    private blackT = -1;
    private blackRank: number[] = [];
    private blackout = false;
    private surgeT = 0;

    // story
    private trav = 1;
    private solved = false;
    private sighted = false;
    private advanceT = 0;
    private tag = false;
    private rule = false;
    private blockaded = false;
    private brkLed: Record<string, THREE.Mesh> = {};
    private brkLight!: THREE.PointLight;
    private breaker: string[] = [];
    private powered = false;
    private watched = false;
    private introT = -1;
    private cpId = 'd1_arrival';
    private cpMop = { x: cx(26), z: cz(3) };
    private roomAEntered = false;
    private wrongBusy = false;
    private chairTipped = false;
    private fingerDone = false;
    private ambT = 8;
    private waterT = 0;

    // props that change
    private cup!: THREE.Mesh;
    private stain!: THREE.Mesh;
    private chair!: THREE.Mesh;
    private extraChair!: THREE.Mesh;
    private shelf!: THREE.Mesh;
    private termScreen!: THREE.Mesh;
    private termCanvas!: HTMLCanvasElement;
    private termTex!: THREE.CanvasTexture;
    private termMode: 'off' | 'flicker' | 'rec' = 'off';
    private recT = 0;
    private exitDoor!: THREE.Group;
    private doorLight!: THREE.PointLight;
    private finger!: THREE.Group;
    private water!: THREE.Mesh;

    // moppet
    private rig: MoppetRig;
    private mx = cx(26);
    private mz = cz(3);
    private myaw = Math.PI / 2;
    private mState: MState = 'IDLE';
    private mTimer = 0;
    private mRaise = 0;
    private mFlood: Int16Array = new Int16Array(W * H);
    private mFloodT = 0;
    private mSeeT = 0;
    private mLastKnown: [number, number] = [26, 3];
    private mLunge = 0;
    private mTick = 0;
    private mPatrolI = 0;
    private mKnock = 0;
    private hasLos = false;
    private lookedAt = false;

    constructor(private ctx: D1Ctx) {
        const rects: [number, number, number, number][] = [
            [2, 8, 5, 11], [6, 9, 8, 9], [9, 6, 14, 12], [10, 3, 10, 5], [10, 3, 26, 3], [15, 9, 17, 9], [12, 13, 12, 15],
            [18, 4, 18, 10], [17, 10, 20, 12], [21, 11, 21, 11], [22, 9, 28, 13], [25, 14, 25, 15], [25, 16, 25, 16],
            [24, 17, 26, 19], [27, 18, 33, 18],
        ];
        for (const [a, b, c, d] of rects) for (let r = b; r <= d; r++) for (let q = a; q <= c; q++) this.grid[r * W + q] = 0;
        this.rig = buildMoppet();
        this.buildGeometry();
        this.buildProps();
        this.buildInteractables();
        this.group.add(this.rig.group);
        this.group.visible = false;
    }

    echoes(): { name: string; model: THREE.Group }[] { return [{ name: 'The Moppet', model: this.rig.group }]; }

    // ───────────── grid helpers ─────────────
    private isWall(c: number, r: number): boolean {
        return c < 0 || r < 0 || c >= W || r >= H || this.grid[r * W + c] === 1;
    }
    private cellOf(x: number, z: number): [number, number] {
        return [Math.floor((x - X1) / CELL), Math.floor(z / CELL)];
    }
    private los(ax: number, az: number, bx: number, bz: number): boolean {
        const d = Math.hypot(bx - ax, bz - az);
        const n = Math.ceil(d / 0.5);
        for (let i = 1; i < n; i++) {
            const k = i / n;
            const [c, r] = this.cellOf(ax + (bx - ax) * k, az + (bz - az) * k);
            if (this.isWall(c, r)) return false;
        }
        return true;
    }
    collide(p: THREE.Vector3): void {
        const R = 0.35;
        const [c0, r0] = this.cellOf(p.x, p.z);
        for (let r = r0 - 1; r <= r0 + 1; r++) {
            for (let c = c0 - 1; c <= c0 + 1; c++) {
                if (!this.isWall(c, r)) continue;
                const minx = X1 + c * CELL, maxx = minx + CELL, minz = r * CELL, maxz = minz + CELL;
                const qx = Math.max(minx, Math.min(p.x, maxx));
                const qz = Math.max(minz, Math.min(p.z, maxz));
                const dx = p.x - qx, dz = p.z - qz;
                const d = Math.hypot(dx, dz);
                if (d < R && d > 0.0001) { p.x = qx + (dx / d) * R; p.z = qz + (dz / d) * R; }
                else if (d <= 0.0001) {
                    const pen = [p.x - minx, maxx - p.x, p.z - minz, maxz - p.z];
                    const mi = pen.indexOf(Math.min(...pen));
                    if (mi === 0) p.x = minx - R; else if (mi === 1) p.x = maxx + R; else if (mi === 2) p.z = minz - R; else p.z = maxz + R;
                }
            }
        }
    }

    // ───────────── geometry ─────────────
    private buildGeometry(): void {
        const g = this.group;
        // mall walls: faded beige tile with a dull teal storefront band near the floor
        const wallTex = canvasTex(128, 128, (x) => {
            x.fillStyle = '#a8a293'; x.fillRect(0, 0, 128, 128);
            x.fillStyle = '#4a6f6a'; x.fillRect(0, 96, 128, 14);
            for (let i = 0; i < 128; i += 32) { x.fillStyle = 'rgba(70,64,52,0.35)'; x.fillRect(i, 0, 2, 96); }
            for (let i = 0; i < 200; i++) { x.fillStyle = `rgba(60,55,40,${Math.random() * 0.12})`; x.fillRect(Math.random() * 128, Math.random() * 128, 6, 6); }
        });
        // mall floor: cracked grey-and-cream tile
        const carpetTex = canvasTex(128, 128, (x) => {
            x.fillStyle = '#8e8a7e'; x.fillRect(0, 0, 128, 128);
            x.strokeStyle = 'rgba(60,58,50,0.5)'; x.lineWidth = 2;
            for (let i = 0; i <= 128; i += 32) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i, 128); x.stroke(); x.beginPath(); x.moveTo(0, i); x.lineTo(128, i); x.stroke(); }
            for (let i = 0; i < 1500; i++) { const v = 110 + Math.random() * 40; x.fillStyle = `rgb(${v},${v},${v * 0.92})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
        }, [W * 2, H * 2]);
        // mall ceiling: grey acoustic tile
        const ceilTex = canvasTex(64, 64, (x) => {
            x.fillStyle = '#7d7d78'; x.fillRect(0, 0, 64, 64);
            x.strokeStyle = '#55554f'; x.lineWidth = 2; x.strokeRect(0, 0, 64, 64);
            for (let i = 0; i < 80; i++) { x.fillStyle = 'rgba(60,50,20,0.25)'; x.fillRect(Math.random() * 64, Math.random() * 64, 1, 1); }
        }, [W * 2, H * 2]);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(X1 + (W * CELL) / 2, 0, (H * CELL) / 2);
        g.add(floor);
        this.ceiling = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 1, side: THREE.DoubleSide }));
        this.ceiling.rotation.x = Math.PI / 2;
        this.ceiling.position.set(X1 + (W * CELL) / 2, WALL_H, (H * CELL) / 2);
        g.add(this.ceiling);
        // walls: only cells touching a floor cell
        const cells: [number, number][] = [];
        for (let r = 0; r < H; r++) {
            for (let c = 0; c < W; c++) {
                if (this.grid[r * W + c] !== 1) continue;
                let near = false;
                for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) if (!this.isWall(c + dc, r + dr)) { near = true; break; }
                if (near) cells.push([c, r]);
            }
        }
        const walls = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 }), cells.length);
        const m = new THREE.Matrix4();
        cells.forEach(([c, r], i) => { m.makeTranslation(cx(c), WALL_H / 2, cz(r)); walls.setMatrixAt(i, m); });
        this.wallGroup.add(walls);
        g.add(this.wallGroup);
        // ceiling panels (instanced emissive), parity pattern + three exit fixtures
        const forced: [number, number][] = [[10, 4], [16, 9], [12, 14]];
        const pos: THREE.Vector3[] = [];
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            if (this.isWall(c, r)) continue;
            const isForced = forced.some(([a, b]) => a === c && b === r);
            if ((c + r) % 2 === 0 || isForced) pos.push(new THREE.Vector3(cx(c), WALL_H - 0.05, cz(r)));
            if (isForced) { const k = forced.findIndex(([a, b]) => a === c && b === r); if (k === 0) this.fixN = pos.length - 1; if (k === 1) this.fixE = pos.length - 1; if (k === 2) this.fixS = pos.length - 1; }
        }
        // a flicker-free (non-forced) set; the E/S fixtures flicker, N is steady
        this.panelPos = pos;
        const pg = new THREE.PlaneGeometry(1.8, 0.8);
        pg.rotateX(Math.PI / 2);
        this.panels = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff }), pos.length);
        pos.forEach((v, i) => {
            m.makeTranslation(v.x, v.y, v.z);
            this.panels.setMatrixAt(i, m);
            this.panelOn.push(true);
            this.panelRed.push(i % 5 === 0);
            this.panels.setColorAt(i, new THREE.Color(1, 0.96, 0.75));
        });
        g.add(this.panels);
        for (let i = 0; i < 4; i++) {
            const l = new THREE.PointLight(0xe8f2ff, 30, 17, 2);
            l.position.y = WALL_H - 0.4;
            g.add(l);
            this.lights.push(l);
        }
    }

    private box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, emissive = 0): THREE.Mesh {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive }));
        mesh.position.set(x, y, z);
        this.group.add(mesh);
        return mesh;
    }

    private buildProps(): void {
        const g = this.group;
        // EXIT signs (repeated)
        // mall directory signs pointing to the exit
        const signTex = canvasTex(128, 48, (x) => { x.fillStyle = '#1d3f3a'; x.fillRect(0, 0, 128, 48); x.fillStyle = '#e8f5ef'; x.font = 'bold 20px monospace'; x.textAlign = 'center'; x.fillText('EXIT', 64, 30); });
        const signs: [number, number, number, number][] = [[cx(3), 3.3, 8 * CELL + 0.2, 0], [X1 + 6 * CELL + 0.2, 3.3, cz(9), Math.PI / 2], [X1 + 9 * CELL + 0.2, 3.3, cz(8), Math.PI / 2], [cx(14), 3.3, 6 * CELL + 0.2, 0], [cx(18), 3.3, 5 * CELL + 0.2, 0]];
        for (const [x, y, z, ry] of signs) {
            const s = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.45), new THREE.MeshBasicMaterial({ map: signTex }));
            s.position.set(x, y, z);
            s.rotation.y = ry;
            g.add(s);
        }
        // room A dressing that changes with each traversal
        this.cup = this.box(0.12, 0.14, 0.12, 0xdddddd, cx(11), 0.82, cz(8));
        this.box(1.6, 0.8, 0.9, 0x5a4a30, cx(11), 0.4, cz(8));
        this.chair = this.box(0.5, 0.9, 0.5, 0x3a3a3a, cx(12.3), 0.45, cz(8.2));
        this.extraChair = this.box(0.5, 0.9, 0.5, 0x3a3a3a, cx(10), 0.45, cz(10));
        this.extraChair.visible = false;
        this.stain = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x3a2a08, transparent: true, opacity: 0.8 }));
        this.stain.position.set(X1 + 9 * CELL + 0.03, 1.5, cz(11));
        this.stain.rotation.y = Math.PI / 2;
        g.add(this.stain);
        for (let i = 0; i < 6; i++) { // compressed footprints arriving from an empty room
            const f = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.45), new THREE.MeshBasicMaterial({ color: 0x4a3c14 }));
            f.rotation.x = -Math.PI / 2;
            f.position.set(cx(9) + i * 1.0, 0.02, cz(9) + (i % 2) * 0.3);
            g.add(f);
        }
        // fallen ceiling tiles ("broken bridge") on the long corridor
        for (let i = 0; i < 6; i++) {
            const t = this.box(1.2, 0.05, 1.2, 0x9c9160, cx(12) + i * 1.6, 3.4 - (i % 3) * 0.4, cz(3) + ((i % 2) - 0.5) * 1.2);
            t.rotation.set(0.3 * (i % 3 - 1), i, 0.2);
        }
        // closet: shelf, breakers, terminal
        this.shelf = this.box(2.6, 2.4, 0.5, 0x6a6e70, cx(23) + 0.2, 1.2, cz(18) - 1.2);
        this.shelf.position.set(X1 + 104, 1.2, cz(19) + 1.2);
        const bw = X1 + 24 * CELL + 0.1;
        this.box(0.1, 0.6, 0.5, 0x444c44, bw, 1.4, cz(19) - 0.6);
        this.box(0.1, 0.6, 0.5, 0x444c44, bw, 1.4, cz(19) + 0.1);
        // Labelled, self-lit switch plates with status lamps: findable in a blackout.
        const plate = (text: string, z: number, sub: string) => {
            const cv = document.createElement('canvas'); cv.width = 256; cv.height = 128;
            const x = cv.getContext('2d')!;
            x.fillStyle = '#1b1f1b'; x.fillRect(0, 0, 256, 128);
            x.strokeStyle = '#d8d2a0'; x.lineWidth = 6; x.strokeRect(4, 4, 248, 120);
            x.fillStyle = '#f0e8b0'; x.font = 'bold 40px monospace'; x.textAlign = 'center'; x.fillText(text, 128, 62);
            x.font = 'bold 26px monospace'; x.fillStyle = '#ff9a7a'; x.fillText(sub, 128, 104);
            const tx = new THREE.CanvasTexture(cv); tx.colorSpace = THREE.SRGBColorSpace;
            const m = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), new THREE.MeshBasicMaterial({ map: tx }));
            m.position.set(bw + 0.07, 1.55, z); m.rotation.y = Math.PI / 2; this.group.add(m);
            const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: 0xff2a1a }));
            led.position.set(bw + 0.07, 1.28, z); this.group.add(led);
            this.brkLed[text] = led;
        };
        plate('LIGHTING', cz(19) - 0.6, 'FIRST');
        plate('ARCHIVE', cz(19) + 0.1, 'SECOND');
        this.brkLight = new THREE.PointLight(0xff6a3a, 0, 7, 1.6);
        this.brkLight.position.set(bw + 0.9, 1.9, cz(19) - 0.25);
        this.group.add(this.brkLight);
        this.box(0.1, 0.8, 1.4, 0x222222, bw, 1.3, cz(17) + 0.3);
        this.termCanvas = document.createElement('canvas');
        this.termCanvas.width = 320;
        this.termCanvas.height = 200;
        this.termTex = new THREE.CanvasTexture(this.termCanvas);
        this.termTex.colorSpace = THREE.SRGBColorSpace;
        this.termScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.75), new THREE.MeshBasicMaterial({ map: this.termTex }));
        this.termScreen.position.set(bw + 0.06, 1.35, cz(17) + 0.3);
        this.termScreen.rotation.y = Math.PI / 2;
        g.add(this.termScreen);
        this.drawTerm();
        // fingers that slide through the wall crack in the flooded hall
        this.finger = new THREE.Group();
        const fm = new THREE.MeshStandardMaterial({ color: 0x8a6a45, emissive: 0x1a1208 });
        for (let i = 0; i < 4; i++) {
            const f = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.025, 1.4, 5), fm);
            f.rotation.z = Math.PI / 2;
            f.position.set(0, 0, (i - 1.5) * 0.12);
            this.finger.add(f);
        }
        this.finger.position.set(X1 + 29 * CELL - 0.2, 1.2, cz(11));
        this.finger.visible = false;
        g.add(this.finger);
        // water
        this.water = new THREE.Mesh(new THREE.PlaneGeometry(7 * CELL, 5 * CELL), new THREE.MeshStandardMaterial({ color: 0x5a6a50, roughness: 0.05, metalness: 0.7, transparent: true, opacity: 0.75 }));
        this.water.rotation.x = -Math.PI / 2;
        this.water.position.set(cx(25), 0.04, cz(11));
        g.add(this.water);
        // exit door (appears at the end)
        this.exitDoor = new THREE.Group();
        const signT = canvasTex(256, 96, (x) => { x.fillStyle = '#111'; x.fillRect(0, 0, 256, 96); x.fillStyle = '#ffe9b0'; x.font = 'bold 52px monospace'; x.textAlign = 'center'; x.fillText('DAY TWO', 128, 66); });
        const frame = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 2.2), new THREE.MeshStandardMaterial({ color: 0x4a3a2a }));
        frame.position.set(0, 0, 0);
        const panel = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.9, 1.8), new THREE.MeshStandardMaterial({ color: 0x7a5a3a }));
        panel.position.set(0.25, 0, 0);
        const warm = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.9), new THREE.MeshBasicMaterial({ color: 0xffc27a }));
        warm.position.set(-0.05, 0, 0);
        warm.rotation.y = -Math.PI / 2;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.6), new THREE.MeshBasicMaterial({ map: signT }));
        sign.position.set(-0.17, 2.0, 0);
        sign.rotation.y = -Math.PI / 2;
        this.exitDoor.add(warm, frame, sign);
        const hinge = new THREE.Group();
        hinge.name = 'hinge';
        hinge.position.set(0, 0, -0.9);
        panel.position.set(0.0, 0, 0.9);
        hinge.add(panel);
        this.exitDoor.add(hinge);
        this.exitDoor.position.set(X1 + 33 * CELL + 3.2, 1.6, cz(18));
        this.exitDoor.visible = false;
        g.add(this.exitDoor);
        this.doorLight = new THREE.PointLight(0xffb060, 0, 20, 2);
        this.doorLight.position.set(X1 + 33 * CELL + 1.5, 1.8, cz(18));
        g.add(this.doorLight);
    }

    private buildInteractables(): void {
        const done = new Set<string>();
        const add = (id: string, label: string, x: number, y: number, z: number, run: () => void, enabled: () => boolean, range = 2.8) => {
            this.interactables.push({ id, label, pos: new THREE.Vector3(x, y, z), range, enabled, run });
        };
        const c = this.ctx;
        const once = (id: string) => () => !done.has(id);
        add('d1_outlet', 'Examine wall outlet', cx(3), 0.6, 8 * CELL + 0.4, () => { done.add('o'); c.say('PROTAGONIST', "An outlet. No cable, not even wire behind it. Who plugs into nothing?", 4.5); c.track('d1_interact', { id: 'outlet' }); }, once('o'));
        add('d1_carpet', 'Examine stained tile', cx(4), 0.1, cz(10), () => { done.add('c'); c.say('PROTAGONIST', "Damp. Cold. The stain on the tile is shaped like a hand.", 4); c.track('d1_interact', { id: 'carpet' }); }, once('c'), 3);
        add('d1_exit', 'Read EXIT sign', X1 + 6 * CELL - 0.4, 2.8, cz(9), () => { done.add('e'); c.say('PROTAGONIST', "EXIT. Same sign on every wall. Same crooked corner.", 4); c.track('d1_interact', { id: 'exit_sign' }); }, once('e'), 4);
        add('d1_note', 'Read maintenance note', cx(5) - 0.5, 0.15, cz(8) + 0.3, () => {
            done.add('n'); c.say('PROTAGONIST', "'STEADY LIGHT. NEVER THE FLICKER. — M.' Someone worked here. Someone got out?", 5.5); c.track('d1_interact', { id: 'note' });
        }, once('n'), 3);
        this.box(0.3, 0.02, 0.2, 0xe8e0c0, cx(5) - 0.5, 0.03, cz(8) + 0.3);
        add('d1_tag', 'Inspect sewn-in identity tag', cx(14), 0.15, cz(3), () => {
            this.tag = true; done.add('t'); c.say('PROTAGONIST', "A cloth tag, hand-stitched: 'ASSIGNED: ' and a name scratched out. It's a person's name.", 5.5); c.track('d1_interact', { id: 'mascot_tag' });
        }, () => !this.tag && this.stage !== 'chase', 3);
        this.box(0.2, 0.02, 0.1, 0x3a8582, cx(14), 0.03, cz(3));
        add('d1_shelf', 'Drag shelf across the door', cx(25), 1.0, cz(17) + 0.2, () => this.dragShelf(), () => (this.stage === 'closet' || this.stage === 'chase') && !this.blockaded && c.p.z > 17 * CELL, 3.5);
        add('d1_brk_light', 'Throw LIGHTING breaker (first)', X1 + 24 * CELL + 0.3, 1.4, cz(19) - 0.6, () => this.breakerHit('LIGHTING'), () => this.blockaded && !this.powered && !this.breaker.includes('LIGHTING'), 3.4);
        add('d1_brk_arch', 'Throw ARCHIVE breaker (second)', X1 + 24 * CELL + 0.3, 1.4, cz(19) + 0.1, () => this.breakerHit('ARCHIVE'), () => this.blockaded && !this.powered && !this.breaker.includes('ARCHIVE'), 3.4);
        add('d1_term', 'Play recording', X1 + 24 * CELL + 0.5, 1.3, cz(17) + 0.3, () => this.watch(), () => this.powered && !this.watched, 3);
    }

    // ───────────── lifecycle ─────────────
    begin(): void {
        const c = this.ctx;
        this.group.visible = true;
        this.reset('explore');
        c.giveFlashlight();
        c.resetRec();
        c.p.set(cx(3), 0, cz(10));
        c.setYaw(-Math.PI / 2);
        c.setHead(0.3);
        c.setPitch(-1.1);
        c.setHandColor(null);
        c.lock(true);
        this.introT = 0;
        this.stage = 'intro';
        c.fadeTo(0, 2.5);
        c.sfx.staticBurst(0.8, 0.06);
        c.objective('...');
        c.checkpoint('d1_arrival');
        c.track('d1_started');
    }
    private reset(stage: Stage): void {
        this.stage = stage;
        this.blackout = false;
        this.blackT = -1;
        this.mState = 'IDLE';
        this.mx = this.cpMop.x; this.mz = this.cpMop.z;
        this.rig.group.position.set(this.mx, 0, this.mz);
        this.mRaise = 0;
        this.setAllPanels(true);
        this.ctx.setAmbient(0.55);
        this.ctx.setHead(null);
        this.ctx.setForceCrouch(false);
        this.ctx.setSpeedMul(1);
        this.applyProps();
        this.drawTerm();
    }
    respawn(id: string): void {
        const c = this.ctx;
        this.group.visible = true;
        this.cpId = id;
        this.wrongBusy = false;
        c.lock(false);
        if (id === 'd1_arrival') {
            this.cpMop = { x: cx(26), z: cz(3) };
            this.reset('explore');
            this.trav = 1; this.roomAEntered = false; this.sighted = false;
        } else if (id === 'd1_loop') {
            this.cpMop = { x: cx(26), z: cz(3) };
            this.solved = true;
            this.reset('explore');
            this.sighted = false;
            c.objective('Reach the broken bridge of ceiling tiles in the next hallway.');
        } else if (id === 'd1_chase') {
            this.solved = true; this.sighted = true;
            this.reset('chase');
            this.mx = this.cpMop.x; this.mz = this.cpMop.z;
            this.rig.group.position.set(this.mx, 0, this.mz);
            this.setBlackout(true, true);
            this.mState = 'PURSUE';
            c.objective('RUN. Find the maintenance closet.');
        } else if (id === 'd1_closet') {
            this.solved = true; this.sighted = true;
            this.reset('closet');
            this.setBlackout(true, true);
            this.placeMoppet(22, 10);
            this.mState = 'PURSUE';
            c.objective('Drag the shelf across the door.');
        } else if (id === 'd1_terminal') {
            this.solved = true; this.sighted = true;
            this.reset('blocked');
            this.setBlackout(true, true);
            this.blockade(true);
            this.placeMoppet(25, 15);
            this.mState = 'DOOR';
            c.objective('Find the breaker panel on the closet wall. Throw LIGHTING first, then ARCHIVE.');
        } else if (id === 'd1_finale') {
            this.solved = true; this.sighted = true; this.watched = true; this.powered = true;
            this.reset('finale');
            this.setBlackout(true, true);
            this.blockade(false);
            this.placeMoppet(25, 16);
            this.mState = 'SCRIPTED';
            this.mTimer = 2.5;
            c.objective('RUN. Follow the emergency corridor.');
        }
    }
    private placeMoppet(c: number, r: number): void {
        this.mx = cx(c); this.mz = cz(r);
        this.rig.group.position.set(this.mx, 0, this.mz);
    }
    private applyProps(): void {
        const a = Math.min(3, this.trav - 1);
        this.cup.position.set(cx(11) + [0, 0.5, -0.4, 0.2][a], 0.82, cz(8) + [0, 0.2, 0.3, -0.3][a]);
        (this.cup.material as THREE.MeshStandardMaterial).color.set([0xdddddd, 0xc8a070, 0x70a0c8, 0x111111][a]);
        this.stain.scale.set(1 + a * 0.5, 1 - a * 0.15, 1);
        this.stain.position.y = 1.5 + a * 0.2;
        this.chair.rotation.y = a * 0.9;
        this.extraChair.visible = a >= 2;
    }
    save(): { tag: boolean; rule: boolean; solved: boolean; cp: string; mop: { x: number; z: number } } {
        return { tag: this.tag, rule: this.rule, solved: this.solved, cp: this.cpId, mop: this.cpMop };
    }
    load(s: { tag?: boolean; rule?: boolean; solved?: boolean; cp?: string; mop?: { x: number; z: number } } | undefined): void {
        if (!s) return;
        this.tag = !!s.tag; this.rule = !!s.rule; this.solved = !!s.solved;
        if (s.mop) this.cpMop = s.mop;
    }
    flags(): { reassignment_rule_known: boolean; mascot_tag_seen: boolean } {
        return { reassignment_rule_known: this.rule, mascot_tag_seen: this.tag };
    }
    objectiveText(): string {
        switch (this.stage) {
            case 'explore': return this.solved ? 'Reach the broken bridge of ceiling tiles in the next hallway.' : 'Find a way out. Follow the steady light.';
            case 'sighted': return 'Something waits at the end of the hall. Find another way.';
            case 'chase': return 'RUN. Find the maintenance closet.';
            case 'closet': return 'Drag the shelf across the door.';
            case 'blocked': return 'Find the breaker panel on the closet wall. Throw LIGHTING first, then ARCHIVE.';
            case 'powered': return 'Play the recording.';
            case 'finale': return 'RUN. Follow the emergency corridor.';
            default: return '...';
        }
    }

    // ───────────── lighting ─────────────
    private setPanel(i: number, v: number): void {
        const red = this.blackout && this.panelRed[i];
        const col = new THREE.Color();
        if (red) col.setRGB(0.5 * v + 0.08, 0.04, 0.03);
        else col.setRGB(v, v * 0.96, v * 0.75);
        this.panels.setColorAt(i, col);
    }
    private setAllPanels(on: boolean): void {
        for (let i = 0; i < this.panelPos.length; i++) {
            this.panelOn[i] = on;
            this.setPanel(i, on ? 1 : 0.03);
        }
        if (this.panels.instanceColor) this.panels.instanceColor.needsUpdate = true;
    }
    private setBlackout(on: boolean, instant: boolean): void {
        this.blackout = on;
        if (on && instant) {
            for (let i = 0; i < this.panelPos.length; i++) { this.panelOn[i] = false; this.setPanel(i, this.panelRed[i] ? 0.15 : 0.02); }
            if (this.panels.instanceColor) this.panels.instanceColor.needsUpdate = true;
            this.ctx.setAmbient(0.16);
        } else if (on) {
            const p = this.ctx.p;
            const order = this.panelPos.map((v, i) => ({ i, d: Math.hypot(v.x - p.x, v.z - p.z) })).sort((a, b) => a.d - b.d);
            this.blackRank = new Array(this.panelPos.length).fill(0);
            order.forEach((o, rank) => { this.blackRank[o.i] = rank; });
            this.blackT = 0;
        }
    }
    private updateLights(dt: number): void {
        const p = this.ctx.p;
        // fixtures: N steady, E and S flicker (puzzle clue); everything else steady
        if (!this.blackout && !this.solved) {
            const fl = (Math.sin(this.t * 37) + Math.sin(this.t * 23.3) > 0.5) ? 0.12 : 1;
            this.setPanel(this.fixE, fl);
            this.setPanel(this.fixS, (Math.sin(this.t * 29 + 1) + Math.sin(this.t * 17) > 0.4) ? 0.1 : 1);
            this.setPanel(this.fixN, 1);
            if (this.panels.instanceColor) this.panels.instanceColor.needsUpdate = true;
        }
        if (this.surgeT > 0) {
            this.surgeT -= dt;
            const v = Math.random() < 0.5 ? 0.05 : 1;
            for (let i = 0; i < this.panelPos.length; i += 2) this.setPanel(i, v);
            if (this.panels.instanceColor) this.panels.instanceColor.needsUpdate = true;
            if (this.surgeT <= 0) { if (!this.blackout) this.setAllPanels(true); else this.setBlackout(true, true); }
        }
        if (this.blackT >= 0) {
            this.blackT += dt;
            const n = this.panelPos.length;
            for (let i = 0; i < n; i++) {
                if (this.panelOn[i] && this.blackT > (this.blackRank[i] / n) * 2.2) {
                    this.panelOn[i] = false;
                    this.setPanel(i, this.panelRed[i] ? 0.15 : 0.02);
                }
            }
            if (this.panels.instanceColor) this.panels.instanceColor.needsUpdate = true;
            this.ctx.setAmbient(Math.max(0.16, 0.55 - this.blackT * 0.2));
            if (this.blackT > 2.4) { this.blackT = -1; this.ctx.setAmbient(0.16); }
        }
        this.lightT -= dt;
        if (this.lightT <= 0) {
            this.lightT = 0.2;
            const near = this.panelPos.map((v, i) => ({ i, d: Math.hypot(v.x - p.x, v.z - p.z) })).filter((o) => this.panelOn[o.i] || this.blackT >= 0).sort((a, b) => a.d - b.d).slice(0, 4);
            this.lights.forEach((l, k) => {
                const o = near[k];
                if (!o || o.d > 18) { l.intensity = 0; return; }
                l.position.x = this.panelPos[o.i].x;
                l.position.z = this.panelPos[o.i].z;
                l.intensity = 30;
            });
        }
    }

    // ───────────── story beats ─────────────
    private wrongExit(which: string): void {
        if (this.wrongBusy) return;
        this.wrongBusy = true;
        const c = this.ctx;
        c.track('d1_loop_wrong_exit', { which, traversal: this.trav });
        c.lock(true);
        c.fadeTo(1, 0.5);
        c.after(0.7, () => {
            this.trav++;
            this.applyProps();
            c.p.set(cx(9) + 1, 0, cz(9));
            c.setYaw(-Math.PI / 2);
            c.setPitch(0);
            c.fadeTo(0, 0.8);
            c.lock(false);
            this.wrongBusy = false;
            const lines = ["Same room. The cup moved.", "That stain... it's bigger. It's different.", "Another chair. I didn't see it before."];
            c.say('PROTAGONIST', lines[Math.min(2, this.trav - 2)], 3.5);
            if (this.trav >= 3) c.after(3.7, () => c.say('PROTAGONIST', "The light. Look for the one that isn't flickering.", 4));
        });
    }
    private solve(): void {
        this.solved = true;
        this.ctx.objective('Reach the broken bridge of ceiling tiles in the next hallway.');
        this.ctx.checkpoint('d1_loop');
        this.cpId = 'd1_loop';
        this.ctx.track('d1_loop_solved', { traversals: this.trav });
        this.setAllPanels(true);
    }
    private startSight(): void {
        this.sighted = true;
        this.stage = 'sighted';
        const c = this.ctx;
        this.mState = 'IDLE';
        this.mRaise = 0.0001;
        c.objective('Something waits at the end of the hall. Find another way.');
        c.say('SYSTEM', 'Please approach your assigned friend.', 3.2);
        c.after(3.6, () => c.say('PROTAGONIST', 'Stay the fuck away from me.', 3));
        c.after(6.5, () => { if (this.stage === 'sighted') { this.mState = 'ADVANCE'; this.advanceT = 0; } });
        c.track('d1_moppet_sighted');
    }
    private startChase(): void {
        if (this.stage !== 'sighted') return;
        const c = this.ctx;
        this.stage = 'chase';
        this.setBlackout(true, false);
        this.mState = 'PURSUE';
        c.objective('RUN. Find the maintenance closet.');
        c.say('PROTAGONIST', 'The lights— MOVE!', 2.5);
        c.sfx.thud(0.5);
        this.cpMop = { x: this.mx, z: this.mz };
        c.checkpoint('d1_chase');
        this.cpId = 'd1_chase';
        c.track('d1_chase_started');
    }
    private dragShelf(): void {
        const c = this.ctx;
        c.lock(true);
        c.track('d1_shelf_dragged');
        c.sfx.scrape(0.5, 0);
        const t0 = this.t;
        const sx = this.shelf.position.x, sz = this.shelf.position.z;
        const ex = cx(25), ez = cz(16) + 1.5;
        const tick = () => {
            const k = Math.min(1, (this.t - t0) / 1.4);
            this.shelf.position.set(sx + (ex - sx) * k, 1.2, sz + (ez - sz) * k);
            if (k < 1) c.after(0.03, tick);
            else {
                this.blockade(true);
                c.lock(false);
                this.stage = 'blocked';
                this.mState = 'DOOR';
                c.say('PROTAGONIST', 'The pipe. Jam it through the handles. There.', 3);
                c.objective('Find the breaker panel on the closet wall. Throw LIGHTING first, then ARCHIVE.');
                this.cpMop = { x: cx(25), z: cz(15) };
                c.checkpoint('d1_terminal');
                this.cpId = 'd1_terminal';
                this.mKnock = 2;
            }
        };
        tick();
    }
    private blockade(on: boolean): void {
        this.blockaded = on;
        this.grid[16 * W + 25] = on ? 1 : 0;
        if (on) this.shelf.position.set(cx(25), 1.2, cz(16) + 1.5);
    }
    private breakerHit(which: string): void {
        const c = this.ctx;
        this.breaker.push(which);
        c.sfx.thud(0.3);
        c.sfx.click(0.5);
        c.track('d1_breaker', { which });
        this.setLed(which, true);
        if (this.breaker.length < 2) {
            if (which === 'LIGHTING') { c.say('PROTAGONIST', 'One lamp lit. Now the ARCHIVE breaker, just below.', 3.5); c.objective('Throw the ARCHIVE breaker.'); }
            return;
        }
        if (this.breaker[0] === 'LIGHTING' && this.breaker[1] === 'ARCHIVE') {
            this.powered = true;
            this.stage = 'powered';
            this.termMode = 'flicker';
            c.sfx.staticBurst(0.8, 0.1);
            c.say('PROTAGONIST', 'The monitor... it came on.', 3);
            c.objective('Play the recording.');
        } else {
            this.breaker = [];
            this.setLed('LIGHTING', false); this.setLed('ARCHIVE', false);
            c.objective('Find the breaker panel on the closet wall. Throw LIGHTING first, then ARCHIVE.');
            this.surgeT = 1.0;
            c.sfx.staticBurst(0.6, 0.12);
            c.say('PROTAGONIST', 'Wrong order. Everything surged. Lighting first, then archive.', 4);
        }
    }
    private setLed(which: string, on: boolean): void {
        const led = this.brkLed[which];
        if (led) (led.material as THREE.MeshBasicMaterial).color.set(on ? 0x38ff6a : 0xff2a1a);
    }

    /** Where the player should go next, for the HUD waypoint. null = no explicit target (the game falls back to the next open interaction). */
    waypoint(): { x: number; y: number; z: number; label: string } | null {
        const bw = X1 + 24 * CELL + 0.3;
        if ((this.stage === 'closet' || this.stage === 'chase') && !this.blockaded) return { x: cx(25), y: 1.4, z: cz(17) + 0.2, label: 'SHELF' };
        if (this.blockaded && !this.powered) {
            return this.breaker.includes('LIGHTING')
                ? { x: bw, y: 1.6, z: cz(19) + 0.1, label: 'ARCHIVE BREAKER (2nd)' }
                : { x: bw, y: 1.6, z: cz(19) - 0.6, label: 'LIGHTING BREAKER (1st)' };
        }
        if (this.powered && !this.watched) return { x: X1 + 24 * CELL + 0.5, y: 1.4, z: cz(17) + 0.3, label: 'MONITOR' };
        return null;
    }

    private watch(): void {
        const c = this.ctx;
        this.watched = true;
        this.stage = 'watching';
        this.termMode = 'rec';
        this.recT = 0;
        c.lock(true);
        c.setPitch(0);
        c.track('d1_recording_started');
        c.say('SYSTEM', '[a second, distorted voice overlaps the recording]', 4);
        c.after(4.2, () => c.card(['THE SYSTEM DOES NOT KILL USERS.', 'IT REASSIGNS THEM.'], 4200));
        c.after(5.4, () => { c.setHandColor(0x3a8582); c.sfx.tone(160, 0.8, 0.08, 0, 'sawtooth', 90); });
        c.after(6.4, () => { c.setHandColor(null); });
        c.after(9.5, () => {
            this.rule = true;
            c.track('d1_rule_learned');
            this.termMode = 'flicker';
            c.lock(false);
            c.objective('Escape before your assigned friend enters.');
            c.say('PROTAGONIST', "It doesn't kill people. It turns them into... them.", 4);
        });
        c.after(14, () => this.startFinale());
    }
    private startFinale(): void {
        const c = this.ctx;
        this.stage = 'finale';
        c.track('d1_finale_started');
        c.sfx.scrape(0.6, 0.2);
        c.sfx.thud(0.6, 0.2);
        const t0 = this.t;
        const sx = this.shelf.position.x, sz = this.shelf.position.z;
        const tick = () => {
            const k = Math.min(1, (this.t - t0) / 1.2);
            this.shelf.position.set(sx - 1.1 * k, 1.2, sz);
            if (k < 1) c.after(0.03, tick);
            else {
                this.blockade(false);
                this.mState = 'SCRIPTED';
                this.mTimer = 1.6;
                c.objective('RUN. Follow the emergency corridor.');
                c.say('PROTAGONIST', "It's pushing in. Long fingers around the door— GO!", 3.5);
                c.checkpoint('d1_finale');
                this.cpId = 'd1_finale';
            }
        };
        tick();
    }
    private endFreeze(): void {
        const c = this.ctx;
        this.stage = 'collapse';
        this.mState = 'IDLE';
        c.lock(true);
        c.setForceCrouch(false);
        c.track('d1_freeze');
        c.say('SYSTEM', 'Orientation complete.', 3.2);
        c.after(3.4, () => {
            c.sfx.tone(90, 2.4, 0.2, 0, 'sine', 40);
            const t0 = this.t;
            const tick = () => {
                const k = Math.min(1, (this.t - t0) / 2.4);
                this.wallGroup.scale.y = Math.max(0.001, 1 - k);
                this.ceiling.visible = k < 0.6;
                this.rig.group.visible = k < 0.5;
                if (k < 1) c.after(0.03, tick);
                else {
                    this.setAllPanels(false);
                    c.setAmbient(0.05);
                    this.exitDoor.visible = true;
                    this.doorLight.intensity = 0;
                    this.grid[18 * W + 33] = 0;
                    c.after(1, () => this.openExit());
                }
            };
            tick();
        });
    }
    private openExit(): void {
        const c = this.ctx;
        const hinge = this.exitDoor.getObjectByName('hinge')!;
        const t0 = this.t;
        c.sfx.click(0.4);
        const tick = () => {
            const k = Math.min(1, (this.t - t0) / 2);
            hinge.rotation.y = -k * 1.5;
            this.doorLight.intensity = 40 * k;
            if (k < 1) c.after(0.03, tick);
            else {
                c.lock(false);
                c.objective('Walk through the door.');
                [523, 659, 784, 659, 523, 659, 784, 1046].forEach((f, i) => c.after(i * 0.4, () => c.sfx.tone(f, 0.35, 0.05)));
            }
        };
        tick();
    }

    // ───────────── per-frame ─────────────
    update(dt: number): void {
        const c = this.ctx;
        this.t += dt;
        void this.water;
        void this.termScreen;
        const p = c.p;
        const [pc, pr] = this.cellOf(p.x, p.z);
        if (this.stage === 'intro') {
            this.introT += dt;
            const k = Math.min(1, Math.max(0, (this.introT - 1) / 3.5));
            c.setHead(0.3 + (1.6 - 0.3) * (k * k * (3 - 2 * k)));
            c.setPitch(-1.1 * (1 - k));
            if (this.introT > 3 && this.introT - dt <= 3) c.say('PROTAGONIST', 'Where am I?', 3);
            if (this.introT > 5) { c.setHead(null); c.lock(false); this.stage = 'explore'; c.objective('Find a way out.'); }
        }
        this.updateLights(dt);
        if (this.brkLight) this.brkLight.intensity = this.blockaded && !this.powered ? 5 + Math.sin(this.t * 4) * 2 : 0;
        if (this.powered) { this.setLed('LIGHTING', true); this.setLed('ARCHIVE', true); }
        // ambience: duct rattle / distant wet steps
        this.ambT -= dt;
        if (this.ambT <= 0) { this.ambT = 12 + Math.random() * 14; if (Math.random() < 0.6) c.sfx.noise(0.5, 300, 2, 0.04, Math.random() * 2 - 1, 'bandpass'); else c.sfx.thud(0.05, Math.random() * 2 - 1); }
        c.sfx.setHumPitch(100 + Math.sin(c.getYaw() * 2) * 14);
        // flooded hall
        const inWater = pc >= 22 && pc <= 28 && pr >= 9 && pr <= 13;
        c.setSpeedMul(inWater ? 0.85 : 1);
        if (inWater && Math.hypot(c.vel.x, c.vel.y) > 1) { this.waterT -= dt; if (this.waterT <= 0) { this.waterT = 0.35; c.sfx.noise(0.15, 900, 0.6, 0.08, 0, 'bandpass'); } }
        // crawl under the collapsed partition
        c.setForceCrouch(pc === 21 && pr === 11);
        // triggers
        if (!this.roomAEntered && pc >= 9 && pc <= 14 && pr >= 6 && pr <= 12) {
            this.roomAEntered = true;
            c.say('SYSTEM', 'Day one. Orientation begins now.', 3.5);
            c.objective('Find a way out. Follow the steady light.');
            c.track('d1_orientation_started');
        }
        if (this.stage === 'explore' && !this.solved && !this.wrongBusy) {
            if (pc >= 15 && pc <= 17 && pr === 9 && p.x > cx(16) - 1) this.wrongExit('east');
            else if (pc === 12 && pr >= 15) this.wrongExit('south');
        }
        if (this.stage === 'explore' && !this.solved && pc === 10 && pr <= 4) this.solve();
        if (this.stage === 'explore' && this.solved && !this.sighted && pr === 3 && pc >= 12) this.startSight();
        if (this.stage === 'sighted' && this.mState === 'ADVANCE') {
            this.advanceT += dt;
            const d = Math.hypot(this.mx - p.x, this.mz - p.z);
            if (d < 26 || this.advanceT > 14 || (pr === 3 && pc >= 17)) this.startChase();
        }
        if (this.stage === 'chase' && pr >= 17 && pc >= 24 && pc <= 26) {
            this.stage = 'closet';
            this.cpMop = { x: cx(22), z: cz(10) };
            c.objective('Drag the shelf across the door.');
            c.checkpoint('d1_closet');
            this.cpId = 'd1_closet';
        }
        // set pieces during the chase
        if (this.stage === 'chase' || this.stage === 'closet') {
            if (!this.chairTipped && pc >= 17 && pc <= 20 && pr >= 10) { this.chairTipped = true; this.chair.rotation.z = 1.4; c.sfx.thud(0.4, 0.3); }
            if (!this.fingerDone && pc >= 24 && pr >= 10 && pr <= 12) { this.fingerDone = true; this.finger.visible = true; c.sfx.scrape(0.4, 0.6); c.after(1.8, () => { this.finger.visible = false; }); }
        }
        if (this.stage === 'finale' && pc >= 31 && pr === 18) this.endFreeze();
        if (this.stage === 'collapse' && this.exitDoor.visible && p.x > X1 + 33 * CELL + 1) {
            this.stage = 'done';
            c.track('d1_completed', this.flags());
            c.lock(true);
            c.fadeTo(1, 1.5);
            c.after(1.6, () => c.nextChapter('d2'));
        }
        this.updateMoppet(dt, pc, pr);
        this.updateTerm(dt);
    }

    private floodFrom(tc: number, tr: number): void {
        const f = this.mFlood;
        f.fill(-1);
        const q: number[] = [];
        if (!this.isWall(tc, tr)) { f[tr * W + tc] = 0; q.push(tc, tr); }
        for (let i = 0; i < q.length; i += 2) {
            const c = q[i], r = q[i + 1];
            const d = f[r * W + c];
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nc = c + dc, nr = r + dr;
                if (this.isWall(nc, nr) || f[nr * W + nc] >= 0) continue;
                f[nr * W + nc] = d + 1;
                q.push(nc, nr);
            }
        }
    }
    private stepToward(tc: number, tr: number, speed: number, dt: number): boolean {
        this.mFloodT -= dt;
        if (this.mFloodT <= 0) { this.mFloodT = 0.3; this.floodFrom(tc, tr); }
        const [mc, mr] = this.cellOf(this.mx, this.mz);
        const here = this.mFlood[mr * W + mc];
        if (here < 0) return false;
        let best = here, bx = cx(mc), bz = cz(mr);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nc = mc + dc, nr = mr + dr;
            if (this.isWall(nc, nr)) continue;
            const v = this.mFlood[nr * W + nc];
            if (v >= 0 && v < best) { best = v; bx = cx(nc); bz = cz(nr); }
        }
        if (best === here && here === 0) return true;
        const dx = bx - this.mx, dz = bz - this.mz;
        const d = Math.hypot(dx, dz) || 1;
        const inCrawl = mc === 21 && mr === 11;
        const inWater = mc >= 22 && mc <= 28 && mr >= 9 && mr <= 13;
        const sp = speed * (inCrawl ? 0.6 : inWater ? 0.8 : 1) * dt;
        this.mx += (dx / d) * Math.min(sp, d);
        this.mz += (dz / d) * Math.min(sp, d);
        return false;
    }
    private updateMoppet(dt: number, pc: number, pr: number): void {
        const c = this.ctx;
        const p = c.p;
        const g = this.rig.group;
        const dist = Math.hypot(p.x - this.mx, p.z - this.mz);
        const active = this.mState !== 'IDLE' || this.sighted;
        this.hasLos = this.los(this.mx, this.mz, p.x, p.z);
        // does the player look at it?
        const yaw = c.getYaw();
        const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
        const dot = ((this.mx - p.x) * fx + (this.mz - p.z) * fz) / Math.max(dist, 0.01);
        this.lookedAt = this.hasLos && dot > 0.82;
        const crouch = c.isCrouching();
        const sp = Math.hypot(c.vel.x, c.vel.y);
        const noise = crouch ? 3 : sp > 4.5 ? 18 : sp > 0.5 ? 8 : 1;
        const flashSees = this.hasLos && dist < 30;
        const [mc, mr] = this.cellOf(this.mx, this.mz);
        void mc; void mr;

        const faceP = () => { this.myaw = Math.atan2(-(p.x - this.mx), -(p.z - this.mz)); };
        let move = 0;
        switch (this.mState) {
            case 'IDLE':
                if (this.mRaise > 0 && this.mRaise < 1) this.mRaise = Math.min(1, this.mRaise + dt * 0.35);
                break;
            case 'ADVANCE':
                faceP();
                this.lunge(dt);
                move = this.mLunge > 0 ? 1.6 : 0;
                this.stepToward(pc, pr, move, dt);
                break;
            case 'PURSUE': {
                if (this.hasLos && dist < 28) { this.mLastKnown = [pc, pr]; this.mSeeT = 0; } else this.mSeeT += dt;
                faceP();
                this.lunge(dt);
                const frozen = this.lookedAt && dist > 5 && this.stage !== 'finale';
                move = this.mLunge > 0 ? (frozen ? 1.1 : 4.8) : 0;
                const reached = this.stepToward(this.blockaded ? 25 : pc, this.blockaded ? 15 : pr, move, dt);
                if (this.blockaded && reached) this.mState = 'DOOR';
                if (this.mSeeT > 7 && dist > 10 && !this.blockaded) { this.mState = 'SEARCH'; this.mTimer = 0; }
                break;
            }
            case 'DOOR': {
                // pressing against the barricade: rhythmic knocking, then silence
                this.myaw = Math.PI;
                this.mKnock -= dt;
                if (this.mKnock <= 0) {
                    this.mKnock = 1.6 + Math.random() * 1.4;
                    c.sfx.thud(0.45 * Math.max(0.2, 1 - dist / 25), this.pan(p, this.mx, this.mz, dist));
                    c.after(0.35, () => c.sfx.thud(0.4, 0));
                }
                this.stepToward(25, 15, 2, dt);
                break;
            }
            case 'SEARCH': {
                this.mTimer += dt;
                const [lc, lr] = this.mLastKnown;
                this.lunge(dt);
                const done = this.stepToward(lc, lr, this.mLunge > 0 ? 2.4 : 0, dt);
                if (done) { this.myaw += dt * 0.9; if (this.mTimer > 10) this.mState = 'PATROL'; }
                if (this.hasLos && dist < 14) this.mState = 'NOTICE', this.mTimer = 0;
                else if (dist < noise && noise > 3) this.mState = 'NOTICE', this.mTimer = 0;
                break;
            }
            case 'PATROL': {
                const wps: [number, number][] = [[26, 3], [18, 3], [18, 9], [12, 3]];
                const [wc, wr] = wps[this.mPatrolI % wps.length];
                this.lunge(dt);
                if (this.stepToward(wc, wr, this.mLunge > 0 ? 1.8 : 0, dt)) this.mPatrolI++;
                { const mfx = -Math.sin(this.myaw), mfz = -Math.cos(this.myaw); const mdot = ((p.x - this.mx) * mfx + (p.z - this.mz) * mfz) / Math.max(dist, 0.01); if (this.hasLos && mdot > 0.35 && dist < (flashSees ? 20 : 18)) { this.mState = 'NOTICE'; this.mTimer = 0; } }
                if (dist < noise) this.mState = 'NOTICE', this.mTimer = 0;
                break;
            }
            case 'NOTICE':
                faceP();
                this.mTimer += dt;
                if (Math.floor(this.mTimer * 12) % 2 === 0) c.sfx.noise(0.02, 3000, 3, 0.03, this.pan(p, this.mx, this.mz, dist), 'bandpass');
                if (this.mTimer > 1.2) this.mState = 'PURSUE', this.mSeeT = 0;
                break;
            case 'SCRIPTED': {
                faceP();
                this.mTimer -= dt;
                if (this.mTimer <= 0) {
                    this.lunge(dt);
                    this.stepToward(pc, pr, this.mLunge > 0 ? 4.4 : 0, dt);
                }
                break;
            }
        }
        g.position.set(this.mx, 0, this.mz);
        let dy = this.myaw - g.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        g.rotation.y += dy * Math.min(1, dt * 5);
        this.animateMoppet(dt, move);
        // metronome tell: ticks until the creature has a direct view of the player
        if (active && this.rig.group.visible) {
            this.mTick -= dt;
            if (this.mTick <= 0) {
                this.mTick = 0.8;
                if (!this.hasLos || dist > 40) {
                    const vol = Math.max(0.03, 0.16 * (1 - dist / 70));
                    c.sfx.noise(0.03, 1800, 3, vol, this.pan(p, this.mx, this.mz, dist), 'bandpass');
                    c.sfx.tone(this.mTickAlt() ? 880 : 760, 0.05, vol * 0.5, this.pan(p, this.mx, this.mz, dist), 'square');
                }
            }
        }
        // capture
        if (dist < 1.7 && (this.mState === 'PURSUE' || this.mState === 'ADVANCE' || this.mState === 'SCRIPTED' || this.mState === 'NOTICE')) c.capture();
    }

    private tickFlip = false;
    private mTickAlt(): boolean { this.tickFlip = !this.tickFlip; return this.tickFlip; }
    private pan(p: THREE.Vector3, x: number, z: number, dist: number): number {
        const yaw = this.ctx.getYaw();
        return ((x - p.x) * Math.cos(yaw) + (z - p.z) * -Math.sin(yaw)) / Math.max(dist, 1);
    }
    private lunge(dt: number): void {
        // dangling stops: 1.0s of taut-string lunge, 0.45s of slack
        this.mTimer2 += dt;
        const cyc = this.mTimer2 % 1.45;
        this.mLunge = cyc < 1.0 ? 1 : 0;
    }
    private mTimer2 = 0;
    private animateMoppet(dt: number, moving: number): void {
        const r = this.rig;
        const t = this.t;
        const raise = this.mRaise;
        // long cloth arm: sways; raised slowly when it first notices
        r.longArm.forEach((s, i) => { s.rotation.z = (i === 0 ? -0.2 - raise * 2.2 : 0.18 * Math.sin(t * 1.3 + i)) ; s.rotation.x = Math.sin(t * 0.9 + i * 0.7) * 0.15; });
        r.stiffArm.rotation.z = 0.15 + (this.mState === 'PURSUE' ? -1.0 : 0);
        r.stiffElbow.rotation.z = Math.sin(t * 2) * 0.1 + (this.mState === 'PURSUE' ? -0.9 : 0);
        r.head.rotation.z = Math.sin(t * 0.7) * 0.12 + (this.mState === 'NOTICE' ? Math.sin(t * 20) * 0.1 : 0);
        r.head.rotation.x = 0.1 + Math.sin(t * 0.5) * 0.04;
        const ph = t * 6;
        r.legs[0].rotation.x = moving > 0 ? Math.sin(ph) * 0.5 : 0;
        r.legs[1].rotation.x = moving > 0 ? Math.sin(ph + Math.PI) * 0.4 : 0;
        r.cloth.rotation.z = Math.sin(t * 1.2) * 0.03 + (moving > 0 ? Math.sin(ph) * 0.05 : 0);
        void dt;
    }

    // ───────────── terminal ─────────────
    private updateTerm(dt: number): void {
        if (this.termMode === 'off') return;
        this.recT += dt;
        this.drawTerm();
    }
    private drawTerm(): void {
        const x = this.termCanvas.getContext('2d')!;
        const W2 = this.termCanvas.width, H2 = this.termCanvas.height;
        x.fillStyle = '#031006';
        x.fillRect(0, 0, W2, H2);
        if (this.termMode === 'off') { this.termTex.needsUpdate = true; return; }
        const t = this.recT;
        if (this.termMode === 'flicker') {
            x.fillStyle = '#39ff7a'; x.font = '16px monospace';
            x.fillText('ARCHIVE ONLINE', 20, 40);
            x.fillText('> PLAY RECORDING_001', 20, 70);
            if (Math.random() < 0.15) { x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(0, Math.random() * H2, W2, 4); }
        } else {
            // scan a human silhouette, reconstruct it as a smiling mascot
            const k = Math.min(1, t / 3);
            const mk = Math.max(0, Math.min(1, (t - 3) / 2));
            x.fillStyle = '#143a24';
            x.fillRect(0, 0, W2, H2);
            x.fillStyle = mk < 1 ? '#0a1a10' : '#2f7a78';
            x.beginPath(); x.arc(160, 70, 28, 0, 7); x.fill();
            x.fillRect(135, 98, 50, 70); x.fillRect(120, 100, 15, 60); x.fillRect(185, 100, 15, 60);
            if (mk > 0) {
                x.fillStyle = '#e8ffe8'; x.fillRect(140, 78, 40, 4);
                for (let i = 0; i < 9; i++) x.fillRect(141 + i * 4.4, 76, 2.5, 8);
                x.fillStyle = '#000'; x.fillRect(148, 58, 6, 6); x.fillRect(168, 58, 6, 6);
            }
            if (k < 1) { x.fillStyle = 'rgba(120,255,160,0.7)'; x.fillRect(0, 30 + k * 150, W2, 3); }
            if (t > 6) {
                x.fillStyle = '#39ff7a'; x.font = 'bold 15px monospace'; x.textAlign = 'center';
                x.fillText('THE SYSTEM DOES NOT KILL USERS.', W2 / 2, 185);
                x.textAlign = 'left';
                for (let i = 0; i < 6; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.15})`; x.fillRect(0, Math.random() * H2, W2, 1); }
            }
        }
        this.termTex.needsUpdate = true;
    }
}
