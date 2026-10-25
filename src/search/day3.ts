import * as THREE from 'three';
import type { D1Ctx, D1Interact } from './day1.ts';
import { Sloppy, type SloppyHost } from './sloppy.ts';

/** DAY THREE — RENDER DISTANCE. An unfinished videogame level floating in a void. */
export const X3 = 1400;
const CELL = 4;
const W = 40;
const H = 34;

const cx = (c: number) => X3 + (c + 0.5) * CELL;
const cz = (r: number) => (r + 0.5) * CELL;

type Stage = 'none' | 'intro' | 'explore' | 'bridge' | 'valley' | 'fennix' | 'chase' | 'leap' | 'chamber' | 'collapse' | 'exit' | 'done';
type WS = 'DORMANT' | 'STATUE' | 'LANE' | 'HUNT' | 'SEARCH' | 'LOCK' | 'JUMP';

function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

interface Wraith {
    group: THREE.Group;
    rings: THREE.Mesh[];
    armR: THREE.Group;
    struts: THREE.Group[];
    ghosts: THREE.Mesh[];
}

/** Original design: faceless wedge torso, three running struts, ring limb segments, red ribbon of afterimages. */
function buildWraith(): Wraith {
    const g = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x23262c, roughness: 0.4, metalness: 0.7, emissive: 0x0a0a10 });
    const red = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    const torso = new THREE.Mesh(new THREE.ConeGeometry(0.55, 1.5, 4), metal);
    torso.rotation.set(Math.PI, Math.PI / 4, 0);
    torso.position.y = 1.7;
    torso.scale.z = 0.6;
    g.add(torso);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), new THREE.MeshStandardMaterial({ color: 0x050507, roughness: 0.2 }));
    head.position.y = 2.65;
    g.add(head);
    const rings: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const r = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.035, 6, 14), i % 2 ? red : metal);
        r.position.set(i < 2 ? -0.55 : 0.55, 2.3 - (i % 2) * 0.5, 0);
        g.add(r);
        rings.push(r);
    }
    const armR = new THREE.Group();
    armR.position.set(0.55, 2.3, 0);
    const forearm = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.03, 0.8, 5), metal);
    forearm.position.y = -0.4;
    armR.add(forearm);
    g.add(armR);
    const struts: THREE.Group[] = [];
    for (let i = 0; i < 3; i++) {
        const s = new THREE.Group();
        s.position.set((i - 1) * 0.3, 1.1, 0);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 1.2, 5), metal);
        m.position.y = -0.6;
        s.add(m);
        g.add(s);
        struts.push(s);
    }
    const ghosts: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 2.2, 0.25), new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.35 - i * 0.05, blending: THREE.AdditiveBlending, depthWrite: false }));
        ghosts.push(m);
    }
    return { group: g, rings, armR, struts, ghosts };
}

export class Day3 {
    group = new THREE.Group();
    interactables: D1Interact[] = [];
    private grid = new Uint8Array(W * H);
    private t = 0;
    private stage: Stage = 'none';
    private cpId = 'd3_arrival';
    private tiles!: THREE.InstancedMesh;
    private tileCells: [number, number][] = [];
    private tileDrop: number[] = [];
    private introT = -1;

    private seenBridge = false;
    private fennixDone = false;
    private chaseT = 0;
    private termSeen = false;
    private mons = new Set<number>();
    private musicOn = true;
    private musicT = 0;
    private musicStep = 0;
    private silenceT = 22;
    private silenceLeft = 0;
    private lockedPillars = new Set<string>();
    private pocketHide = 0;
    private elevGone = false;
    private lineSaid = false;
    private barrier!: THREE.Mesh;
    private elev!: THREE.Mesh;
    private fennix!: THREE.Group;
    private visor!: THREE.Mesh;
    private fennixBlack = false;
    private trees: THREE.Mesh[] = [];
    private spriteT = 0;
    private bigMon: { cv: HTMLCanvasElement; tx: THREE.CanvasTexture }[] = [];
    private smallMon!: THREE.InstancedMesh;
    private monT = 0;
    private bridgeVis!: THREE.Mesh;
    private doorMesh!: THREE.Group;
    private streak!: THREE.Mesh;
    private streakT = -1;
    // wraith
    private wr: Wraith;
    private ws: WS = 'DORMANT';
    private wx = 0;
    private wz = 0;
    private wyaw = 0;
    private wv = 3;
    private wTimer = 0;
    private lastDir = new THREE.Vector2(1, 0);
    private flood = new Int16Array(W * H);
    private floodT = 0;
    private trail: THREE.Vector3[] = [];
    private trailT = 0;
    private laneI = 0;
    private laneT = 10;
    private laneRun = -1;
    private laneTell = false;
    private jumpT = 0;
    private lastSeen: [number, number] = [20, 28];
    private cpWr = { x: cx(20), z: cz(28) };

    /** Mitzi Goins: helper on the first pass, hunter on the second (same rule as Day 2). */
    private mitzi: Sloppy;
    constructor(private ctx: D1Ctx) {
        const carve = (a: number, b: number, c: number, d: number) => { for (let r = b; r <= d; r++) for (let q = a; q <= c; q++) this.grid[r * W + q] = 0; };
        this.grid.fill(1);
        carve(2, 26, 5, 29); carve(6, 28, 14, 28); carve(15, 28, 19, 28); carve(20, 22, 32, 32);
        carve(26, 10, 26, 21); carve(25, 16, 25, 16); carve(27, 18, 27, 18); carve(33, 26, 37, 26);
        carve(2, 2, 12, 10); carve(13, 6, 17, 6);
        this.grid[21 * W + 26] = 2; // streaming barrier until the chase begins
        this.wr = buildWraith();
        this.wr.group.visible = false;
        this.group.add(this.wr.group);
        this.wr.ghosts.forEach((g) => { g.visible = false; this.group.add(g); });
        // Mitzi walks the lower corridor (cells 2 to 5, rows 26 to 29).
        const mitziHost: SloppyHost = {
            columns: W, rows: H,
            solid: (c, r) => this.solid(c, r),
            canStand: (x, z) => !this.solid(this.cellOf(x, z)[0], this.cellOf(x, z)[1]),
            los: (ax, az, bx, bz) => this.los(ax, az, bx, bz),
            cellOf: (x, z) => this.cellOf(x, z),
            cx, cz,
            player: () => this.ctx.p,
            caught: () => { this.ctx.track('d3_friend_caught_player', { friend: 'Mitzi', cycle: 2 }); this.ctx.capture(); },
            spotted: () => { this.ctx.track('d3_friend_spotted_player', { friend: 'Mitzi', cycle: 2 }); this.ctx.say('MITZI GOINS', 'Mitzi? She is coming straight for me.', 3); },
            stateChanged: (state) => this.ctx.track('d3_friend_state_changed', { friend: 'Mitzi', state, cycle: this.ctx.isSecondCycle() ? 2 : 1 }),
        };
        this.mitzi = new Sloppy(mitziHost, [[3, 27], [4, 27], [4, 29], [3, 29]], 2);
        this.mitzi.setHelpPoint(4, 27);
        this.group.add(this.mitzi.group);
        this.buildWorld();
        this.buildInteractables();
        this.group.visible = false;
    }

