import * as THREE from 'three';
import type { D1Ctx, D1Interact } from './day1.ts';
import { companion } from './companions.ts';

/** DAY FOUR — 99 NIGHTS / 404 FOREST. */
export const X4 = 1900;
const CELL = 4;
const W = 36;
const H = 28;

const cx = (c: number) => X4 + (c + 0.5) * CELL;
const cz = (r: number) => (r + 0.5) * CELL;

type Stage = 'none' | 'n1' | 'n2' | 'giant' | 'montage' | 'n99' | 'n100' | 'tunnel' | 'count' | 'exit' | 'done';
type GS = 'DORMANT' | 'PATROL' | 'TELL' | 'INVESTIGATE' | 'LOCK';

const SX = cx(27), SZ = cz(8);
const SPAWN = { x: cx(4), z: cz(20) };
const TREE_X = cx(3), TREE_Z = cz(5);
const DOOR = { x: cx(31), z: cz(16) };

interface Milestone { n: number; kind: 'go' | 'still' | 'silent' | 'cams'; x: number; z: number; label: string; line: string; obj: string; fog: number }
const MILESTONES: Milestone[] = [
    { n: 7, kind: 'go', x: cx(30), z: cz(21), label: 'Drink at the source', line: 'The river loops. It ends exactly where it starts, and it starts at my feet.', obj: 'Follow the river upstream to its source.', fog: 0.02 },
    { n: 18, kind: 'go', x: cx(14), z: cz(4), label: 'Look inside the cabin', line: 'Every chair and table is nailed to the ceiling. Like the cabin fell upward.', obj: 'Find the cabin in the north woods.', fog: 0.028 },
    { n: 33, kind: 'go', x: cx(18), z: cz(22), label: 'Compare the footprints', line: "Backward prints. Heel first. They're mine, walking away from where I'm going.", obj: 'Follow the footprints.', fog: 0.034 },
    { n: 51, kind: 'still', x: 0, z: 0, label: '', line: '', obj: 'A voice is counting. Crouch and hold still until it stops.', fog: 0.026 },
    { n: 76, kind: 'silent', x: cx(30), z: cz(4), label: 'Take the lantern', line: 'Sound comes back all at once. I was holding my breath the whole walk.', obj: 'Total silence. Walk to the lantern in the north-east.', fog: 0.045 },
    { n: 98, kind: 'cams', x: 0, z: 0, label: 'Take the bodycam', line: '', obj: 'Recordings hang from the branches. Collect all three.', fog: 0.05 },
];
const CAMS: [number, number][] = [[cx(12), cz(14)], [cx(20), cz(10)], [cx(25), cz(20)]];
const CAM_LINES = ['(recording) "Day ten. I think. The sign says night 9."', '(recording) "I stopped counting. The forest didn\'t."', '(recording) "If you find this, don\'t follow the voices."'];

function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
function hash(a: number, b: number, s: number): number {
    let h = (a * 374761393 + b * 668265263 + s * 2147483647) | 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

interface Giant { group: THREE.Group; dishes: THREE.Mesh[]; legs: THREE.Group[]; beacon: THREE.Mesh }
/** Original design: skeletal relay creature, a cage of rotating dish-shaped sound chambers, hanging wires, a beacon in its sternum. */
function buildGiant(): Giant {
    const g = new THREE.Group();
    const iron = new THREE.MeshStandardMaterial({ color: 0x5a4a3a, roughness: 0.8, metalness: 0.5 });
    const legs: THREE.Group[] = [];
    for (const s of [-1, 1]) {
        const l = new THREE.Group();
        l.position.set(s * 1.6, 9, 0);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.2, 9, 6), iron);
        m.position.y = -4.5;
        l.add(m);
        const foot = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.3, 2.2), iron);
        foot.position.set(0, -9, -0.4);
        l.add(foot);
        g.add(l);
        legs.push(l);
    }
    const cage = new THREE.Group();
    cage.position.y = 11.5;
    for (let i = 0; i < 4; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(2.2 - i * 0.2, 0.08, 5, 12), iron);
        r.rotation.x = Math.PI / 2;
        r.position.y = i * 1.1 - 1.5;
        cage.add(r);
    }
    for (let i = 0; i < 6; i++) {
        const b = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 4.4, 4), iron);
        b.position.set(Math.cos(i) * 1.9, 0.2, Math.sin(i) * 1.9);
        cage.add(b);
    }
    g.add(cage);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff8a20, fog: false }));
    beacon.position.set(0, 11.2, -1.4);
    g.add(beacon);
    const dishes: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
        const d = new THREE.Mesh(new THREE.ConeGeometry(1.0 + (i % 2) * 0.4, 0.8, 10, 1, true), new THREE.MeshStandardMaterial({ color: 0x8a8a7a, side: THREE.DoubleSide, metalness: 0.6, roughness: 0.5 }));
        d.position.set(Math.cos(i * 1.3) * 1.8, 14.2 + (i % 3) * 0.8, Math.sin(i * 1.3) * 1.8);
        d.rotation.set(1.2 * (i % 2 ? 1 : -1), i, 0);
        g.add(d);
        dishes.push(d);
    }
    const wm = new THREE.MeshBasicMaterial({ color: 0x222222 });
    for (let i = 0; i < 10; i++) {
        const w = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 3 + (i % 3), 3), wm);
        w.position.set(Math.cos(i * 0.9) * 2.2, 10 - (i % 3), Math.sin(i * 0.9) * 2.2);
        g.add(w);
    }
    return { group: g, dishes, legs, beacon };
}

export class Day4 {
    group = new THREE.Group();
    private forest = new THREE.Group();
    private blackRoom = new THREE.Group();
    interactables: D1Interact[] = [];
    private grid = new Uint8Array(W * H);
    private trees: { x: number; z: number; r: number }[] = [];
    private walls: [number, number, number, number][] = [];
    private t = 0;
    private stage: Stage = 'none';
    private nightNo = 1;
    private extraNight = false;
    private cpId = 'd4_n1';
    private ms = 0;
    private msPhase = 0;
    private stillT = 0;
    private camsGot = [false, false, false];
    private insideT = 0;
    private radioDone = false;
    private radioSeq = false;
    private windowSeen = false;
    private radioSeen = false;
    private broke = false;
    private photoSeen = false;
    private frozen = false;
    private countT = -1;
    private countSaid = 0;
    private birdT = 3;
    private birdsSilent = 0;
    private birdIntro = false;
    private loopBusy = false;
    private blocked = false;
    private muted = false;
    private doorOpen = false;

