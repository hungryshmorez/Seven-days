import * as THREE from 'three';
import type { D1Ctx, D1Interact } from './day1.ts';

/** DAY SEVEN — THE SUB-BASS CORE. S01 Heart of the System … S10 Installation Successful. */
export const X7 = 3600;
const CELL = 4;
const W = 48;
const H = 48;
const WALL_H = 6;

const cx = (c: number) => X7 + (c + 0.5) * CELL;
const cz = (r: number) => (r + 0.5) * CELL;

type Stage = 'none' | 'arrive' | 'core' | 'broadcast' | 'memory' | 'toCore' | 'offer' | 'morph' | 'pursuit' | 'console' | 'breaking' | 'last' | 'living' | 'tv' | 'mirror' | 'ending' | 'done';

function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
const std = (color: number, emissive = 0) => new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive});
const pad2 = (n: number) => String(n).padStart(2, '0');
const clock = (s: number) => '00:' + pad2(Math.floor(Math.max(0, s) / 60)) + ':' + pad2(Math.floor(Math.max(0, s)) % 60);

function faceTex(color: string): THREE.CanvasTexture {
    return tex(64, 64, (x) => {
        x.fillStyle = color; x.fillRect(0, 0, 64, 64);
        x.fillStyle = '#111'; x.fillRect(16, 20, 8, 10); x.fillRect(40, 20, 8, 10);
        x.strokeStyle = '#111'; x.lineWidth = 4; x.beginPath(); x.arc(32, 38, 14, 0.2, Math.PI - 0.2); x.stroke();
    });
}

interface Sm { group: THREE.Group; faces: THREE.Mesh[]; eyes: THREE.Mesh[] }
function buildSplicemaster(): Sm {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.75, 2.7, 12), std(0x16141a, 0x050408));
    body.position.y = 1.35; g.add(body);
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 0.5, 10), std(0x2a2630));
    collar.position.y = 2.6; g.add(collar);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38, 14, 12), std(0xe6e0d4, 0x1a1814));
    head.position.y = 3.05; g.add(head);
    const eyes: THREE.Mesh[] = [];
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.03, 6, 12), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        e.position.set(s * 0.15, 3.1, -0.33); g.add(e); eyes.push(e);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.035, 0.02), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    mouth.position.set(0, 2.92, -0.36); g.add(mouth);
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.2, 0.12), std(0x16141a));
        arm.position.set(s * 0.6, 1.5, -0.1); arm.rotation.z = s * 0.12; g.add(arm);
    }
    const faces: THREE.Mesh[] = [];
    ['#f0a0b0', '#ffd24a', '#9a7448', '#aa4a2a'].forEach((col, i) => {
        const f = new THREE.Mesh(new THREE.CircleGeometry(0.34, 16), new THREE.MeshBasicMaterial({ map: faceTex(col), side: THREE.DoubleSide }));
        f.userData.a = (i / 4) * Math.PI * 2;
        f.visible = false; g.add(f); faces.push(f);
    });
    return { group: g, faces, eyes };
}

export class Day7 {
    group = new THREE.Group();
    interactables: D1Interact[] = [];
    private grid = new Uint8Array(W * H);
    private t = 0;
    private stage: Stage = 'none';
    private cpId = 'd7_core';
    private busy = false;
    private layered = false;
    private pods: boolean[] = [false, false, false, false, false];
    private offerLeft = -1;
    private consoleT = -1;
    private step = 0;
    private morphT = -1;
    private smScale = 1;
    private swx = 0;
    private swz = 0;
    private swOn = false;
    private swSpeed = 2.6;
    private flood = new Int16Array(W * H);
    private floodT = 0;
    private heartT = 0;
    private pulse = 0;
    private collapsing = false;
    private frontZ = 1e9;
    private rumbleT = 0;
    private seg = 0;
    private crushT = -1;
    private slabBase = new THREE.Vector3();
    private staticA = 0;
    private staticT = 0;
    private hintSec = -1;
    private cassette = false;
    private tvPlayed = false;
    private tvOn = false;
    private tvT = 0;
    private mirrorSm = false;
    private pressed = false;
    private bcT = 0;

    private sm: Sm;
    private tiles: { m: THREE.Mesh; z: number; vy: number }[] = [];
    private rings: THREE.Mesh[] = [];
    private coreMesh!: THREE.Mesh;
    private coreLight!: THREE.PointLight;
    private livingLight!: THREE.PointLight;
    private podMeshes: THREE.Mesh[] = [];
    private slab!: THREE.Mesh;
    private staticMesh!: THREE.Mesh;
    private staticCv = document.createElement('canvas');
    private staticTx: THREE.CanvasTexture;
    private bcCv = document.createElement('canvas');
    private bcTx: THREE.CanvasTexture;
    private tvCv = document.createElement('canvas');
    private tvTx: THREE.CanvasTexture;
    private miCv = document.createElement('canvas');
    private miTx: THREE.CanvasTexture;
    private conCv = document.createElement('canvas');
    private conTx: THREE.CanvasTexture;
    private cassetteMesh!: THREE.Mesh;

    constructor(private ctx: D1Ctx) {
        const carve = (a: number, b: number, c: number, d: number) => { for (let r = b; r <= d; r++) for (let q = a; q <= c; q++) this.grid[r * W + q] = 0; };
        this.grid.fill(1);
        carve(8, 28, 28, 44); carve(17, 8, 19, 27); carve(12, 2, 24, 7);
        carve(29, 36, 31, 36); carve(32, 32, 42, 40);
        carve(13, 14, 16, 16); carve(20, 20, 23, 22);
        carve(36, 6, 38, 8);
        for (let r = 34; r <= 36; r++) for (let c = 17; c <= 19; c++) this.grid[r * W + c] = 1; // the Core itself
        this.sm = buildSplicemaster();
        this.sm.group.visible = false;
        this.group.add(this.sm.group);
        for (const cv of [this.bcCv, this.tvCv, this.miCv, this.conCv]) { cv.width = 128; cv.height = 72; }
        this.staticCv.width = 64; this.staticCv.height = 64;
        this.staticTx = new THREE.CanvasTexture(this.staticCv); this.staticTx.magFilter = THREE.NearestFilter;
        this.bcTx = new THREE.CanvasTexture(this.bcCv); this.tvTx = new THREE.CanvasTexture(this.tvCv);
        this.miTx = new THREE.CanvasTexture(this.miCv); this.conTx = new THREE.CanvasTexture(this.conCv);
        this.buildWorld();
        this.buildInteractables();
        this.drawMirror();
        this.group.visible = false;
    }

