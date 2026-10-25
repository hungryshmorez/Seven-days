import * as THREE from 'three';
import { buildCleaverback, type CleaverbackRig } from './cleaverback.ts';
import type { D1Ctx, D1Interact } from './day1.ts';
import { Sloppy, type SloppyHost } from './sloppy.ts';

/** DAY TWO — THE NOSTALGIA WAREHOUSE. Grid warehouse with racks, a memory-sorting puzzle, the Cleaverback's return, a bedroom and the freight elevator. */
export const X2 = 1000;
const CELL = 4;
const W = 40;
const H = 30;
const WALL_H = 6;
const cx = (c: number) => X2 + (c + 0.5) * CELL;
const cz = (r: number) => (r + 0.5) * CELL;
interface LowBox { minx: number; maxx: number; minz: number; maxz: number; h: number }
type Stage = 'none' | 'intro' | 'explore' | 'sorted' | 'exit' | 'chase' | 'catwalk' | 'bedroom' | 'elev0' | 'elev1' | 'elev2' | 'elev3' | 'elev4' | 'descend' | 'done';
type CS = 'DORMANT' | 'TRACK' | 'STALK' | 'CHARGE' | 'PAUSE' | 'SEARCH' | 'ELEV';
function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void, rep?: [number, number]): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rep[0], rep[1]); }
    return t;
}
const REELS = [
    { id: 1, name: 'BEFORE', sym: 'circle', year: 'JUNE 1994', wear: 'barely worn, label crisp', tone: 440 },
    { id: 2, name: 'DURING', sym: 'square', year: 'DECEMBER 1997', wear: 'edges frayed, one clean scratch', tone: 550 },
    { id: 3, name: 'AFTER', sym: 'triangle', year: 'MARCH 2003', wear: 'heavily worn, label rubbed almost blank', tone: 660 },
];
export class Day2 {
    group = new THREE.Group();
    interactables: D1Interact[] = [];
    private grid = new Uint8Array(W * H);
    private lows: LowBox[] = [];
    private t = 0;
    private stage: Stage = 'none';
    private wallMat!: THREE.MeshStandardMaterial;
    private floorMat!: THREE.MeshStandardMaterial;
    private panels!: THREE.InstancedMesh;
    private panelPos: THREE.Vector3[] = [];
    private lights: THREE.PointLight[] = [];
    private lightT = 0;
    private clinT = 0;
    private clin = 0;
    private introT = -1;
    private cpId = 'd2_arrival';
    private cpMop = { x: cx(31), z: cz(7) };

    // story
    private reels = [false, false, false];
    private slots = [0, 0, 0];
    private solved = false;
    private tvSeen = new Set<number>();
    private tvLines = false;
    private loops = 0;
    private phoneRang = false;
    private slammed = false;
    private chaseStarted = false;
    private label = false;
    private key = false;
    private tapeSeen = false;
    private shadowT = -1;
    private catBlade = false;
    private falling = false;
    private elevT = 0;
    private wedgeT = 0;
    private busy = false;

    // props
    private tvs: { mesh: THREE.Mesh; cv: HTMLCanvasElement; tx: THREE.CanvasTexture }[] = [];
    private reelMesh: THREE.Mesh[] = [];
    private daylight!: THREE.Mesh;
    private doorSlab!: THREE.Mesh;
    private exitLight!: THREE.PointLight;
    private catBladeMesh!: THREE.Mesh;
    private shadow!: THREE.Mesh;
    private bedCv!: HTMLCanvasElement;
    private bedTx!: THREE.CanvasTexture;
    private clockHand!: THREE.Mesh;
    private keyMesh!: THREE.Mesh;
    private labelMesh!: THREE.Mesh;
    private knife!: THREE.Mesh;
    private elevDoor!: THREE.Group;
    private elevLight!: THREE.PointLight;
    private signCv!: HTMLCanvasElement;
    private signTx!: THREE.CanvasTexture;
    private signText = 'AISLE A · TOYS 1982';
    private bedMode: 'off' | 'static' | 'sleep' | 'future' = 'off';
    private debris: { m: THREE.Mesh; vy: number; life: number }[] = [];
    private debrisT = 0;

    // creature
    private rig: CleaverbackRig;
    private mx = cx(31);
    private mz = cz(7);
    private myaw = Math.PI;
    private cs: CS = 'DORMANT';
    private cTimer = 0;
    private cPauseIn = 9;
    private cThuds = 0;
    private cPhase = 0;
    private scrapeT = 1;
    private flood = new Int16Array(W * H);
    private floodT = 0;
    private seeT = 0;
    private lastKnown: [number, number] = [11, 7];

    private sloppy: Sloppy;
    /** Alan, Mitzi and Oliver: helpers on the first pass, hunters on the second. */
    private friends: { s: Sloppy; help: [number, number]; name: string }[] = [];
    private friendHelped = new Set<string>();
    private friendTalkT = 0;
    constructor(private ctx: D1Ctx) {
        const carve = (a: number, b: number, c: number, d: number, v = 0) => { for (let r = b; r <= d; r++) for (let q = a; q <= c; q++) this.grid[r * W + q] = v; };
        this.grid.fill(1);
        carve(2, 12, 9, 17); carve(10, 6, 33, 24); carve(11, 3, 11, 5); carve(26, 0, 33, 1);
        carve(1, 20, 6, 25); carve(3, 26, 3, 27); carve(3, 28, 12, 28); carve(13, 27, 15, 29);
        for (const c of [13, 17, 21, 25]) for (let r = 9; r <= 21; r++) {
            if ((c === 17 || c === 21) && (r === 14 || r === 15)) continue;
            this.grid[r * W + c] = 2;
        }
        this.rig = buildCleaverback();
        this.rig.group.visible = false;
        this.group.add(this.rig.group);
        const hostFor = (who: string): SloppyHost => ({
            columns: W, rows: H,
            solid: (c, r) => this.solid(c, r) || !this.friendCanStand(cx(c), cz(r)),
            canStand: (x, z) => this.friendCanStand(x, z),
            los: (ax, az, bx, bz) => this.los(ax, az, bx, bz),
            cellOf: (x, z) => this.cellOf(x, z),
            cx, cz,
            player: () => this.ctx.p,
            caught: () => { this.ctx.track('d2_friend_caught_player', { friend: who, cycle: 2 }); this.ctx.capture(); },
            spotted: () => {
                this.ctx.track('d2_friend_spotted_player', { friend: who, cycle: 2 });
                if (this.t >= this.friendTalkT) {
                    this.friendTalkT = this.t + 4;
                    this.ctx.say('PROTAGONIST', who === 'Mitzi' ? 'Mitzi? She is coming straight for me.' : `${who}? That is not how he used to look at me.`, 3);
                }
            },
            stateChanged: (state) => this.ctx.track('d2_friend_state_changed', { friend: who, state, cycle: this.ctx.isSecondCycle() ? 2 : 1 }),
        });
        // Avoid the sorting console at (8,14); the other patrols have separate aisles.
        this.sloppy = new Sloppy(hostFor('Sloppy'), [[4, 14], [7, 14], [7, 16], [4, 16]]);
        this.group.add(this.sloppy.group);
        const cast: [string, number, [number, number][], [number, number]][] = [
            ['Alan', 0, [[6, 13], [6, 17], [9, 17], [9, 13]], [11, 4]],
            ['Mitzi', 2, [[10, 8], [14, 8], [14, 6], [10, 6]], [11, 5]],
            ['Oliver', 3, [[28, 9], [32, 9], [32, 12], [28, 12]], [11, 3]],
        ];
        for (const [name, idx, route, help] of cast) {
            this.friends.push({ s: new Sloppy(hostFor(name), route, idx), help, name });
        }
        for (const f of this.friends) this.group.add(f.s.group);
        this.buildGeometry();
        this.buildProps();
        this.buildInteractables();
        this.group.visible = false;
    }