    private trunk!: THREE.InstancedMesh;
    private cone1!: THREE.InstancedMesh;
    private cone2!: THREE.InstancedMesh;
    private bndCount = 0;
    private signCv!: HTMLCanvasElement;
    private signTx!: THREE.CanvasTexture;
    private clockCv!: HTMLCanvasElement;
    private clockTx!: THREE.CanvasTexture;
    private shadowWin!: THREE.Mesh;
    private panes: THREE.Mesh[] = [];
    private river!: THREE.Mesh;
    private cabin!: THREE.Group;
    private prints: THREE.Mesh[] = [];
    private lantern!: THREE.Mesh;
    private camMeshes: THREE.Mesh[] = [];
    private thread: THREE.Group;
    private threadSegs: THREE.Mesh[] = [];
    private threadLight!: THREE.PointLight;
    private doorGroup!: THREE.Group;
    private hand!: THREE.Group;
    private spot!: THREE.SpotLight;
    private tunnelCeil!: THREE.Mesh;
    private actPos = new THREE.Vector3();
    private actOn = false;
    private actLabel = '';

    // giant
    private gi: Giant;
    private gs: GS = 'DORMANT';
    private gx = 0;
    private gz = 0;
    private gyaw = 0;
    private gTimer = 0;
    private gWp = 0;
    private gTarget: [number, number] = [0, 0];
    private gStep = 0;
    private threadPos = new THREE.Vector3(cx(5), 2.2, cz(18));
    private threadOn = false;

    constructor(private ctx: D1Ctx) {
        const carve = (a: number, b: number, c: number, d: number) => { for (let r = b; r <= d; r++) for (let q = a; q <= c; q++) this.grid[r * W + q] = 0; };
        this.grid.fill(1);
        carve(1, 1, 34, 24); carve(3, 26, 20, 26); carve(21, 25, 24, 27);
        this.gi = buildGiant();
        this.gi.group.visible = false;
        this.forest.add(this.gi.group);
        this.thread = new THREE.Group();
        this.thread.visible = false;
        this.forest.add(this.thread);
        this.group.add(this.forest, this.blackRoom);
        // Oliver: a still helper beside the lantern. Built once, shown only at the silent milestone.
        this.oliverStand = companion(3);
        this.oliverStand.visible = false;
        this.forest.add(this.oliverStand);
        this.buildWorld();
        this.buildInteractables();
        this.group.visible = false;
    }

    // ───────── geometry / collisions ─────────
    private solid(c: number, r: number): boolean { return c < 0 || r < 0 || c >= W || r >= H || this.grid[r * W + c] !== 0; }
    private cellOf(x: number, z: number): [number, number] { return [Math.floor((x - X4) / CELL), Math.floor(z / CELL)]; }