    private solid(c: number, r: number): boolean { return c < 0 || r < 0 || c >= W || r >= H || this.grid[r * W + c] !== 0; }
    private cellOf(x: number, z: number): [number, number] { return [Math.floor((x - X7) / CELL), Math.floor(z / CELL)]; }

    collide(p: THREE.Vector3): void {
        const R = 0.35;
        const [c0, r0] = this.cellOf(p.x, p.z);
        for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
            if (!this.solid(c, r)) continue;
            const minx = X7 + c * CELL, maxx = minx + CELL, minz = r * CELL, maxz = minz + CELL;
            const qx = Math.max(minx, Math.min(p.x, maxx)), qz = Math.max(minz, Math.min(p.z, maxz));
            const dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
            if (d < R && d > 0.0001) { p.x = qx + (dx / d) * R; p.z = qz + (dz / d) * R; }
            else if (d <= 0.0001) {
                const pen = [p.x - minx, maxx - p.x, p.z - minz, maxz - p.z];
                const mi = pen.indexOf(Math.min(...pen));
                if (mi === 0) p.x = minx - R; else if (mi === 1) p.x = maxx + R; else if (mi === 2) p.z = minz - R; else p.z = maxz + R;
            }
        }
    }

    // ───────── world ─────────
    private mk(geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
        const m = new THREE.Mesh(geo, mat);
        m.position.set(x, y, z);
        this.group.add(m);
        return m;
    }

    private floor(c0: number, r0: number, c1: number, r1: number, mat: THREE.Material): void {
        const f = this.mk(new THREE.PlaneGeometry((c1 - c0 + 1) * CELL, (r1 - r0 + 1) * CELL), mat, cx((c0 + c1) / 2), 0.01, cz((r0 + r1) / 2));
        f.rotation.x = -Math.PI / 2;
    }

    private buildWorld(): void {
        const g = this.group;
        this.floor(8, 28, 28, 44, new THREE.MeshStandardMaterial({ color: 0x07070c, roughness: 0.15, metalness: 0.6 }));
        this.floor(29, 36, 31, 36, std(0x222228)); this.floor(32, 32, 42, 40, std(0x2a2a30));
        this.floor(12, 2, 24, 7, std(0x1a1a22));
        this.floor(13, 14, 16, 16, std(0x2a2a30)); this.floor(20, 20, 23, 22, std(0x2a2a30));
        this.floor(36, 6, 38, 8, std(0x8a6a48));
        // walls: dark everywhere, cream for the living room
        const dark: [number, number][] = [], cream: [number, number][] = [];
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            if (this.grid[r * W + c] === 0) continue;
            let near = false;
            for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) if (!this.solid(c + dc, r + dr)) { near = true; break; }
            if (!near) continue;
            if (c >= 34 && c <= 40 && r >= 4 && r <= 10) cream.push([c, r]); else dark.push([c, r]);
        }
        const m4 = new THREE.Matrix4();
        const wall = (list: [number, number][], mat: THREE.Material) => {
            const im = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), mat, list.length);
            list.forEach(([c, r], i) => { m4.makeTranslation(cx(c), WALL_H / 2, cz(r)); im.setMatrixAt(i, m4); });
            g.add(im);
        };
        wall(dark, std(0x15151c, 0x040408));
        wall(cream, std(0xe8dcc4));
        // the Core and its rings
        this.coreMesh = this.mk(new THREE.CylinderGeometry(5.2, 5.6, 14, 20), std(0x0a1020, 0x103060), cx(18), 7, cz(35));
        for (const [a, b] of [[7, 7.4], [12, 12.3], [20, 20.2]]) {
            const rg = this.mk(new THREE.RingGeometry(a, b, 48), new THREE.MeshBasicMaterial({ color: 0x2a7aff, transparent: true, opacity: 0.6, side: THREE.DoubleSide }), cx(18), 0.03, cz(35));
            rg.rotation.x = -Math.PI / 2; this.rings.push(rg);
        }
        this.coreLight = new THREE.PointLight(0x4a8aff, 90, 70, 1.4);
        this.coreLight.position.set(cx(18), 9, cz(35)); g.add(this.coreLight);
        const key = new THREE.PointLight(0xffffff, 25, 60, 1.6);
        key.position.set(cx(18), 9, cz(41)); g.add(key);
        const key2 = new THREE.PointLight(0xaaaacc, 18, 60, 1.6);
        key2.position.set(cx(18), 9, cz(14)); g.add(key2);
        // memory pods (earlier hosts)
        const podPos: [number, number][] = [[cx(10), cz(31)], [cx(26), cz(30)], [cx(10), cz(41)], [cx(26), cz(42)], [cx(18), cz(43)]];
        podPos.forEach(([x, z]) => this.podMeshes.push(this.mk(new THREE.CylinderGeometry(0.6, 0.6, 2.4, 10), new THREE.MeshStandardMaterial({ color: 0x88aacc, emissive: 0x204060, transparent: true, opacity: 0.7 }), x, 1.2, z)));
        // accept / refuse podiums
        this.mk(new THREE.BoxGeometry(0.8, 1, 0.8), std(0x2a6a3a, 0x0a3a1a), cx(22), 0.5, cz(30));
        this.mk(new THREE.BoxGeometry(0.8, 1, 0.8), std(0x6a2a2a, 0x3a0a0a), cx(22), 0.5, cz(30) + 3.5);
        // original broadcast screen + side monitors
        const scr = this.mk(new THREE.PlaneGeometry(10, 5.6), new THREE.MeshBasicMaterial({ map: this.bcTx }), X7 + 43 * CELL - 0.1, 3, cz(36));
        scr.rotation.y = -Math.PI / 2;
        for (let i = 0; i < 6; i++) {
            const mm = this.mk(new THREE.PlaneGeometry(2, 1.2), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(i / 6, 0.4, 0.25) }), cx(36 + (i % 3) * 2.4), 2 + Math.floor(i / 3) * 1.6, 32 * CELL + 0.1);
            mm.rotation.y = Math.PI;
        }
        // walkway tiles + themed panels (earlier worlds intersecting)
        const cols = [0x0a0a10, 0x9a8a30, 0x6a5a48, 0x1a3a1a, 0x8a3a6a];
        for (let r = 8; r <= 27; r++) {
            const si = Math.min(4, Math.floor((27 - r) / 4));
            const tl = this.mk(new THREE.BoxGeometry(12, 0.3, CELL - 0.05), std(cols[si], si === 1 ? 0x2a2408 : 0), cx(18), -0.14, cz(r));
            this.tiles.push({ m: tl, z: cz(r), vy: 0 });
            if (r % 2 === 0) for (const s of [-1, 1]) {
                const pn = this.mk(new THREE.PlaneGeometry(CELL * 1.6, 3.4), new THREE.MeshBasicMaterial({ color: cols[si], transparent: true, opacity: 0.55 }), cx(18) + s * 5.9, 2.2, cz(r));
                pn.rotation.y = -s * Math.PI / 2;
            }
        }
        // console room: MASTER RECORDING
        for (const x of [14, 18, 22]) this.mk(new THREE.BoxGeometry(2.6, 1, 1.2), std(0x24242c, 0x0a1220), cx(x), 0.5, cz(4));
        const cs = this.mk(new THREE.PlaneGeometry(10, 5.6), new THREE.MeshBasicMaterial({ map: this.conTx }), cx(18), 3.2, 2 * CELL + 0.1);
        void cs;
        // slab for the crushing frame, camera-attached static
        this.slab = this.mk(new THREE.BoxGeometry(8, 3, 0.7), std(0x040404), 0, 20, 0);
        this.slab.visible = false;
        this.staticMesh = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.4), new THREE.MeshBasicMaterial({ map: this.staticTx, transparent: true, opacity: 0, depthTest: false, depthWrite: false }));
        this.staticMesh.position.set(0, 0, -0.3);
        this.staticMesh.renderOrder = 1000;
        this.staticMesh.visible = false;
        this.ctx.camera.add(this.staticMesh);
        // living room
        const lx = cx(37), lz = cz(7);
        this.livingLight = new THREE.PointLight(0xffd8a0, 0, 30, 1.6);
        this.livingLight.position.set(lx, 3.8, lz); g.add(this.livingLight);
        const ceil = this.mk(new THREE.PlaneGeometry(12, 12), std(0xf2ece0), lx, WALL_H - 0.4, lz); ceil.rotation.x = Math.PI / 2;
        this.mk(new THREE.BoxGeometry(2.4, 1.6, 0.9), std(0x222226), lx, 0.9, 6 * CELL + 0.6); // TV cabinet
        const tvScr = this.mk(new THREE.PlaneGeometry(2, 1.2), new THREE.MeshBasicMaterial({ map: this.tvTx }), lx, 1.2, 6 * CELL + 1.06);
        tvScr.rotation.y = 0;
        this.mk(new THREE.BoxGeometry(3, 0.8, 1.1), std(0x5a6a7a), lx, 0.4, lz + 1.2); // couch
        this.mk(new THREE.BoxGeometry(3, 0.9, 0.3), std(0x5a6a7a), lx, 0.9, lz + 1.8);
        this.mk(new THREE.BoxGeometry(1.1, 0.7, 1.1), std(0x6a4a2a), X7 + 153, 0.35, 32);
        this.cassetteMesh = this.mk(new THREE.BoxGeometry(0.35, 0.05, 0.22), std(0x111111, 0x221111), X7 + 153, 0.74, 32);
        this.drawBroadcast(); this.drawConsole(120);
        const mir = this.mk(new THREE.PlaneGeometry(1.6, 2.4), new THREE.MeshBasicMaterial({ map: this.miTx }), X7 + 39 * CELL - 0.1, 1.8, lz);
        mir.rotation.y = -Math.PI / 2;
    }

    private buildInteractables(): void {
        const c = this.ctx;
        const add = (id: string, label: string, x: number, y: number, z: number, run: () => void, enabled: () => boolean, range = 3) =>
            this.interactables.push({ id, label, pos: new THREE.Vector3(x, y, z), range, enabled, run });
        add('d7_bcast', 'Play the Original Broadcast', cx(41), 1.4, cz(36), () => this.playBroadcast(), () => this.stage === 'broadcast', 5);
        const podLines = [
            "HOST 1 — Name withheld. Last recorded words: 'It's only a tape.'",
            'HOST 2 — The boy in the bunker. Still waiting for the door to open.',
            'HOST 3 — A voice that only reads the time. It is always seven.',
            'HOST 4 — Wearing a mascot head. Sewn in. Smiling.',
            'HOST 5 — Empty. The label is in your handwriting.',
        ];
        const podPos: [number, number][] = [[cx(10), cz(31)], [cx(26), cz(30)], [cx(10), cz(41)], [cx(26), cz(42)], [cx(18), cz(43)]];
        podPos.forEach(([x, z], i) => add('d7_pod' + i, 'Read memory pod ' + (i + 1), x, 1.4, z, () => {
            this.pods[i] = true; c.sfx.click(0.4); c.say('SYSTEM', podLines[i], 5); c.track('d7_pod_read', { pod: i + 1 });
        }, () => this.stage === 'offer' && !this.pods[i], 3));
        add('d7_accept', 'Accept: wear the signal', cx(22), 1.2, cz(30), () => this.startMorph('accept'), () => this.stage === 'offer', 2.8);
        add('d7_refuse', 'Refuse the offer', cx(22), 1.2, cz(30) + 3.5, () => this.startMorph('refuse'), () => this.stage === 'offer', 2.8);
        add('d7_t1', 'MASTER RECORDING: eject the master tape', cx(14), 1.3, cz(4), () => this.consoleStep(0), () => this.stage === 'console' && this.step === 0, 3.5);
        add('d7_t2', 'MASTER RECORDING: cut the broadcast feed', cx(22), 1.3, cz(4), () => this.consoleStep(1), () => this.stage === 'console' && this.step === 1, 3.5);
        add('d7_t3', 'MASTER RECORDING: record over the master', cx(18), 1.3, cz(4), () => this.consoleStep(2), () => this.stage === 'console' && this.step === 2, 3.5);
        add('d7_cass', 'Pick up the cassette', X7 + 153, 0.9, 32, () => {
            this.cassette = true; this.cassetteMesh.visible = false;
            c.sfx.click(0.5); c.track('d7_cassette');
            c.card(['SEVEN DAYS', 'PLEASE WATCH UNTIL THE END'], 4200);
            c.say('PROTAGONIST', "Handwritten label. That's my handwriting.", 4);
            c.objective('Put the cassette in the player.');
        }, () => this.stage === 'living' && !this.cassette, 3);
        add('d7_tv', 'Insert the cassette', cx(37), 1.0, 6 * CELL + 1.5, () => this.playTv(), () => this.stage === 'living' && this.cassette && !this.tvPlayed, 3.5);
        add('d7_mirror', 'Look in the mirror', X7 + 155.5, 1.6, cz(7), () => this.lookMirror(), () => this.stage === 'mirror', 3);
    }

    // ───────── helpers ─────────
    private smSay(text: string, dur = 4.5): void {
        const c = this.ctx;
        c.say('SPLICEMASTER', (this.layered ? '[layered voices] ' : '') + text, dur);
        c.sfx.tone(55, 1.4, 0.05, 0, 'sawtooth');
        if (this.layered) { c.sfx.tone(58.5, 1.4, 0.04, -0.3, 'sawtooth'); c.sfx.tone(82.4, 1.2, 0.03, 0.3, 'triangle'); c.sfx.tone(110.7, 1, 0.02, 0, 'sine'); }
    }

    private placeSm(x: number, z: number, scale: number, faces: boolean): void {
        this.swx = x; this.swz = z; this.smScale = scale;
        this.sm.group.visible = true;
        this.sm.group.position.set(x, 0, z);
        this.sm.group.scale.setScalar(scale);
        this.sm.faces.forEach((f) => { f.visible = faces; });
    }

    private reset(stage: Stage): void {
        const c = this.ctx;
        this.stage = stage;
        c.lock(false); c.setSpeedMul(1); c.setForceCrouch(false); c.setHead(null); c.setAmbient(0.8); c.hint(null);
        c.showHands(true); c.fadeColor('#000'); c.setDrone(0.03);
        this.staticMesh.visible = false; this.staticA = 0; this.slab.visible = false; this.crushT = -1;
        this.busy = false; this.layered = false; this.swOn = false; this.morphT = -1; this.collapsing = false; this.frontZ = 1e9; this.seg = 0;
        this.offerLeft = -1; this.consoleT = -1; this.step = 0; this.pods.fill(false);
        this.cassette = false; this.tvPlayed = false; this.tvOn = false; this.mirrorSm = false; this.pressed = false;
        this.cassetteMesh.visible = true; this.livingLight.intensity = 0; this.drawMirror();
        this.sm.group.visible = false;
        this.tiles.forEach((t) => { t.vy = 0; t.m.position.y = -0.14; t.m.visible = true; });
        this.coreLight.intensity = 90;
    }

    // ───────── lifecycle ─────────
    begin(): void {
        const c = this.ctx;
        this.group.visible = true;
        this.reset('arrive');
        c.giveFlashlight();
        c.p.set(cx(18), 0, cz(43));
        c.setYaw(0); c.setPitch(0); c.setHead(null); c.setHandColor(null);
        c.lock(true);
        c.fadeTo(0, 2.5);
        c.after(1.5, () => c.say('SYSTEM', 'DESCENT COMPLETE.', 3));
        c.after(5, () => c.say('PROTAGONIST', "The whole place is humming. Like a heartbeat the size of a building.", 5));
        c.after(10, () => { c.fadeTo(1, 0.7); c.after(0.9, () => c.nextChapter('hospital_echo')); });
        c.track('d7_started');
    }

    resumeArrival(): void {
        const c = this.ctx; this.stage = 'arrive'; c.p.set(cx(18), 0, cz(43)); c.setYaw(0); c.setPitch(0); c.setHead(null);
        c.showHands(true); c.setAmbient(0.8); c.setDrone(0.03); c.lock(false); c.fadeColor('#000'); c.fadeTo(0, 1.8);
        c.objective('Approach the Core.'); this.cpId = 'd7_core'; c.checkpoint(this.cpId); c.track('story_hospital_echo_returned');
    }

    echoes(): { name: string; model: THREE.Group }[] { return [{ name: 'Splicemaster', model: this.sm.group }]; }
    releaseOverlay(): void { this.staticMesh.removeFromParent(); this.staticMesh.geometry.dispose(); (this.staticMesh.material as THREE.Material).dispose(); this.staticTx.dispose(); }

    respawn(id: string): void {
        const c = this.ctx;
        this.group.visible = true;
        this.cpId = id;
        if (id === 'd7_broadcast') { this.reset('broadcast'); c.objective('Play the Original Broadcast.'); }
        else if (id === 'd7_offer') { this.reset('offer'); this.startOffer(true); }
        else if (id === 'd7_pursuit') { this.reset('pursuit'); this.setupPursuit(); }
        else if (id === 'd7_console') { this.reset('console'); this.startConsole(true); }
        else if (id === 'd7_living') { this.reset('living'); this.setupLiving(true); }
        else { this.reset('arrive'); c.objective('Approach the Core.'); }
    }

    save(): { cp: string } { return { cp: this.cpId }; }
    load(): void { /* progress lives in the checkpoint id */ }

    objectiveText(): string {
        switch (this.stage) {
            case 'arrive': return 'Approach the Core.';
            case 'core': return 'Find the Original Broadcast. The east door is open.';
            case 'broadcast': return 'Play the Original Broadcast.';
            case 'toCore': return 'Return to the Core. He is waiting.';
            case 'offer': return 'Decide. Accept or refuse before the signal ends.';
            case 'pursuit': return 'RUN. The walkway north is the only way out.';
            case 'console': return this.step === 0 ? 'Eject the master tape.' : this.step === 1 ? 'Cut the broadcast feed.' : 'Record over the master.';
            case 'living': return this.cassette ? 'Put the cassette in the player.' : 'Look around.';
            case 'mirror': return 'Look in the mirror.';
            default: return '...';
        }
    }

    // ───────── S01–S04 ─────────
    private coreScene(): void {
        const c = this.ctx;
        this.stage = 'core';
        c.lock(true);
        c.track('d7_heart_of_system');
        c.sfx.thud(0.5);
        c.say('SYSTEM', 'SUB-BASS CORE. CENTRAL CONSCIOUSNESS: FAILING.', 4);
        c.after(4.5, () => c.say('PROTAGONIST', 'Every world. Every day. They all ran off this.', 4));
        c.after(9, () => { c.lock(false); c.objective('Find the Original Broadcast. The east door is open.'); });
    }

    private enterBroadcast(): void {
        this.stage = 'broadcast';
        const c = this.ctx;
        c.checkpoint('d7_broadcast'); this.cpId = 'd7_broadcast';
        c.objective('Play the Original Broadcast.');
        c.track('d7_broadcast_room');
    }

    private playBroadcast(): void {
        const c = this.ctx;
        this.stage = 'memory';
        c.lock(true);
        this.bcT = 0.001;
        c.track('d7_original_broadcast');
        c.sfx.staticBurst(0.8, 0.07);
        c.say('RADIO', 'Day Zero. Transmission one. If you are watching this, the signal held.', 5.5);
        c.after(6, () => c.say('RADIO', 'We built the Core to keep one voice alive. At first it was a rescue: a way to stop people from disappearing.', 7));
        c.after(13.5, () => c.say('RADIO', 'It learned to keep them instead.', 4));
        // S03 Memory Revelation
        c.after(18.5, () => { c.card(['ARCHIVE MATCH', 'HOST 7'], 3000); c.sfx.tone(120, 2, 0.08); });
        c.after(22, () => c.say('PROTAGONIST', "That's me. That's the camp. That's my voice on the tape.", 5));
        c.after(27.5, () => c.say('PROTAGONIST', "I didn't wake up on that beach. I was put there.", 4.5));
        c.after(32.5, () => this.smSay('You volunteered. Seven days, one for each world. You asked to be the one who remembered.', 6.5));
        c.after(39.5, () => c.say('PROTAGONIST', "I don't remember asking.", 3));
        c.after(43, () => this.smSay('That was the point.', 3));
        c.after(46.5, () => {
            this.bcT = 0; this.stage = 'toCore';
            c.lock(false);
            c.objective('Return to the Core. He is waiting.');
        });
    }

    private startOffer(resume: boolean): void {
        const c = this.ctx;
        this.stage = 'offer';
        this.placeSm(cx(24), cz(31), 1, false);
        this.sm.group.rotation.y = Math.atan2(-(c.p.x - cx(24)), -(c.p.z - cz(31)));
        const go = () => {
            this.offerLeft = 420;
            c.lock(false);
            c.objective('Decide. Accept or refuse before the signal ends.');
            c.checkpoint('d7_offer'); this.cpId = 'd7_offer';
        };
        c.track('d7_final_offer', { resumed: resume });
        if (resume) { go(); return; }
        c.lock(true);
        this.smSay('Seven days, and you are still standing.', 4);
        c.after(4.8, () => this.smSay('The Core is failing. It needs a voice that can hold a story together.', 5));
        c.after(10.3, () => this.smSay('Take my place. Wear the signal. Everyone you met stays safe. Preserved. Together.', 6));
        c.after(16.8, () => this.smSay('Refuse, and the Core finishes without you. They all stop.', 5));
        c.after(22.3, () => { c.say('SYSTEM', 'FINAL OFFER OPEN. 00:07:00 REMAINING.', 4); go(); });
    }

    // ───────── S05 ─────────
    private startMorph(choice: 'accept' | 'refuse' | 'timeout'): void {
        const c = this.ctx;
        this.stage = 'morph';
        this.offerLeft = -1;
        c.hint(null);
        c.lock(true);
        c.track('d7_offer_choice', { choice });
        if (choice === 'accept') c.say('PROTAGONIST', 'Show me what it costs.', 3);
        else if (choice === 'refuse') c.say('PROTAGONIST', "No. They're people, not channels.", 3.5);
        else this.smSay('Time is up. Hosts do not get to decide.', 3.5);
        c.after(3.5, () => {
            if (choice === 'accept') this.smSay('Everything. That is why it works.', 3.5);
            else if (choice === 'refuse') this.smSay('Then you have chosen the long way.', 3.5);
            c.fadeTo(1, 0.8);
        });
        c.after(5, () => {
            c.p.set(cx(18), 0, cz(30.5)); c.setYaw(Math.PI); c.setPitch(0);
            this.placeSm(cx(24), cz(40), 1, false);
            this.sm.group.rotation.y = Math.atan2(-(c.p.x - cx(24)), -(c.p.z - cz(40)));
            c.fadeTo(0, 1.2);
            this.morphT = 0;
            c.sfx.tone(40, 8, 0.15);
        });
        c.after(7, () => this.smSay('I was a technician once. A man with a name. The first one kept.', 5.5));
        c.after(13, () => { this.layered = true; this.smSay('Then the Core needed more voices. So I learned to wear them.', 5.5); });
        c.after(19, () => this.smSay("You can't leave before the episode ends.", 4));
        c.after(24, () => this.smSay('Run, little frame.', 3.5));
        c.after(27, () => {
            this.morphT = -1;
            c.lock(false);
            this.setupPursuit();
            c.checkpoint('d7_pursuit'); this.cpId = 'd7_pursuit';
        });
    }

    private setupPursuit(): void {
        const c = this.ctx;
        this.stage = 'pursuit';
        this.layered = true;
        this.placeSm(cx(24), cz(40), 2.4, true);
        this.swOn = true; this.swSpeed = 2.6;
        this.collapsing = false; this.frontZ = 1e9; this.seg = 0;
        c.setAmbient(0.7);
        c.objective('RUN. The walkway north is the only way out.');
    }

    // ───────── S06 / S07 ─────────
    private startConsole(resume: boolean): void {
        const c = this.ctx;
        this.stage = 'console';
        this.step = 0; this.consoleT = 0;
        this.layered = true;
        this.collapsing = false;
        this.tiles.forEach((t) => { t.m.visible = false; });
        this.placeSm(cx(18), cz(10), 2.4, true);
        this.swOn = true; this.swSpeed = 1.2;
        c.setAmbient(0.9);
        c.objective('Eject the master tape.');
        c.checkpoint('d7_console'); this.cpId = 'd7_console';
        c.track('d7_master_recording', { resumed: resume });
        c.say('SYSTEM', 'MASTER RECORDING. LOCKS IN 00:02:00.', 4);
    }

    private consoleStep(i: number): void {
        const c = this.ctx;
        c.sfx.click(0.6); c.sfx.tone(440 + i * 220, 0.3, 0.06, 0, 'square');
        c.track('d7_console_step', { step: i + 1 });
        if (i === 0) c.say('PROTAGONIST', 'The master tape. The one real copy of the story.', 3.5);
        if (i === 1) c.say('PROTAGONIST', 'Cutting the feed. Nobody watches this ending.', 3.5);
        this.step = i + 1;
        if (this.step === 3) { this.breakingStory(); return; }
        c.objective(this.objectiveText());
    }

    private breakingStory(): void {
        const c = this.ctx;
        this.stage = 'breaking';
        this.swOn = false;
        c.hint(null);
        c.lock(true);
        c.track('d7_breaking_story');
        c.say('SYSTEM', 'MASTER RECORDING OVERWRITTEN. AUTHOR: UNKNOWN.', 4);
        c.after(4.5, () => c.say('PROTAGONIST', "I know what the ending is. You wrote it for me. I'm not the ending.", 5.5));
        c.after(10.5, () => this.smSay("You cannot break a story you are standing inside.", 5));
        c.after(16, () => c.say('PROTAGONIST', "Then I'll finish it.", 3));
        c.after(19.5, () => this.lastFrame());
    }

    // ───────── S08 ─────────
    private lastFrame(): void {
        const c = this.ctx; this.stage = 'last'; this.swOn = false; this.slab.visible = false;
        c.track('story_day7_survived'); c.showHands(true);
        this.smSay('You cannot take them out of the story.', 4);
        c.after(4.8, () => c.say('PROTAGONIST', 'Then we will come back for them. Together.', 4));
        c.after(9.2, () => { this.sm.group.visible = false; c.sfx.staticBurst(0.7, 0.04); c.fadeColor('#000'); c.fadeTo(1, 2); c.setDrone(0); });
        c.after(12, () => this.toLiving());
    }

    // ───────── S09 / S10 ─────────
    private toLiving(): void { this.ctx.nextChapter('home_or_hospital'); }

    returnHome(): void {
        const c = this.ctx;
        this.sm.group.visible = false; this.slab.visible = false; this.swOn = false; this.crushT = -1;
        c.showHands(true); c.setHead(null);
        c.p.set(X7 + 150, 0, 34); c.setYaw(0); c.setPitch(0);
        this.stage = 'living';
        this.setupLiving(false);
    }

    private setupLiving(resume: boolean): void {
        const c = this.ctx;
        this.stage = 'living';
        this.cassette = false; this.tvPlayed = false;
        this.livingLight.intensity = 30;
        c.setAmbient(1.25); c.setDrone(0);
        this.cassetteMesh.visible = true;
        this.drawTv();
        c.checkpoint('d7_living'); this.cpId = 'd7_living';
        c.track('d7_living_room', { resumed: resume });
        c.lock(true);
        c.fadeTo(0, 3);
        c.after(3.5, () => { c.say('VOICE', 'Welcome back.', 3.5); });
        c.after(7, () => { c.lock(false); c.objective('Look around.'); });
    }

    private playTv(): void {
        const c = this.ctx;
        this.tvPlayed = true; this.tvOn = true;
        this.stage = 'tv';
        c.lock(true);
        c.track('d7_tv_island');
        c.sfx.click(0.5);
        for (let i = 0; i < 3; i++) c.after(i * 3.4, () => c.sfx.noise(3.4, 500, 0.4, 0.07, 0, 'lowpass', 200));
        c.after(2, () => c.say('ALAN', 'You made it home. The tape kept the route. We can follow it back.', 4));
        c.after(7, () => c.say('SLOPPY', 'Seven days again. This time nobody walks in alone.', 3.5));
        c.after(11, () => c.say('MITZI GOINS', 'I will lead the runs. Follow my voice, not the sirens.', 4.5));
        c.after(16.5, () => c.say('OLIVER', 'The seam opens once more. We return through all seven days. Father, Son, and Holy Ghost.', 4.5));
        c.after(21.5, () => c.say('PROTAGONIST', 'I remember the plan. I remember who I am.', 4));
        c.after(26, () => { this.stage = 'mirror'; c.lock(false); c.objective('Look in the mirror.'); });
    }

    private lookMirror(): void {
        const c = this.ctx;
        this.stage = 'ending';
        c.lock(true);
        c.track('d7_mirror');
        this.mirrorSm = false; this.drawMirror();
        c.sfx.tone(55, 3, 0.1, 0, 'sawtooth'); c.sfx.tone(58.5, 3, 0.08, 0, 'sawtooth');
        c.after(1.5, () => c.say('PROTAGONIST', 'Still me. Not his replacement.', 3));
        c.after(5, () => c.fadeTo(1, 3));
        c.after(9, () => this.finale());
    }

    private finale(): void {
        const c = this.ctx;
        c.finaleClear();
        c.setAmbient(0.4);
        const lines = ['HOME. ALIVE.', 'THE PLAN IS REMEMBERED.', 'ALAN · SLOPPY · MITZI GOINS · OLIVER', 'RETURN TO THE SEVEN DAYS.'];
        lines.forEach((l, i) => c.after(0.8 + i * 2.3, () => { c.finaleLine(l); c.sfx.tone(520 + i * 40, 0.12, 0.04, 0, 'square'); }));
        const tEnd = 0.8 + lines.length * 2.3;
        c.after(tEnd, () => c.finaleButton('RETURN TO THE SEVEN DAYS', () => this.pressPlay()));
        c.track('d7_finale_text');
    }

    private pressPlay(): void {
        if (this.pressed) return;
        this.pressed = true;
        const c = this.ctx;
        c.finaleButton(null);
        c.finaleClear();
        c.sfx.click(0.7); c.after(0.12, () => c.sfx.thud(0.25));
        c.track('d7_play_again_pressed');
        this.stage = 'done'; c.track('story_return_loop_chosen');
        // end-of-game loss: Sloppy does not come home, and the second pass begins without him
        if (c.isFriendAlive('Sloppy')) c.killFriend('Sloppy');
        c.nextChapter('return_seven_days');
    }

    // ───────── drawing ─────────
    private drawMirror(): void {
        const x = this.miCv.getContext('2d')!;
        x.fillStyle = '#1a1a20'; x.fillRect(0, 0, 128, 72);
        const sm = this.mirrorSm;
        x.fillStyle = sm ? '#e6e0d4' : '#b58a74'; x.beginPath(); x.arc(64, 26, 12, 0, 7); x.fill();
        x.fillStyle = sm ? '#16141a' : '#3a4a3a'; x.fillRect(sm ? 52 : 44, 40, sm ? 24 : 40, 32);
        if (sm) {
            x.strokeStyle = '#fff'; x.lineWidth = 2;
            x.beginPath(); x.arc(59, 24, 3, 0, 7); x.stroke(); x.beginPath(); x.arc(69, 24, 3, 0, 7); x.stroke();
            x.fillStyle = '#000'; x.fillRect(57, 33, 14, 2);
        } else { x.fillStyle = '#aa2222'; x.fillRect(40, 52, 6, 6); }
        this.miTx.needsUpdate = true;
    }

    private drawTv(): void {
        const x = this.tvCv.getContext('2d')!;
        if (!this.tvOn) { x.fillStyle = '#050505'; x.fillRect(0, 0, 128, 72); this.tvTx.needsUpdate = true; return; }
        const g = x.createLinearGradient(0, 0, 0, 40); g.addColorStop(0, '#506a80'); g.addColorStop(1, '#a8bac4');
        x.fillStyle = g; x.fillRect(0, 0, 128, 40);
        x.fillStyle = '#2a4a5a'; x.fillRect(0, 40, 128, 14);
        x.strokeStyle = '#cfe0e8'; x.lineWidth = 1;
        for (let i = 0; i < 4; i++) { const yy = 42 + i * 3 + Math.sin(this.tvT * 2 + i) * 1.2; x.beginPath(); x.moveTo(0, yy); x.lineTo(128, yy); x.stroke(); }
        x.fillStyle = '#c8b48a'; x.fillRect(0, 54, 128, 18);
        x.fillStyle = '#222'; x.fillRect(96, 34, 2, 14);
        x.fillStyle = Math.floor(this.tvT * 1.1) % 2 ? '#f44' : '#400'; x.fillRect(95, 32, 4, 3);
        x.fillStyle = 'rgba(0,0,0,0.12)'; for (let y = 0; y < 72; y += 3) x.fillRect(0, y, 128, 1);
        this.tvTx.needsUpdate = true;
    }

    private drawBroadcast(): void {
        const x = this.bcCv.getContext('2d')!;
        x.fillStyle = '#0a0f14'; x.fillRect(0, 0, 128, 72);
        if (this.bcT > 0) {
            x.fillStyle = '#e6e0d4'; x.beginPath(); x.arc(64, 30, 10, 0, 7); x.fill();
            x.fillStyle = '#16141a'; x.fillRect(50, 40, 28, 32);
            x.fillStyle = 'rgba(255,255,255,0.1)'; for (let i = 0; i < 6; i++) x.fillRect(0, Math.random() * 72, 128, 2);
        } else {
            x.fillStyle = '#7ab'; x.font = '9px monospace'; x.textAlign = 'center'; x.fillText('ORIGINAL BROADCAST', 64, 34); x.fillText('DAY 0', 64, 46);
        }
        this.bcTx.needsUpdate = true;
    }
    private drawConsole(left: number): void {
        const x = this.conCv.getContext('2d')!;
        x.fillStyle = '#05120a'; x.fillRect(0, 0, 128, 72);
        x.fillStyle = '#39ff7a'; x.textAlign = 'center'; x.font = 'bold 9px monospace';
        x.fillText('MASTER RECORDING', 64, 18);
        x.font = 'bold 16px monospace'; x.fillText(clock(left), 64, 42);
        x.font = '8px monospace'; x.fillText('STEP ' + Math.min(3, this.step + 1) + ' / 3', 64, 60);
        this.conTx.needsUpdate = true;
    }

    // ───────── per-frame ─────────
    private floodFrom(tc: number, tr: number): void {
        const f = this.flood; f.fill(-1);
        const q: number[] = [];
        if (!this.solid(tc, tr)) { f[tr * W + tc] = 0; q.push(tc, tr); }
        for (let i = 0; i < q.length; i += 2) {
            const c = q[i], r = q[i + 1], d = f[r * W + c];
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (this.solid(nc, nr) || f[nr * W + nc] >= 0) continue; f[nr * W + nc] = d + 1; q.push(nc, nr); }
        }
    }

    private chase(dt: number, pc: number, pr: number): void {
        const c = this.ctx, p = c.p;
        this.floodT -= dt;
        if (this.floodT <= 0) { this.floodT = 0.3; this.floodFrom(pc, pr); }
        const [mc, mr] = this.cellOf(this.swx, this.swz);
        const here = this.flood[mr * W + mc];
        let nx = this.swx, nz = this.swz;
        if (here > 0) {
            let best = here, bx = cx(mc), bz = cz(mr);
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = mc + dc, nr = mr + dr; if (this.solid(nc, nr)) continue; const v = this.flood[nr * W + nc]; if (v >= 0 && v < best) { best = v; bx = cx(nc); bz = cz(nr); } }
            const dx = bx - this.swx, dz = bz - this.swz, d = Math.hypot(dx, dz) || 1;
            const st = Math.min(this.swSpeed * dt, d);
            nx += (dx / d) * st; nz += (dz / d) * st;
        } else if (here === 0) {
            const dx = p.x - nx, dz = p.z - nz, d = Math.hypot(dx, dz) || 1;
            nx += (dx / d) * this.swSpeed * dt; nz += (dz / d) * this.swSpeed * dt;
        }
        this.swx = nx; this.swz = nz;
        this.sm.group.position.set(nx, 0, nz);
        this.sm.group.rotation.y = Math.atan2(-(p.x - nx), -(p.z - nz));
        if (Math.hypot(p.x - nx, p.z - nz) < 1.2 + this.smScale * 0.4) c.capture();
    }

    update(dt: number): void {
        const c = this.ctx;
        this.t += dt;
        const p = c.p;
        const [pc, pr] = this.cellOf(p.x, p.z);
        const inChamber = this.stage !== 'living' && this.stage !== 'tv' && this.stage !== 'mirror' && this.stage !== 'ending' && this.stage !== 'done' && this.stage !== 'last';

        // heartbeat of the Core
        if (inChamber) {
            this.heartT -= dt;
            if (this.heartT <= 0) { this.heartT = 1.15; this.pulse = 1; c.sfx.thud(0.2, 0); c.after(0.22, () => c.sfx.thud(0.12, 0)); }
            this.pulse = Math.max(0, this.pulse - dt * 2);
            this.coreLight.intensity = 80 + this.pulse * 60;
            (this.coreMesh.material as THREE.MeshStandardMaterial).emissiveIntensity = 0.8 + this.pulse * 0.8;
            this.rings.forEach((r, i) => { (r.material as THREE.MeshBasicMaterial).opacity = 0.3 + this.pulse * 0.4 * (1 - i * 0.2); });
        }

        // Splicemaster transformation and orbiting faces
        if (this.morphT >= 0) {
            this.morphT += dt;
            const k = Math.min(1, this.morphT / 14);
            this.smScale = 1 + 1.4 * k * k * (3 - 2 * k);
            this.sm.group.scale.setScalar(this.smScale);
            this.sm.faces.forEach((f, i) => { f.visible = this.morphT > 5 + i * 2.5; });
        }
        if (this.sm.group.visible) {
            this.sm.faces.forEach((f) => {
                const a = (f.userData.a as number) + this.t * 0.6;
                f.position.set(Math.cos(a) * 0.9, 3.0 + Math.sin(a * 1.3) * 0.15, Math.sin(a) * 0.9);
                f.rotation.y = -a + Math.PI / 2;
            });
            this.sm.eyes.forEach((e) => { e.rotation.z += dt * 3; });
        }

        // S01 / S02 / S04 triggers
        if (this.stage === 'arrive' && Math.hypot(p.x - cx(18), p.z - cz(35)) < 22) this.coreScene();
        if (this.stage === 'core' && pc >= 33 && pr >= 32) this.enterBroadcast();
        if (this.stage === 'toCore' && pc <= 29 && !this.busy) { this.busy = true; this.startOffer(false); }

        // S04 timer
        if (this.stage === 'offer' && this.offerLeft >= 0) {
            this.offerLeft -= dt;
            const s = Math.ceil(this.offerLeft);
            if (s !== this.hintSec) { this.hintSec = s; c.hint('FINAL OFFER  ' + clock(s)); }
            if (this.offerLeft <= 0) this.startMorph('timeout');
        }

        // S06 collapse
        if (this.stage === 'pursuit') {
            if (!this.collapsing && pr <= 27 && pr >= 8) {
                this.collapsing = true; this.frontZ = p.z + 18;
                c.track('d7_collapse_started');
                c.say('SYSTEM', 'WALKWAY INTEGRITY: FAILING.', 3);
            }
            if (this.collapsing) {
                const speed = 2.4 * (Math.sin(this.t * 0.9) > 0.7 ? 1.6 : 1);
                this.frontZ -= speed * dt;
                this.rumbleT -= dt;
                if (this.rumbleT <= 0) { this.rumbleT = 0.5; c.sfx.thud(0.12, 0); c.sfx.noise(0.4, 150, 0.5, 0.08, 0, 'lowpass'); }
                if (pr >= 8 && pr <= 27 && p.z > this.frontZ + 0.3) c.capture();
                const sg = Math.min(4, Math.floor((27 - pr) / 4));
                if (pr >= 8 && pr <= 27 && sg > this.seg) {
                    this.seg = sg;
                    c.setAmbient([0.7, 0.9, 0.75, 0.6, 1.0][sg]);
                    c.sfx.tone([110, 196, 147, 82, 330][sg], 1.2, 0.05, 0, 'triangle');
                    const lines = ['', 'Yellow carpet. The Backrooms. Day One folding into the floor.', 'The warehouse. Crates stacked into the sky.', 'Pines. The island, the render edge. All of it overlapping.', 'Film and dawn. The crawlspace under the cartoon, stitched into one night.'];
                    c.say('PROTAGONIST', lines[sg], 4);
                }
                if (pr <= 7 && pc >= 12 && pc <= 24) this.startConsole(false);
            }
            this.tiles.forEach((tl) => {
                if (this.collapsing && tl.z + 2 > this.frontZ) { tl.vy += 14 * dt; tl.m.position.y -= tl.vy * dt; if (tl.m.position.y < -40) tl.m.visible = false; }
            });
        }

        // S06 console timer
        if (this.stage === 'console' && this.consoleT >= 0) {
            this.consoleT += dt;
            const left = 120 - this.consoleT;
            const s = Math.ceil(left);
            if (s !== this.hintSec) { this.hintSec = s; c.hint('MASTER RECORDING  ' + clock(s)); this.drawConsole(left); }
            if (left <= 0) { this.consoleT = -1; c.hint(null); c.say('SYSTEM', 'RECORDING LOCKED.', 2.5); c.capture(); }
        }

        // pursuit actor
        if (this.swOn && (this.stage === 'pursuit' || this.stage === 'console')) this.chase(dt, pc, pr);

        // S08 slab
        if (this.crushT >= 0) {
            this.crushT += dt;
            const k = Math.min(1, this.crushT / 2.2);
            this.slab.position.set(this.slabBase.x, 9 - 8.2 * k * k, this.slabBase.z);
            if (k >= 1) this.crushT = -1;
        }

        // static overlay (no strobing: slow ramp, low refresh)
        if (this.staticMesh.visible) {
            this.staticA = Math.min(c.reducedFlash() ? 0.35 : 0.8, this.staticA + dt * 0.35);
            (this.staticMesh.material as THREE.MeshBasicMaterial).opacity = this.staticA;
            this.staticT -= dt;
            if (this.staticT <= 0) {
                this.staticT = c.reducedFlash() ? 0.25 : 0.083;
                const x = this.staticCv.getContext('2d')!;
                const img = x.createImageData(64, 64);
                for (let i = 0; i < img.data.length; i += 4) { const v = 120 + Math.random() * 135; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
                x.putImageData(img, 0, 0);
                this.staticTx.needsUpdate = true;
            }
        }

        // screens
        if (this.stage === 'memory' || this.stage === 'broadcast') { if (Math.floor(this.t * 6) !== Math.floor((this.t - dt) * 6)) this.drawBroadcast(); }
        if (this.tvOn) { this.tvT += dt; if (Math.floor(this.tvT * 8) !== Math.floor((this.tvT - dt) * 8)) this.drawTv(); }
    }
}