    // ───────── grid ─────────
    private solid(c: number, r: number): boolean {
        return c < 0 || r < 0 || c >= W || r >= H || this.grid[r * W + c] !== 0;
    }
    private cellOf(x: number, z: number): [number, number] { return [Math.floor((x - X2) / CELL), Math.floor(z / CELL)]; }
    private los(ax: number, az: number, bx: number, bz: number): boolean {
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.6);
        for (let i = 1; i < n; i++) { const k = i / n; const [c, r] = this.cellOf(ax + (bx - ax) * k, az + (bz - az) * k); if (this.solid(c, r)) return false; }
        return true;
    }

    /** Body clearance for friends, including low furniture and the duck-under beam. */
    private friendCanStand(x: number, z: number): boolean {
        const radius = 0.42;
        for (const dx of [-radius, radius]) for (const dz of [-radius, radius]) {
            const [c, r] = this.cellOf(x + dx, z + dz);
            if (this.solid(c, r)) return false;
        }
        for (const b of this.lows) {
            if (x > b.minx - radius && x < b.maxx + radius && z > b.minz - radius && z < b.maxz + radius) return false;
        }
        if (Math.abs(x - cx(11)) < 6 + radius && Math.abs(z - cz(19)) < 0.25 + radius) return false;
        // The bedroom's thin back wall is not represented by the coarse grid.
        if (Math.abs(x - (X2 + 16)) < 12 + radius && Math.abs(z - (80 + 0.1)) < 0.1 + radius) return false;
        return true;
    }

    groundAt(x: number, z: number, y: number): number {
        let g = 0;
        for (const b of this.lows) if (x > b.minx && x < b.maxx && z > b.minz && z < b.maxz && y >= b.h - 0.12) g = Math.max(g, b.h);
        return g;
    }
    collide(p: THREE.Vector3): void {
        const R = 0.35;
        const [c0, r0] = this.cellOf(p.x, p.z);
        for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
            if (!this.solid(c, r)) continue;
            const minx = X2 + c * CELL, maxx = minx + CELL, minz = r * CELL, maxz = minz + CELL;
            const qx = Math.max(minx, Math.min(p.x, maxx)), qz = Math.max(minz, Math.min(p.z, maxz));
            const dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
            if (d < R && d > 0.0001) { p.x = qx + (dx / d) * R; p.z = qz + (dz / d) * R; }
            else if (d <= 0.0001) {
                const pen = [p.x - minx, maxx - p.x, p.z - minz, maxz - p.z];
                const mi = pen.indexOf(Math.min(...pen));
                if (mi === 0) p.x = minx - R; else if (mi === 1) p.x = maxx + R; else if (mi === 2) p.z = minz - R; else p.z = maxz + R;
            }
        }
        for (const b of this.lows) {
            if (p.y >= b.h - 0.1) continue;
            const ex = b.minx - R, fx = b.maxx + R, ez = b.minz - R, fz = b.maxz + R;
            if (p.x > ex && p.x < fx && p.z > ez && p.z < fz) {
                const pen = [p.x - ex, fx - p.x, p.z - ez, fz - p.z];
                const mi = pen.indexOf(Math.min(...pen));
                if (mi === 0) p.x = ex; else if (mi === 1) p.x = fx; else if (mi === 2) p.z = ez; else p.z = fz;
            }
        }
    }

    // ───────── geometry ─────────
    private buildGeometry(): void {
        const g = this.group;
        const wallTex = tex(128, 128, (x) => {
            x.fillStyle = '#7a6c58'; x.fillRect(0, 0, 128, 128);
            for (let i = 0; i < 400; i++) { x.fillStyle = `rgba(40,30,20,${Math.random() * 0.15})`; x.fillRect(Math.random() * 128, Math.random() * 128, 5, 5); }
            x.strokeStyle = 'rgba(0,0,0,0.25)'; x.strokeRect(0, 0, 128, 128);
        });
        const rackTex = tex(128, 128, (x) => {
            x.fillStyle = '#3a3226'; x.fillRect(0, 0, 128, 128);
            for (let row = 0; row < 4; row++) {
                x.fillStyle = '#6a5a40'; x.fillRect(0, row * 32 + 28, 128, 4);
                for (let i = 0; i < 5; i++) { x.fillStyle = ['#a85a3a', '#3a6a8a', '#c8a83a', '#7a4a8a', '#4a8a5a'][(i + row) % 5]; x.fillRect(4 + i * 24, row * 32 + 8 + (i % 2) * 4, 18, 20 - (i % 2) * 4); }
            }
        });
        this.wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.95 });
        const floorTex = tex(128, 128, (x) => {
            x.fillStyle = '#5a5248'; x.fillRect(0, 0, 128, 128);
            for (let i = 0; i < 1500; i++) { const v = 70 + Math.random() * 40; x.fillStyle = `rgb(${v},${v - 6},${v - 14})`; x.fillRect(Math.random() * 128, Math.random() * 128, 2, 2); }
            x.strokeStyle = 'rgba(0,0,0,0.3)'; x.strokeRect(0, 0, 128, 128);
        }, [W, H]);
        this.floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.9 });
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), this.floorMat);
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(X2 + (W * CELL) / 2, 0, (H * CELL) / 2);
        g.add(floor);
        const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), new THREE.MeshStandardMaterial({ color: 0x2a2620, roughness: 1, side: THREE.DoubleSide }));
        ceil.rotation.x = Math.PI / 2;
        ceil.position.set(X2 + (W * CELL) / 2, WALL_H, (H * CELL) / 2);
        g.add(ceil);
        const walls: [number, number][] = [], racks: [number, number][] = [];
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            const v = this.grid[r * W + c];
            if (v === 0) continue;
            if (v === 2) { racks.push([c, r]); continue; }
            let near = false;
            for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) if (!this.solid(c + dc, r + dr)) { near = true; break; }
            if (near) walls.push([c, r]);
        }
        const m = new THREE.Matrix4();
        const wm = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), this.wallMat, walls.length);
        walls.forEach(([c, r], i) => { m.makeTranslation(cx(c), WALL_H / 2, cz(r)); wm.setMatrixAt(i, m); });
        g.add(wm);
        const rm = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL - 0.4, WALL_H - 0.6, CELL - 0.4), new THREE.MeshStandardMaterial({ map: rackTex, roughness: 0.9 }), racks.length);
        racks.forEach(([c, r], i) => { m.makeTranslation(cx(c), (WALL_H - 0.6) / 2, cz(r)); rm.setMatrixAt(i, m); });
        g.add(rm);
        const pos: THREE.Vector3[] = [];
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (!this.solid(c, r) && (c + r) % 2 === 0) pos.push(new THREE.Vector3(cx(c), WALL_H - 0.05, cz(r)));
        this.panelPos = pos;
        const pg = new THREE.PlaneGeometry(1.8, 0.8);
        pg.rotateX(Math.PI / 2);
        this.panels = new THREE.InstancedMesh(pg, new THREE.MeshBasicMaterial({ color: 0xffffff }), pos.length);
        pos.forEach((v, i) => { m.makeTranslation(v.x, v.y, v.z); this.panels.setMatrixAt(i, m); this.panels.setColorAt(i, new THREE.Color(1, 0.88, 0.65)); });
        g.add(this.panels);
        for (let i = 0; i < 4; i++) { const l = new THREE.PointLight(0xffd9a0, 40, 20, 2); l.position.y = WALL_H - 0.5; g.add(l); this.lights.push(l); }
    }
    private box(w: number, h: number, d: number, color: number, x: number, y: number, z: number, emissive = 0): THREE.Mesh {
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, roughness: 0.85, emissive }));
        mesh.position.set(x, y, z);
        this.group.add(mesh);
        return mesh;
    }
    private addLow(x: number, z: number, w: number, d: number, h: number): void {
        this.lows.push({ minx: x - w / 2, maxx: x + w / 2, minz: z - d / 2, maxz: z + d / 2, h });
    }
    private makeTv(x: number, z: number, ry: number, idx: number): void {
        this.box(1.1, 0.9, 0.7, 0x222222, x, 0.95, z).rotation.y = ry;
        this.box(0.6, 0.9, 0.5, 0x333333, x, 0.45, z).rotation.y = ry;
        const cv = document.createElement('canvas');
        cv.width = 160; cv.height = 120;
        const tx = new THREE.CanvasTexture(cv);
        tx.colorSpace = THREE.SRGBColorSpace;
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.85, 0.62), new THREE.MeshBasicMaterial({ map: tx }));
        mesh.position.set(x + Math.sin(ry) * 0.36, 0.98, z + Math.cos(ry) * 0.36);
        mesh.rotation.y = ry;
        this.group.add(mesh);
        this.tvs[idx] = { mesh, cv, tx };
        this.addLow(x, z, 1.1, 0.8, 1.5);
    }
    private buildProps(): void {
        // receiving-bay TVs with altered memories
        this.makeTv(cx(3), cz(12) + 1.3, Math.PI, 0);
        this.makeTv(cx(5), cz(12) + 1.3, Math.PI, 1);
        this.makeTv(cx(7), cz(12) + 1.3, Math.PI, 2);
        // changing label sign
        this.signCv = document.createElement('canvas');
        this.signCv.width = 256; this.signCv.height = 64;
        this.signTx = new THREE.CanvasTexture(this.signCv);
        this.signTx.colorSpace = THREE.SRGBColorSpace;
        const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.6), new THREE.MeshBasicMaterial({ map: this.signTx }));
        sign.position.set(cx(11), 2.4, cz(9) - 0.1);
        sign.rotation.y = Math.PI;
        sign.position.z = cz(8) + 1.8;
        sign.rotation.y = 0;
        this.group.add(sign);
        this.drawSign();
        // aisle signs
        ['A', 'B', 'C', 'D'].forEach((l, i) => {
            const t = tex(64, 64, (x) => { x.fillStyle = '#c8a83a'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#222'; x.font = 'bold 48px monospace'; x.textAlign = 'center'; x.fillText(l, 32, 50); });
            const s = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: t }));
            s.position.set(cx([11, 15, 19, 23][i]), 4.2, cz(8.6));
            this.group.add(s);
        });
        // landmarks: giant red toy block, blinking arcade cabinet, paper moon
        this.box(3.4, 3.4, 3.4, 0xc02020, cx(28), 1.7, cz(13));
        this.addLow(cx(28), cz(13), 3.4, 3.4, 3.4);
        const cab = this.box(1.2, 2.2, 1, 0x2a2a6a, cx(31), 1.1, cz(7), 0x080820);
        this.addLow(cx(31), cz(7), 1.2, 1, 2.2);
        const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ color: 0x66ffcc }));
        scr.position.set(cx(31), 1.5, cz(7) - 0.52);
        scr.rotation.y = Math.PI;
        scr.name = 'arcadeScreen';
        this.group.add(scr);
        void cab;
        const moon = new THREE.Mesh(new THREE.SphereGeometry(1.2, 14, 10), new THREE.MeshBasicMaterial({ color: 0xe8e0c0 }));
        moon.position.set(cx(19), 4.6, cz(7));
        this.group.add(moon);
        // conveyor across aisle A (vault), fallen beam (duck), long toy conveyor in the east
        this.box(12, 0.6, 1.4, 0x555a5e, cx(11), 0.3, cz(16));
        this.addLow(cx(11), cz(16), 12, 1.4, 0.6);
        const beam = this.box(12, 0.4, 0.5, 0x3a2a1a, cx(11), 1.35, cz(19));
        beam.rotation.z = 0.04;
        this.box(10, 0.7, 1.6, 0x555a5e, cx(30), 0.35, cz(18));
        this.addLow(cx(30), cz(18), 10, 1.6, 0.7);
        // reels
        const rpos: [number, number, number][] = [[cx(11) - 1.2, 0.35, cz(11)], [cx(31), 2.35, cz(7)], [cx(32), 0.85, cz(18)]];
        REELS.forEach((r, i) => {
            const mesh = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.08, 14), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, emissive: 0x303018 }));
            mesh.position.set(...rpos[i]);
            this.group.add(mesh);
            const symTex = tex(64, 64, (x) => {
                x.fillStyle = '#e8d8a0'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#111';
                if (r.sym === 'circle') { x.beginPath(); x.arc(32, 32, 18, 0, 7); x.fill(); }
                else if (r.sym === 'square') x.fillRect(14, 14, 36, 36);
                else { x.beginPath(); x.moveTo(32, 12); x.lineTo(54, 52); x.lineTo(10, 52); x.fill(); }
            });
            const top = new THREE.Mesh(new THREE.CircleGeometry(0.2, 12), new THREE.MeshBasicMaterial({ map: symTex }));
            top.rotation.x = -Math.PI / 2;
            top.position.y = 0.045;
            mesh.add(top);
            this.reelMesh.push(mesh);
        });
        // sorting console
        this.box(2.4, 1.0, 0.8, 0x3a4a3a, cx(8), 0.5, cz(14) + 0.5);
        this.box(2.4, 0.1, 0.8, 0x6a7a6a, cx(8), 1.05, cz(14) + 0.5);
        this.addLow(cx(8), cz(14) + 0.5, 2.4, 0.8, 1.1);
        // false exit: daylight projection, door slab, glow
        const day = tex(256, 400, (x) => {
            const g = x.createLinearGradient(0, 0, 0, 400); g.addColorStop(0, '#8ac8ff'); g.addColorStop(1, '#f5e3b0');
            x.fillStyle = g; x.fillRect(0, 0, 256, 400);
            x.fillStyle = '#245a34';
            for (let i = 0; i < 7; i++) { x.beginPath(); x.moveTo(i * 40 - 10, 330); x.lineTo(i * 40 + 20, 160 + (i % 3) * 25); x.lineTo(i * 40 + 50, 330); x.fill(); }
            x.fillStyle = '#d2a81f'; x.beginPath(); x.moveTo(110, 370); x.lineTo(150, 300); x.lineTo(190, 370); x.fill();
            x.fillStyle = '#ff9a2a'; x.fillRect(60, 350, 16, 22);
        });
        this.daylight = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 5.2), new THREE.MeshBasicMaterial({ map: day }));
        this.daylight.position.set(cx(11), 2.6, cz(3) - 1.9);
        this.group.add(this.daylight);
        this.doorSlab = this.box(3.4, 5.2, 0.25, 0x4a3a2a, cx(11) + 4, 2.6, cz(3) - 1.7);
        this.doorSlab.visible = false;
        this.exitLight = new THREE.PointLight(0xfff0c0, 0, 22, 2);
        this.exitLight.position.set(cx(11), 3, cz(3));
        this.group.add(this.exitLight);
        this.daylight.visible = false;
        // ladder
        this.box(0.1, 5, 0.1, 0x777777, cx(11) - 0.4, 2.5, cz(24) + 1.75);
        this.box(0.1, 5, 0.1, 0x777777, cx(11) + 0.4, 2.5, cz(24) + 1.75);
        for (let i = 0; i < 9; i++) this.box(0.8, 0.06, 0.06, 0x777777, cx(11), 0.4 + i * 0.55, cz(24) + 1.75);
        // blade that punches through the wall next to the catwalk
        this.catBladeMesh = this.box(0.15, 2.2, 1.6, 0x7a4326, cx(30), 1.6, cz(2) - 1);
        this.catBladeMesh.visible = false;
        this.box(8, 0.12, 0.12, 0x888888, cx(29.5), 1.1, cz(0) - 1.8);
        // curtain at the end of the catwalk
        this.box(0.2, 4, 7, 0x6a1a2a, cx(26) - 1.6, 2, cz(0.5) + 0.2);
        // bedroom
        const paper = tex(64, 64, (x) => { x.fillStyle = '#c8b090'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#a07858'; for (let i = 0; i < 8; i++) x.fillRect((i % 4) * 16 + 4, Math.floor(i / 4) * 32 + 4, 8, 8); });
        const bedWall = new THREE.Mesh(new THREE.BoxGeometry(6 * CELL, 5, 0.2), new THREE.MeshStandardMaterial({ map: paper }));
        bedWall.position.set(X2 + 4 * CELL, 2.5, 20 * CELL + 0.1);
        this.group.add(bedWall);
        this.box(2.2, 0.5, 1.2, 0x5a6a8a, cx(2) + 0.5, 0.3, cz(22));
        this.box(1.2, 0.6, 0.8, 0x6a4a2a, cx(2), 0.3, cz(24) + 0.3);
        for (let i = 0; i < 3; i++) {
            const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1.3), new THREE.MeshStandardMaterial({ color: [0x7a5a5a, 0x5a7a8a, 0x5a5a7a][i], emissive: 0x111111 }));
            p.position.set(cx(1) + 0.2 + i * 3, 2.4, 20 * CELL + 0.25);
            this.group.add(p);
            const blur = new THREE.Mesh(new THREE.CircleGeometry(0.28, 10), new THREE.MeshBasicMaterial({ color: 0xcdb8a0, transparent: true, opacity: 0.6 }));
            blur.position.set(0, 0.2, 0.01);
            p.add(blur);
        }
        this.box(0.3, 0.3, 0.3, 0xffd080, cx(1) - 0.9, 0.4, cz(21), 0xaa7a30);
        this.clockHand = this.box(0.04, 0.4, 0.04, 0x111111, cx(4), 3.4, 26 * CELL - 0.2);
        this.box(0.9, 0.9, 0.1, 0xdddccc, cx(4), 3.2, 26 * CELL - 0.1);
        this.box(0.9, 0.7, 0.7, 0x2b2b2d, cx(5), 0.4, cz(24) + 0.5);
        this.bedCv = document.createElement('canvas');
        this.bedCv.width = 192; this.bedCv.height = 144;
        this.bedTx = new THREE.CanvasTexture(this.bedCv);
        this.bedTx.colorSpace = THREE.SRGBColorSpace;
        const bs = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.46), new THREE.MeshBasicMaterial({ map: this.bedTx }));
        bs.position.set(cx(5), 0.45, cz(24) + 0.86);
        this.group.add(bs);
        this.box(0.7, 0.14, 0.4, 0x1b1b1d, cx(5) + 1.0, 0.07, cz(24) + 0.5);
        this.keyMesh = this.box(0.18, 0.04, 0.08, 0xd8b84a, cx(5) + 0.1, 0.05, cz(24) - 0.3, 0x403010);
        this.labelMesh = this.box(0.25, 0.01, 0.15, 0xe8e0c0, cx(3), 0.55, cz(21) + 0.2);
        this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.4), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.85, side: THREE.DoubleSide }));
        this.shadow.position.set(cx(3), 1.2, cz(25) + 0.2);
        this.shadow.visible = false;
        this.group.add(this.shadow);
        // elevator + red emergency lights
        const ec = new THREE.PointLight(0xff2020, 25, 22, 2);
        ec.position.set(cx(8), 3, cz(28));
        this.group.add(ec);
        this.elevLight = new THREE.PointLight(0xffe0b0, 10, 14, 2);
        this.elevLight.position.set(cx(14), 3, cz(28));
        this.group.add(this.elevLight);
        this.elevDoor = new THREE.Group();
        const dl = this.box(0.15, 3, 2.2, 0x6a6a6a, cx(13) - 1.9, 1.5, cz(28) - 1.1);
        const dr = this.box(0.15, 3, 2.2, 0x6a6a6a, cx(13) - 1.9, 1.5, cz(28) + 1.1);
        this.group.remove(dl, dr);
        this.elevDoor.add(dl, dr);
        dl.position.set(0, 1.5, -2);
        dr.position.set(0, 1.5, 2);
        this.elevDoor.position.set(cx(13) - 1.9, 0, cz(28));
        this.group.add(this.elevDoor);
        this.box(0.5, 0.8, 0.3, 0x3a3a3a, cx(14), 1.2, cz(27) - 0.4);
        this.knife = this.box(0.12, 1.7, 0.5, 0x7a4326, cx(13) - 1.9, 1.6, cz(28));
        this.knife.visible = false;
        // goods on shelves = faux-TVs glow
        for (let i = 0; i < 6; i++) this.box(0.7, 0.55, 0.5, 0x112233, cx(14 + (i % 3) * 4) - 0.1, 1.2 + (i % 2), cz(10 + i), 0x224466);
    }
    private drawSign(): void {
        const x = this.signCv.getContext('2d')!;
        x.fillStyle = '#d8c890'; x.fillRect(0, 0, 256, 64);
        x.fillStyle = '#222'; x.font = 'bold 22px monospace'; x.textAlign = 'center';
        x.fillText(this.signText, 128, 40);
        this.signTx.needsUpdate = true;
    }
    private drawTv(i: number): void {
        const tv = this.tvs[i];
        const x = tv.cv.getContext('2d')!;
        const t = this.t;
        x.fillStyle = ['#d8b890', '#c0d0e0', '#e0c8c0'][i]; x.fillRect(0, 0, 160, 120);
        x.fillStyle = '#5a7a4a'; x.fillRect(0, 85, 160, 35);
        const sway = Math.sin(t * 2 + i) * 6;
        // a family of figures whose faces are folded paper cutouts; motion lags/desyncs
        for (let k = 0; k < 3; k++) {
            const px = 35 + k * 45 + (k === 1 ? Math.sin(t * 2 + i - 0.8) * 6 : sway);
            x.fillStyle = ['#3a4a6a', '#6a3a4a', '#4a6a3a'][k]; x.fillRect(px - 9, 55, 18, 38);
            x.fillStyle = '#f2ecd8'; x.beginPath(); x.moveTo(px - 8, 40); x.lineTo(px + 9, 38); x.lineTo(px + 7, 55); x.lineTo(px - 9, 54); x.fill();
            x.strokeStyle = '#aaa'; x.beginPath(); x.moveTo(px - 8, 47); x.lineTo(px + 8, 46); x.stroke();
        }
        x.fillStyle = '#111'; x.font = 'bold 12px monospace'; x.fillText(['JUN 1994', 'DEC 1997', 'MAR 2003'][i], 8, 14);
        x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(0, (t * 60) % 120, 160, 6);
        tv.tx.needsUpdate = true;
    }
    private drawBed(): void {
        const x = this.bedCv.getContext('2d')!;
        x.fillStyle = '#050505'; x.fillRect(0, 0, 192, 144);
        if (this.bedMode === 'off') { this.bedTx.needsUpdate = true; return; }
        if (this.bedMode === 'static') { for (let i = 0; i < 60; i++) { const v = Math.random() * 255 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * 192, Math.random() * 144, 40, 4); } this.bedTx.needsUpdate = true; return; }
        x.fillStyle = '#3a3a5a'; x.fillRect(0, 0, 192, 144);
        x.fillStyle = '#5a6a8a'; x.fillRect(30, 70, 130, 50);
        x.fillStyle = '#c8a888'; x.beginPath(); x.arc(60, 78, 16, 0, 7); x.fill();
        x.fillStyle = '#d8d8c0'; x.fillRect(40, 66, 40, 8);
        if (this.bedMode === 'future') {
            x.fillStyle = 'rgba(0,0,0,0.6)'; x.fillRect(120, 20, 40, 100);
            x.fillStyle = '#ff6666'; x.font = 'bold 12px monospace'; x.fillText('+00:00:07', 100, 16);
        } else { x.fillStyle = '#9f9'; x.font = 'bold 12px monospace'; x.fillText('NOW', 10, 16); }
        for (let i = 0; i < 5; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * 0.2})`; x.fillRect(0, Math.random() * 144, 192, 2); }
        this.bedTx.needsUpdate = true;
    }
    private buildInteractables(): void {
        const c = this.ctx;
        const done = new Set<string>();
        const once = (id: string) => () => !done.has(id);
        const add = (id: string, label: string, x: number, y: number, z: number, run: () => void, enabled: () => boolean, range = 2.8) => {
            this.interactables.push({ id, label, pos: new THREE.Vector3(x, y, z), range, enabled, run });
        };
        add('d2_toy', 'Wind up the broken toy', cx(4), 0.3, cz(15), () => {
            done.add('toy'); c.sfx.tone(300, 0.5, 0.06, 0, 'square', 200); c.sfx.click(0.3);
            c.say('PROTAGONIST', "A wind-up drummer. The key turns... and nothing moves. It still hums a tune I know.", 5); c.track('d2_interact', { id: 'toy' });
        }, once('toy'));
        this.box(0.3, 0.4, 0.3, 0xcc3333, cx(4), 0.2, cz(15));
        add('d2_box', 'Open the box with your handwriting', cx(6), 0.3, cz(16), () => {
            done.add('box'); c.say('PROTAGONIST', "'KEEP — BIRTHDAY' in my handwriting. I never packed this. I never sent this anywhere.", 5.5); c.track('d2_interact', { id: 'box' });
        }, once('box'));
        this.box(0.7, 0.5, 0.7, 0xb08a58, cx(6), 0.25, cz(16));
        for (let i = 0; i < 3; i++) {
            add('d2_tv' + i, 'Watch the television', this.tvs[i].mesh.position.x, 1, this.tvs[i].mesh.position.z + 0.3, () => {
                this.tvSeen.add(i);
                c.sfx.staticBurst(0.4, 0.06);
                c.say('PROTAGONIST', ['A birthday. But the faces are folded paper. And they move a half-second late.', 'The winter one. Same paper faces. Someone cut them out.', 'The last one. The family is missing. The paper faces are still smiling.'][i], 5);
                c.track('d2_tv_watched', { id: i });
                if (this.tvSeen.size === 3 && !this.tvLines) {
                    this.tvLines = true;
                    c.after(5.2, () => c.say('PROTAGONIST', 'These are my memories.', 3));
                    c.after(8.4, () => c.say('SYSTEM', 'They belong to us now.', 3));
                }
            }, () => true, 2.6);
        }
        add('d2_sign', 'Read the shelf label', cx(11), 2.4, cz(8) + 1.4, () => {
            this.signText = ['AISLE A · TOYS 1982', 'AISLE A · YOU 1982', 'AISLE A · US 1982', 'AISLE A · MINE 1982'][Math.min(3, this.loops++ % 4)];
            this.drawSign();
            c.say('PROTAGONIST', "The label changed. After I read it. It says something else now.", 4);
            c.track('d2_interact', { id: 'label_changes' });
        }, () => this.loops < 4, 3.5);
        REELS.forEach((r, i) => {
            add('d2_reel' + r.id, 'Take memory reel', this.reelMesh[i].position.x, this.reelMesh[i].position.y + 0.2, this.reelMesh[i].position.z, () => {
                this.reels[i] = true;
                this.reelMesh[i].visible = false;
                c.sfx.tone(r.tone, 0.6, 0.1);
                c.say('PROTAGONIST', `Reel: ${r.sym.toUpperCase()} symbol. Stamped ${r.year}. ${r.wear}.`, 6);
                c.track('item_collected', { item: 'reel_' + r.name.toLowerCase() });
                c.after(0.1, () => { /* checkpoint kept at arrival until solved */ });
            }, () => !this.reels[i], 2.6);
        });
        const slotName = (v: number) => (v === 0 ? 'empty' : `${REELS[v - 1].sym} (${REELS[v - 1].year})`);
        for (let s = 0; s < 3; s++) {
            add('d2_slot' + s, `Load slot ${s + 1} (cycle reel)`, cx(8) - 0.8 + s * 0.8, 1.1, cz(14) + 0.1, () => {
                const used = new Set(this.slots.filter((v, k) => k !== s && v > 0));
                let v = this.slots[s];
                for (let k = 0; k < 4; k++) { v = (v + 1) % 4; if (v === 0) break; if (this.reels[v - 1] && !used.has(v)) break; }
                this.slots[s] = v;
                c.sfx.click(0.5);
                if (v > 0) c.sfx.tone(REELS[v - 1].tone, 0.3, 0.08);
                c.say('PROTAGONIST', `Slot ${s + 1}: ${slotName(v)}.`, 2.4);
                c.track('d2_slot_changed', { slot: s + 1, value: v });
            }, () => !this.solved, 1.5);
        }
        add('d2_run', 'Run the sorting sequence', cx(8), 1.1, cz(14) + 0.6, () => this.runSort(), () => !this.solved, 2.8);
        add('d2_false', "Accept the suggested order ('BEST DAY' aid)", cx(8) + 1.2, 1.1, cz(14) + 0.9, () => this.falseMemory(), () => !this.solved && this.reels.some(Boolean) && !this.busy, 3);
        add('d2_ladder', 'Climb the ladder to the catwalk', cx(11), 1.5, cz(24) + 1.2, () => this.climb(), () => this.solved && this.stage !== 'catwalk' && this.stage !== 'bedroom' && !this.busy, 3);
        add('d2_tape', 'Play the tape', cx(5), 0.6, cz(24) + 0.9, () => this.playTape(), () => this.stage === 'bedroom' && !this.tapeSeen && !this.busy, 3);
        add('d2_label', 'Pick up the damaged label', cx(3), 0.5, cz(21) + 0.2, () => {
            this.label = true; this.labelMesh.visible = false;
            c.say('PROTAGONIST', "'SPLICEMASTER: FORBIDDEN EPISODE.' That's the same handwriting as the bunker tape. That's... mine?", 6);
            c.track('item_collected', { item: 'damaged_label' });
        }, () => !this.label, 2.8);
        add('d2_key', 'Take the service key behind the CRT', cx(5) + 0.1, 0.2, cz(24) - 0.3, () => {
            this.key = true; this.keyMesh.visible = false;
            c.sfx.click(0.5);
            c.say('PROTAGONIST', 'A brass service key. RENDER DISTANCE, stamped on the tag.', 4);
            c.objective('Leave the bedroom. Find the freight elevator south of here.');
            c.checkpoint('d2_bedroom'); this.cpId = 'd2_bedroom';
            c.track('item_collected', { item: 'service_key' });
        }, () => this.tapeSeen && !this.key, 2.8);
        add('d2_insert', 'Insert service key', cx(14), 1.2, cz(27) - 0.2, () => this.elevStart(), () => this.stage === 'elev0' && this.key, 3);
        add('d2_gate', 'Hold the gate', cx(13) - 1.2, 1.2, cz(28), () => this.elevGate(), () => this.stage === 'elev1', 3);
        add('d2_lever', 'Pull the safety lever', cx(14), 1.2, cz(27) - 0.2, () => this.elevLever(), () => this.stage === 'elev2', 3);
        add('d2_kick', 'KICK the blade away', cx(13) - 1.0, 1.2, cz(28), () => this.elevKick(), () => this.stage === 'elev4', 4);
    }

    // ───────── lifecycle ─────────
    begin(): void {
        const c = this.ctx;
        this.group.visible = true;
        this.reset('intro');
        this.friendHelped.clear(); this.friendTalkT = this.t + 5;
        c.giveFlashlight();
        c.p.set(cx(2), 0, cz(14));
        c.setYaw(-Math.PI / 2);
        c.setPitch(0);
        c.setHead(null);
        c.setHandColor(null);
        c.lock(true);
        this.introT = 0;
        c.fadeTo(0, 2);
        c.objective('Look for a way out. Investigate the screens.');
        [392, 440, 523, 440, 587, 523, 440, 392].forEach((f, i) => c.after(i * 0.45, () => c.sfx.tone(f, 0.4, 0.04)));
        c.checkpoint('d2_arrival');
        c.track('d2_started');
    }
    private reset(stage: Stage): void {
        this.stage = stage;
        this.mx = this.cpMop.x; this.mz = this.cpMop.z;
        this.cs = 'DORMANT';
        this.rig.group.visible = false;
        this.busy = false;
        this.ctx.setForceCrouch(false);
        this.ctx.setSpeedMul(1);
        this.ctx.setAmbient(0.6);
        this.ctx.lock(false);
        this.knife.visible = false;
        this.catBladeMesh.visible = false;
        this.shadow.visible = false;
        this.elevT = 0;
    }
    respawn(id: string): void {
        const c = this.ctx;
        this.group.visible = true;
        this.cpId = id;
        this.sloppy.hide();
        for (const f of this.friends) f.s.hide();
        if (id === 'd2_arrival') this.reset('explore');
        else if (id === 'd2_sorted') { this.solved = true; this.openExit(); this.reset('exit'); c.objective('A lit doorway at the north end of the warehouse.'); }
        else if (id === 'd2_chase') {
            this.solved = true; this.chaseStarted = true; this.openExit(); this.reset('chase');
            this.mx = this.cpMop.x; this.mz = this.cpMop.z;
            this.rig.group.position.set(this.mx, 0, this.mz); this.rig.group.visible = true;
            this.cs = 'CHARGE'; this.cPauseIn = 9; this.clin = 0.7;
            c.objective('RUN. Reach the ladder at the south end of Aisle A.');
        } else if (id === 'd2_catwalk') { this.solved = true; this.chaseStarted = true; this.reset('catwalk'); this.catBlade = false; c.objective('Cross the catwalk.'); }
        else if (id === 'd2_bedroom') { this.solved = true; this.reset('bedroom'); c.objective(this.key ? 'Leave the bedroom. Find the freight elevator.' : 'Inspect the recording. Find the way forward.'); }
        else if (id === 'd2_elev') { this.solved = true; this.key = true; this.reset('elev0'); this.rig.group.visible = false; this.resetElevVisuals(); c.objective('Insert the service key.'); }
        this.drawBed();
    }
    private resetElevVisuals(): void {
        this.elevDoor.position.set(cx(13) - 1.9, 0, cz(28));
        this.elevDoor.children.forEach((ch, i) => ch.position.set(0, 1.5, i === 0 ? -2 : 2));
    }
    save(): { reels: boolean[]; solved: boolean; key: boolean; label: boolean; cp: string; mop: { x: number; z: number } } {
        return { reels: this.reels, solved: this.solved, key: this.key, label: this.label, cp: this.cpId, mop: this.cpMop };
    }
    load(s: { reels?: boolean[]; solved?: boolean; key?: boolean; label?: boolean; mop?: { x: number; z: number } } | undefined): void {
        if (!s) return;
        this.reels = s.reels ?? this.reels; this.solved = !!s.solved; this.key = !!s.key; this.label = !!s.label;
        if (s.mop) this.cpMop = s.mop;
        this.reels.forEach((v, i) => { this.reelMesh[i].visible = !v; });
        this.keyMesh.visible = !this.key; this.labelMesh.visible = !this.label;
    }
    itemsText(): string[] {
        const l = ['Memory reels: ' + this.reels.filter(Boolean).length + ' / 3'];
        if (this.label) l.push('Damaged label (same handwriting as the bunker tape)');
        if (this.key) l.push('Service key');
        return l;
    }
    objectiveText(): string {
        switch (this.stage) {
            case 'explore': return this.solved ? 'Use the ladder at the south end of Aisle A.' : 'Find three memory reels and sort them at the console.';
            case 'sorted': case 'exit': return 'A lit doorway at the north end of the warehouse.';
            case 'chase': return 'RUN. Reach the ladder at the south end of Aisle A.';
            case 'catwalk': return 'Cross the catwalk.';
            case 'bedroom': return this.key ? 'Leave the bedroom. Find the freight elevator.' : 'Inspect the recording. Find the way forward.';
            case 'elev0': return 'Insert the service key.';
            case 'elev1': return 'Hold the gate!';
            case 'elev2': return 'Pull the safety lever!';
            case 'elev4': return 'KICK the blade away!';
            default: return '...';
        }
    }

    // ───────── beats ─────────
    private runSort(): void {
        const c = this.ctx;
        if (this.slots.some((v) => v === 0)) { c.say('PROTAGONIST', 'The slots are not all filled.', 2.6); return; }
        c.track('d2_sort_attempt', { order: this.slots.join('') });
        if (this.slots[0] === 1 && this.slots[1] === 2 && this.slots[2] === 3) {
            this.solved = true;
            this.friendTalkT = this.t + 5;
            this.stage = 'sorted';
            c.sfx.tone(523, 0.3, 0.1); c.after(0.3, () => c.sfx.tone(659, 0.3, 0.1)); c.after(0.6, () => c.sfx.tone(784, 0.5, 0.1));
            c.say('PROTAGONIST', 'Before. During. After. The console accepted it.', 4);
            c.objective('A doorway is lit at the north end. The ladder to the catwalk is unlocked.');
            this.openExit();
            c.checkpoint('d2_sorted'); this.cpId = 'd2_sorted';
            c.track('d2_sort_solved');
        } else {
            c.sfx.staticBurst(0.7, 0.1);
            c.card(['FALSE MEMORY', 'PLAYBACK ONLY'], 2200);
            c.say('PROTAGONIST', "It replayed a day that never happened. Check the dates and the wear.", 5);
            this.tvSeen.forEach((i) => this.drawTv(i));
        }
    }
    private falseMemory(): void {
        const c = this.ctx;
        this.busy = true;
        c.track('d2_false_memory_taken');
        c.say('SYSTEM', 'Best day, selected for you.', 3);
        c.lock(true);
        c.fadeTo(1, 0.8);
        c.after(1.2, () => {
            this.loops++;
            this.signText = 'AISLE A · BEST DAY 1982'; this.drawSign();
            this.slots = [0, 0, 0];
            c.p.set(cx(2), 0, cz(14)); c.setYaw(-Math.PI / 2);
            c.fadeTo(0, 1); c.lock(false);
            this.busy = false;
            c.say('PROTAGONIST', "Back at the start. Same room, but the labels are different. That was a trap.", 5);
        });
    }
    private openExit(): void {
        this.daylight.visible = !this.slammed;
        this.exitLight.intensity = this.slammed ? 0 : 55;
    }
    private slam(): void {
        const c = this.ctx;
        this.slammed = true;
        this.busy = true;
        this.stage = 'exit';
        c.lock(true);
        c.track('d2_false_exit_slam');
        this.doorSlab.visible = true;
        const t0 = this.t;
        const tick = () => {
            const k = Math.min(1, (this.t - t0) / 0.25);
            this.doorSlab.position.x = cx(11) + 4 * (1 - k);
            if (k < 1) c.after(0.02, tick);
            else {
                c.sfx.thud(0.8); c.sfx.scrape(0.5, 0.6);
                c.say('PROTAGONIST', 'No. Not again.', 2.5);
                this.exitLight.intensity = 0;
                c.after(2, () => {
                    this.doorSlab.visible = false;
                    this.daylight.material = new THREE.MeshBasicMaterial({ map: tex(64, 100, (x) => { x.fillStyle = '#666'; x.fillRect(0, 0, 64, 100); for (let i = 0; i < 80; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.2})`; x.fillRect(Math.random() * 64, Math.random() * 100, 4, 4); } }) });
                    c.sfx.noise(0.8, 600, 1, 0.1, 0, 'bandpass');
                    c.say('PROTAGONIST', 'It was a projection. Just concrete behind it.', 3.5);
                    c.lock(false); this.busy = false; this.friendTalkT = this.t + 4;
                    c.objective('Find another route through the aisles.');
                    c.after(4, () => this.startReturn());
                });
            }
        };
        tick();
    }
    private startReturn(): void {
        if (this.chaseStarted) return;
        this.chaseStarted = true;
        const c = this.ctx;
        this.mx = cx(31); this.mz = cz(7);
        this.rig.group.position.set(this.mx, 0, this.mz);
        this.rig.group.visible = true;
        this.cs = 'TRACK';
        this.cpMop = { x: this.mx, z: this.mz };
        c.sfx.scrape(0.45, 0.8);
        c.say('CLEAVERBACK', "You didn't get away. You just changed channels.", 4.5);
        c.track('d2_cleaverback_returns');
        c.objective('Get to the ladder at the south end of Aisle A. Stay out of sight.');
    }
    private climb(): void {
        const c = this.ctx;
        this.busy = true;
        c.lock(true);
        this.cs = 'DORMANT';
        this.rig.group.visible = false;
        c.track('d2_ladder_climbed');
        c.fadeTo(1, 0.6);
        c.sfx.step('concrete', 1.2);
        c.after(0.9, () => {
            this.stage = 'catwalk';
            c.p.set(cx(33), 0, cz(1)); c.setYaw(Math.PI / 2); c.setPitch(0);
            this.catBlade = false;
            c.fadeTo(0, 0.8); c.lock(false); this.busy = false;
            c.objective('Cross the catwalk.');
            c.say('PROTAGONIST', "The whole warehouse is dying below me. Keep moving.", 3.5);
            c.checkpoint('d2_catwalk'); this.cpId = 'd2_catwalk';
        });
    }
    private fall(): void {
        const c = this.ctx;
        this.falling = true;
        c.lock(true);
        c.track('d2_catwalk_fall');
        c.fadeTo(1, 0.5);
        c.sfx.tone(300, 0.9, 0.12, 0, 'sine', 60);
        c.after(1.3, () => {
            this.stage = 'bedroom';
            this.falling = false;
            c.p.set(cx(3), 0, cz(24)); c.setYaw(Math.PI); c.setPitch(0);
            c.fadeTo(0, 1.5); c.lock(false);
            c.objective('Inspect the recording. Find the way forward.');
            c.say('PROTAGONIST', "A bedroom. My bedroom. Down to the wallpaper.", 4);
            c.checkpoint('d2_bedroom'); this.cpId = 'd2_bedroom';
            c.track('d2_bedroom_entered');
        });
    }
    private playTape(): void {
        const c = this.ctx;
        this.busy = true;
        this.tapeSeen = true;
        this.bedMode = 'static';
        c.lock(true);
        c.say('PROTAGONIST', 'The tape shows me. Sleeping. In this room. From where I am standing right now.', 5);
        c.after(2, () => { this.bedMode = 'sleep'; });
        c.after(5.5, () => { this.bedMode = 'future'; c.say('SPLICEMASTER', 'The best memories are the ones we can use again.', 4); });
        c.after(9.5, () => {
            c.lock(false); this.busy = false;
            c.say('PROTAGONIST', "It's showing a few seconds from now. Something behind me.", 3.5);
            this.shadowT = 0; this.shadow.visible = true;
            c.sfx.tone(60, 1.5, 0.12);
            c.objective('Search the room: the label, and whatever is behind the CRT.');
        });
        c.track('d2_tape_played');
    }
    private elevStart(): void {
        const c = this.ctx;
        this.stage = 'elev1';
        c.sfx.click(0.6); c.sfx.tone(70, 4, 0.14, 0, 'sawtooth');
        c.say('PROTAGONIST', 'The motor is starting— hold the gate!', 3);
        c.track('d2_elevator_started');
        this.mx = cx(3); this.mz = cz(28);
        this.rig.group.position.set(this.mx, 0, this.mz);
        this.rig.group.visible = true;
        this.cs = 'ELEV';
        this.elevT = 0;
        c.sfx.scrape(0.5, -0.6);
    }
    private elevGate(): void {
        this.stage = 'elev2';
        this.ctx.sfx.thud(0.4);
        this.ctx.say('PROTAGONIST', 'Gate held. The safety lever!', 2.5);
    }
    private elevLever(): void {
        const c = this.ctx;
        this.stage = 'elev3';
        c.sfx.thud(0.5);
        c.lock(true);
        const t0 = this.t;
        const tick = () => {
            const k = Math.min(1, (this.t - t0) / 1.8);
            this.elevDoor.children.forEach((ch, i) => { ch.position.z = (i === 0 ? -2 : 2) * (1 - k * 0.9); });
            if (this.stage === 'elev3' && k < 1) c.after(0.03, tick);
        };
        tick();
    }
    private elevKick(): void {
        const c = this.ctx;
        this.knife.visible = false;
        this.stage = 'descend';
        this.cs = 'DORMANT';
        c.sfx.thud(0.6); c.sfx.click(0.6);
        c.track('d2_blade_kicked');
        c.lock(true);
        this.elevDoor.children.forEach((ch, i) => { ch.position.z = (i === 0 ? -0.2 : 0.2); });
        this.rig.group.visible = false;
        c.say('PROTAGONIST', 'Go. GO!', 2);
        c.sfx.tone(200, 3.5, 0.14, 0, 'sawtooth', 60);
        this.geometryFailure();
    }
    private geometryFailure(): void {
        const c = this.ctx;
        c.after(1.5, () => {
            this.wallMat.wireframe = true; this.wallMat.map = null; this.wallMat.color.set(0x66ffcc); this.wallMat.needsUpdate = true;
            this.floorMat.map = tex(64, 64, (x) => { x.fillStyle = '#111'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#ddd'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32); }, [W * 2, H * 2]);
            this.floorMat.needsUpdate = true;
            c.card(['LOADING GEOMETRY...'], 2600);
        });
        c.after(5, () => { c.fadeTo(1, 1.2); });
        c.after(6.5, () => {
            this.stage = 'done';
            c.track('d2_completed', { reels: this.reels.filter(Boolean).length, key: this.key, label: this.label });
            c.nextChapter('d3');
        });
    }

    // ───────── creature ─────────
    private floodFrom(tc: number, tr: number): void {
        const f = this.flood; f.fill(-1);
        const q: number[] = [];
        if (!this.solid(tc, tr)) { f[tr * W + tc] = 0; q.push(tc, tr); }
        for (let i = 0; i < q.length; i += 2) {
            const c = q[i], r = q[i + 1], d = f[r * W + c];
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nc = c + dc, nr = r + dr;
                if (this.solid(nc, nr) || f[nr * W + nc] >= 0) continue;
                f[nr * W + nc] = d + 1; q.push(nc, nr);
            }
        }
    }
    private stepToward(tc: number, tr: number, speed: number, dt: number): boolean {
        this.floodT -= dt;
        if (this.floodT <= 0) { this.floodT = 0.3; this.floodFrom(tc, tr); }
        const [mc, mr] = this.cellOf(this.mx, this.mz);
        const here = this.flood[mr * W + mc];
        if (here < 0) return false;
        let best = here, bx = cx(mc), bz = cz(mr);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nc = mc + dc, nr = mr + dr;
            if (this.solid(nc, nr)) continue;
            const v = this.flood[nr * W + nc];
            if (v >= 0 && v < best) { best = v; bx = cx(nc); bz = cz(nr); }
        }
        if (best === here && here === 0) return true;
        const dx = bx - this.mx, dz = bz - this.mz, d = Math.hypot(dx, dz) || 1;
        const narrow = (mc === 17 || mc === 21) && (mr === 14 || mr === 15);
        const sp = speed * (narrow ? 0.55 : 1) * dt;
        this.mx += (dx / d) * Math.min(sp, d); this.mz += (dz / d) * Math.min(sp, d);
        this.myaw = Math.atan2(-dx, -dz);
        return false;
    }
    private pan(dist: number): number {
        const p = this.ctx.p, yaw = this.ctx.getYaw();
        return ((this.mx - p.x) * Math.cos(yaw) + (this.mz - p.z) * -Math.sin(yaw)) / Math.max(dist, 1);
    }
    private updateCreature(dt: number, pc: number, pr: number): void {
        if (this.cs === 'DORMANT') return;
        const c = this.ctx, p = c.p, g = this.rig.group;
        const dist = Math.hypot(p.x - this.mx, p.z - this.mz);
        const losP = this.los(this.mx, this.mz, p.x, p.z);
        const sp = Math.hypot(c.vel.x, c.vel.y);
        const noise = c.isCrouching() ? 4 : sp > 4.5 ? 30 : sp > 0.5 ? 12 : 2;
        let move = 0;
        const near = Math.max(0, 1 - dist / 45);
        switch (this.cs) {
            case 'TRACK':
                move = 1.8; this.stepToward(pc, pr, move, dt);
                if (losP && dist < 36) { this.cs = 'STALK'; this.cTimer = 0; }
                else if (dist < noise) this.cs = 'STALK';
                break;
            case 'STALK':
                move = 2.3; this.stepToward(pc, pr, move, dt);
                this.cTimer += dt;
                if (!losP) this.seeT += dt; else this.seeT = 0;
                if ((losP && dist < 24) || (losP && sp > 4.5) || dist < 14) {
                    this.cs = 'CHARGE'; this.cPauseIn = 9;
                    this.cpMop = { x: this.mx, z: this.mz };
                    c.checkpoint('d2_chase'); this.cpId = 'd2_chase'; this.stage = 'chase';
                    c.objective('RUN. Reach the ladder at the south end of Aisle A.');
                    c.say('PROTAGONIST', 'It sees me— RUN!', 2.5);
                    c.sfx.scrape(0.6, this.pan(dist));
                    c.track('d2_chase_started');
                    // A readable loss beat without stopping the player during the chase.
                    if (c.isFriendAlive('Oliver')) {
                        c.killFriend('Oliver');
                        c.card(['OLIVER', 'SIGNAL LOST'], 1500);
                        c.sfx.thud(0.35, -0.6);
                        c.track('story_friend_loss_beat', { friend: 'Oliver', day: 2 });
                        this.friendTalkT = this.t + 7;
                        c.after(2.7, () => c.say('PROTAGONIST', 'Oliver? He was right there. He is not behind me anymore.', 3.8));
                    }
                }
                if (this.seeT > 8) { this.cs = 'SEARCH'; this.lastKnown = [pc, pr]; this.cTimer = 0; }
                break;
            case 'CHARGE':
                move = 5.2 * (dist > 40 ? 1.2 : 1);
                this.stepToward(pc, pr, move, dt);
                this.cPauseIn -= dt;
                if (this.cPauseIn <= 0) { this.cs = 'PAUSE'; this.cTimer = 3.4; this.cThuds = 0; }
                this.debrisT -= dt;
                if (this.debrisT <= 0) { this.debrisT = 1.4; this.spawnDebris(); }
                break;
            case 'PAUSE': {
                const t = 3.4 - this.cTimer;
                this.cTimer -= dt;
                const due = t > 2.2 ? 3 : t > 1.3 ? 2 : t > 0.4 ? 1 : 0;
                if (this.cThuds < due) { this.cThuds++; c.sfx.thud(0.5 * Math.max(0.3, near + 0.3), this.pan(dist)); }
                if (this.cTimer <= 0) { this.cs = 'CHARGE'; this.cPauseIn = 9 + Math.random() * 3; }
                break;
            }
            case 'SEARCH': {
                this.cTimer += dt;
                const done = this.stepToward(this.lastKnown[0], this.lastKnown[1], 2.4, dt);
                if (done && this.cTimer > 12) { this.cs = 'TRACK'; }
                if (losP && dist < 20) { this.cs = 'STALK'; this.seeT = 0; }
                break;
            }
            case 'ELEV': {
                this.elevT += dt;
                move = 5.4;
                this.stepToward(13, 28, move, dt);
                if (this.stage === 'elev3' && dist < 5) {
                    this.stage = 'elev4'; this.wedgeT = 0;
                    this.knife.visible = true; this.knife.position.set(cx(13) - 1.9, 1.6, cz(28));
                    c.sfx.scrape(0.7, 0); c.sfx.thud(0.7);
                    c.lock(false);
                    c.objective('KICK the blade away!');
                    c.say('PROTAGONIST', 'The blade! It\'s jamming the doors— kick it out!', 3);
                }
                if (this.stage === 'elev4') { this.wedgeT += dt; if (this.wedgeT > 7) c.capture(); }
                if (this.stage === 'elev1' || this.stage === 'elev2') { if (dist < 2) c.capture(); }
                break;
            }
            default:
        }
        if (move > 0) { this.cPhase += dt * move * 1.6; this.scrapeT -= dt; if (this.scrapeT <= 0) { this.scrapeT = 1.4 + Math.random() * 1.6; c.sfx.scrape(0.5 * Math.max(0.15, near), this.pan(dist)); } }
        g.position.set(this.mx, 0, this.mz);
        let dy = this.myaw - g.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        g.rotation.y += dy * Math.min(1, dt * 4);
        const m = move > 0 ? 1 : 0;
        this.rig.arms.forEach((a, i) => { a.rotation.x = Math.sin(this.cPhase + i * 1.6) * 0.7 * m + (this.cs === 'CHARGE' ? -0.6 : 0); });
        this.rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.cPhase + i * Math.PI) * 0.6 * m; });
        this.rig.jawL.rotation.z = this.cs === 'CHARGE' ? 0.4 : 0.1; this.rig.jawR.rotation.z = -this.rig.jawL.rotation.z;
        if (dist < 1.9 && (this.cs === 'CHARGE' || this.cs === 'PAUSE' || this.cs === 'STALK')) c.capture();
    }
    private spawnDebris(): void {
        const [mc, mr] = this.cellOf(this.mx, this.mz);
        let rack = false;
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (this.grid[(mr + dr) * W + mc + dc] === 2) rack = true;
        if (!rack || this.debris.length > 30) return;
        this.ctx.sfx.noise(0.4, 500, 1, 0.12, this.pan(Math.hypot(this.ctx.p.x - this.mx, this.ctx.p.z - this.mz)), 'bandpass');
        for (let i = 0; i < 3; i++) {
            const m = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.3, 0.35), new THREE.MeshStandardMaterial({ color: [0xa85a3a, 0x3a6a8a, 0xc8a83a][i] }));
            m.position.set(this.mx + (Math.random() - 0.5) * 2, 3 + Math.random(), this.mz + (Math.random() - 0.5) * 2);
            this.group.add(m);
            this.debris.push({ m, vy: 0, life: 8 });
        }
    }

    // ───────── per-frame ─────────
    update(dt: number): void {
        const c = this.ctx;
        this.t += dt;
        const p = c.p;
        const [pc, pr] = this.cellOf(p.x, p.z);
        if (this.stage === 'intro') {
            this.introT += dt;
            if (this.introT > 3.5) { c.lock(false); this.stage = 'explore'; c.say('PROTAGONIST', 'The warehouse goes on forever. And every screen is on.', 4); }
        }
        // warm-to-clinical lighting shift
        const target = this.stage === 'explore' ? (this.solved ? 0.35 : 0.1 + this.reels.filter(Boolean).length * 0.08) : this.stage === 'chase' || this.stage === 'catwalk' ? 0.8 : this.stage === 'bedroom' ? 0.25 : this.stage === 'exit' || this.stage === 'sorted' ? 0.55 : 1;
        this.clin += (target - this.clin) * Math.min(1, dt * 0.4);
        this.clinT -= dt;
        if (this.clinT <= 0) {
            this.clinT = 0.5;
            const col = new THREE.Color(1 - 0.2 * this.clin, 0.88 + 0.08 * this.clin, 0.65 + 0.3 * this.clin);
            for (let i = 0; i < this.panelPos.length; i++) this.panels.setColorAt(i, col);
            if (this.panels.instanceColor) this.panels.instanceColor.needsUpdate = true;
            this.lights.forEach((l) => l.color.copy(col));
        }
        this.lightT -= dt;
        if (this.lightT <= 0) {
            this.lightT = 0.2;
            const near = this.panelPos.map((v, i) => ({ i, d: Math.hypot(v.x - p.x, v.z - p.z) })).sort((a, b) => a.d - b.d).slice(0, 4);
            this.lights.forEach((l, k) => { const o = near[k]; if (!o || o.d > 20) { l.intensity = 0; return; } l.position.x = this.panelPos[o.i].x; l.position.z = this.panelPos[o.i].z; l.intensity = 40; });
        }
        // living props
        this.tvs.forEach((_, i) => { if (this.tvs[i]) this.drawTv(i); });
        const scr = this.group.getObjectByName('arcadeScreen') as THREE.Mesh | undefined;
        if (scr) scr.visible = Math.floor(this.t * 2) % 2 === 0;
        this.clockHand.rotation.z = this.t * 1.5;
        void this.elevLight;
        if (this.stage === 'bedroom' || this.stage === 'catwalk') { if (this.bedMode !== 'off') this.drawBed(); }
        for (let i = this.debris.length - 1; i >= 0; i--) {
            const d = this.debris[i];
            d.vy -= 12 * dt; d.m.position.y = Math.max(0.15, d.m.position.y + d.vy * dt);
            if (d.m.position.y <= 0.15) d.vy = 0;
            d.life -= dt;
            if (d.life < 0) { this.group.remove(d.m); this.debris.splice(i, 1); }
        }
        if (this.shadowT >= 0) { this.shadowT += dt; if (this.shadowT > 5) { this.shadow.visible = false; this.shadowT = -1; } }
        // narrow/crouch/vault hints
        c.setForceCrouch(pc >= 10 && pc <= 12 && pr === 19);
        c.hint(pc >= 10 && pc <= 12 && pr >= 16 && pr <= 17 && p.z < cz(16) + 3 && p.z > cz(16) + 0.6 && this.stage !== 'catwalk' ? 'SPACE — jump the conveyor' : null);
        // triggers
        if (!this.phoneRang && pc >= 14 && pc <= 16 && pr >= 10 && pr <= 12) {
            this.phoneRang = true;
            c.sfx.tone(1400, 0.15, 0.05); c.after(0.3, () => c.sfx.tone(1400, 0.15, 0.05)); c.after(0.6, () => c.sfx.tone(1400, 0.15, 0.05));
            c.after(1.4, () => c.say('PROTAGONIST', "(a toy phone rings in my own voice) 'Pick up. Pick up. You already know what I'm going to say.'", 6));
        }
        if (this.solved && !this.slammed && (this.stage === 'sorted' || this.stage === 'exit') && pc === 11 && pr <= 4) this.slam();
        if (this.stage === 'catwalk' && !this.catBlade && pc <= 31) {
            this.catBlade = true;
            this.catBladeMesh.visible = true;
            this.catBladeMesh.position.set(cx(30), 1.6, cz(2) - 0.4);
            c.sfx.scrape(0.7, 0.6); c.sfx.thud(0.8, 0.4);
            c.say('PROTAGONIST', 'The wall— the blade came through the wall!', 3);
            const t0 = this.t;
            const tick = () => {
                const k = Math.min(1, (this.t - t0) / 1.2);
                this.catBladeMesh.position.z = cz(2) - 3.5 * Math.sin(k * Math.PI);
                if (k < 1) c.after(0.03, tick); else this.catBladeMesh.visible = false;
            };
            tick();
        }
        if (this.stage === 'catwalk' && !this.falling && pc <= 26) this.fall();
        this.updateCreature(dt, pc, pr);
        this.updateFriends(dt);
    }
    private updateFriends(dt: number): void {
        const c = this.ctx;
        const friendsAll = [{ s: this.sloppy, help: [11, 6] as [number, number], name: 'Sloppy' }, ...this.friends];
        const inWarehouse = ['explore', 'sorted', 'exit', 'chase'].includes(this.stage);
        const helpLines: Record<string, string> = {
            Alan: 'That daylight is projected. Look for the real way out: the ladder south of Aisle A.',
            Sloppy: 'Ladder at the far end of Aisle A. I will keep watch. Do not wait for me.',
            Mitzi: 'Take the wide aisle. Jump the conveyor, then duck under the fallen beam.',
            Oliver: 'The light in that doorway is wrong. The ladder is the way through.',
        };
        for (const f of friendsAll) {
            if (!this.solved || !inWarehouse || !c.isFriendAlive(f.name)) { f.s.hide(); continue; }
            f.s.mode = c.isSecondCycle() ? 'hunt' : 'help';
            if (!f.s.isActive()) { f.s.setHelpPoint(f.help[0], f.help[1]); f.s.spawn(); }
            if (!this.busy) f.s.update(dt);
        }
        if (c.isSecondCycle() || this.busy || this.stage === 'chase' || this.t < this.friendTalkT) return;
        const nearby = friendsAll.filter((f) => f.s.isActive() && !this.friendHelped.has(f.name))
            .map((f) => ({ f, distance: Math.hypot(c.p.x - f.s.group.position.x, c.p.z - f.s.group.position.z) }))
            .filter(({ f, distance }) => distance < 5.5 && this.los(c.p.x, c.p.z, f.s.group.position.x, f.s.group.position.z))
            .sort((a, b) => a.distance - b.distance)[0];
        if (nearby) {
            const name = nearby.f.name;
            this.friendHelped.add(name); this.friendTalkT = this.t + 7;
            c.say(name === 'Mitzi' ? 'MITZI GOINS' : name.toUpperCase(), helpLines[name], 5.5);
            c.track('d2_friend_helped', { friend: name, cycle: 1 });
        }
    }
}
