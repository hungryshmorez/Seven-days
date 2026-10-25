import * as THREE from 'three';
import type { D1Ctx, D1Interact } from './day1.ts';

/** DAY FIVE — RUBBER-HOSE NIGHTMARE. Monochrome cartoon studio, three distinct pursuers. */
export const X5 = 2400;
const CELL = 4;
const W = 48;
const H = 36;
const WALL_H = 6;
const cx = (c: number) => X5 + (c + 0.5) * CELL;
const cz = (r: number) => (r + 0.5) * CELL;
type Stage = 'none' | 'street' | 'grin' | 'theater' | 'hush' | 'factory' | 'burst' | 'pursuit' | 'editing' | 'tear' | 'done';
function tex(w: number, h: number, draw: (x: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    draw(c.getContext('2d')!);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}
const gray = (v: number) => new THREE.Color(v, v, v);
const gmat = (v: number, emissive = 0) => new THREE.MeshStandardMaterial({ color: gray(v), roughness: 0.9, emissive: gray(emissive)});
interface Grin { group: THREE.Group; limbs: THREE.Mesh[]; plate: THREE.Mesh; mask: THREE.Mesh }
function buildGrinwick(): Grin {
    const g = new THREE.Group();
    const ink = gmat(0.06);
    const crescent = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.3, 8, 14, Math.PI * 1.2), ink);
    crescent.rotation.set(0, 0, Math.PI * 0.9);
    crescent.position.y = 1.9;
    g.add(crescent);
    const limbs: THREE.Mesh[] = [];
    for (const [x, y, ry] of [[-0.8, 2.2, 0], [0.8, 2.2, 0], [-0.4, 1.0, 0], [0.4, 1.0, 0]] as [number, number, number][]) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 6), ink);
        l.geometry.translate(0, -0.8, 0);
        l.position.set(x, y, 0);
        l.rotation.z = ry;
        g.add(l);
        limbs.push(l);
        const glove = new THREE.Mesh(new THREE.SphereGeometry(0.16, 8, 6), gmat(1, 0.4));
        glove.position.y = -1.6;
        l.add(glove);
    }
    const smile = tex(128, 128, (x) => { x.fillStyle = '#fff'; x.beginPath(); x.arc(64, 64, 60, 0, 7); x.fill(); x.strokeStyle = '#000'; x.lineWidth = 6; x.beginPath(); x.arc(64, 54, 36, 0.15, Math.PI - 0.15); x.stroke(); x.fillStyle = '#000'; x.fillRect(38, 36, 10, 16); x.fillRect(80, 36, 10, 16);});
    const mask = new THREE.Mesh(new THREE.CircleGeometry(0.55, 20), new THREE.MeshBasicMaterial({ map: smile, side: THREE.DoubleSide}));
    mask.position.set(0, 2.9, -0.2);
    g.add(mask);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.14, 0.05), gmat(1, 0.5));
    plate.position.set(0.3, 1.6, -0.35);
    g.add(plate);
    return { group: g, limbs, plate, mask };
}
interface Hush { group: THREE.Group; masks: THREE.Group; head: THREE.Group; folds: THREE.Mesh[] }
function buildHush(): Hush {
    const g = new THREE.Group();
    const coat = gmat(0.12);
    const folds: THREE.Mesh[] = [];
    for (let i = 0; i < 9; i++) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(1.0 - i * 0.04, 0.22, 0.6), i % 2 ? coat : gmat(0.7));
        f.position.y = 0.4 + i * 0.22;
        g.add(f);
        folds.push(f);
    }
    const head = new THREE.Group();
    head.position.y = 3.0;
    const masks = new THREE.Group();
    for (let i = 0; i < 4; i++) {
        const t = tex(64, 64, (x) => { x.fillStyle = ['#e8e0c8', '#c8c8c8', '#e0d0d0', '#d0d8e0'][i]; x.fillRect(0, 0, 64, 64); x.fillStyle = '#000'; x.fillRect(16, 20, 8, 4); x.fillRect(40, 20, 8, 4); if (i % 2) x.fillRect(22, 44, 20, 3); else { x.beginPath(); x.arc(32, 44, 8, 0, Math.PI); x.stroke();}});
        const m = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.65), new THREE.MeshBasicMaterial({ map: t}));
        m.rotation.y = (i * Math.PI) / 2;
        m.position.set(Math.sin((i * Math.PI) / 2) * 0.3, 0, -Math.cos((i * Math.PI) / 2) * 0.3);
        masks.add(m);
    }
    head.add(masks);
    g.add(head);
    for (const s of [-1, 1]) { const foot = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), gmat(1, 0.5)); foot.position.set(0.25 * s, 0.12, -0.1); g.add(foot);}
    return { group: g, masks, head, folds };
}
interface Inkw { group: THREE.Group; tent: THREE.Mesh[]; core: THREE.Mesh }
function buildInk(): Inkw {
    const g = new THREE.Group();
    const ink = new THREE.MeshStandardMaterial({ color: 0x020202, roughness: 0.2, metalness: 0.3});
    const core = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), ink);
    core.scale.set(1.2, 1.1, 1);
    core.position.y = 1.4;
    g.add(core);
    for (let i = 0; i < 3; i++) { const rib = new THREE.Mesh(new THREE.TorusGeometry(0.9 - i * 0.1, 0.05, 5, 12), gmat(0.7, 0.2)); rib.position.y = 1.0 + i * 0.4; rib.rotation.x = Math.PI / 2; g.add(rib);}
    for (let i = 0; i < 8; i++) { const t = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.18, 0.08), gmat(0.9, 0.3)); t.position.set((i - 3.5) * 0.12, 1.55, -0.95); g.add(t);}
    const tent: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.03, 2.2, 5), ink); t.geometry.translate(0, -1.1, 0); t.position.set(Math.cos(i * 1.26) * 0.9, 1.6, Math.sin(i * 1.26) * 0.9); t.rotation.z = Math.cos(i * 1.26) * 0.9; t.rotation.x = Math.sin(i * 1.26) * 0.9; g.add(t); tent.push(t);}
    return { group: g, tent, core };
}
export class Day5 {
    group = new THREE.Group();
    interactables: D1Interact[] = [];
    private grid = new Uint8Array(W * H);
    private t = 0;
    private stage: Stage = 'none';
    private cpId = 'd5_street';
    private busy = false;
    private seenProj = false;
    private burstDone = false;
    private torn = false;
    private pieces = new Set<string>();
    private introT = -1;
    private factT = 0;
    private lightsT = 0;
    private shutterT = 0;
    private heat: number[] = [0, 0];
    private cool = 0;
    private loops = 0;
    private beamT = 3;
    private beams: { m: THREE.Mesh; c: number; r: number; state: number; t: number}[] = [];
    private musicT = 0;
    private musicOn = true;
    private musicStep = 0;
    private cpData = { gx: 0, gz: 0, hx: 0, hz: 0, layer: 0};
    private facade!: THREE.InstancedMesh;
    private inkMesh!: THREE.InstancedMesh;
    private inkCells: number[] = [];
    private inkSet = new Set<number>();
    private inkDist = new Int16Array(W * H);
    private layer = 0;
    private layerT = 0;
    private leak!: THREE.Mesh;
    private curtains: THREE.Mesh[] = [];
    private arm!: THREE.Mesh;
    private projCv!: HTMLCanvasElement;
    private projTx!: THREE.CanvasTexture;
    private tearPlane!: THREE.Mesh;
    private shutterLight!: THREE.PointLight;
    private grates: THREE.Mesh[] = [];
    private studio!: THREE.Group;
    private editLabel!: THREE.Mesh;
    private shadow!: THREE.Mesh;
    private strip!: THREE.Mesh;
    // enemies
    private gr: Grin;
    private gs: 'DORMANT' | 'SCRIPT' | 'CHASE' | 'FROZEN' = 'DORMANT';
    private gx = 0;
    private gz = 0;
    private gTimer = 0;
    private gTap = 0;
    private hu: Hush;
    private hs: 'DORMANT' | 'SEAT' | 'ACTIVE' = 'DORMANT';
    private hx = 0;
    private hz = 0;
    private hTimer = 5;
    private hTell = false;
    private hYaw = 0;
    private ik: Inkw;
    private ia = false;
    private ix = 0;
    private iz = 0;
    private flood = new Int16Array(W * H);
    constructor(private ctx: D1Ctx) {
        const carve = (a: number, b: number, c: number, d: number) => { for (let r = b; r <= d; r++) for (let q = a; q <= c; q++) this.grid[r * W + q] = 0;};
        this.grid.fill(1);
        carve(2, 24, 20, 27); carve(12, 21, 12, 23);
        carve(2, 6, 20, 19); carve(17, 7, 23, 7); carve(24, 4, 40, 12); carve(26, 14, 40, 16);
        carve(41, 8, 42, 8); carve(42, 9, 42, 22); carve(38, 23, 46, 28);
        carve(22, 28, 37, 28); carve(21, 28, 21, 28); carve(8, 29, 21, 34); carve(2, 30, 7, 33);
        // theater seats (solid blocks) leave a centre aisle
        for (let r = 12; r <= 17; r++) { for (let c = 4; c <= 8; c++) this.grid[r * W + c] = 2; for (let c = 12; c <= 16; c++) this.grid[r * W + c] = 2;}
        this.grid[7 * W + 17] = 3; // stage door (closed until the curtains open)
        this.grid[13 * W + 32] = 3; // locked ink door
        this.grid[25 * W + 20] = 0;
        this.gr = buildGrinwick(); this.hu = buildHush(); this.ik = buildInk();
        for (const o of [this.gr.group, this.hu.group, this.ik.group]) { o.visible = false; this.group.add(o);}
        this.buildWorld();
        this.buildInteractables();
        this.group.visible = false;
    }
    private solid(c: number, r: number): boolean { return c < 0 || r < 0 || c >= W || r >= H || this.grid[r * W + c] !== 0;}
    private cellOf(x: number, z: number): [number, number] { return [Math.floor((x - X5) / CELL), Math.floor(z / CELL)];}
    private idx(c: number, r: number): number { return r * W + c; }
    collide(p: THREE.Vector3): void {
        const R = 0.35;
        const [c0, r0] = this.cellOf(p.x, p.z);
        for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
            if (!this.solid(c, r)) continue;
            const minx = X5 + c * CELL, maxx = minx + CELL, minz = r * CELL, maxz = minz + CELL;
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
    private buildWorld(): void {
        const g = this.group;
        const floorTex = tex(128, 128, (x) => { x.fillStyle = '#b8b8b8'; x.fillRect(0, 0, 128, 128); x.fillStyle = '#9a9a9a'; x.fillRect(0, 0, 64, 64); x.fillRect(64, 64, 64, 64); for (let i = 0; i < 300; i++) { x.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; x.fillRect(Math.random() * 128, Math.random() * 128, 4, 4);}});
        floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
        floorTex.repeat.set(W, H);
        const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * CELL, H * CELL), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 1}));
        floor.rotation.x = -Math.PI / 2;
        floor.position.set(X5 + (W * CELL) / 2, 0, (H * CELL) / 2);
        g.add(floor);
        // painted facades for solid cells adjacent to open floor (street = building fronts, elsewhere = studio walls)
        const facadeTex = tex(128, 192, (x) => {
            x.fillStyle = '#d8d8d8'; x.fillRect(0, 0, 128, 192); x.strokeStyle = '#111'; x.lineWidth = 5; x.strokeRect(4, 4, 120, 184);
            for (let i = 0; i < 4; i++) { x.fillStyle = '#222'; x.fillRect(16 + (i % 2) * 52, 24 + Math.floor(i / 2) * 60, 40, 44); x.fillStyle = '#f4f4f4'; x.fillRect(20 + (i % 2) * 52, 28 + Math.floor(i / 2) * 60, 32, 36);}
            x.fillStyle = '#111'; x.beginPath(); x.moveTo(0, 0); x.lineTo(64, -20); x.lineTo(128, 0); x.fill();
        });
        const cells: [number, number][] = [];
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            const v = this.grid[r * W + c];
            if (v === 0 || v === 2) continue;
            let near = false;
            for (let dr = -1; dr <= 1 && !near; dr++) for (let dc = -1; dc <= 1; dc++) if (!this.solid(c + dc, r + dr) || (dr === 0 && dc === 0 && false)) { near = true; break;}
            if (near) cells.push([c, r]);
        }
        this.facade = new THREE.InstancedMesh(new THREE.BoxGeometry(CELL, WALL_H, CELL), new THREE.MeshStandardMaterial({ map: facadeTex, roughness: 1}), cells.length);
        const m = new THREE.Matrix4();
        cells.forEach(([c, r], i) => { m.makeTranslation(cx(c), WALL_H / 2, cz(r)); this.facade.setMatrixAt(i, m);});
        g.add(this.facade);
        // theater seats
        const seatM = gmat(0.25);
        for (let r = 12; r <= 17; r++) for (const c of [4, 5, 6, 7, 8, 12, 13, 14, 15, 16]) { this.mk(new THREE.BoxGeometry(CELL - 0.6, 1.1, CELL - 1.4), seatM, cx(c), 0.55, cz(r));}
        // street props: bending streetlights, painted clouds, piano-shop sign
        for (let i = 0; i < 4; i++) { const pole = this.mk(new THREE.CylinderGeometry(0.08, 0.1, 5, 6), gmat(0.1), cx(4 + i * 4), 2.5, cz(26) + 1.5); pole.rotation.z = Math.sin(i) * 0.3; const lamp = this.mk(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff}), cx(4 + i * 4) + Math.sin(i) * 1.5, 5, cz(26) + 1.5); void lamp;}
        for (let i = 0; i < 6; i++) { const cl = this.mk(new THREE.SphereGeometry(2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfcfcfc, fog: false}), cx(2 + i * 4), 12 + (i % 2) * 2, cz(24)); cl.scale.set(2, 0.7, 0.5);}
        // painted door on a street facade
        const doorTex = tex(64, 112, (x) => { x.fillStyle = '#eee'; x.fillRect(0, 0, 64, 112); x.strokeStyle = '#000'; x.lineWidth = 4; x.strokeRect(3, 3, 58, 106); x.fillStyle = '#000'; x.beginPath(); x.arc(48, 58, 4, 0, 7); x.fill(); x.fillStyle = '#000'; x.font = 'bold 12px monospace'; x.fillText('THEATRE', 6, 24);});
        const pd = this.mk(new THREE.PlaneGeometry(2, 3.4), new THREE.MeshBasicMaterial({ map: doorTex}), cx(8), 1.7, 24 * CELL - 0.05);
        pd.rotation.y = Math.PI;
        // alley shadow
        this.shadow = this.mk(new THREE.PlaneGeometry(1.2, 2.8), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.8, side: THREE.DoubleSide}), cx(8) + 6, 1.4, cz(26) - 0.5);
        this.shadow.visible = false;
        // Grinwick's stretched arm blocking the street exit
        this.arm = this.mk(new THREE.CylinderGeometry(0.2, 0.2, 18, 8), gmat(0.05), cx(19), 1.2, cz(25.5));
        this.arm.rotation.x = Math.PI / 2;
        this.arm.rotation.z = 0;
        this.arm.visible = false;
        // theater: stage, curtains, booth, shutter light
        this.mk(new THREE.BoxGeometry(11 * CELL, 0.8, 4 * CELL), gmat(0.35), cx(11), 0.4, cz(7.5));
        for (const s of [-1, 1]) { const cu = this.mk(new THREE.BoxGeometry(5 * CELL, 5, 0.4), gmat(0.2), cx(11) + s * 2.5 * CELL * 0.5, 2.8, cz(9.4)); this.curtains.push(cu);}
        this.shutterLight = new THREE.PointLight(0xffffff, 40, 40, 1.5);
        this.shutterLight.position.set(cx(11), 5, cz(19));
        g.add(this.shutterLight);
        // factory: drawing tables, film reels, ink pumps, projector screen
        for (let i = 0; i < 6; i++) this.mk(new THREE.BoxGeometry(3, 0.9, 1.4), gmat(0.55), cx(26 + (i % 3) * 4.5), 0.45, cz(5 + Math.floor(i / 3) * 3.5));
        for (let i = 0; i < 5; i++) { const r = this.mk(new THREE.CylinderGeometry(0.6, 0.6, 0.15, 14), gmat(0.1), cx(26 + i * 3), 1.05, cz(5)); r.rotation.x = Math.PI / 2;}
        for (let i = 0; i < 3; i++) this.mk(new THREE.CylinderGeometry(0.7, 0.8, 3, 10), gmat(0.2, 0.05), cx(37), 1.5, cz(6 + i * 3));
        const draw = tex(256, 128, (x) => { x.fillStyle = '#f0f0f0'; x.fillRect(0, 0, 256, 128); x.strokeStyle = '#222'; x.lineWidth = 2; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(40 + i * 80, 60, 24, 0, 7); x.stroke(); x.fillStyle = '#222'; x.fillRect(32 + i * 80, 50, 6, 6); x.fillRect(46 + i * 80, 50, 6, 6); x.beginPath(); x.arc(40 + i * 80, 66, 10, 0.2, 2.9); x.stroke();}});
        const dr = this.mk(new THREE.PlaneGeometry(2.4, 1.2), new THREE.MeshBasicMaterial({ map: draw}), cx(30), 0.92, cz(5));
        dr.rotation.x = -Math.PI / 2;
        this.projCv = document.createElement('canvas');
        this.projCv.width = 192; this.projCv.height = 128;
        this.projTx = new THREE.CanvasTexture(this.projCv);
        this.projTx.colorSpace = THREE.SRGBColorSpace;
        const scr = this.mk(new THREE.PlaneGeometry(6, 4), new THREE.MeshBasicMaterial({ map: this.projTx}), cx(32), 2.8, 4 * CELL + 0.3);
        void scr;
        this.leak = this.mk(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ color: 0x000000}), cx(32), 0.03, 13 * CELL - 0.6);
        this.leak.rotation.x = -Math.PI / 2;
        this.leak.scale.set(1, 0.1, 1);
        this.leak.visible = false;
        // ink flood visuals
        this.inkMesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(CELL - 0.1, CELL - 0.1), new THREE.MeshStandardMaterial({ color: 0x000000, roughness: 0.1, metalness: 0.4}), 600);
        this.inkMesh.rotation.x = -Math.PI / 2;
        this.inkMesh.count = 0;
        const ig = new THREE.Group();
        ig.add(this.inkMesh);
        g.add(ig);
        this.inkMesh.position.y = 0;
        // heated grates in the gallery corridor
        for (const r of [15, 19]) { const gr = this.mk(new THREE.PlaneGeometry(CELL - 0.4, CELL - 0.4), new THREE.MeshStandardMaterial({ color: 0x333333, emissive: 0x000000}), cx(42), 0.05, cz(r)); gr.rotation.x = -Math.PI / 2; this.grates.push(gr);}
        // gallery: unfinished drawings of earlier characters
        for (let i = 0; i < 6; i++) { const d2 = this.mk(new THREE.PlaneGeometry(2.4, 3), new THREE.MeshBasicMaterial({ map: tex(64, 80, (x) => { x.fillStyle = '#eee'; x.fillRect(0, 0, 64, 80); x.strokeStyle = '#111'; x.lineWidth = 2; if (i % 3 === 0) { x.strokeRect(14, 30, 36, 40); x.fillStyle = '#111'; x.fillRect(22, 10, 20, 14);} else if (i % 3 === 1) { x.beginPath(); x.moveTo(32, 8); x.lineTo(10, 70); x.lineTo(54, 70); x.closePath(); x.stroke();} else { x.beginPath(); x.arc(32, 28, 14, 0, 7); x.stroke(); x.strokeRect(10, 46, 44, 26);}})}), cx(42) + (i % 2 ? 1.8 : -1.8), 2.2, cz(10 + i * 2)); d2.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;}
        // collapsing projection room beams
        for (const [c, r] of [[40, 25], [43, 26], [45, 24], [41, 27]] as [number, number][]) { const mm = this.mk(new THREE.BoxGeometry(CELL - 0.8, 0.4, CELL - 0.8), new THREE.MeshBasicMaterial({ color: 0xff3030, transparent: true, opacity: 0.0}), cx(c), 0.05, cz(r)); this.beams.push({ m: mm, c, r, state: 0, t: 0});}
        // editing room: giant film machine
        const machine = this.mk(new THREE.BoxGeometry(5, 4, 3), gmat(0.2), cx(4), 2, cz(31));
        void machine;
        const lt = tex(256, 64, (x) => { x.fillStyle = '#111'; x.fillRect(0, 0, 256, 64); x.fillStyle = '#fff'; x.font = 'bold 15px monospace'; x.textAlign = 'center'; x.fillText('FINAL CAST ASSEMBLY', 128, 28); x.fillText('DAY SEVEN', 128, 50);});
        this.editLabel = this.mk(new THREE.PlaneGeometry(4, 1), new THREE.MeshBasicMaterial({ map: lt}), cx(4) + 2.55, 3, cz(31));
        this.editLabel.rotation.y = Math.PI / 2;
        this.strip = this.mk(new THREE.BoxGeometry(0.1, 0.5, 9), gmat(0.9, 0.4), cx(4) + 2.6, 1.2, cz(31));
        for (let i = 0; i < 5; i++) this.mk(new THREE.PlaneGeometry(1.2, 0.9), new THREE.MeshBasicMaterial({ color: gray(0.4 + i * 0.1)}), cx(2) + 0.6 * i, 2.8, cz(30) - 1.4).rotation.y = Math.PI;
        // the tear that opens at the end
        this.tearPlane = this.mk(new THREE.PlaneGeometry(3.2, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide}), cx(20) + 1.5, 2.5, cz(31.5));
        this.tearPlane.rotation.y = Math.PI / 2;
        this.tearPlane.visible = false;
        // children's studio carpet (shown at the end)
        this.studio = new THREE.Group();
        const carpet = new THREE.Mesh(new THREE.PlaneGeometry(40, 30), new THREE.MeshStandardMaterial({ color: 0xff6a3a}));
        carpet.rotation.x = -Math.PI / 2;
        this.studio.add(carpet);
        const air = tex(128, 48, (x) => { x.fillStyle = '#c00'; x.fillRect(0, 0, 128, 48); x.fillStyle = '#fff'; x.font = 'bold 28px monospace'; x.textAlign = 'center'; x.fillText('ON AIR', 64, 34);});
        const ons = new THREE.Mesh(new THREE.PlaneGeometry(3, 1.1), new THREE.MeshBasicMaterial({ map: air}));
        ons.position.set(0, 6, -10);
        this.studio.add(ons);
        const merr = new THREE.Mesh(new THREE.ConeGeometry(0.9, 2.6, 10), new THREE.MeshStandardMaterial({ color: 0xd04a8a}));
        merr.position.set(-3, 1.3, -8);
        this.studio.add(merr);
        const bell = new THREE.Mesh(new THREE.SphereGeometry(0.6, 10, 8), new THREE.MeshStandardMaterial({ color: 0xf0e0b0}));
        bell.position.set(2, 0.7, -8);
        this.studio.add(bell);
        const back = new THREE.Mesh(new THREE.PlaneGeometry(40, 14), new THREE.MeshBasicMaterial({ color: 0x5ac85a}));
        back.position.set(0, 7, -12);
        this.studio.add(back);
        const sl = new THREE.PointLight(0xffffff, 200, 60, 1.2);
        sl.position.set(0, 10, 0);
        this.studio.add(sl);
        this.studio.position.set(X5 + 400, 0, 0);
        this.studio.visible = false;
        g.add(this.studio);
        const key = new THREE.PointLight(0xffffff, 70, 60, 1.4);
        key.position.set(cx(10), 8, cz(15));
        key.name = 'key';
        g.add(key);
    }
    private buildInteractables(): void {
        const c = this.ctx;
        const add = (id: string, label: string, x: number, y: number, z: number, run: () => void, enabled: () => boolean, range = 3) => {
            this.interactables.push({ id, label, pos: new THREE.Vector3(x, y, z), range, enabled, run });
        };
        add('d5_facade', 'Touch the painted building', cx(5), 1.5, 24 * CELL - 0.2, () => {
            this.pieces.add('f');
            c.say('PROTAGONIST', "My hand goes straight through it. It's paint. Just paint.", 4.5);
            c.track('d5_facade_touched');
        }, () => this.stage === 'street' && !this.pieces.has('f'), 3);
        add('d5_door', 'Open the painted door', cx(8), 1.4, 24 * CELL + 0.8, () => this.toTheater(), () => this.stage === 'grin' && !this.busy, 3);
        add('d5_proj', 'Watch the projector', cx(32), 1.4, 5 * CELL + 1, () => this.watchProj(), () => this.stage === 'factory' && !this.seenProj && !this.busy, 4);
        add('d5_drawings', 'Look at the unfinished drawings', cx(30), 0.9, cz(5) + 0.5, () => {
            c.say('PROTAGONIST', "A tall one with long fingers. A bear with a blade. A trench-coat figure. They're drawing everyone I've met.", 7);
            c.track('d5_drawings');
        }, () => this.stage === 'factory', 3);
        const lever = (id: string, label: string, x: number, z: number) => add(id, label, x, 1.2, z, () => this.cutLights(), () => this.stage === 'pursuit' && this.cool <= 0, 3);
        lever('d5_lights_a', 'Cut the stage lights', cx(26), cz(8));
        lever('d5_lights_b', 'Cut the stage lights', cx(41) - 1, cz(11));
        lever('d5_lights_c', 'Cut the stage lights', cx(40), cz(26));
        const shutter = (id: string, x: number, z: number) => add(id, 'Slam the projector shutter', x, 1.2, z, () => this.slamShutter(), () => (this.stage === 'pursuit') && this.cool <= 0, 3);
        shutter('d5_shut_a', cx(34), cz(5));
        shutter('d5_shut_b', cx(38), cz(24));
        const heatSw = (id: string, i: number, x: number, z: number) => add(id, 'Engage heat on the grate', x, 1.2, z, () => this.engageHeat(i), () => this.stage === 'pursuit' && this.heat[i] <= 0, 3);
        heatSw('d5_heat_a', 0, cx(42) - 1.5, cz(13));
        heatSw('d5_heat_b', 1, cx(42) - 1.5, cz(17));
        add('d5_tear', 'Tear the film strip', cx(4) + 1.8, 1.2, cz(31), () => this.tear(), () => this.stage === 'editing' && !this.torn, 4);
        add('d5_label', 'Read the machine label', cx(4) + 1.8, 2.8, cz(31) + 1.5, () => {
            c.say('PROTAGONIST', "'FINAL CAST ASSEMBLY — DAY SEVEN.' And reels of every day. The island. The Backrooms. The warehouse. Me.", 7);
            c.track('d5_label_read');
        }, () => this.stage === 'editing', 4);
    }
    // ───────── lifecycle ─────────
    begin(): void {
        const c = this.ctx;
        this.group.visible = true;
        this.reset('street');
        c.giveFlashlight();
        c.p.set(cx(3), 0, cz(25));
        c.setYaw(-Math.PI / 2);
        c.setPitch(0);
        c.setHead(null);
        c.setHandColor(null);
        c.lock(true);
        this.introT = 0;
        c.fadeTo(0, 2);
        c.checkpoint('d5_street');
        c.track('d5_started');
    }
    private reset(stage: Stage): void {
        this.stage = stage;
        this.gs = 'DORMANT'; this.hs = 'DORMANT'; this.ia = false;
        this.gr.group.visible = false; this.hu.group.visible = false; this.ik.group.visible = false;
        this.ctx.lock(false); this.ctx.setSpeedMul(1); this.ctx.setForceCrouch(false); this.ctx.setHead(null);
        this.ctx.setAmbient(0.8);
        this.busy = false;
        this.inkSet.clear(); this.inkCells = []; this.layer = 0; this.inkMesh.count = 0;
        this.heat = [0, 0]; this.cool = 0; this.lightsT = 0; this.shutterT = 0;
        this.musicOn = stage === 'street' || stage === 'theater';
        this.grid[25 * W + 19] = 0; this.grid[24 * W + 19] = 0; this.grid[26 * W + 19] = 0; this.grid[27 * W + 19] = 0;
        this.arm.visible = false; this.shadow.visible = false;
        const afterCurt = ['hush', 'factory', 'burst', 'pursuit', 'editing', 'tear'].includes(stage);
        this.grid[7 * W + 17] = afterCurt ? 0 : 3;
        this.curtains.forEach((cu, i) => { cu.position.x = cx(11) + (i ? 1 : -1) * (afterCurt ? 19 : 5); });
        const burst = ['pursuit', 'editing', 'tear'].includes(stage);
        this.grid[13 * W + 32] = burst ? 0 : 3;
        this.leak.visible = false;
        this.shutterLight.intensity = 40;
        this.tearPlane.visible = false;
        this.studio.visible = false;
        this.torn = stage === 'tear';
        this.burstDone = burst;
        this.factT = 0;
        this.group.getObjectByName('key')!.visible = true;
    }
    respawn(id: string): void {
        const c = this.ctx;
        this.group.visible = true;
        this.cpId = id;
        if (id === 'd5_street') this.reset('street');
        else if (id === 'd5_theater') { this.reset('theater'); this.stage = 'hush'; this.hs = 'ACTIVE'; this.spawnHush(cx(11), cz(10)); c.objective('Reach the stage door while the projector is dark.');}
        else if (id === 'd5_factory') { this.reset('factory'); this.seenProj = false; c.objective('Investigate the animation factory.');}
        else if (id === 'd5_pursuit') { this.reset('pursuit'); this.startPursuit(true); }
        else if (id === 'd5_proj') { this.reset('pursuit'); this.startPursuit(true); }
        else if (id === 'd5_editing') { this.reset('editing'); this.torn = false; c.objective('Tear the film strip.');}
        else this.reset('street');
    }
    save(): { cp: string } { return { cp: this.cpId }; }
    load(): void { /* progress is stored in the checkpoint id */ }
    objectiveText(): string {
        switch (this.stage) {
            case 'street': return 'Explore the street.';
            case 'grin': return 'Find a way off the street. Try the painted door.';
            case 'theater': case 'hush': return 'Reach the stage door while the projector is dark.';
            case 'factory': return 'Investigate the animation factory.';
            case 'burst': case 'pursuit': return 'RUN. Use the levers, shutters and heat grates to slow them.';
            case 'editing': return 'Tear the film strip.';
            case 'tear': return 'Jump through the tear!';
            default: return '...';
        }
    }
    // ───────── beats ─────────
    private grinScene(): void {
        const c = this.ctx;
        this.stage = 'grin';
        c.lock(false);
        c.checkpoint('d5_street'); this.cpId = 'd5_street';
        this.gs = 'SCRIPT';
        this.gx = cx(12); this.gz = cz(22);
        this.gr.group.visible = true;
        c.track('d5_grinwick');
        c.say('GRINWICK', 'Well, well! Look what wandered into the picture!', 4);
        c.after(4.5, () => {
            this.arm.visible = true;
            for (let r = 24; r <= 27; r++) this.grid[r * W + 19] = 1;
            c.sfx.tone(400, 0.5, 0.08, 0.5, 'sine', 900);
            c.say('GRINWICK', "Leaving already? We haven't even started the show!", 4);
        });
        c.after(7, () => { this.musicOn = false; this.gs = 'DORMANT'; this.gr.group.visible = false; c.objective('Find a way off the street. Try the painted door.'); this.busy = false;});
    }
    private toTheater(): void {
        const c = this.ctx;
        this.busy = true;
        c.lock(true);
        c.fadeTo(1, 0.6);
        c.after(0.8, () => {
            this.stage = 'theater';
            this.arm.visible = false;
            c.p.set(cx(10), 0, cz(18)); c.setYaw(0); c.setPitch(0);
            this.musicOn = false;
            c.fadeTo(0, 1); c.lock(false); this.busy = false;
            c.checkpoint('d5_theater'); this.cpId = 'd5_theater';
            c.objective('Reach the stage door while the projector is dark.');
            c.after(3, () => this.hushRises());
            c.track('d5_theater_entered');
        });
    }
    private spawnHush(x: number, z: number): void {
        this.hx = x; this.hz = z;
        this.hu.group.visible = true;
        this.hu.group.position.set(x, 0, z);
        this.hs = 'ACTIVE'; this.hTimer = 5; this.hTell = false;
    }
    private hushRises(): void {
        const c = this.ctx;
        this.hx = cx(11); this.hz = cz(11.5);
        this.hu.group.visible = true;
        this.hu.group.position.set(this.hx, -1.5, this.hz);
        this.hs = 'SEAT';
        this.stage = 'theater';
        c.sfx.tone(70, 2, 0.1);
        const t0 = this.t;
        const tick = () => {
            const k = Math.min(1, (this.t - t0) / 2.2);
            this.hu.group.position.y = -1.5 + 1.5 * k;
            if (k < 1) c.after(0.03, tick);
            else {
                c.say('MR. HUSH', 'You smell like the outside.', 3.5);
                c.after(4, () => { this.hs = 'ACTIVE'; this.hTimer = 3; this.stage = 'hush'; c.objective('Reach the stage door while the projector is dark.');});
            }
        };
        tick();
    }
    private hushJumpBehind(): void {
        const c = this.ctx, p = c.p;
        const yaw = c.getYaw();
        this.hx = p.x + Math.sin(yaw) * 3.5; this.hz = p.z + Math.cos(yaw) * 3.5; // directly behind the player
        const [hc, hr] = this.cellOf(this.hx, this.hz);
        if (this.solid(hc, hr)) { this.hx = p.x; this.hz = p.z + 4; }
        c.say('MR. HUSH', 'Nobody comes from outside anymore.', 4);
        c.after(4.2, () => {
            this.curtains.forEach((cu, i) => { cu.position.x += (i ? 1 : -1) * 14; });
            this.grid[7 * W + 17] = 0;
            c.sfx.tone(120, 1.4, 0.1, 0, 'sawtooth', 300);
            c.say('PROTAGONIST', 'The curtains are opening. There, the stage door!', 3.5);
            c.objective('Reach the stage door.');
        });
    }
    private watchProj(): void {
        const c = this.ctx;
        this.seenProj = true;
        this.busy = true;
        c.lock(true);
        c.track('d5_projector');
        const t0 = this.t;
        const run = () => {
            const k = (this.t - t0) / 8;
            this.drawProj(k);
            if (k < 1) c.after(0.1, run);
        };
        run();
        c.say('PROTAGONIST', "That's the forest. That's me, running. It's turning me into a cartoon...", 5);
        c.after(5.2, () => c.say('PROTAGONIST', "They're turning us into these things.", 4));
        c.after(9, () => {
            c.lock(false); this.busy = false;
            this.leak.visible = true;
            c.sfx.noise(1, 300, 0.5, 0.08, 0, 'lowpass');
            c.say('PROTAGONIST', 'Ink. It is seeping under the locked door.', 4);
            c.after(8, () => this.burst());
        });
        this.stage = 'factory';
    }
    private drawProj(k: number): void {
        const x = this.projCv.getContext('2d')!;
        x.fillStyle = '#101810'; x.fillRect(0, 0, 192, 128);
        for (let i = 0; i < 12; i++) { x.fillStyle = '#1e3a1e'; x.beginPath(); x.moveTo(i * 18, 100); x.lineTo(i * 18 + 9, 40 + (i % 3) * 10); x.lineTo(i * 18 + 18, 100); x.fill();}
        const fx = 30 + k * 130;
        if (k < 0.5) { x.fillStyle = '#d0d0d0'; x.fillRect(fx, 70, 8, 22); x.beginPath(); x.arc(fx + 4, 64, 6, 0, 7); x.fill();}
        else {
            const t = (k - 0.5) * 2;
            x.fillStyle = '#fff'; x.beginPath(); x.arc(fx + 4, 70, 12, 0, 7); x.fill();
            x.fillStyle = '#000'; x.fillRect(fx, 66, 4, 6); x.fillRect(fx + 8, 66, 4, 6);
            x.beginPath(); x.arc(fx + 4, 74, 6, 0.2, 2.9); x.stroke();
            x.fillStyle = `rgba(16,24,16,${t})`; x.fillRect(fx - 50 * (1 - t), 60, 40, 40); // the original double is erased
        }
        this.projTx.needsUpdate = true;
    }
    private burst(): void {
        if (this.burstDone || this.stage !== 'factory') return;
        this.burstDone = true;
        const c = this.ctx;
        this.stage = 'burst';
        c.track('d5_inkwright');
        this.grid[13 * W + 32] = 0;
        this.leak.visible = false;
        c.sfx.thud(0.9); c.sfx.noise(1.2, 500, 0.4, 0.2, 0, 'bandpass');
        this.ia = true; this.ik.group.visible = true;
        this.ix = cx(32); this.iz = cz(13.5);
        this.computeInkDist(32, 14);
        this.layer = 1; this.layerT = 0; this.inkSet.clear(); this.rebuildInk();
        c.say('INKWRIGHT', 'Every good story needs a permanent cast.', 4.5);
        c.after(5, () => this.startPursuit(false));
    }
    private computeInkDist(sc: number, sr: number): void {
        const d = this.inkDist; d.fill(-1);
        const q: number[] = [sc, sr];
        d[sr * W + sc] = 0;
        for (let i = 0; i < q.length; i += 2) {
            const c = q[i], r = q[i + 1], v = d[r * W + c];
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nc = c + dc, nr = r + dr;
                if (this.solid(nc, nr) && !(nc === 32 && nr === 13) || d[nr * W + nc] >= 0) continue;
                if (nc < 0 || nr < 0 || nc >= W || nr >= H) continue;
                d[nr * W + nc] = v + 1; q.push(nc, nr);
            }
        }
    }
    private startPursuit(resume: boolean): void {
        const c = this.ctx;
        this.stage = 'pursuit';
        this.musicOn = false;
        this.ia = true; this.ik.group.visible = true;
        const [pc, pr] = this.cellOf(c.p.x, c.p.z);
        this.computeInkDist(32, 14);
        const pd = Math.max(0, this.inkDist[this.idx(pc, pr)]);
        if (resume) { this.layer = Math.max(2, pd - 12); this.inkSet.clear(); this.rebuildInk(); }
        // Grinwick folds through the wall behind; Mr. Hush exits the projector
        const yaw = c.getYaw();
        this.gs = 'CHASE'; this.gr.group.visible = true; this.gTimer = 3;
        this.gx = c.p.x + Math.sin(yaw) * 20; this.gz = c.p.z + Math.cos(yaw) * 20;
        this.hs = 'ACTIVE'; this.hu.group.visible = true; this.hTimer = 4; this.hTell = false;
        this.hx = cx(34); this.hz = cz(5);
        if (resume) { const best = this.farCell(pc, pr, 10); this.hx = cx(best[0]); this.hz = cz(best[1]); }
        c.objective('RUN. Use the levers, shutters and heat grates to slow them.');
        c.say('PROTAGONIST', 'All three of them. Move!', 3);
        c.checkpoint(this.cpId === 'd5_proj' ? 'd5_proj' : 'd5_pursuit'); if (!resume) this.cpId = 'd5_pursuit';
    }
    private farCell(pc: number, pr: number, steps: number): [number, number] {
        const [sc, sr] = [32, 14];
        void sc; void sr;
        let best: [number, number] = [pc, pr];
        const pd = this.inkDist[this.idx(pc, pr)];
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) { const d = this.inkDist[r * W + c]; if (d >= 0 && d === pd - steps && !this.solid(c, r)) { best = [c, r];}}
        return best;
    }
    private cutLights(): void {
        const c = this.ctx;
        this.cool = 25; this.lightsT = 8;
        this.gs = 'FROZEN'; this.gTimer = 8;
        this.shutterLight.intensity = 3;
        c.sfx.thud(0.5); c.sfx.staticBurst(0.3, 0.05);
        c.say('PROTAGONIST', 'The stage lights are out. It stopped. It can only perform in a spotlight.', 4);
        c.track('d5_lights_cut');
    }
    private slamShutter(): void {
        const c = this.ctx;
        this.cool = 25; this.shutterT = 12;
        c.sfx.click(0.7); c.sfx.thud(0.4);
        c.say('PROTAGONIST', "The shutter's jammed shut. The projector can't blink.", 4);
        c.track('d5_shutter_slammed');
    }
    private engageHeat(i: number): void {
        const c = this.ctx;
        this.heat[i] = 15;
        c.sfx.tone(180, 0.6, 0.08, 0, 'sawtooth');
        c.say('PROTAGONIST', "The grate's glowing. The ink can't cross dry, hot metal.", 4);
        c.track('d5_heat_engaged', { grate: i });
    }
    private tear(): void {
        const c = this.ctx;
        this.torn = true;
        this.stage = 'tear';
        c.lock(true);
        this.gs = 'FROZEN'; this.gTimer = 99; this.hs = 'DORMANT'; this.ia = false;
        c.track('d5_film_torn');
        c.sfx.noise(1.2, 800, 0.4, 0.15, 0, 'bandpass', 3000);
        c.say('PROTAGONIST', "I'm tearing it. Everything stops.", 3);
        c.after(3.4, () => c.say('SPLICEMASTER', 'You keep ruining the ending.', 3.5));
        c.after(7.2, () => c.say('PROTAGONIST', 'Then stop writing it.', 3));
        c.after(10.5, () => {
            c.lock(false);
            this.tearPlane.visible = true;
            this.gs = 'CHASE'; this.gTimer = 0; this.hs = 'ACTIVE'; this.hTimer = 3; this.ia = true;
            this.gx = cx(5); this.gz = cz(33);
            c.sfx.noise(2, 600, 0.3, 0.12, 0, 'bandpass', 4000);
            c.say('PROTAGONIST', 'The world is tearing like film! The white gap, JUMP THROUGH!', 4);
            c.objective('Jump through the tear!');
            c.checkpoint('d5_editing'); this.cpId = 'd5_editing';
        });
    }
    echoes(): { name: string; model: THREE.Group }[] {
        return [{ name: 'Grinwick', model: this.gr.group}, { name: 'Hush', model: this.hu.group}, { name: 'Ink Wretch', model: this.ik.group}];
    }
    private finale(): void {
        const c = this.ctx;
        this.stage = 'done';
        c.lock(true);
        c.track('d5_tear_jump');
        this.gs = 'DORMANT'; this.hs = 'DORMANT'; this.ia = false;
        c.fadeTo(1, 1.4);
        c.sfx.noise(1.5, 3000, 0.3, 0.1, 0, 'highpass');
        c.after(1.8, () => {
            this.group.children.forEach((o) => { if (o !== this.studio) o.visible = false; });
            this.studio.visible = true;
            c.p.set(X5 + 400, 0, 6); c.setYaw(0); c.setPitch(0);
            c.sfx.click(0.5); c.sfx.staticBurst(0.4, 0.08);
            c.fadeTo(0, 1.2);
            c.say('OLIVER', 'Behind the painted set. Under the house. The same night, not another beginning.', 4);
        });
        c.after(5, () => { c.fadeTo(1, 1.2); c.say('PROTAGONIST', 'A crawlspace. The film was hiding the way in.', 3.5);});
        c.after(9.5, () => {
            c.track('chapter_days56_film_completed');
            // end-of-day loss: Alan is taken in the crawlspace
            if (c.isFriendAlive('Alan')) c.killFriend('Alan');
            c.nextChapter('d6');
        });
    }
    // ───────── enemies ─────────
    private floodFrom(tc: number, tr: number): void {
        const f = this.flood; f.fill(-1);
        const q: number[] = [];
        if (!this.solid(tc, tr)) { f[tr * W + tc] = 0; q.push(tc, tr); }
        for (let i = 0; i < q.length; i += 2) {
            const c = q[i], r = q[i + 1], d = f[r * W + c];
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = c + dc, nr = r + dr; if (this.solid(nc, nr) || f[nr * W + nc] >= 0) continue; f[nr * W + nc] = d + 1; q.push(nc, nr);}
        }
    }
    private pathStep(x: number, z: number, speed: number, dt: number, tc: number, tr: number): [number, number] {
        const [mc, mr] = this.cellOf(x, z);
        const here = this.flood[mr * W + mc];
        if (here < 0) return [x, z];
        let best = here, bx = cx(mc), bz = cz(mr);
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const nc = mc + dc, nr = mr + dr; if (this.solid(nc, nr)) continue; const v = this.flood[nr * W + nc]; if (v >= 0 && v < best) { best = v; bx = cx(nc); bz = cz(nr);}}
        void tc; void tr;
        if (best === here && here === 0) return [x, z];
        const dx = bx - x, dz = bz - z, d = Math.hypot(dx, dz) || 1;
        return [x + (dx / d) * Math.min(speed * dt, d), z + (dz / d) * Math.min(speed * dt, d)];
    }
    private rebuildInk(): void {
        const m = new THREE.Matrix4();
        const cells: number[] = [];
        for (let r = 0; r < H; r++) for (let c = 0; c < W; c++) {
            const d = this.inkDist[r * W + c];
            if (d >= 0 && d <= this.layer && !this.solid(c, r) && !this.isHot(c, r)) cells.push(r * W + c);
        }
        this.inkCells = cells;
        this.inkSet = new Set(cells);
        const n = Math.min(600, cells.length);
        for (let i = 0; i < n; i++) { const r = Math.floor(cells[i] / W), c = cells[i] % W; m.makeTranslation(cx(c) - 0, -cz(r), 0.06); this.inkMesh.setMatrixAt(i, m);}
        this.inkMesh.count = n;
        this.inkMesh.instanceMatrix.needsUpdate = true;
    }
    private isHot(c: number, r: number): boolean {
        if (c !== 42) return false;
        if (r === 15) return this.heat[0] > 0;
        if (r === 19) return this.heat[1] > 0;
        return false;
    }
    private updateEnemies(dt: number, pc: number, pr: number): void {
        const c = this.ctx, p = c.p;
        const live = this.stage === 'pursuit' || this.stage === 'tear';
        // Grinwick: elastic, folds through walls; its smile plate taps three times before a stretch
        if (this.gs === 'CHASE') {
            const dx = p.x - this.gx, dz = p.z - this.gz, d = Math.hypot(dx, dz) || 1;
            this.gTimer -= dt;
            if (this.gTimer <= 0 && d < 18 && Math.floor(this.t * 6) % 7 === 0 && this.gTap <= 0) { this.gTap = 0.8; c.sfx.click(0.3); c.after(0.25, () => c.sfx.click(0.3)); c.after(0.5, () => c.sfx.click(0.3)); this.gTimer = 6;}
            if (this.gTap > 0) this.gTap -= dt;
            const sp = this.gTap > 0 ? 0.5 : (d > 12 ? 4.4 : 3.7);
            this.gx += (dx / d) * sp * dt; this.gz += (dz / d) * sp * dt;
            this.gr.group.position.set(this.gx, 0, this.gz);
            this.gr.group.rotation.y = Math.atan2(-dx, -dz);
            this.gr.limbs.forEach((l, i) => { l.scale.y = 1 + 0.5 * Math.sin(this.t * 5 + i); l.rotation.x = Math.sin(this.t * 4 + i * 2) * 0.6;});
            this.gr.mask.position.y = 2.9 + Math.sin(this.t * 3) * 0.1;
            if (d < 1.6 && live) c.capture();
        } else if (this.gs === 'FROZEN') {
            this.gTimer -= dt;
            this.gr.group.visible = true;
            if (this.gTimer <= 0 && this.stage !== 'tear') this.gs = 'CHASE';
        } else if (this.gs === 'SCRIPT') {
            this.gr.group.position.set(this.gx, 0, this.gz);
            const dx = p.x - this.gx, dz = p.z - this.gz;
            this.gr.group.rotation.y = Math.atan2(-dx, -dz);
            this.gr.limbs.forEach((l, i) => { l.rotation.z = Math.sin(this.t * 2 + i) * 0.4;});
            this.gz += Math.sign(cz(25) - this.gz) * dt * 3;
        }
        // Mr. Hush: moves only when the projector shutter interrupts the light
        if (this.hs === 'SEAT') { this.hu.head.rotation.y = Math.atan2(p.x - this.hx, p.z - this.hz) + Math.PI;}
        if (this.hs === 'ACTIVE') {
            this.hu.masks.rotation.y += dt * 0.4;
            this.hu.head.rotation.y = Math.atan2(p.x - this.hx, p.z - this.hz) + Math.PI;
            if (this.shutterT > 0) this.shutterT -= dt;
            else {
                this.hTimer -= dt;
                if (this.hTimer <= 1 && !this.hTell) { this.hTell = true; c.sfx.click(0.4); }
                if (this.hTimer <= 0) {
                    this.hTimer = this.stage === 'pursuit' ? 5 : 4.5; this.hTell = false;
                    c.fadeTo(0.88, 0.04);
                    c.sfx.thud(0.3);
                    this.floodFrom(pc, pr);
                    const first = this.stage === 'hush' && !this.curtainsOpened();
                    if (first) this.hushJumpBehind();
                    else {
                        let [nx, nz] = [this.hx, this.hz];
                        for (let k = 0; k < 4; k++) [nx, nz] = this.pathStep(nx, nz, 1, 1.6, pc, pr);
                        this.hx = nx; this.hz = nz;
                    }
                    c.after(0.18, () => c.fadeTo(0, 0.2));
                }
                if (Math.hypot(p.x - this.hx, p.z - this.hz) < 1.8 && (live || this.stage === 'hush')) c.capture();
            }
            this.hu.group.position.set(this.hx, 0, this.hz);
            this.hu.group.rotation.y = this.hYaw;
            this.hu.folds.forEach((f, i) => { f.scale.x = 1 + Math.sin(this.t * 2 + i) * 0.04;});
        }
        this.shutterLight.intensity = this.hTell ? 10 : (this.lightsT > 0 ? 3 : 40);
        // Inkwright: rides connected ink; spreads each interval but cannot cross heated grates
        if (this.ia) {
            for (let i = 0; i < 2; i++) if (this.heat[i] > 0) { this.heat[i] -= dt; const gm = this.grates[i].material as THREE.MeshStandardMaterial; gm.emissive.setHex(this.heat[i] > 0 ? 0xff6a10 : 0x000000);}
            if (this.cool > 0) this.cool -= dt;
            if (this.lightsT > 0) this.lightsT -= dt;
            this.layerT += dt;
            if (this.layerT > (this.stage === 'pursuit' ? 1.2 : 1.8)) { this.layerT = 0; this.layer++; this.rebuildInk();}
            if (this.heat[0] > 0 || this.heat[1] > 0) { /* hot cells repel ink on rebuild */ }
            // choose the ink cell nearest the player and slide toward it
            let bd = 1e9, bx = this.ix, bz = this.iz;
            for (const id of this.inkCells) { const r = Math.floor(id / W), cc = id % W; const x = cx(cc), z = cz(r); const d = Math.hypot(x - p.x, z - p.z); if (d < bd) { bd = d; bx = x; bz = z;}}
            const dx = bx - this.ix, dz = bz - this.iz, dd = Math.hypot(dx, dz);
            const [ic, ir] = this.cellOf(this.ix + Math.sign(dx) * 0.8, this.iz + Math.sign(dz) * 0.8);
            if (dd > 0.3 && (this.inkSet.has(this.idx(ic, ir)) || this.inkCells.length === 0)) { this.ix += (dx / dd) * 2.8 * dt; this.iz += (dz / dd) * 2.8 * dt;}
            this.ik.group.position.set(this.ix, 0, this.iz);
            this.ik.group.rotation.y = Math.atan2(-(p.x - this.ix), -(p.z - this.iz));
            this.ik.tent.forEach((tn, i) => { tn.rotation.z = Math.cos(i * 1.26) * 0.9 + Math.sin(this.t * 3 + i) * 0.3;});
            if (live && Math.hypot(p.x - this.ix, p.z - this.iz) < 1.7) c.capture();
            // standing in ink drags at the feet
            const [cc2, rr2] = [pc, pr];
            c.setSpeedMul(this.inkSet.has(this.idx(cc2, rr2)) && live ? 0.7 : 1);
        }
    }
    private curtainsOpened(): boolean { return this.grid[7 * W + 17] === 0; }
    // ───────── per-frame ─────────
    update(dt: number): void {
        const c = this.ctx;
        this.t += dt;
        void this.facade; void this.leak; void this.editLabel; void this.strip; void this.shutterLight; void this.cpData; void this.loops; void this.beamT; void this.musicStep;
        const p = c.p;
        const [pc, pr] = this.cellOf(p.x, p.z);
        if (this.stage === 'street' && this.introT >= 0) {
            this.introT += dt;
            if (this.introT > 2 && this.introT - dt <= 2) c.say('PROTAGONIST', 'What kind of place is this?', 3);
            if (this.introT > 3.5) { c.lock(false); c.objective('Explore the street.'); this.introT = -1; }
        }
        // cheerful piano
        this.musicT -= dt;
        if (this.musicOn && this.musicT <= 0) { this.musicT = 0.3; const n = [523, 587, 659, 523, 659, 698, 784, 659]; c.sfx.tone(n[this.musicStep++ % 8], 0.25, 0.04, 0, 'triangle');}
        // shadow behind, then Grinwick
        if (this.stage === 'street' && this.introT < 0 && !this.shadow.visible && pc >= 7) { this.shadow.visible = true; c.sfx.tone(60, 1.5, 0.08);}
        if (this.stage === 'street' && pc >= 11 && pr >= 24) this.grinScene();
        if (this.stage === 'hush' && !this.curtainsOpened()) { /* waiting for the first shutter */ }
        if ((this.stage === 'theater' || this.stage === 'hush') && pc >= 17 && pr === 7 && this.curtainsOpened()) {
            this.stage = 'factory'; this.hs = 'DORMANT'; this.hu.group.visible = false;
            c.checkpoint('d5_factory'); this.cpId = 'd5_factory';
            c.objective('Investigate the animation factory.');
            c.track('d5_factory_entered');
        }
        if (this.stage === 'factory' && !this.seenProj && !this.burstDone) {
            this.factT += dt;
            if (this.factT > 40) { this.seenProj = true; this.leak.visible = true; c.say('PROTAGONIST', 'Ink is seeping under the locked door!', 3.5); c.after(6, () => this.burst());}
        }
        // projection room hazard beams
        if (this.stage === 'pursuit' && pc >= 38 && pr >= 23 && this.cpId !== 'd5_proj') { this.cpId = 'd5_proj'; c.checkpoint('d5_proj');}
        if (this.stage === 'pursuit' && pc >= 38 && pr >= 23) {
            this.beamT -= dt;
            if (this.beamT <= 0) { this.beamT = 2.6; const b = this.beams[Math.floor(Math.random() * this.beams.length)]; if (b.state === 0) { b.state = 1; b.t = 0;}}
            for (const b of this.beams) {
                if (b.state === 0) continue;
                b.t += dt;
                const mat = b.m.material as THREE.MeshBasicMaterial;
                if (b.state === 1) { mat.opacity = 0.3 + Math.sin(b.t * 20) * 0.2; if (b.t > 0.9) { b.state = 2; b.t = 0; c.sfx.thud(0.5); if (pc === b.c && pr === b.r) c.capture(); mat.color.setHex(0x000000); mat.opacity = 0.9;}}
                else if (b.t > 0.6) { b.state = 0; mat.opacity = 0; mat.color.setHex(0xff3030); }
            }
        }
        // repeating cartoon corridor
        if (this.stage === 'pursuit' && pr === 28 && pc <= 25 && pc >= 23 && this.loops < 2) {
            this.loops++;
            const off = cx(36) - cx(25);
            c.p.x += off; this.gx += off; this.hx += off; this.ix += off;
            c.sfx.noise(0.2, 1500, 1, 0.05, 0, 'bandpass');
        }
        if (this.stage === 'pursuit' && pc <= 14 && pr >= 29) { this.stage = 'editing'; this.gs = 'FROZEN'; this.gTimer = 3; this.hs = 'DORMANT'; this.hu.group.visible = false; this.ia = false; c.objective('Tear the film strip.'); c.checkpoint('d5_editing'); this.cpId = 'd5_editing'; c.track('d5_editing_room');}
        if (this.stage === 'tear' && pc >= 20 && pr >= 30 && this.torn) this.finale();
        this.updateEnemies(dt, pc, pr);
    }
}