    collide(p: THREE.Vector3): void {
        if (this.stage === 'exit' || this.stage === 'done') return;
        const R = 0.35;
        const [c0, r0] = this.cellOf(p.x, p.z);
        for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
            if (!this.solid(c, r)) continue;
            const minx = X4 + c * CELL, maxx = minx + CELL, minz = r * CELL, maxz = minz + CELL;
            const qx = Math.max(minx, Math.min(p.x, maxx)), qz = Math.max(minz, Math.min(p.z, maxz));
            const dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
            if (d < R && d > 0.0001) { p.x = qx + (dx / d) * R; p.z = qz + (dz / d) * R; }
            else if (d <= 0.0001) {
                const pen = [p.x - minx, maxx - p.x, p.z - minz, maxz - p.z];
                const mi = pen.indexOf(Math.min(...pen));
                if (mi === 0) p.x = minx - R; else if (mi === 1) p.x = maxx + R; else if (mi === 2) p.z = minz - R; else p.z = maxz + R;
            }
        }
        if (this.stage !== 'tunnel') {
            for (const t of this.trees) {
                const dx = p.x - t.x, dz = p.z - t.z;
                if (Math.abs(dx) > 2 || Math.abs(dz) > 2) continue;
                const d = Math.hypot(dx, dz), m = t.r + R;
                if (d < m && d > 0.0001) { p.x = t.x + (dx / d) * m; p.z = t.z + (dz / d) * m; }
            }
            for (const [a, b, c2, d2] of this.walls) {
                const ex = a - R, fx = b + R, ez = c2 - R, fz = d2 + R;
                if (p.x > ex && p.x < fx && p.z > ez && p.z < fz) {
                    const pen = [p.x - ex, fx - p.x, p.z - ez, fz - p.z];
                    const mi = pen.indexOf(Math.min(...pen));
                    if (mi === 0) p.x = ex; else if (mi === 1) p.x = fx; else if (mi === 2) p.z = ez; else p.z = fz;
                }
            }
        }
    }

    private mk(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, parent: THREE.Object3D = this.forest, emissive = 0): THREE.Mesh {
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive }));
        m.position.set(x, y, z);
        parent.add(m);
        return m;
    }

    private buildWorld(): void {
        const f = this.forest;
        const soil = tex(128, 128, (x) => { x.fillStyle = '#1a2418'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 1800; i++) { const v = 20 + Math.random() * 30; x.fillStyle = `rgb(${v},${v + 14},${v - 4})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); } });
        soil.wrapS = soil.wrapT = THREE.RepeatWrapping;
        soil.repeat.set(W * 2, H * 2);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), new THREE.MeshStandardMaterial({ map: soil, roughness: 1 }));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(X4 + (W * CELL) / 2, 0, (H * CELL) / 2);
        f.add(floor);
        // boundary trees (fixed) + forest trees (rearranged each night)
        const cap = 900;
        const mkI = (g: THREE.BufferGeometry, col: number) => { const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ color: col, roughness: 1 }), cap); f.add(m); return m; };
        this.trunk = mkI(new THREE.CylinderGeometry(0.3, 0.45, 7, 6), 0x2a1d14);
        this.cone1 = mkI(new THREE.ConeGeometry(2.4, 5, 7), 0x0f1e14);
        this.cone2 = mkI(new THREE.ConeGeometry(1.7, 4, 7), 0x13261a);
        const dummy = new THREE.Object3D();
        let n = 0;
        const put = (x: number, z: number, s: number) => {
            dummy.rotation.set(0, hash(x | 0, z | 0, 3) * 6, 0);
            dummy.scale.setScalar(s);
            dummy.position.set(x, 3.5 * s, z); dummy.updateMatrix(); this.trunk.setMatrixAt(n, dummy.matrix);
            dummy.position.set(x, 6 * s, z); dummy.updateMatrix(); this.cone1.setMatrixAt(n, dummy.matrix);
            dummy.position.set(x, 9 * s, z); dummy.updateMatrix(); this.cone2.setMatrixAt(n, dummy.matrix);
            n++;
        };
        for (let r = -2; r < H + 2; r++) for (let c = -2; c < W + 2; c++) {
            if (c >= 0 && r >= 0 && c < W && r < H && this.grid[r * W + c] === 0) continue;
            if (r > 24 && c >= 2 && c <= 25 && r <= 28) continue;
            for (let k = 0; k < 2; k++) put(cx(c) + (hash(c, r, 5 + k) - 0.5) * 3, cz(r) + (hash(c, r, 9 + k) - 0.5) * 3, 1 + hash(c, r, 11 + k) * 0.5);
        }
        this.bndCount = n;
        // ancient tree with the root tunnel
        const anc = this.mk(new THREE.CylinderGeometry(1.3, 2.2, 18, 10), 0x3a2a1c, TREE_X, 9, TREE_Z);
        anc.name = 'ancient';
        this.mk(new THREE.SphereGeometry(5, 8, 6), 0x13261a, TREE_X, 19, TREE_Z);
        const hole = this.mk(new THREE.CircleGeometry(0.9, 10), 0x000000, TREE_X + 2.1, 0.9, TREE_Z + 0.2);
        hole.rotation.y = Math.PI / 2;
        // spawn sign
        this.signCv = document.createElement('canvas');
        this.signCv.width = 256; this.signCv.height = 96;
        this.signTx = new THREE.CanvasTexture(this.signCv);
        this.signTx.colorSpace = THREE.SRGBColorSpace;
        const post = this.mk(new THREE.CylinderGeometry(0.08, 0.08, 2.4, 6), 0x3a2a1c, SPAWN.x - 3.5, 1.2, SPAWN.z - 0.5);
        void post;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.85), new THREE.MeshBasicMaterial({ map: this.signTx }));
        sign.position.set(SPAWN.x - 3.38, 2.2, SPAWN.z - 0.5);
        sign.rotation.y = Math.PI / 2;
        f.add(sign);
        this.drawSign();
        // ranger station
        const wall = new THREE.MeshStandardMaterial({ color: 0x5a4430, roughness: 1 });
        const addWall = (x0: number, x1: number, z0: number, z1: number, h = 3.2) => {
            const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, h, z1 - z0), wall);
            m.position.set((x0 + x1) / 2, h / 2, (z0 + z1) / 2);
            f.add(m);
            this.walls.push([x0, x1, z0, z1]);
        };
        addWall(SX - 5, SX + 5, SZ - 4.2, SZ - 3.8);
        addWall(SX - 5.2, SX - 4.8, SZ - 4, SZ + 4);
        addWall(SX + 4.8, SX + 5.2, SZ - 4, SZ + 4);
        addWall(SX - 5, SX - 1.2, SZ + 3.8, SZ + 4.2);
        addWall(SX + 1.2, SX + 5, SZ + 3.8, SZ + 4.2);
        const roof = this.mk(new THREE.BoxGeometry(11, 0.3, 9), 0x2a1d14, SX, 3.35, SZ);
        void roof;
        for (let i = 0; i < 2; i++) { const pm = this.mk(new THREE.PlaneGeometry(1.4, 1.1), 0x88aacc, SX - 4.75, 1.8, SZ - 1.5 + i * 3.2); pm.rotation.y = Math.PI / 2; (pm.material as THREE.MeshStandardMaterial).transparent = true; (pm.material as THREE.MeshStandardMaterial).opacity = 0.35; this.panes.push(pm); }
        this.mk(new THREE.BoxGeometry(2.2, 0.9, 1), 0x4a3a2a, SX + 2, 0.45, SZ - 2.8);
        this.mk(new THREE.BoxGeometry(0.5, 0.35, 0.3), 0x222222, SX + 2, 1.05, SZ - 3);
        this.clockCv = document.createElement('canvas');
        this.clockCv.width = 128; this.clockCv.height = 64;
        this.clockTx = new THREE.CanvasTexture(this.clockCv);
        this.clockTx.colorSpace = THREE.SRGBColorSpace;
        const clk = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.5), new THREE.MeshBasicMaterial({ map: this.clockTx }));
        clk.position.set(SX, 2.3, SZ - 3.7);
        f.add(clk);
        this.drawClock('11:59');
        this.shadowWin = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 5), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.9 }));
        this.shadowWin.position.set(SX - 7.5, 2.5, SZ - 1.5);
        this.shadowWin.rotation.y = Math.PI / 2;
        this.shadowWin.visible = false;
        f.add(this.shadowWin);
        const lamp = new THREE.PointLight(0xffd9a0, 14, 12, 2);
        lamp.position.set(SX, 2.8, SZ);
        f.add(lamp);
        // milestone props
        this.river = this.mk(new THREE.PlaneGeometry(3, 1), 0x2a4a6a, 0, 0.03, 0);
        this.river.rotation.x = -Math.PI / 2;
        this.river.visible = false;
        this.cabin = new THREE.Group();
        this.cabin.add(new THREE.Mesh(new THREE.BoxGeometry(6, 3, 5), new THREE.MeshStandardMaterial({ color: 0x4a3828, side: THREE.BackSide })));
        for (let i = 0; i < 5; i++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.9), new THREE.MeshStandardMaterial({ color: 0x7a5a3a })); b.position.set(-2 + i * 0.6, 2.6, ((i * 5) % 3) - 1); this.cabin.add(b); }
        this.cabin.visible = false;
        f.add(this.cabin);
        for (let i = 0; i < 14; i++) { const pm = new THREE.Mesh(new THREE.PlaneGeometry(0.25, 0.5), new THREE.MeshBasicMaterial({ color: 0x0a0806 })); pm.rotation.x = -Math.PI / 2; pm.visible = false; f.add(pm); this.prints.push(pm); }
        this.lantern = this.mk(new THREE.SphereGeometry(0.3, 8, 6), 0xffd080, 0, 1.2, 0, f, 0xffa030);
        this.lantern.visible = false;
        CAMS.forEach((p) => { const cm = this.mk(new THREE.BoxGeometry(0.3, 0.2, 0.2), 0x222222, p[0], 2.2, p[1], f, 0x330000); cm.visible = false; this.camMeshes.push(cm); const wire = this.mk(new THREE.CylinderGeometry(0.01, 0.01, 3, 3), 0x111111, p[0], 3.7, p[1], f); wire.visible = false; cm.add(wire); wire.position.set(0, 1.5, 0); });
        // Pale Thread: ivory ribbon, lantern-shaped head
        for (let i = 0; i < 16; i++) {
            const seg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.04, 0.35), new THREE.MeshStandardMaterial({ color: 0xf0e8d0, emissive: 0x2a2820, transparent: true, opacity: 0.85 }));
            this.thread.add(seg);
            this.threadSegs.push(seg);
        }
        const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 0.55, 8), new THREE.MeshBasicMaterial({ color: 0xffe9b0 }));
        head.name = 'threadHead';
        this.thread.add(head);
        for (let i = 0; i < 5; i++) { const wh = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 0.5, 3), new THREE.MeshBasicMaterial({ color: 0xf0e8d0 })); wh.position.set((i - 2) * 0.1, 0.4, 0); wh.rotation.z = (i - 2) * 0.3; head.add(wh); }
        this.threadLight = new THREE.PointLight(0xffe0a0, 14, 14, 2);
        head.add(this.threadLight);
        // tunnel
        const dirt = new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 1 });
        this.tunnelCeil = new THREE.Mesh(new THREE.BoxGeometry(18 * CELL, 0.4, CELL), dirt);
        this.tunnelCeil.position.set(cx(11.5) - 0, 1.55, cz(26));
        f.add(this.tunnelCeil);
        for (let i = 0; i < 12; i++) { const root = this.mk(new THREE.CylinderGeometry(0.06, 0.1, 2, 4), 0x4a3a28, cx(3 + i * 1.5), 1, cz(26) + (i % 2 ? 1.2 : -1.2)); root.rotation.z = i; }
        const tl = new THREE.PointLight(0xffc880, 18, 14, 2);
        tl.position.set(cx(11), 1.2, cz(26));
        tl.name = 'tunnelLight';
        f.add(tl);
        for (let i = 0; i < 6; i++) this.mk(new THREE.BoxGeometry(0.4, 0.04, 0.25), 0x222222, cx(6 + i * 2.2), 0.04, cz(26) + (i % 2 ? 1 : -1) * 0.7);
        // wooden door decorated with smiling cartoon animals
        this.doorGroup = new THREE.Group();
        const dt = tex(128, 224, (x) => {
            x.fillStyle = '#7a5530'; x.fillRect(0, 0, 128, 224);
            const cols = ['#e8c840', '#e88a8a', '#8ac8e8', '#a8e88a'];
            for (let i = 0; i < 8; i++) { const px = 32 + (i % 2) * 64, py = 28 + Math.floor(i / 2) * 48; x.fillStyle = cols[i % 4]; x.beginPath(); x.arc(px, py, 18, 0, 7); x.fill(); x.fillStyle = '#111'; x.fillRect(px - 8, py - 5, 4, 4); x.fillRect(px + 4, py - 5, 4, 4); x.beginPath(); x.arc(px, py + 2, 9, 0.1, 3); x.stroke(); }
        });
        const dm = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 3.6), new THREE.MeshStandardMaterial({ map: dt, emissive: 0x333322 }));
        dm.position.set(0, 0, 0.9);
        const hinge = new THREE.Group();
        hinge.name = 'hinge';
        hinge.position.set(0, 0, -0.9);
        hinge.add(dm);
        this.doorGroup.add(hinge);
        this.doorGroup.add(new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.9, 2.6), new THREE.MeshStandardMaterial({ color: 0x3a2a1c })));
        this.doorGroup.position.set(DOOR.x, 1.9, DOOR.z);
        this.doorGroup.rotation.y = Math.PI;
        f.add(this.doorGroup);
        // black room (white-gloved hand in a spotlight)
        this.hand = new THREE.Group();
        const glove = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x555555, roughness: 0.5 });
        const palm = new THREE.Mesh(new THREE.SphereGeometry(0.4, 12, 10), glove);
        palm.scale.set(1, 0.4, 1);
        this.hand.add(palm);
        for (let i = 0; i < 4; i++) { const fg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.06, 0.6, 6), glove); fg.rotation.z = Math.PI / 2; fg.position.set(0.5, 0, (i - 1.5) * 0.17); this.hand.add(fg); }
        const th = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.45, 6), glove);
        th.position.set(0.1, 0.1, -0.45); th.rotation.x = 0.9;
        this.hand.add(th);
        this.hand.position.set(X4 + 300, 1.4, -4);
        this.blackRoom.add(this.hand);
        this.spot = new THREE.SpotLight(0xfff0d0, 300, 30, 0.5, 0.4, 1.4);
        this.spot.position.set(X4 + 300, 9, 1);
        this.spot.target.position.set(X4 + 300, 0, -3);
        this.blackRoom.add(this.spot, this.spot.target);
        this.blackRoom.visible = false;
    }

    private drawSign(): void {
        const x = this.signCv.getContext('2d')!;
        x.fillStyle = '#2a2018'; x.fillRect(0, 0, 256, 96);
        x.strokeStyle = '#c8a860'; x.lineWidth = 4; x.strokeRect(4, 4, 248, 88);
        x.fillStyle = '#e8d8a0'; x.font = 'bold 30px monospace'; x.textAlign = 'center';
        x.fillText('NIGHT ' + String(this.nightNo).padStart(2, '0') + ' / 99', 128, 58);
        this.signTx.needsUpdate = true;
    }

    private drawClock(txt: string): void {
        const x = this.clockCv.getContext('2d')!;
        x.fillStyle = '#100'; x.fillRect(0, 0, 128, 64);
        x.fillStyle = '#f33'; x.font = 'bold 34px monospace'; x.textAlign = 'center';
        x.fillText(txt, 64, 44);
        this.clockTx.needsUpdate = true;
    }

    /** Rearrange the forest for the current night (each loop subtly changes the same landmarks). */
    private regen(): void {
        const dummy = new THREE.Object3D();
        let n = this.bndCount;
        this.trees = [];
        const keep: [number, number, number][] = [[SPAWN.x, SPAWN.z, 6], [SX, SZ, 9], [TREE_X, TREE_Z, 6], [DOOR.x, DOOR.z, 8], [cx(30), cz(21), 4], [cx(14), cz(4), 4], [cx(18), cz(22), 4], [cx(30), cz(4), 4], ...CAMS.map((p) => [p[0], p[1], 3] as [number, number, number])];
        for (let r = 1; r <= 24; r++) for (let c = 1; c <= 34; c++) {
            if (hash(c, r, this.nightNo) > 0.2) continue;
            const x = cx(c) + (hash(c, r, this.nightNo + 40) - 0.5) * 3, z = cz(r) + (hash(c, r, this.nightNo + 80) - 0.5) * 3;
            if (keep.some(([kx, kz, kr]) => Math.hypot(x - kx, z - kz) < kr)) continue;
            const s = 0.9 + hash(c, r, 21) * 0.5;
            dummy.rotation.set(0, hash(c, r, 7) * 6, 0);
            dummy.scale.setScalar(s);
            dummy.position.set(x, 3.5 * s, z); dummy.updateMatrix(); this.trunk.setMatrixAt(n, dummy.matrix);
            dummy.position.set(x, 6 * s, z); dummy.updateMatrix(); this.cone1.setMatrixAt(n, dummy.matrix);
            dummy.position.set(x, 9 * s, z); dummy.updateMatrix(); this.cone2.setMatrixAt(n, dummy.matrix);
            this.trees.push({ x, z, r: 0.5 * s });
            n++;
            if (n >= 900) break;
        }
        this.trunk.count = this.cone1.count = this.cone2.count = n;
        for (const m of [this.trunk, this.cone1, this.cone2]) m.instanceMatrix.needsUpdate = true;
        this.drawSign();
    }

    private buildInteractables(): void {
        const c = this.ctx;
        const add = (id: string, label: () => string, pos: () => THREE.Vector3, run: () => void, enabled: () => boolean, range = 3) => {
            const it = { id, label: '', pos: new THREE.Vector3(), range, enabled, run } as D1Interact;
            Object.defineProperty(it, 'label', { get: label });
            Object.defineProperty(it, 'pos', { get: pos });
            this.interactables.push(it);
        };
        const v = (x: number, y: number, z: number) => () => new THREE.Vector3(x, y, z);
        add('d4_extra_night', () => 'Listen at the station door', v(SX, 1.3, SZ), () => { c.track('story_extra_night_door'); this.startCount(); }, () => this.stage === 'n100', 5);
        add('d4_radio', () => 'Inspect the radio', v(SX + 2, 1.2, SZ - 3), () => {
            this.radioSeen = true;
            c.sfx.staticBurst(0.6, 0.08);
            c.say('PROTAGONIST', "It's unplugged. The cord's lying on the floor. It still has a voice.", 5);
            c.track('d4_radio_inspected');
        }, () => this.stage === 'n2' && !this.radioSeen, 3);
        add('d4_window', () => 'Look out the window', v(SX - 4.2, 1.6, SZ - 1.5), () => {
            this.windowSeen = true;
            c.say('PROTAGONIST', "Something enormous is standing out there. Between the trees. It isn't moving.", 5);
            c.track('d4_window_inspected');
        }, () => this.stage === 'n2' && !this.windowSeen, 3);
        add('d4_act', () => this.actLabel, () => this.actPos, () => this.actDone(), () => this.stage === 'montage' && this.actOn, 3);
        CAMS.forEach((p, i) => add('d4_cam' + i, () => 'Take the hanging bodycam', v(p[0], 1.8, p[1]), () => {
            this.camsGot[i] = true; this.camMeshes[i].visible = false;
            c.sfx.click(0.5);
            c.say('PROTAGONIST', CAM_LINES[i], 6);
            c.track('d4_cam_taken', { id: i });
            if (this.camsGot.every(Boolean)) c.after(6.2, () => this.milestoneDone());
        }, () => this.stage === 'montage' && MILESTONES[this.ms]?.kind === 'cams' && !this.camsGot[i], 3));
        add('d4_scratch', () => 'Read the scratched wall', v(cx(9), 0.8, cz(26)), () => {
            c.card(['THEY ARE NOT ALL HUNTERS.', 'SOME REMEMBER WHAT HAPPENED.'], 5000);
            c.track('d4_scratch_read');
        }, () => this.stage === 'tunnel', 3.5);
        add('d4_tapes', () => 'Look through the VHS tapes', v(cx(12), 0.3, cz(26)), () => {
            c.say('PROTAGONIST', "Dozens of tapes. Every label is a different date. Every date is today.", 5);
            c.track('d4_tapes');
        }, () => this.stage === 'tunnel', 3.5);
        add('d4_drawings', () => "Look at the children's drawings", v(cx(15), 0.3, cz(26)), () => {
            c.say('PROTAGONIST', "Crayon drawings. A tall figure with a lantern for a head. And a smiling cartoon door.", 6);
            c.track('d4_drawings');
        }, () => this.stage === 'tunnel', 3.5);
        add('d4_photo', () => 'Examine the photograph', v(cx(22), 0.5, cz(26)), () => {
            this.photoSeen = true;
            c.say('PROTAGONIST', "A photo. Splicemaster and cartoon characters, standing beside a TV. That's the bunker TV from the island.", 7);
            c.objective('Climb out of the tunnel.');
            c.track('d4_photo_examined');
        }, () => this.stage === 'tunnel' && !this.photoSeen, 3.5);
        add('d4_climb', () => 'Climb out of the tunnel', v(cx(23), 1, cz(26)), () => this.startCount(), () => this.stage === 'tunnel' && this.photoSeen, 3.5);
        add('d4_door', () => 'Open the door', v(DOOR.x + 1.2, 1.4, DOOR.z), () => this.openDoor(), () => this.stage === 'count' && this.frozen && !this.doorOpen, 4);
    }
    private actDone(): void {
        const m = MILESTONES[this.ms];
        this.ctx.track('d4_milestone_done', { night: m.n });
        this.actOn = false;
        if (m.kind === 'silent') { this.muted = false; this.ctx.mute(false); this.lantern.visible = false; }
        this.ctx.say('PROTAGONIST', m.line, 6);
        this.ctx.after(6.2, () => this.milestoneDone());
    }

    // ───────── lifecycle ─────────
    begin(): void {
        const c = this.ctx;
        this.group.visible = true;
        this.nightNo = 1; this.extraNight = false;
        this.reset('n1');
        c.giveFlashlight();
        c.p.set(SPAWN.x, 0, SPAWN.z);
        c.setYaw(-Math.PI / 2);
        c.setPitch(0);
        c.setHead(null);
        c.setHandColor(null);
        c.lock(true);
        c.fadeTo(0, 2);
        c.after(2.5, () => { c.lock(false); c.objective('Reach the ranger station.'); });
        this.birdIntro = false;
        this.birdT = 5;
        c.checkpoint('d4_n1');
        c.track('d4_started');
    }

    private reset(stage: Stage): void {
        this.stage = stage;
        this.gs = 'DORMANT';
        this.gi.group.visible = false;
        this.ctx.lock(false);
        this.ctx.setForceCrouch(false);
        this.ctx.setSpeedMul(1);
        this.ctx.setHead(null);
        this.ctx.mute(false);
        this.muted = false;
        this.loopBusy = false;
        this.forest.visible = true;
        this.blackRoom.visible = false;
        this.insideT = 0;
        this.radioSeq = false;
        this.frozen = false;
        this.countT = -1;
        this.blocked = false;
        this.threadOn = false;
        this.thread.visible = false;
        this.actOn = false;
        this.regen();
        this.setFog(0.02);
        this.panes.forEach((p) => { p.visible = true; });
        this.broke = false;
        this.shadowWin.visible = false;
        this.drawClock('11:59');
        this.ctx.setAmbient(0.35);
    }

    private setFog(d: number): void {
        const s = this.group.parent as THREE.Scene | null;
        if (s && s.fog) (s.fog as THREE.FogExp2).density = d;
    }

    private teleportSpawn(): void {
        this.ctx.p.set(SPAWN.x, 0, SPAWN.z);
        this.ctx.setYaw(-Math.PI / 2);
        this.ctx.setPitch(0);
    }

    respawn(id: string): void {
        const c = this.ctx;
        this.group.visible = true;
        this.cpId = id;
        if (id === 'd4_n1') { this.nightNo = 1; this.reset('n1'); c.objective('Reach the ranger station.'); }
        else if (id === 'd4_n2') { this.nightNo = 2; this.reset('n2'); c.objective('Reach the ranger station.'); }
        else if (id.startsWith('d4_m')) { this.ms = Number(id.slice(4)); this.nightNo = MILESTONES[this.ms].n; this.reset('montage'); this.setupMilestone(); }
        else if (id === 'd4_n100') { this.extraNight = true; this.extraNightScene(); }
        else if (id === 'd4_n99') { this.nightNo = 99; this.reset('n99'); this.setup99(); }
        else if (id === 'd4_tunnel') { this.nightNo = 99; this.reset('tunnel'); this.setupTunnel(); }
        else { this.nightNo = 1; this.reset('n1'); }
    }

    save(): { cp: string } { return { cp: this.cpId }; }
    load(): void { /* all progress is encoded in the checkpoint id */ }

    objectiveText(): string {
        switch (this.stage) {
            case 'n1': case 'n2': return 'Reach the ranger station.';
            case 'giant': return 'RUN. Flee into the forest!';
            case 'montage': return MILESTONES[this.ms]?.obj ?? '...';
            case 'n100': return 'Return to the ranger station. One more night.';
            case 'n99': return 'Follow the Pale Thread. Stay quiet; the Giant hunts by sound.';
            case 'tunnel': return this.photoSeen ? 'Climb out of the tunnel.' : 'Crawl through the roots. Read the wall.';
            case 'count': return 'Reach the door.';
            default: return '...';
        }
    }

    // ───────── beats ─────────
    private midnight(): void {
        if (this.loopBusy) return;
        this.loopBusy = true;
        const c = this.ctx;
        c.lock(true);
        this.drawClock('12:00');
        c.track('d4_midnight_reset', { night: this.nightNo });
        c.sfx.tone(60, 1.5, 0.15);
        for (let k = 0; k < 6; k++) c.after(k * 0.18, () => { c.fadeTo(k % 2 ? 0.2 : 0.9, 0.1); });
        c.after(1.4, () => {
            this.nightNo = 2;
            this.regen();
            this.teleportSpawn();
            this.stage = 'n2';
            this.insideT = 0;
            this.loopBusy = false;
            this.drawClock('11:59');
            c.fadeTo(0, 1);
            c.lock(false);
            c.say('PROTAGONIST', 'No. I was just there.', 3);
            c.objective('Reach the ranger station.');
            c.checkpoint('d4_n2'); this.cpId = 'd4_n2';
        });
    }

    private broadcast(): void {
        this.radioSeq = true;
        const c = this.ctx;
        c.track('d4_emergency_broadcast');
        c.lock(false);
        c.sfx.staticBurst(1, 0.08);
        c.say('RADIO', 'This is an emergency warning. Do not follow voices coming from the treeline.', 6);
        c.after(7, () => { c.say('VOICE', "I'm outside. Open the door.", 3); c.sfx.tone(240, 0.8, 0.06, -0.5, 'sawtooth', 200); });
        c.after(10.5, () => { this.shadowWin.visible = true; c.sfx.tone(700, 3, 0.04, 0.5, 'sine', 500); c.sfx.thud(0.3, -0.6); });
        c.after(11, () => c.objective('Inspect the radio and the window.'));
        c.after(22, () => this.giantStep());
    }

    private giantStep(): void {
        if (this.broke) return;
        this.broke = true;
        this.stage = 'giant';
        const c = this.ctx;
        c.track('d4_giant_step');
        this.gi.group.visible = true;
        this.gi.group.position.set(SX - 16, 0, SZ - 2);
        this.gi.group.rotation.y = Math.PI / 2;
        c.sfx.thud(1, -0.5);
        c.after(0.3, () => { this.panes.forEach((p) => { p.visible = false; }); c.sfx.noise(1.2, 3000, 0.5, 0.2, -0.4, 'highpass'); });
        c.say('BROADCAST GIANT', 'Remain where you are. Assistance is coming.', 5);
        c.say('PROTAGONIST', 'The windows— RUN!', 2);
        c.objective('RUN. Flee into the forest!');
        c.sfx.tone(110, 3, 0.12, -0.5, 'sawtooth', 200);
    }

    private startMontage(): void {
        this.stage = 'montage';
        this.ms = 0;
        this.gi.group.visible = false;
        this.beginMilestone();
    }

    /** Oliver's placeholder figure, built once and shown only at the silent lantern milestone. */
    private oliverStand?: THREE.Group;

    private beginMilestone(): void {
        const c = this.ctx;
        const m = MILESTONES[this.ms];
        c.lock(true);
        c.fadeTo(1, 0.6);
        c.after(0.9, () => {
            this.nightNo = m.n;
            this.reset('montage');
            this.teleportSpawn();
            c.card([`NIGHT ${String(m.n).padStart(2, '0')} / 99`], 1800);
            c.after(1.2, () => {
                this.setupMilestone();
                c.fadeTo(0, 1);
                c.lock(false);
                c.checkpoint('d4_m' + this.ms); this.cpId = 'd4_m' + this.ms;
            });
        });
    }

    private setupMilestone(): void {
        const c = this.ctx;
        const m = MILESTONES[this.ms];
        this.nightNo = m.n;
        this.drawSign();
        this.setFog(m.fog);
        c.objective(m.obj);
        this.actLabel = m.label;
        this.actPos.set(m.x, 1, m.z);
        this.actOn = m.kind === 'go' || m.kind === 'silent';
        this.stillT = 0;
        this.river.visible = this.cabin.visible = this.lantern.visible = false;
        this.prints.forEach((p) => { p.visible = false; });
        this.camMeshes.forEach((cm, i) => { cm.visible = m.kind === 'cams' && !this.camsGot[i]; });
        if (m.kind === 'go' && m.n === 7) {
            this.river.visible = true;
            const dx = m.x - SPAWN.x, dz = m.z - SPAWN.z, len = Math.hypot(dx, dz);
            this.river.scale.set(len / 3, 3, 1);
            this.river.position.set((SPAWN.x + m.x) / 2, 0.03, (SPAWN.z + m.z) / 2);
            this.river.rotation.set(-Math.PI / 2, 0, Math.atan2(-dz, dx));
        }
        if (m.n === 18) { this.cabin.visible = true; this.cabin.position.set(m.x, 1.5, m.z - 3); }
        if (m.n === 33) this.prints.forEach((p, i) => { const k = i / (this.prints.length - 1); p.visible = true; p.position.set(SPAWN.x + (m.x - SPAWN.x) * k + (i % 2 ? 0.3 : -0.3), 0.04, SPAWN.z + (m.z - SPAWN.z) * k); p.rotation.z = Math.atan2(m.z - SPAWN.z, m.x - SPAWN.x) + Math.PI / 2 + Math.PI; });
        if (m.kind === 'silent') { this.lantern.visible = true; this.lantern.position.set(m.x, 1.2, m.z); this.muted = true; c.mute(true); }
        // Oliver waits beside the lantern, only if he survived Day 2. He never speaks in the silence.
        const oliverHere = m.kind === 'silent' && c.isFriendAlive('Oliver');
        if (this.oliverStand) {
            this.oliverStand.visible = oliverHere;
            if (oliverHere) this.oliverStand.position.set(m.x + 2.2, 0, m.z - 1.2);
        }
    }

    private milestoneDone(): void {
        this.ms++;
        if (this.ms < MILESTONES.length) this.beginMilestone();
        else this.begin99();
    }

    private begin99(): void {
        const c = this.ctx;
        c.lock(true);
        c.fadeTo(1, 0.8);
        c.after(1, () => {
            this.nightNo = 99;
            this.reset('n99');
            this.teleportSpawn();
            c.card(['NIGHT 99 / 99'], 2200);
            c.after(1.5, () => { this.setup99(); c.fadeTo(0, 1.2); c.lock(false); c.checkpoint('d4_n99'); this.cpId = 'd4_n99'; });
        });
    }

    private setup99(): void {
        const c = this.ctx;
        this.drawSign();
        this.setFog(0.03);
        this.stage = 'n99';
        this.gx = cx(30); this.gz = cz(20); this.gs = 'PATROL'; this.gWp = 0;
        this.gi.group.visible = true;
        this.thread.visible = false;
        this.threadOn = false;
        c.objective('Follow the Pale Thread. Stay quiet; the Giant hunts by sound.');
        c.after(5, () => {
            if (this.stage !== 'n99') return;
            this.threadOn = true; this.thread.visible = true;
            this.threadPos.set(SPAWN.x + 5, 2.2, SPAWN.z - 1);
            c.say('PROTAGONIST', "You're trying to show me something?", 3.5);
            c.track('d4_pale_thread');
        });
    }

    private setupTunnel(): void {
        const c = this.ctx;
        this.stage = 'tunnel';
        c.p.set(cx(3), 0, cz(26)); c.setYaw(-Math.PI / 2); c.setPitch(0);
        this.gi.group.visible = false; this.gs = 'DORMANT';
        this.thread.visible = false; this.threadOn = false;
        c.objective(this.photoSeen ? 'Climb out of the tunnel.' : 'Crawl through the roots. Read the wall.');
        this.setFog(0.04);
    }

    private enterTunnel(): void {
        const c = this.ctx;
        this.stage = 'tunnel';
        c.lock(true);
        c.track('d4_tunnel_entered');
        c.fadeTo(1, 0.6);
        c.after(0.9, () => {
            this.setupTunnel();
            c.fadeTo(0, 0.8); c.lock(false);
            c.checkpoint('d4_tunnel'); this.cpId = 'd4_tunnel';
        });
    }

    echoes(): { name: string; model: THREE.Group }[] { return [{ name: 'Relay Giant', model: this.gi.group }]; }

    private extraNightScene(): void {
        const c = this.ctx; this.nightNo = 100; this.reset('n100'); this.teleportSpawn();
        c.card(['NIGHT 100', 'THE NIGHT THAT SHOULD NOT EXIST'], 3300);
        c.say('OLIVER', 'The count is broken. This is a seam, not another day. Back to the station.', 6);
        c.fadeTo(0, 1.2); c.lock(false); c.objective('Return to the ranger station. One more night.');
        this.cpId = 'd4_n100'; c.checkpoint(this.cpId); c.track('story_extra_night_started');
    }

    private startCount(): void {
        const c = this.ctx;
        if (!this.extraNight) { this.extraNight = true; this.extraNightScene(); return; }
        c.lock(true);
        c.fadeTo(1, 0.6);
        c.track('d4_final_midnight');
        c.after(0.9, () => {
            this.stage = 'count';
            this.setFog(0.025);
            c.p.set(DOOR.x - 34, 0, DOOR.z); c.setYaw(-Math.PI / 2); c.setPitch(0);
            this.gi.group.visible = true; this.gs = 'DORMANT';
            this.gi.group.position.set(DOOR.x - 12, 0, DOOR.z - 22);
            this.gi.group.rotation.y = Math.PI / 4;
            this.thread.visible = false;
            c.fadeTo(0, 0.8); c.lock(false);
            this.countT = 0; this.countSaid = 0;
            c.objective('Reach the door.');
        });
    }

    private openDoor(): void {
        const c = this.ctx;
        this.doorOpen = true;
        this.stage = 'exit';
        c.lock(true);
        c.track('d4_door_opened');
        const hinge = this.doorGroup.getObjectByName('hinge')!;
        const t0 = this.t;
        c.sfx.click(0.5);
        const tick = () => {
            const k = Math.min(1, (this.t - t0) / 1.6);
            hinge.rotation.y = -k * 1.6;
            if (k < 1) c.after(0.03, tick);
            else {
                c.fadeTo(1, 0.8);
                c.after(1.2, () => this.blackRoomSeq());
            }
        };
        tick();
    }

    private blackRoomSeq(): void {
        const c = this.ctx;
        this.forest.visible = false;
        this.blackRoom.visible = true;
        this.setFog(0.002);
        c.setAmbient(0.02);
        c.p.set(X4 + 300, 0, 4);
        c.setYaw(0); c.setPitch(0);
        c.fadeTo(0, 1.2);
        // reversed 1930s melody: a descending, warbling phrase
        [880, 784, 740, 659, 587, 659, 523, 494, 440, 392].forEach((f, i) => c.after(i * 0.42, () => c.sfx.tone(f * (1 + Math.sin(i) * 0.01), 0.45, 0.05, 0, 'triangle')));
        const t0 = this.t;
        const tick = () => {
            const k = (this.t - t0) / 6;
            const reach = Math.min(1, k * 2.2);
            this.hand.position.z = -4 + Math.sin(Math.min(1, reach) * Math.PI / 2) * 3.4 - (k > 0.55 ? (k - 0.55) * 8 : 0);
            this.hand.rotation.x = Math.sin(this.t * 8) * 0.25;
            if (k < 1) c.after(0.03, tick);
        };
        tick();
        c.after(2, () => c.card(['DAYS FIVE–SIX', 'THE FILM / THE CRAWLSPACE / THE SUN'], 3200));
        c.after(7.5, () => {
            this.stage = 'done';
            c.track('d4_completed');
            c.nextChapter('d5');
        });
    }

    // ───────── giant ─────────
    private pan(dist: number): number {
        const p = this.ctx.p, yaw = this.ctx.getYaw();
        return ((this.gx - p.x) * Math.cos(yaw) + (this.gz - p.z) * -Math.sin(yaw)) / Math.max(dist, 1);
    }

    private updateGiant(dt: number): void {
        if (this.stage !== 'n99' || this.gs === 'DORMANT') return;
        const c = this.ctx, p = c.p, g = this.gi.group;
        const dist = Math.hypot(p.x - this.gx, p.z - this.gz);
        const sp = Math.hypot(c.vel.x, c.vel.y);
        const noise = c.isCrouching() ? 4 : sp > 4.5 ? 40 : sp > 0.5 ? 14 : 0;
        let move = 0;
        if (this.gs === 'PATROL') {
            const wps: [number, number][] = [[cx(30), cz(20)], [cx(20), cz(14)], [cx(10), cz(10)], [cx(20), cz(5)]];
            const [wx, wz] = wps[this.gWp % 4];
            const dx = wx - this.gx, dz = wz - this.gz, d = Math.hypot(dx, dz);
            if (d < 3) this.gWp++;
            else { move = 2.6; this.gx += (dx / d) * move * dt; this.gz += (dz / d) * move * dt; this.gyaw = Math.atan2(-dx, -dz); }
            if (dist < noise) { this.gs = 'TELL'; this.gTimer = 2.4; this.birdsSilent = 2.4; this.gTarget = [p.x, p.z]; c.sfx.tone(90, 2.4, 0.12, this.pan(dist), 'sine', 420); c.track('d4_giant_tell'); }
        } else if (this.gs === 'TELL') {
            this.gTimer -= dt;
            if (this.gTimer <= 0) this.gs = 'INVESTIGATE';
        } else if (this.gs === 'INVESTIGATE') {
            const dx = this.gTarget[0] - this.gx, dz = this.gTarget[1] - this.gz, d = Math.hypot(dx, dz);
            if (dist < noise * 0.6) this.gTarget = [p.x, p.z];
            if (d < 3) { this.gs = 'PATROL'; }
            else { move = 4.6; this.gx += (dx / d) * move * dt; this.gz += (dz / d) * move * dt; this.gyaw = Math.atan2(-dx, -dz); }
        } else if (this.gs === 'LOCK') {
            this.gTimer -= dt;
            if (this.gTimer <= 0) { this.gs = 'PATROL'; this.gWp = 3; }
        }
        g.position.set(this.gx, 0, this.gz);
        g.rotation.y = this.gyaw;
        if (move > 0) {
            this.gStep -= dt * move;
            if (this.gStep <= 0) { this.gStep = 5; c.sfx.thud(Math.min(0.9, 0.12 + 14 / Math.max(dist, 8) * 0.1), this.pan(dist)); }
        }
        this.gi.legs.forEach((l, i) => { l.rotation.x = move > 0 ? Math.sin(this.t * move * 0.5 + i * Math.PI) * 0.4 : 0; });
        // first approach: the Pale Thread coils around you and bars the Giant's way
        if (!this.blocked && this.threadOn && dist < 30 && (this.gs === 'INVESTIGATE' || dist < 22)) {
            this.blocked = true;
            this.gs = 'LOCK'; this.gTimer = 7;
            c.say('PROTAGONIST', "It's... putting itself between us.", 4);
            c.track('d4_thread_blocks_giant');
        }
        if (dist < 4 && this.gs !== 'LOCK') c.capture();
    }

    // ───────── per-frame ─────────
    update(dt: number): void {
        const c = this.ctx;
        this.t += dt;
        void this.birdIntro; void this.radioDone; void this.tunnelCeil; void this.river; void this.muted; void this.threadLight; void this.spot;
        const p = c.p;
        const inside = Math.abs(p.x - SX) < 4.6 && Math.abs(p.z - SZ) < 3.6;
        // animated props
        this.gi.dishes.forEach((d, i) => { d.rotation.y += dt * (0.6 + i * 0.2); });
        (this.gi.beacon.material as THREE.MeshBasicMaterial).color.setHex(Math.floor(this.t * 2) % 2 ? 0xff8a20 : 0x401800);
        if (this.threadOn || this.thread.visible) this.updateThread(dt);
        // birds: three identical calls, absent when something is listening
        if (this.birdsSilent > 0) this.birdsSilent -= dt;
        this.birdT -= dt;
        if (this.birdT <= 0 && this.stage !== 'tunnel' && this.stage !== 'exit') {
            this.birdT = 9 + Math.random() * 5;
            if (this.birdsSilent <= 0 && this.stage !== 'giant') for (let k = 0; k < 3; k++) c.after(k * 0.5, () => c.sfx.tone(2400, 0.12, 0.03, 0.4, 'sine', 1800));
        }
        if (this.stage === 'n1' && inside) {
            this.insideT += dt;
            if (this.insideT > 10) this.midnight();
        }
        if (this.stage === 'n2' && inside && !this.radioSeq) this.broadcast();
        if (this.stage === 'n2' && this.radioSeq && this.radioSeen && this.windowSeen && !this.broke && this.insideT === 0) { this.insideT = 1; c.after(6, () => this.giantStep()); }
        if (this.stage === 'giant' && Math.hypot(p.x - SX, p.z - SZ) > 22) this.startMontage();
        if (this.stage === 'giant' && this.gi.group.visible) this.gi.group.position.x += dt * 1.5;
        if (this.stage === 'montage') {
            const m = MILESTONES[this.ms];
            if (m?.kind === 'still') {
                const still = c.isCrouching() && Math.hypot(c.vel.x, c.vel.y) < 0.4;
                const before = Math.floor(this.stillT);
                this.stillT = still ? this.stillT + dt : Math.max(0, this.stillT - dt * 2);
                if (still && Math.floor(this.stillT) > before && this.stillT < 9) c.say('VOICE', `Breath ${Math.floor(this.stillT)}...`, 1.2);
                if (this.stillT >= 9) { this.stillT = 0; this.actOn = false; c.say('VOICE', 'Ten.', 2); c.after(2.2, () => this.milestoneDone()); this.stage = 'montage'; this.msPhase = 1; }
            }
        }
        if (this.stage === 'n99' && Math.hypot(p.x - TREE_X, p.z - TREE_Z) < 3.2) this.enterTunnel();
        if (this.stage === 'tunnel') {
            c.setForceCrouch(p.z > cz(26) - 2 && p.x < cx(20) + 2);
            c.setSpeedMul(0.9);
        }
        if (this.stage === 'count' && this.countT >= 0 && !this.frozen) {
            this.countT += dt;
            const words = ['Ten.', 'Nine.', 'Eight.', 'Seven.', 'Six.', 'Five.', 'Four.', 'Three.', 'Two.', 'One.'];
            if (this.countT >= this.countSaid && this.countSaid < 10) { c.say('BROADCAST GIANT', words[this.countSaid], 1.1); c.sfx.tone(220, 0.4, 0.07, 0.3, 'sawtooth', 160); this.countSaid++; }
            if (this.countT >= 10.5) {
                this.frozen = true;
                c.track('d4_zero');
                c.say('PROTAGONIST', "It stopped. The whole forest stopped. Even the wind.", 4);
                c.sfx.tone(60, 2, 0.1);
                c.objective('Open the door.');
                c.after(0.1, () => { this.gs = 'DORMANT'; });
            }
        }
        this.updateGiant(dt);
        void this.msPhase;
    }

    private updateThread(dt: number): void {
        const c = this.ctx, p = c.p;
        const toTree = new THREE.Vector3(TREE_X, 2.2, TREE_Z).sub(this.threadPos);
        let goal = new THREE.Vector3(TREE_X + 2.5, 2.2, TREE_Z);
        if (this.blocked && this.gs === 'LOCK') {
            const toG = new THREE.Vector3(this.gx - p.x, 0, this.gz - p.z).normalize();
            goal = new THREE.Vector3(p.x + toG.x * 9, 4, p.z + toG.z * 9);
        } else if (Math.hypot(p.x - this.threadPos.x, p.z - this.threadPos.z) > 9) goal = this.threadPos.clone();
        const d = goal.clone().sub(this.threadPos);
        if (d.length() > 0.2) this.threadPos.addScaledVector(d.normalize(), Math.min(d.length(), 3.2 * dt));
        void toTree;
        const head = this.thread.getObjectByName('threadHead') as THREE.Object3D;
        head.position.copy(this.threadPos);
        head.position.y += Math.sin(this.t * 2) * 0.15;
        this.threadSegs.forEach((s, i) => {
            const k = i / this.threadSegs.length;
            s.position.set(this.threadPos.x - Math.sin(this.t * 1.5 + i * 0.5) * 0.3 * (k + 0.3), this.threadPos.y - 0.4 - k * 1.8 + Math.sin(this.t + i) * 0.1, this.threadPos.z + k * 1.4);
            s.rotation.y = Math.sin(this.t + i) * 0.5;
        });
    }
}
