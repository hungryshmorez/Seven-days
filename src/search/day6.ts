import * as THREE from 'three';
import type { D1Ctx, D1Interact } from './day1.ts';
import { buildCleaverback } from './cleaverback.ts';
import { companion } from './companions.ts';
import { psxBox, type Surface } from './psx.ts';

/** The second half of ONE continuous Days 5–6 chapter: crawlspace, stones, birth of the sun. */
export const X6 = 2900;
type Stage = 'crawl' | 'stones' | 'ritual' | 'sunrise' | 'done';

export class Day6 {
    group = new THREE.Group();
    interactables: D1Interact[] = [];
    private stage: Stage = 'crawl';
    private cpId = 'd56_crawl';
    private t = 0;
    private rite = 0;
    private duelT = 0;
    private dawnT = 0;
    private nextHum = 0;
    private sky = new THREE.Color(0x171519);
    private sun = new THREE.PointLight(0xffe4ac, 0, 55, 1.2);
    private moon = new THREE.PointLight(0x7d8abf, 35, 45, 1.4);
    private entity = buildCleaverback();
    private seals: THREE.Mesh[] = [];
    private sunDisk!: THREE.Mesh;
    private moonDisk!: THREE.Mesh;
    private haze: THREE.Mesh[] = [];

    constructor(private c: D1Ctx) {
        const box = (w: number, h: number, d: number, col: number, x: number, y: number, z: number, surface?: Surface) => {
            const m = surface ? psxBox(w, h, d, surface) : new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.95 }));
            m.position.set(X6 + x, y, z); this.group.add(m); return m;
        };
        box(6, 0.3, 18, 0x40372c, 0, -0.15, 1, 'dirt');
        box(6, 0.22, 18, 0x302a24, 0, 1.38, 1, 'wood');
        for (const side of [-1, 1]) {
            box(0.3, 1.5, 18, 0x514335, side * 3, 0.65, 1, 'block');
            box(0.4, 4, 22, 0x494039, side * 6, 2, -29, 'block');
            for (let i = 0; i < 8; i++) box(0.18, 1.2, 0.2, 0x715b40, side * 2.8, 0.6, 8 - i * 2);
        }
        box(12, 0.3, 18, 0x4d4438, 0, -0.15, -29, 'dirt');
        box(12, 0.25, 18, 0x302b27, 0, 4, -29, 'wood');
        box(12, 4, 0.4, 0x534a3d, 0, 2, -38, 'block');
        // The crawl is a long winding maze of low corridors. Walls are tall enough to block the view, low enough to crouch under.
        this.buildCrawlMaze(box);
        for (let i = 0; i < 4; i++) box(2.5, 0.45, 2.3, 0x8c887b, Math.sin(i * 1.6) * 0.65, -0.225, -9.5 - i * 3, 'stone');
        box(15, 0.1, 14, 0x05070c, 0, -3, -14);
        this.sun.position.set(X6, 2.8, -35); this.moon.position.set(X6, 3.2, -25);
        this.group.add(this.sun, this.moon);
        this.sunDisk = new THREE.Mesh(new THREE.CircleGeometry(1.8, 32), new THREE.MeshBasicMaterial({ color: 0xffe5ac, transparent: true, opacity: 0.14 }));
        this.sunDisk.position.set(X6, 2.4, -37.74); this.group.add(this.sunDisk);
        this.moonDisk = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.18, 8, 24, Math.PI * 1.5), new THREE.MeshBasicMaterial({ color: 0xb2c3ed }));
        this.moonDisk.position.set(X6, 2.5, -27); this.group.add(this.moonDisk);
        this.entity.group.position.set(X6, 0, -33);
        this.entity.group.scale.setScalar(0.7); this.group.add(this.entity.group);
        for (let i = 0; i < 3; i++) {
            const x = [-3.5, 0, 3.5][i], z = [-25, -28, -25][i];
            box(0.9, 0.6, 0.9, 0x70624b, x, 0.3, z);
            const seal = new THREE.Mesh(new THREE.TorusGeometry(0.25, 0.035, 6, 24), new THREE.MeshBasicMaterial({ color: 0x61708c }));
            seal.rotation.x = -Math.PI / 2; seal.position.set(X6 + x, 0.62, z); this.seals.push(seal); this.group.add(seal);
            this.interactables.push({ id: 'd56_seal_' + i, label: ['Father — hold the dawn', 'Son — hold the light', 'Holy Ghost — release the soul'][i],
                pos: new THREE.Vector3(X6 + x, 0.8, z), range: 2.7,
                enabled: () => this.stage === 'ritual' && this.rite === i,
                run: () => this.holdSeal(i) });
        }
        // Oliver waits at the entry to the crawl (he is only shown if he survived the warehouse).
        const oliver = companion(3); oliver.position.set(X6 - 1.4, 0, 9.5); oliver.rotation.y = Math.PI; this.group.add(oliver);
        this.oliverFigure = oliver;
        for (let i = 0; i < 9; i++) {
            const mist = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.1), new THREE.MeshBasicMaterial({ color: 0xe2cda2, opacity: 0.018, transparent: true, depthWrite: false, side: THREE.DoubleSide }));
            mist.position.set(X6, 0.35 + i % 3 * 0.4, -22 - i * 1.7); this.haze.push(mist); this.group.add(mist);
        }
        this.group.visible = false;
    }

    private oliverFigure!: THREE.Group;
    /** Solid wall blocks of the crawl maze, in world space (used to stop the player walking through them). */
    private mazeWalls: { minx: number; maxx: number; minz: number; maxz: number }[] = [];
    /** Five lifeless friends lie still in the maze; one living helper guides you out. */
    private deadFriends: THREE.Group[] = [];
    private hanging: { g: THREE.Group; baseY: number; phase: number }[] = [];
    private helper?: THREE.Group;
    private helperTalked = false;

    /** Lolo and Yuri: two heads on one body. Lolo is loud and party-minded; Yuri is warm and heavier. */
    private buildLoloYuri(): THREE.Group {
        const g = new THREE.Group();
        const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9 });
        // shared body, slightly wider than a single person (the two are joined at the hip and shoulder)
        const torso = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.9, 0.45), std(0x3a2a5a));
        torso.position.set(0, 1.2, 0); g.add(torso);
        const legs = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.8, 0.4), std(0x222230));
        legs.position.set(0, 0.5, 0); g.add(legs);
        // Lolo: slimmer, bright face paint and a hair pom, on the left
        const lolo = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), std(0xf0d0b8));
        lolo.position.set(-0.22, 1.85, 0); g.add(lolo);
        const loloHair = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std(0xd02070));
        loloHair.position.set(-0.22, 2.0, -0.02); g.add(loloHair);
        // Yuri: rounder, clown paint and a red nose, on the right
        const yuri = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), std(0xf0d0b8));
        yuri.position.set(0.24, 1.85, 0); yuri.scale.set(1.05, 1, 1); g.add(yuri);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), new THREE.MeshBasicMaterial({ color: 0xd02020 }));
        nose.position.set(0.24, 1.82, -0.24); g.add(nose);
        // shared arms
        for (const s of [-1, 1]) {
            const arm = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.7, 0.22), std(0x3a2a5a));
            arm.position.set(s * 0.6, 1.1, 0); g.add(arm);
        }
        return g;
    }

    /** The helpers warn you: the friends aren't here to be found, and you should leave with them. */
    private helperTalk(): void {
        const c = this.c;
        this.helperTalked = true;
        c.track('d6_helper_talked');
        c.say('LOLO', "Fuck your sleep. Y'all are dicks, all of you. We're getting you out.", 5);
        c.after(5.2, () => c.say('YURI', "Don't mind her. Hey. Last beer's yours if you want it.", 5));
        c.after(10.6, () => c.say('YURI', "You're not gonna find your friends down here. Nobody who came in this way is coming back out the same. Leave with us.", 6));
        c.after(17.2, () => c.say('LOLO', "Stones are the only way across. Stay low and follow us.", 4.5));
    }

    /** A winding crawl maze from the door under the house to the stones. Each step is a corridor cell. */
    private buildCrawlMaze(box: (w: number, h: number, d: number, col: number, x: number, y: number, z: number, s?: Surface) => THREE.Mesh): void {
        // A real winding maze: a 3-column by 9-row grid of 2 m cells. Every cell starts as wall;
        // a depth-first carve opens one route from the door (south, z=8) to the stones (north, z=-8).
        // Fixed layout (so it can be checked by eye). '#' = wall block, '.' = open crawl cell.
        // Row 0 is the stones end (z=-8); the last row is the door end (z=8). Columns run left to right.
        const LAYOUT = [
            '...',  // row 0  stones side (opened so the exit is never blocked)
            '...',  // row 1  (opened so the exit is never blocked)
            '...',  // row 2  turn east-west
            '#.#',  // row 3
            '...',  // row 4
            '.##',  // row 5
            '...',  // row 6
            '#.#',  // row 7
            '.#.',  // row 8  door side (the door is at the bottom middle)
        ];
        const COLS = 3, ROWS = LAYOUT.length;
        const wall = LAYOUT.map((row) => row.split('').map((ch) => ch === '#'));
        // grid row 0 is the stones end (z=-8), row ROWS-1 the door end (z=8)
        // cellX/cellZ are LOCAL offsets (box() adds X6 itself); world positions add X6 for collision.
        const cellZ = (rr: number) => 8 - rr * 2;
        const cellX = (cc: number) => (cc - 1) * 2;
        this.mazeWalls = [];
        for (let rr = 0; rr < ROWS; rr++) for (let cc = 0; cc < COLS; cc++) {
            if (wall[rr][cc]) {
                box(2, 1.4, 2, 0x4a4035, cellX(cc), 0.7, cellZ(rr), 'block');
                this.mazeWalls.push({ minx: X6 + cellX(cc) - 1, maxx: X6 + cellX(cc) + 1, minz: cellZ(rr) - 1, maxz: cellZ(rr) + 1 });
            }
        }
        // the crawl floor and ceiling run the full length so the maze reads as one space
        box(6, 0.3, 20, 0x40372c, 0, -0.15, 0, 'dirt');
        box(6, 0.22, 20, 0x302a24, 0, 1.38, 0, 'wood');
        // Five lifeless friends hang motionless, levitating in the open void at the centre of the crawl.
        const hang: [number, number, number][] = [[-1.4, 1.1, -1.5], [1.3, 1.25, 0.5], [-0.4, 0.95, 3.2], [1.5, 1.05, -4.0], [-1.6, 1.3, -6.2]];
        this.hanging = [];
        for (const [x, y, z] of hang) {
            const body = companion(0);
            body.rotation.x = -Math.PI / 2 + 0.25; body.position.set(X6 + x, y, z);
            this.hanging.push({ g: body, baseY: y, phase: Math.random() * 6.28 });
            body.traverse((o) => { if (o instanceof THREE.Mesh) (o.material as THREE.MeshStandardMaterial).color.multiplyScalar(0.6); });
            this.group.add(body); this.deadFriends.push(body);
        }
        // One living helper near the stones: Lolo and Yuri, a conjoined pair with two heads and two personalities.
        this.helper = this.buildLoloYuri();
        this.helper.position.set(X6, 0, -9.2); this.helper.rotation.y = Math.PI;
        this.group.add(this.helper);
        this.interactables.push({ id: 'd6_helper', label: 'Talk to Lolo and Yuri', pos: new THREE.Vector3(X6, 0.8, -9.2), range: 2.8,
            enabled: () => this.stage === 'crawl' && !this.helperTalked, run: () => this.helperTalk() });
    }

    begin(): void {
        // Oliver is only here if he survived the warehouse
        if (this.oliverFigure) this.oliverFigure.visible = this.c.isFriendAlive('Oliver');
        const c = this.c;
        this.group.visible = true; this.stage = 'crawl'; this.cpId = 'd56_crawl'; this.rite = 0; this.duelT = 0; this.dawnT = 0;
        this.sun.intensity = 0; this.moon.intensity = 35; this.entity.group.visible = true; this.entity.group.scale.setScalar(0.7);
        this.seals.forEach((m) => (m.material as THREE.MeshBasicMaterial).color.setHex(0x61708c));
        c.setForceCrouch(true); c.setHead(null); c.setSpeedMul(1); c.showHands(true); c.setAmbient(0.15);
        c.p.set(X6, 0, 8); c.setYaw(0); c.setPitch(0); c.lock(false); c.fadeColor('#000'); c.fadeTo(0, 1.4);
        c.say('OLIVER', 'The studio ends under the house. Keep low. We finish this before the next dawn.', 6);
        c.objective(this.objectiveText()); c.checkpoint(this.cpId); c.track('chapter_merged_crawlspace_entered');
    }
    respawn(id: string): void {
        this.begin();
        // Old Day 6 saves migrate into the merged chapter rather than a removed broadcast scene.
        if (id === 'd56_stones' || id === 'd56_ritual') {
            this.stage = 'stones'; this.c.p.set(X6, 0, -6.7); this.c.setForceCrouch(false); this.cpId = 'd56_stones';
            if (id === 'd56_ritual') { this.c.p.set(X6, 0, -22); this.startRitual(); }
        }
    }
    save(): { cp: string } { return { cp: this.cpId }; }
    load(): void {}
    objectiveText(): string {
        return this.stage === 'crawl' ? 'Crawl beneath the house toward the stones.' : this.stage === 'stones' ? 'Cross the stones. Jump the gaps.' : this.stage === 'ritual' ? ['Hold the Father seal on the left.', 'Hold the Son seal ahead.', 'Hold the Holy Ghost seal on the right.'][this.rite] ?? '' : '';
    }
    collide(p: THREE.Vector3): void {
        const R = 0.35;
        // Inside the crawl maze the walls are solid: the player is pushed out of any wall block they touch.
        if (p.z > -9.5 && p.z < 9.5) {
            p.x = THREE.MathUtils.clamp(p.x, X6 - 3, X6 + 3);
            for (const w of this.mazeWalls) {
                if (p.x + R > w.minx && p.x - R < w.maxx && p.z + R > w.minz && p.z - R < w.maxz) {
                    // push out along the shallowest axis
                    const dl = p.x + R - w.minx, dr = w.maxx - (p.x - R), dd = p.z + R - w.minz, du = w.maxz - (p.z - R);
                    const m = Math.min(dl, dr, dd, du);
                    if (m === dl) p.x = w.minx - R; else if (m === dr) p.x = w.maxx + R; else if (m === dd) p.z = w.minz - R; else p.z = w.maxz + R;
                }
            }
        } else {
            p.x = THREE.MathUtils.clamp(p.x, X6 - (p.z > -21 ? 4.5 : 5.5), X6 + (p.z > -21 ? 4.5 : 5.5));
        }
        p.z = THREE.MathUtils.clamp(p.z, -37.4, 9.4);
    }
    groundAt(x: number, z: number): number {
        if (z >= -8 || z <= -20.5) return 0;
        for (let i = 0; i < 4; i++) if (Math.abs(x - X6 - Math.sin(i * 1.6) * 0.65) < 1.25 && Math.abs(z + 9.5 + i * 3) < 1.15) return 0;
        return -3;
    }
    echo(): { name: string; model: THREE.Group } { return { name: 'The Other One', model: this.entity.group }; }

    private startRitual(): void {
        this.stage = 'ritual'; this.cpId = 'd56_ritual'; this.duelT = 0;
        this.c.setForceCrouch(false); this.c.setAmbient(0.08);
        this.c.say('OLIVER', 'A battle for the soul. Father, Son, and Holy Ghost. No flame. No offering of flesh. Hold each seal until night lets go.', 9);
        this.c.objective(this.objectiveText()); this.c.checkpoint(this.cpId); this.c.track('ritual_duel_started');
    }
    private holdSeal(i: number): void {
        this.rite++; this.c.track('ritual_seal_held', { seal: ['father', 'son', 'holy_ghost'][i] });
        (this.seals[i].material as THREE.MeshBasicMaterial).color.setHex(0xffdc91);
        this.c.sfx.tone(174 * (i + 1), 1.2, 0.06); this.c.say('PROTAGONIST', ['In the name of the Father.', 'And of the Son.', 'And of the Holy Ghost. Let this soul go.'][i], 3.5);
        this.duelT = Math.max(0, this.duelT - 12);
        this.c.objective(this.objectiveText());
        if (this.rite === 3) this.sunrise();
    }
    private sunrise(): void {
        const c = this.c; this.stage = 'sunrise'; this.dawnT = 0; c.lock(true); c.objective(''); c.track('ritual_sunrise_started');
        c.setAmbient(0.015); this.moon.intensity = 0; c.sfx.tone(55, 2.2, 0.07); c.say('OLIVER', 'It is finished.', 2.8);
        c.after(4.3, () => { c.sfx.tone(261.6, 4, 0.055); c.sfx.tone(392, 4, 0.035); c.say('PROTAGONIST', 'Daylight. We finally got rid of it.', 4); });
        // Let relief settle, then interrupt it with one final deep, off-beat cry. Never a rapid white flash.
        c.after(8.8 + Math.random() * 1.5, () => { c.sfx.lastCry(); c.say('THE OTHER ONE', '[one last deep, breaking cry]', 2.5); c.track('ritual_last_cry'); });
        c.after(12.4, () => {
            this.entity.group.visible = false; c.say('PROTAGONIST', "I can't see. Oliver—", 3);
            c.fadeColor(c.reducedFlash() ? '#b7ab90' : '#fff2d1'); c.fadeTo(c.reducedFlash() ? 0.55 : 0.76, 1.5); c.track('ritual_blinded');
        });
        c.after(15, () => { c.setHead(0.28); c.setPitch(-0.85); c.sfx.thud(0.3); c.track('ritual_collapsed'); });
        c.after(17, () => { c.fadeColor('#000'); c.fadeTo(1, 1.5); });
        c.after(19.2, () => { this.stage = 'done'; c.track('chapter_days56_completed'); c.nextChapter('d7'); });
    }
    update(dt: number): void {
        this.t += dt;
        const c = this.c;
        if (this.stage === 'crawl' && c.p.z < -6.5) {
            this.stage = 'stones'; this.cpId = 'd56_stones'; c.setForceCrouch(false); c.objective(this.objectiveText()); c.checkpoint(this.cpId); c.track('stones_crossing_started');
        }
        if (this.stage === 'stones' && c.p.y < -1.35) { this.stage = 'done'; c.track('stones_crossing_failed'); c.nextChapter('stones_hall'); return; }
        if (this.stage === 'stones' && c.p.z < -21 && c.p.y > -0.2) this.startRitual();
        if (this.stage === 'ritual') {
            this.duelT += dt;
            const pressure = Math.min(1, this.duelT / 90);
            this.entity.group.position.z = -34 + pressure * 10;
            this.moon.intensity = 18 + (1 + Math.sin(this.t * 1.1)) * 7;
            if (this.duelT >= 90) { this.stage = 'done'; c.track('ritual_duel_lost'); c.capture(); return; }
            this.nextHum -= dt;
            if (this.nextHum <= 0) { this.nextHum = 7; c.sfx.tone(48, 2, 0.045, 0, 'sawtooth'); }
        }
        if (this.stage === 'sunrise') {
            this.dawnT += dt;
            const k = THREE.MathUtils.clamp((this.dawnT - 2) / 9, 0, 1);
            // Two irregular brownouts, closer to an unstable lantern than a strobe.
            const dip = !c.reducedFlash() && ((this.dawnT > 5.1 && this.dawnT < 5.45) || (this.dawnT > 7.7 && this.dawnT < 8.15)) ? 0.64 : 1;
            this.sun.intensity = 160 * k * dip; c.setAmbient(0.1 + 2 * k * dip);
            (this.sunDisk.material as THREE.MeshBasicMaterial).opacity = 0.14 + 0.72 * k;
            this.moonDisk.scale.setScalar(Math.max(0.02, 1 - k));
            this.entity.group.scale.setScalar(0.7 * (1 - Math.max(0, k - 0.7) * 1.7));
            const scene = this.group.parent as THREE.Scene;
            this.sky.set(0x171519).lerp(new THREE.Color(0xab956e), k * 0.6);
            if (scene.fog instanceof THREE.FogExp2) { scene.fog.color.copy(this.sky); scene.fog.density = 0.035; }
            (scene.background as THREE.Color).copy(this.sky);
        }
        this.haze.forEach((m, i) => { m.position.x = X6 + Math.sin(this.t * 0.12 + i) * 0.7; });
        // the hanging friends drift gently up and down in the void
        for (const h of this.hanging) h.g.position.y = h.baseY + Math.sin(this.t * 0.8 + h.phase) * 0.12;
        this.entity.arms.forEach((arm, i) => { arm.rotation.x = -0.45 + Math.sin(this.t * 0.7 + i) * 0.18; });
    }
}