    /** Mitzi is present only while she is alive and the level is in its explore/bridge stages. */
    private updateMitzi(dt: number): void {
        const c = this.ctx;
        const inWalk = this.stage === 'explore' || this.stage === 'bridge';
        if (!inWalk || !c.isFriendAlive('Mitzi')) { this.mitzi.hide(); return; }
        this.mitzi.mode = c.isSecondCycle() ? 'hunt' : 'help';
        if (!this.mitzi.isActive()) this.mitzi.spawn();
        this.mitzi.update(dt);
    }
    private los(ax: number, az: number, bx: number, bz: number): boolean {
        const n = Math.ceil(Math.hypot(bx - ax, bz - az) / 0.6);
        for (let i = 1; i < n; i++) { const k = i / n; const [c, r] = this.cellOf(ax + (bx - ax) * k, az + (bz - az) * k); if (this.solid(c, r)) return false; }
        return true;
    }

    private solid(c: number, r: number): boolean { return c < 0 || r < 0 || c >= W || r >= H || this.grid[r * W + c] !== 0; }
    private cellOf(x: number, z: number): [number, number] { return [Math.floor((x - X3) / CELL), Math.floor(z / CELL)]; }

    collide(p: THREE.Vector3): void {
        const R = 0.35;
        const [c0, r0] = this.cellOf(p.x, p.z);
        for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
            if (!this.solid(c, r)) continue;
            const minx = X3 + c * CELL, maxx = minx + CELL, minz = r * CELL, maxz = minz + CELL;
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
    private mk(geo: THREE.BufferGeometry, color: number, x: number, y: number, z: number, emissive = 0): THREE.Mesh {
        const m = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color, roughness: 0.8, emissive }));
        m.position.set(x, y, z);
        this.group.add(m);
        return m;
    }
    private buildWorld(): void {
        const g = this.group;
        // tiles (checkerboard; some cells show "missing texture")
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) if (this.grid[r * W + c] === 0) this.tileCells.push([c, r]);
        this.tiles = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL - 0.06, 0.3, CELL - 0.06), new THREE.MeshStandardMaterial({ roughness: 0.9 }), this.tileCells.length);
        const m = new THREE.Matrix4();
        this.tileCells.forEach(([c, r], i) => {
            m.makeTranslation(cx(c), -0.15, cz(r));
            this.tiles.setMatrixAt(i, m);
            this.tiles.setColorAt(i, this.tileColor(c, r, 0));
            this.tileDrop.push(0);
        });
        g.add(this.tiles);
        // grey "collision geometry" blocks and floating junk in the void
        const gray = new THREE.MeshBasicMaterial({ color: 0x4a4e56, wireframe: true });
        for (let i = 0; i < 40; i++) {
            const b = new THREE.Mesh(new THREE.BoxGeometry(2 + Math.random() * 6, 1 + Math.random() * 5, 2 + Math.random() * 6), gray);
            b.position.set(X3 + Math.random() * W * CELL, -8 - Math.random() * 30, Math.random() * H * CELL);
            b.rotation.set(Math.random(), Math.random(), Math.random());
            g.add(b);
        }
        const ringM = new THREE.MeshStandardMaterial({ color: 0xcc9a3a, roughness: 0.5, metalness: 0.5, emissive: 0x302008 });
        for (let i = 0; i < 6; i++) {
            const t = new THREE.Mesh(new THREE.TorusGeometry(3, 0.4, 8, 24), ringM);
            t.position.set(cx(22 + i * 2), 6 + (i % 3) * 3, cz(14 + i * 2));
            t.rotation.x = Math.PI / 2 + i * 0.3;
            g.add(t);
        }
        for (let i = 0; i < 8; i++) { // floating platforms and abandoned assets
            const pl = this.mk(new THREE.BoxGeometry(6, 0.6, 6), 0x7a8a6a, cx(18 + i * 2.5), 3 + (i % 4) * 2, cz(4 + (i % 5) * 14));
            pl.name = 'float';
        }
        // castle whose windows are frames from the protagonist's past
        const winTex = tex(64, 64, (x) => { x.fillStyle = '#222'; x.fillRect(0, 0, 64, 64); const cols = ['#c8a888', '#88a8c8', '#a8c888', '#c888a8']; for (let i = 0; i < 4; i++) { x.fillStyle = cols[i]; x.fillRect((i % 2) * 32 + 3, Math.floor(i / 2) * 32 + 3, 26, 26); } });
        const castle = new THREE.Group();
        const cm = new THREE.MeshStandardMaterial({ color: 0x8a8a96, roughness: 0.9 });
        castle.add(new THREE.Mesh(new THREE.BoxGeometry(24, 14, 10), cm));
        for (const x of [-12, 12]) { const t = new THREE.Mesh(new THREE.CylinderGeometry(3, 3, 22, 8), cm); t.position.set(x, 4, 0); castle.add(t); }
        for (let i = 0; i < 5; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2, 2.4), new THREE.MeshBasicMaterial({ map: winTex })); w.position.set(-8 + i * 4, 3, 5.1); castle.add(w); }
        castle.position.set(cx(30), 6, cz(-6));
        g.add(castle);
        // mountains (flat shaded, far)
        for (let i = 0; i < 7; i++) {
            const mt = new THREE.Mesh(new THREE.ConeGeometry(30 + i * 5, 50, 5), new THREE.MeshBasicMaterial({ color: 0x2a3a4a, fog: false }));
            mt.position.set(X3 + i * 50 - 40, 10, -120 - (i % 2) * 30);
            g.add(mt);
        }
        // trees that pop in and out
        for (let i = 0; i < 24; i++) {
            const tr = new THREE.Mesh(new THREE.ConeGeometry(1.4, 4.5, 6), new THREE.MeshStandardMaterial({ color: 0x2a8a3a, roughness: 1 }));
            const side = i % 2 ? 1 : -1;
            tr.position.set(cx(21 + (i % 12)), 2.25, cz(i % 2 ? 21.2 : 33));
            tr.position.x += side * 0.3;
            g.add(tr);
            this.trees.push(tr);
        }
        // grass made of tiny faces
        const faces = tex(128, 128, (x) => { x.fillStyle = '#3a8a3a'; x.fillRect(0, 0, 128, 128); for (let i = 0; i < 64; i++) { const px = (i % 8) * 16 + 8, py = Math.floor(i / 8) * 16 + 8; x.fillStyle = '#e8d0a0'; x.beginPath(); x.arc(px, py, 5, 0, 7); x.fill(); x.fillStyle = '#111'; x.fillRect(px - 3, py - 2, 2, 2); x.fillRect(px + 1, py - 2, 2, 2); x.fillRect(px - 2, py + 2, 4, 1); } });
        const grass = new THREE.Mesh(new THREE.PlaneGeometry(CELL * 3, CELL * 3), new THREE.MeshBasicMaterial({ map: faces }));
        grass.rotation.x = -Math.PI / 2;
        grass.position.set(cx(22.5), 0.02, cz(30));
        g.add(grass);
        // elevator (vanishes) and signs
        this.elev = this.mk(new THREE.BoxGeometry(4, 4, 0.4), 0x666a70, cx(1.3), 2, cz(27.5));
        this.elev.rotation.y = Math.PI / 2;
        const sign = (txt: string, x: number, z: number, ry: number) => {
            const t = tex(256, 64, (c) => { c.fillStyle = '#101018'; c.fillRect(0, 0, 256, 64); c.strokeStyle = '#ff4040'; c.lineWidth = 3; c.strokeRect(2, 2, 252, 60); c.fillStyle = '#ffd0d0'; c.font = 'bold 20px monospace'; c.textAlign = 'center'; c.fillText(txt, 128, 40); });
            const s = new THREE.Mesh(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: t, side: THREE.DoubleSide }));
            s.position.set(x, 2.6, z);
            s.rotation.y = ry;
            g.add(s);
        };
        sign('WELCOME TO THE LAST LEVEL', cx(7), cz(27) - 0.5, 0);
        sign('YOU HAVE ALREADY LOST', cx(11), cz(29) + 0.5, Math.PI);
        // bridge: the drawn bridge is offset from its true collision tiles
        this.bridgeVis = this.mk(new THREE.BoxGeometry(5 * CELL, 0.4, 3), 0x9a7a4a, cx(17), 0.1, cz(28) - 1.6);
        for (let i = 0; i < 5; i++) this.mk(new THREE.BoxGeometry(CELL - 0.5, 0.05, 0.5), 0x66ffcc, cx(15 + i), 0.18, cz(28), 0x33aa88);
        // streaming barrier at the foot of the north path
        this.barrier = this.mk(new THREE.BoxGeometry(CELL, 3, 0.3), 0xff3030, cx(26), 1.5, cz(21) + 1.5, 0x661010);
        (this.barrier.material as THREE.MeshStandardMaterial).transparent = true;
        (this.barrier.material as THREE.MeshStandardMaterial).opacity = 0.5;
        // streaming-error pillars on the chase path
        for (const r of [19, 14]) this.mk(new THREE.BoxGeometry(0.5, 4, 0.5), 0xff8a20, cx(26), 2, cz(r), 0xaa5510);
        // gap + unreachable ledge
        this.mk(new THREE.BoxGeometry(3 * CELL, 0.3, 3 * CELL), 0x555a66, cx(27.5), -0.1, cz(7));
        // Fennix
        this.fennix = new THREE.Group();
        const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), new THREE.MeshStandardMaterial({ color: 0x6a5a48, roughness: 0.6, metalness: 0.4 }));
        body.scale.set(1, 0.9, 1.2);
        this.visor = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.1), new THREE.MeshBasicMaterial({ color: 0xffb020 }));
        this.visor.position.set(0, 0.08, -0.34);
        const fins: THREE.Mesh[] = [];
        for (const s of [-1, 1]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.35), new THREE.MeshStandardMaterial({ color: 0x88aacc, transparent: true, opacity: 0.55 })); f.position.set(0.42 * s, 0.1, 0.05); f.rotation.z = 0.5 * s; fins.push(f); }
        const core = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), new THREE.MeshBasicMaterial({ color: 0x66ffcc }));
        core.position.set(0, -0.1, 0.3);
        this.fennix.add(body, this.visor, core, ...fins);
        this.fennix.position.set(cx(27), 0.5, cz(23.5));
        g.add(this.fennix);
        const tree = this.mk(new THREE.ConeGeometry(2.4, 6, 7), 0x2a6a3a, cx(27) + 1.5, 3, cz(23.5) - 1);
        void tree;
        // debug terminal in the valley
        this.mk(new THREE.BoxGeometry(1.2, 1.5, 0.6), 0x2a2a30, cx(22), 0.75, cz(31), 0x050a10);
        this.mk(new THREE.PlaneGeometry(0.9, 0.5), 0x33ff88, cx(22), 1.2, cz(31) - 0.31, 0x33ff88).rotation.y = Math.PI;
        // debugging chamber: thousands of monitors, three large recordings
        const sm = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.2, 0.8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 360);
        this.smallMon = sm;
        const placed: THREE.Matrix4[] = [];
        for (let i = 0; i < 360; i++) {
            const side = i % 4;
            const u = (i * 0.37) % 1, v = (i * 0.61) % 1;
            const mat = new THREE.Matrix4();
            const pos = new THREE.Vector3(), q = new THREE.Quaternion();
            if (side === 0) { pos.set(cx(2) - 1.9, 0.6 + v * 6, cz(2) + u * 36); q.setFromEuler(new THREE.Euler(0, Math.PI / 2, 0)); }
            else if (side === 1) { pos.set(cx(12) + 1.9, 0.6 + v * 6, cz(2) + u * 36); q.setFromEuler(new THREE.Euler(0, -Math.PI / 2, 0)); }
            else if (side === 2) { pos.set(cx(2) + u * 44, 0.6 + v * 6, cz(2) - 1.9); q.setFromEuler(new THREE.Euler(0, 0, 0)); }
            else { pos.set(cx(2) + u * 44, 0.6 + v * 6, cz(10) + 1.9); q.setFromEuler(new THREE.Euler(0, Math.PI, 0)); }
            // keep openings clear for the exit corridor
            if (side === 1 && pos.z > cz(5) && pos.z < cz(7)) pos.y = 20;
            mat.compose(pos, q, new THREE.Vector3(1, 1, 1));
            sm.setMatrixAt(i, mat);
            sm.setColorAt(i, new THREE.Color().setHSL(Math.random(), 0.5, 0.35));
            placed.push(mat);
        }
        g.add(sm);
        const big: [string, number][] = [['OUTCOME 17 — ISLAND / CAMP', 0], ['OUTCOME 03 — BUNKER (ENTERED)', 1], ['OUTCOME 41 — LIVING ROOM (WATCHER)', 2]];
        big.forEach(([name, i]) => {
            const cv = document.createElement('canvas');
            cv.width = 256; cv.height = 160;
            const tx = new THREE.CanvasTexture(cv);
            tx.colorSpace = THREE.SRGBColorSpace;
            const mon = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.25), new THREE.MeshBasicMaterial({ map: tx }));
            mon.position.set(cx(5 + i * 2.7), 2.6, cz(2) - 1.8);
            g.add(mon);
            this.bigMon[i] = { cv, tx };
            void name;
        });
        // terminal (chamber)
        this.mk(new THREE.BoxGeometry(1.4, 1.2, 0.8), 0x22262e, cx(10), 0.6, cz(6));
        this.mk(new THREE.PlaneGeometry(1.1, 0.6), 0x33ff88, cx(10) - 0.5, 1.1, cz(6)).rotation.y = -Math.PI / 2;
        // 404 emergency door
        this.doorMesh = new THREE.Group();
        const dt = tex(128, 192, (x) => { x.fillStyle = '#2a0a0a'; x.fillRect(0, 0, 128, 192); x.fillStyle = '#ff5050'; x.font = 'bold 40px monospace'; x.textAlign = 'center'; x.fillText('404', 64, 70); x.font = 'bold 13px monospace'; x.fillText('WORLD NOT FOUND', 64, 100); });
        const door = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 3.4), new THREE.MeshBasicMaterial({ map: dt }));
        door.rotation.y = -Math.PI / 2;
        this.doorMesh.add(door);
        this.doorMesh.position.set(cx(17) + 1.9, 1.8, cz(6));
        g.add(this.doorMesh);
        const dl = new THREE.PointLight(0xff3030, 20, 14, 2);
        dl.position.set(cx(16), 3, cz(6));
        g.add(dl);
        // streak (the blue figure crossing the hillside)
        this.streak = new THREE.Mesh(new THREE.BoxGeometry(14, 0.5, 0.5), new THREE.MeshBasicMaterial({ color: 0x66ccff, transparent: true, opacity: 0.8, fog: false }));
        this.streak.visible = false;
        g.add(this.streak);
        // cool ambient + red glow for wraith
        const key = new THREE.PointLight(0xaabbff, 40, 70, 1.5);
        key.position.set(cx(18), 14, cz(24));
        key.name = 'key';
        g.add(key);
        const wl = new THREE.PointLight(0xff2020, 10, 12, 2);
        wl.position.y = 2;
        wl.name = 'wlight';
        this.wr.group.add(wl);
        void placed;
    }

    private tileColor(c: number, r: number, corrupt: number): THREE.Color {
        const missing = (c * 7 + r * 13) % 11 === 0 || corrupt > 0;
        if (missing) return (c + r) % 2 === 0 ? new THREE.Color(0xff00ff) : new THREE.Color(0x101010);
        if (c >= 2 && c <= 12 && r >= 2 && r <= 10) return (c + r) % 2 === 0 ? new THREE.Color(0x3a3d46) : new THREE.Color(0x2a2c34);
        return (c + r) % 2 === 0 ? new THREE.Color(0xb8c0c8) : new THREE.Color(0x5a6470);
    }
    private drawMons(): void {
        const x0 = this.bigMon.map((m) => m.cv.getContext('2d')!);
        const t = this.t;
        x0.forEach((x, i) => {
            x.fillStyle = '#05080c'; x.fillRect(0, 0, 256, 160);
            x.fillStyle = '#1a2a1a'; x.fillRect(0, 110, 256, 50);
            if (i === 0) { // the Cleaverback finds the protagonist
                x.fillStyle = '#100808'; x.fillRect(150 + Math.sin(t) * 10, 30, 60, 100);
                x.fillStyle = '#7a4326'; x.fillRect(130, 60, 10, 55);
                x.fillStyle = '#d8d8d8'; x.fillRect(80, 100 + Math.min(10, (t * 4) % 14), 36, 12);
            } else if (i === 1) { // walks into the bunker
                x.fillStyle = '#555'; x.fillRect(170, 40, 50, 90);
                x.fillStyle = '#000'; x.fillRect(180, 50, 30, 80);
                const px = 40 + ((t * 20) % 130);
                x.fillStyle = '#d8d8d8'; x.fillRect(px, 70, 12, 40);
            } else { // watcher in a living room
                x.fillStyle = '#4a3a2a'; x.fillRect(50, 80, 100, 36);
                x.fillStyle = '#d8d8d8'; x.fillRect(90, 56, 14, 28);
                x.fillStyle = '#2a3a5a'; x.fillRect(170, 40, 60, 50);
                x.fillStyle = '#7a9aca'; x.fillRect(176, 46, 48, 38);
            }
            x.fillStyle = '#9ff'; x.font = 'bold 11px monospace'; x.fillText(['OUTCOME 17', 'OUTCOME 03', 'OUTCOME 41'][i], 8, 14);
            x.fillStyle = `rgba(255,255,255,${0.05 + Math.random() * 0.1})`; x.fillRect(0, (t * 50 + i * 40) % 160, 256, 3);
            this.bigMon[i].tx.needsUpdate = true;
        });
    }

    private buildInteractables(): void {
        const c = this.ctx;
        const add = (id: string, label: string, x: number, y: number, z: number, run: () => void, enabled: () => boolean, range = 3) => {
            this.interactables.push({ id, label, pos: new THREE.Vector3(x, y, z), range, enabled, run });
        };
        add('d3_term_valley', 'Read debug terminal', cx(22), 1.2, cz(31) - 0.6, () => {
            c.say('PROTAGONIST', "'STABLE PATHS: NORTH. EAST: UNLOADED.' So whichever way the guide points... check it against this.", 7);
            c.track('d3_terminal_read', { where: 'valley' });
        }, () => this.stage === 'valley' || this.stage === 'fennix' || this.stage === 'chase', 3);
        add('d3_fennix', 'Talk to the injured guide', cx(27), 0.8, cz(23.5), () => this.fennixTalk(), () => this.stage === 'valley' && !this.fennixDone, 3);
        for (let i = 0; i < 3; i++) {
            add('d3_mon' + i, 'Inspect the recording', cx(5 + i * 2.7), 1.8, cz(2) + 0.2, () => {
                this.mons.add(i);
                c.say('PROTAGONIST', ['That one: the Cleaverback finds me at the camp. I never ran.', "That one: I walk into the bunker on my own. Nobody's chasing me.", "That one: someone sits in a living room, watching. Watching me."][i], 6);
                c.track('d3_recording_inspected', { id: i });
            }, () => this.stage === 'chamber' || this.stage === 'collapse', 3.2);
        }
        add('d3_term', 'Read the world-state terminal', cx(10) - 1, 1.2, cz(6), () => this.readTerm(), () => this.stage === 'chamber', 3);
    }

    // ───────── lifecycle ─────────
    begin(): void {
        const c = this.ctx;
        this.group.visible = true;
        this.reset('intro');
        c.giveFlashlight();
        c.p.set(cx(3), 0, cz(28));
        c.setYaw(-Math.PI / 2);
        c.setPitch(0);
        c.setHead(null);
        c.setHandColor(null);
        c.lock(true);
        this.introT = 0;
        c.fadeTo(0, 1.5);
        c.checkpoint('d3_arrival');
        c.track('d3_started');
    }

    private reset(stage: Stage): void {
        this.stage = stage;
        this.ws = 'DORMANT';
        this.wr.group.visible = false;
        this.ctx.lock(false);
        this.ctx.setSpeedMul(1);
        this.ctx.setForceCrouch(false);
        this.ctx.setAmbient(0.9);
        this.ctx.setHead(null);
        this.grid[21 * W + 26] = stage === 'chase' || stage === 'leap' ? 0 : 2;
        this.barrier.visible = stage !== 'chase';
        this.fennix.visible = true;
        this.elev.visible = !this.elevGone;
        this.lockedPillars.clear();
        this.laneRun = -1;
        this.laneTell = false;
        this.pocketHide = 0;
        this.resetTiles();
    }

    private resetTiles(): void {
        this.tileCells.forEach(([c, r], i) => { this.tiles.setColorAt(i, this.tileColor(c, r, 0)); this.tileDrop[i] = 0; });
        if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true;
    }

    respawn(id: string): void {
        const c = this.ctx;
        this.group.visible = true;
        this.cpId = id;
        if (id === 'd3_arrival') { this.reset('explore'); this.seenBridge = false; c.objective('Navigate to the broken bridge.'); }
        else if (id === 'd3_bridge') { this.seenBridge = true; this.reset('valley'); c.objective('Cross into the valley. Find the stable path.'); }
        else if (id === 'd3_chase') {
            this.fennixDone = true; this.seenBridge = true; this.reset('chase');
            this.wx = this.cpWr.x; this.wz = this.cpWr.z; this.ws = 'HUNT'; this.wv = 3;
            this.wr.group.visible = true;
            c.objective('RUN north. Use the orange streaming pillars to stall it.');
        } else if (id === 'd3_chamber') { this.fennixDone = true; this.seenBridge = true; this.reset('chamber'); c.objective('Inspect the terminal.'); }
        else if (id === 'd3_collapse') { this.fennixDone = true; this.seenBridge = true; this.termSeen = true; this.reset('chamber'); this.startCollapse(); }
        else { this.reset('explore'); }
    }

    save(): { cp: string; wr: { x: number; z: number } } { return { cp: this.cpId, wr: this.cpWr }; }
    load(s: { wr?: { x: number; z: number } } | undefined): void { if (s?.wr) this.cpWr = s.wr; }

    objectiveText(): string {
        switch (this.stage) {
            case 'explore': return 'Navigate to the broken bridge.';
            case 'bridge': return 'Cross the bridge.';
            case 'valley': return 'Find the stable path. Stay out of the red lanes.';
            case 'fennix': return '...';
            case 'chase': return 'RUN north. Use the orange streaming pillars to stall it.';
            case 'chamber': return 'Inspect the terminal.';
            case 'collapse': return 'RUN to the emergency door.';
            default: return '...';
        }
    }

    // ───────── beats ─────────
    private seeWraithAtBridge(): void {
        this.seenBridge = true;
        this.stage = 'bridge';
        const c = this.ctx;
        c.track('d3_wraith_first');
        this.streakT = 0;
        this.streak.visible = true;
        c.sfx.tone(1200, 0.9, 0.08, 0.6, 'sawtooth', 200);
        c.after(1.2, () => {
            this.wx = cx(19); this.wz = cz(28); this.wyaw = Math.PI / 2;
            this.ws = 'STATUE';
            this.wr.group.visible = true;
            this.wr.armR.rotation.z = 2.7; // finger to mouth
            this.wr.armR.rotation.x = 0;
            c.lock(true);
            c.say('VELOCITY WRAITH', "Shhh. The world hasn't finished loading.", 4);
            c.sfx.tone(180, 3, 0.1, 0, 'sawtooth');
        });
        c.after(5, () => { // environment freezes; he reappears closer behind a glitch dip
            c.fadeTo(0.8, 0.1);
            c.after(0.2, () => { this.wx = cx(17.2); this.wz = cz(28); c.fadeTo(0, 0.2); c.sfx.staticBurst(0.2, 0.05); });
        });
        c.after(7, () => c.say('PROTAGONIST', 'What the fuck?', 2.5));
        c.after(9, () => {
            this.wr.group.visible = false; this.ws = 'DORMANT';
            c.lock(false);
            this.stage = 'valley';
            c.objective('Cross into the valley. Find the stable path.');
            c.checkpoint('d3_bridge'); this.cpId = 'd3_bridge';
        });
    }

    private fennixTalk(): void {
        const c = this.ctx;
        this.fennixDone = true;
        this.stage = 'fennix';
        c.lock(true);
        c.track('d3_fennix_talk');
        c.say('FENNIX', "Don't run when the music stops.", 3.5);
        c.after(3.8, () => c.say('PROTAGONIST', 'What are you?', 2.5));
        c.after(6.4, () => c.say('FENNIX', 'Something that used to have a name.', 3.5));
        c.after(10, () => { this.fennixBlack = true; (this.visor.material as THREE.MeshBasicMaterial).color.set(0x000000); c.say('FENNIX', 'He can hear your footsteps.', 3); c.sfx.tone(880, 1.2, 0.1, 0, 'square', 440); });
        c.after(10.2, () => { for (let k = 0; k < 4; k++) c.after(k * 0.35, () => c.sfx.tone(1000, 0.2, 0.06, 0, 'square')); });
        c.after(13.4, () => { c.say('FENNIX', '...East. East is stable. No— North. North?', 3.5); });
        c.after(14, () => {
            c.lock(false);
            this.startChase('fennix');
        });
    }

    private startChase(why: string): void {
        if (this.stage === 'chase' || this.stage === 'leap') return;
        const c = this.ctx;
        this.stage = 'chase';
        this.grid[21 * W + 26] = 0;
        this.barrier.visible = false;
        this.wx = cx(19); this.wz = cz(28); this.ws = 'HUNT'; this.wv = 3; this.chaseT = 0; this.lineSaid = false;
        this.wr.group.visible = true;
        this.cpWr = { x: this.wx, z: this.wz };
        c.checkpoint('d3_chase'); this.cpId = 'd3_chase';
        c.objective('RUN north. Use the orange streaming pillars to stall it.');
        c.sfx.tone(1100, 1.0, 0.1, -0.7, 'sawtooth', 220);
        c.track('d3_chase_started', { why });
    }

    private leap(): void {
        const c = this.ctx;
        this.stage = 'leap';
        c.lock(true);
        this.ws = 'DORMANT'; this.wr.group.visible = false;
        c.track('d3_leap');
        c.say('PROTAGONIST', 'The path ends— JUMP!', 2);
        c.fadeTo(0.3, 0.6);
        c.after(1.2, () => { c.say('PROTAGONIST', "I've got it! I've got the ledge— my grip— no—", 3.5); c.sfx.tone(600, 1.5, 0.1, 0, 'sine', 80); });
        c.after(3.6, () => c.fadeTo(1, 0.8));
        c.after(4.8, () => {
            this.stage = 'chamber';
            c.p.set(cx(5), 0, cz(4)); c.setYaw(Math.PI); c.setPitch(0);
            this.resetTiles();
            c.fadeTo(0, 1.4);
            c.lock(false);
            c.checkpoint('d3_chamber'); this.cpId = 'd3_chamber';
            c.objective('Inspect the terminal.');
            c.after(2, () => c.say('PROTAGONIST', "That's me.", 2.5));
            c.after(5, () => c.say('SYSTEM', 'All outcomes remain available until selection.', 4));
            c.track('d3_chamber_entered');
        });
    }

    private readTerm(): void {
        const c = this.ctx;
        this.termSeen = true;
        c.lock(true);
        c.track('d3_terminal_read', { where: 'chamber' });
        c.card(['WORLD STATE: CORRUPTED', 'REMAINING SESSIONS: 4'], 4200);
        c.after(4.5, () => c.say('SPLICEMASTER', "You're getting closer. That's not necessarily good.", 4.5));
        c.after(9, () => { c.lock(false); this.startCollapse(); });
    }

    private startCollapse(): void {
        const c = this.ctx;
        this.stage = 'collapse';
        c.checkpoint('d3_collapse'); this.cpId = 'd3_collapse';
        c.objective('RUN to the emergency door.');
        this.wx = cx(3); this.wz = cz(9); this.ws = 'JUMP'; this.jumpT = 1.5;
        this.wr.group.visible = true;
        this.cpWr = { x: this.wx, z: this.wz };
        c.sfx.tone(60, 3, 0.2);
        c.say('PROTAGONIST', 'The floor— the whole room is coming apart!', 3);
        c.track('d3_collapse_started');
        const order = this.tileCells.map(([cc, rr], i) => ({ i, k: cc >= 2 && cc <= 12 && rr >= 2 && rr <= 10 ? cc + Math.random() * 3 : -1 })).filter((o) => o.k >= 0).sort((a, b) => a.k - b.k);
        order.forEach((o, n) => this.after2(n * 0.05 + 1, () => {
            this.tiles.setColorAt(o.i, new THREE.Color(0xff00ff)); if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true; }));
    }

    private after2(t: number, fn: () => void): void { this.ctx.after(t, fn); }

    echoes(): { name: string; model: THREE.Group }[] { return [{ name: 'Velocity Wraith', model: this.wr.group }]; }

    private endSequence(): void {
        const c = this.ctx;
        this.stage = 'exit';
        c.lock(true);
        this.ws = 'LOCK'; this.wTimer = 3;
        c.track('d3_door_404');
        c.sfx.tone(300, 1.6, 0.14, 0, 'sine', 40);
        c.fadeTo(1, 1);
        this.tumble = 0;
        c.after(1.6, () => {
            c.sfx.noise(3, 400, 0.4, 0.1, 0, 'lowpass');
            c.sfx.tone(520, 1.2, 0.04, 0.4, 'sine'); c.after(1.4, () => c.sfx.tone(520, 1.2, 0.04, 0.4, 'sine'));
            c.card(['DAY THREE', 'HOME / SIGNAL RETURN'], 3200);
        });
        c.after(5.2, () => {
            this.stage = 'done';
            c.track('d3_completed');
            // end-of-day loss: Mitzi does not come out of the signal room
            if (c.isFriendAlive('Mitzi')) c.killFriend('Mitzi');
            c.nextChapter('d3home');
        });
    }
    private tumble = -1;

    // ───────── wraith ─────────
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
        if (this.floodT <= 0) { this.floodT = 0.25; this.floodFrom(tc, tr); }
        const [mc, mr] = this.cellOf(this.wx, this.wz);
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
        const dx = bx - this.wx, dz = bz - this.wz, d = Math.hypot(dx, dz) || 1;
        const dir = new THREE.Vector2(dx / d, dz / d);
        if (dir.dot(this.lastDir) < 0.2) this.wv = Math.min(this.wv, 2.2); // doubling back costs momentum
        this.lastDir.copy(dir);
        const sp = speed * dt;
        this.wx += dir.x * Math.min(sp, d); this.wz += dir.y * Math.min(sp, d);
        this.wyaw = Math.atan2(-dir.x, -dir.y);
        return false;
    }

    private pan(dist: number): number {
        const p = this.ctx.p, yaw = this.ctx.getYaw();
        return ((this.wx - p.x) * Math.cos(yaw) + (this.wz - p.z) * -Math.sin(yaw)) / Math.max(dist, 1);
    }

    private updateWraith(dt: number, pc: number, pr: number): void {
        const c = this.ctx, p = c.p, g = this.wr.group;
        // lanes: predetermined high-energy runs through the valley, announced by a Doppler-like note
        if ((this.stage === 'valley' || this.stage === 'fennix') && this.ws !== 'HUNT') {
            const lanes: [number, number, number, number][] = [[20, 26, 32, 26], [32, 30, 20, 30], [30, 22, 30, 32]];
            this.laneT -= dt;
            if (this.laneT <= 0 && this.laneRun < 0 && !this.laneTell && this.stage === 'valley') {
                this.laneTell = true;
                const L = lanes[this.laneI % 3];
                c.sfx.tone(1000, 1.1, 0.09, L[0] < 26 ? -0.7 : 0.7, 'sawtooth', 260);
                this.wr.group.visible = false;
                this.wTimer = 1.1;
            }
            if (this.laneTell) {
                this.wTimer -= dt;
                if (this.wTimer <= 0) {
                    const L = lanes[this.laneI % 3];
                    this.wx = cx(L[0]); this.wz = cz(L[1]); this.ws = 'LANE'; this.laneRun = this.laneI % 3; this.laneTell = false;
                    g.visible = true;
                }
            }
            if (this.ws === 'LANE' && this.laneRun >= 0) {
                const L = lanes[this.laneRun];
                const tx = cx(L[2]), tz = cz(L[3]);
                const dx = tx - this.wx, dz = tz - this.wz, d = Math.hypot(dx, dz);
                this.wyaw = Math.atan2(-dx, -dz);
                this.wx += (dx / d) * 18 * dt; this.wz += (dz / d) * 18 * dt;
                if (d < 1) { this.ws = 'DORMANT'; g.visible = false; this.laneRun = -1; this.laneI++; this.laneT = 9 + Math.random() * 4; }
            }
            if (Math.hypot(p.x - this.wx, p.z - this.wz) < 1.5) c.capture();
        }
        if (this.ws === 'DORMANT') { this.trail.length = 0; this.wr.ghosts.forEach((m) => { m.visible = false; }); return; }
        const dist = Math.hypot(p.x - this.wx, p.z - this.wz);
        let moving = 0;
        if (this.ws === 'HUNT') {
            this.chaseT += dt;
            const hidden = this.pocketHide > 1.2;
            if (!hidden) this.lastSeen = [pc, pr];
            this.wv = Math.min(7.2, this.wv + 1.6 * dt);
            moving = this.wv;
            const arrived = this.stepToward(this.lastSeen[0], this.lastSeen[1], this.wv, dt);
            if (hidden && arrived) { this.ws = 'SEARCH'; this.wTimer = 6; }
            if (this.chaseT > 4 && !this.lineSaid) { this.lineSaid = true; c.say('VELOCITY WRAITH', "You can't outrun something that knows the map.", 4); }
            if (dist < 1.6) c.capture();
        } else if (this.ws === 'SEARCH') {
            this.wTimer -= dt;
            moving = 2.4;
            this.stepToward(this.lastSeen[0], this.lastSeen[1], 2.4, dt);
            if (this.pocketHide <= 0.1 || this.wTimer <= 0) { this.ws = 'HUNT'; this.wv = 3; }
        } else if (this.ws === 'LOCK') {
            this.wTimer -= dt;
            if (this.wTimer <= 0) { this.ws = this.stage === 'exit' ? 'DORMANT' : 'HUNT'; this.wv = 3; }
        } else if (this.ws === 'JUMP') {
            // frozen-frame jumps: it pops forward in short steps with held poses between
            this.jumpT -= dt;
            if (this.jumpT <= 0) {
                this.jumpT = 0.5;
                const dx = p.x - this.wx, dz = p.z - this.wz, d = Math.hypot(dx, dz) || 1;
                const step = Math.min(2.7, d - 0.1);
                this.wx += (dx / d) * step; this.wz += (dz / d) * step;
                this.wyaw = Math.atan2(-dx, -dz);
                c.sfx.tone(200 + Math.random() * 60, 0.08, 0.06, this.pan(dist), 'square');
                if (dist < 1.6) c.capture();
            }
        }
        g.position.set(this.wx, 0, this.wz);
        g.rotation.y = this.wyaw;
        const run = moving > 0 ? 1 : 0;
        this.wr.struts.forEach((s, i) => { s.rotation.x = Math.sin(this.t * 14 + i * 2.1) * 0.8 * run; });
        this.wr.rings.forEach((r, i) => { r.rotation.y += dt * (2 + i); r.rotation.x += dt; });
        if (this.ws !== 'STATUE') this.wr.armR.rotation.z = 0.3 + Math.sin(this.t * 14) * 0.5 * run;
        // red ribbon of afterimages
        this.trailT -= dt;
        if (this.trailT <= 0) { this.trailT = 0.05; this.trail.unshift(new THREE.Vector3(this.wx, 1.1, this.wz)); if (this.trail.length > 6) this.trail.pop(); }
        this.wr.ghosts.forEach((m, i) => { const tp = this.trail[i + 1]; m.visible = !!tp && run > 0 && g.visible; if (tp) { m.position.copy(tp); m.rotation.y = this.wyaw; } });
        // loud when near
        if (this.ws === 'HUNT' && Math.floor(this.t * 3) !== Math.floor((this.t - dt) * 3)) c.sfx.tone(90 + this.wv * 8, 0.2, 0.1 * Math.max(0.2, 1 - dist / 40), this.pan(dist), 'sawtooth');
    }

    // ───────── per-frame ─────────
    update(dt: number): void {
        const c = this.ctx;
        this.t += dt;
        void this.termSeen; void this.bridgeVis; void this.doorMesh;
        const p = c.p;
        const [pc, pr] = this.cellOf(p.x, p.z);
        this.updateMitzi(dt);
        if (this.stage === 'intro') {
            this.introT += dt;
            if (this.introT > 2 && this.introT - dt <= 2) c.say('PROTAGONIST', "This isn't real. None of this is fucking real.", 4.5);
            if (this.introT > 4) { c.lock(false); this.stage = 'explore'; c.objective('Navigate to the broken bridge.'); }
        }
        // electronic melody; it stops now and then. Don't run when it stops.
        this.musicT -= dt;
        if (this.musicOn && this.musicT <= 0 && this.stage !== 'done') {
            this.musicT = 0.38;
            const notes = [523, 659, 784, 988, 784, 659, 587, 698];
            c.sfx.tone(notes[this.musicStep++ % 8], 0.3, 0.035, 0, 'square');
        }
        if (this.stage === 'valley' || this.stage === 'fennix') {
            if (this.silenceLeft > 0) { this.silenceLeft -= dt; if (this.silenceLeft <= 0) this.musicOn = true; }
            else { this.silenceT -= dt; if (this.silenceT <= 0) { this.silenceT = 20 + Math.random() * 10; this.silenceLeft = 5; this.musicOn = false; } }
        }
        const sp = Math.hypot(c.vel.x, c.vel.y);
        if (!this.musicOn && sp > 4.5 && this.stage === 'valley') this.startChase('ran-in-silence');
        if (this.stage === 'chase' || this.stage === 'leap') this.musicOn = true;
        // elevator silently vanishes
        if (!this.elevGone && Math.hypot(p.x - cx(1.3), p.z - cz(27.5)) > 9) { this.elevGone = true; this.elev.visible = false; c.sfx.noise(0.3, 300, 1, 0.04, 0, 'lowpass'); }
        // streak across the hillside
        if (this.streakT >= 0) {
            this.streakT += dt;
            this.streak.position.set(cx(40) - this.streakT * 140, 7 + Math.sin(this.streakT * 4) * 3, cz(14));
            if (this.streakT > 1.4) { this.streak.visible = false; this.streakT = -1; }
        }
        // popping trees, floating platforms
        this.spriteT -= dt;
        if (this.spriteT <= 0) { this.spriteT = 2.5; this.trees.forEach((tr) => { tr.visible = Math.random() > 0.3; }); }
        this.group.children.forEach((o) => { if (o.name === 'float') o.position.y += Math.sin(this.t + o.position.x) * 0.004; });
        // big and small monitors
        if (this.stage === 'chamber' || this.stage === 'collapse') {
            this.monT -= dt;
            if (this.monT <= 0) {
                this.monT = 0.15;
                this.drawMons();
                for (let i = 0; i < 20; i++) this.smallMon.setColorAt(Math.floor(Math.random() * 360), new THREE.Color().setHSL(Math.random(), 0.5, 0.15 + Math.random() * 0.3));
                if (this.smallMon.instanceColor) this.smallMon.instanceColor.needsUpdate = true;
            }
        }
        // fennix hover; voice from the wrong direction sometimes
        this.fennix.position.y = 0.55 + Math.sin(this.t * 2) * 0.05;
        this.fennix.rotation.y = Math.atan2(-(p.x - this.fennix.position.x), -(p.z - this.fennix.position.z));
        if (this.fennixBlack) this.fennix.rotation.z = Math.sin(this.t * 30) * 0.05;
        // triggers
        if (this.stage === 'explore' && !this.seenBridge && pc >= 12 && pr === 28) this.seeWraithAtBridge();
        if (this.stage === 'valley' && pc >= 20 && this.fennixDone === false && this.laneT > 9 && this.laneT < 10) { /* lanes warm up */ }
        if (this.stage === 'chase') {
            this.pocketHide = (c.isCrouching() && Math.hypot(c.vel.x, c.vel.y) < 0.6 && ((pc === 25 && pr === 16) || (pc === 27 && pr === 18))) ? this.pocketHide + dt : 0;
            for (const r of [19, 14]) {
                const key = 'p' + r;
                if (!this.lockedPillars.has(key) && pc === 26 && pr === r) {
                    this.lockedPillars.add(key);
                    this.ws = 'LOCK'; this.wTimer = 3.2;
                    c.sfx.staticBurst(0.5, 0.1);
                    c.say('PROTAGONIST', "It froze— the streaming error stalled it!", 2.5);
                    c.track('d3_stream_stall');
                }
            }
            // east branch is unloaded: stepping off the stable path resets you without penalty
            if (pc >= 36 && pr === 26) { c.track('d3_unloaded_fall'); c.capture(); }
            if (pc === 26 && pr <= 10) this.leap();
        }
        // collapsing tiles behind the player
        const behind = this.tileCells.findIndex(([cc, rr], i) => cc === 26 && rr === pr + 4 && this.tileDrop[i] === 0);
        if (behind >= 0) { this.tileDrop[behind] = 1; this.tiles.setColorAt(behind, new THREE.Color(0xff00ff)); if (this.tiles.instanceColor) this.tiles.instanceColor.needsUpdate = true; }
        if (this.stage === 'valley' && pc >= 33 && pr === 26 && pc >= 36) { c.track('d3_unloaded_fall'); c.capture(); }
        if (this.stage === 'collapse' && pc >= 17) this.endSequence();
        if (this.stage === 'exit' && this.tumble >= 0) { this.tumble += dt; c.setPitch(Math.sin(this.tumble * 3) * 1.2); }
        this.updateWraith(dt, pc, pr);
    }
}
