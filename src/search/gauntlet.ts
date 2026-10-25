import * as THREE from 'three';
import type { Sfx } from './audio.ts';
import type { CleaverbackRig } from './cleaverback.ts';
import { pathX } from './world.ts';
import { buildSkitter, type SkitterRig } from './survivor.ts';

type Kind = 'jump' | 'duck' | 'swat';
/** The auto-run ends here; the last stretch to the bunker is normal movement. */
export const GAUNTLET_END_Z = -179;
const MAX_GAP = 22;

export interface GHost {
    parent: THREE.Object3D;
    p: THREE.Vector3;
    rig: CleaverbackRig;
    sfx: Sfx;
    root: HTMLElement;
    say(who: string, text: string, dur?: number): void;
    track(name: string, props?: Record<string, unknown>): void;
    objective(text: string): void;
    checkpoint(): void;
    capture(): void;
    shake(v: number): void;
    setHead(h: number | null): void;
    jumpPhysics(): void;
    finished(gap: number): void;
    flash(): void;
}

interface Ob { z: number; kind: Kind; done: boolean; label: string; cp: boolean }
interface Critter { rig: SkitterRig; ob: Ob; spawned: boolean; state: 'idle' | 'run' | 'lunge' | 'flung'; x: number; z: number; y: number; vx: number; vy: number; vz: number; t: number; side: number }

const DEFS: [number, Kind, string, boolean][] = [
    [-88, 'duck', 'LOW BRANCH — DUCK', false],
    [-98, 'jump', 'HOLE — JUMP', false],
    [-108, 'duck', 'LOW BRANCH — DUCK', false],
    [-120, 'jump', 'LOG — JUMP', true],
    [-131, 'jump', 'HOLE — JUMP', false],
    [-143, 'swat', 'IT IS LEAPING AT YOU — SWAT', false],
    [-153, 'duck', 'LOW BRANCH — DUCK', true],
    [-162, 'jump', 'HOLE — JUMP', false],
    [-171, 'swat', 'IT IS LEAPING AT YOU — SWAT', false],
];

/** The long run to the bunker: the player auto-runs; tap JUMP / DUCK / SWAT to clear what is on the path. */
export class Gauntlet {
    active = false;
    private obs: Ob[] = DEFS.map(([z, kind, label, cp]) => ({ z, kind, label, cp, done: false }));
    private world = new THREE.Group();
    private critters: Critter[] = [];
    private gap = 20;
    private gapTarget = 20;
    private stumbles = 0;
    private act: Kind | 'none' = 'none';
    private actT = 0;
    private slow = 0;
    private t = 0;
    private phase = 0;
    private stepT = 0;
    private ui!: HTMLElement;
    private prompt!: HTMLElement;
    private btns: Record<Kind, HTMLElement> = {} as Record<Kind, HTMLElement>;

    constructor(private h: GHost) {
        const wood = new THREE.MeshStandardMaterial({ color: 0x3a2a1c, roughness: 1 });
        for (const ob of this.obs) {
            const x = pathX(ob.z);
            if (ob.kind === 'duck') {
                const g = new THREE.Group();
                const bar = new THREE.Mesh(new THREE.BoxGeometry(8, 0.28, 0.35), wood);
                bar.position.y = 1.42; g.add(bar);
                for (const s of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.28, 3.2, 6), wood); post.position.set(s * 4.2, 1.6, 0); g.add(post); }
                for (let i = 0; i < 9; i++) { const twig = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.55, 4), wood); twig.rotation.x = Math.PI; twig.position.set(-3.2 + i * 0.8, 1.05, 0); g.add(twig); }
                g.position.set(x, 0, ob.z);
                this.world.add(g);
            } else if (ob.kind === 'jump' && ob.label.startsWith('HOLE')) {
                const g = new THREE.Group();
                const pit = new THREE.Mesh(new THREE.CylinderGeometry(2.3, 2.3, 0.04, 18), new THREE.MeshBasicMaterial({ color: 0x020203 }));
                pit.position.y = 0.04; g.add(pit);
                const rim = new THREE.Mesh(new THREE.RingGeometry(2.3, 2.75, 18), new THREE.MeshStandardMaterial({ color: 0x3a2c20, roughness: 1, side: THREE.DoubleSide }));
                rim.rotation.x = -Math.PI / 2; rim.position.y = 0.05; g.add(rim);
                g.scale.z = 0.5;
                g.position.set(x, 0, ob.z);
                this.world.add(g);
            }
            if (ob.kind === 'swat') {
                const rig = buildSkitter();
                rig.group.visible = false;
                this.world.add(rig.group);
                this.critters.push({ rig, ob, spawned: false, state: 'idle', x: 0, z: 0, y: 0, vx: 0, vy: 0, vz: 0, t: 0, side: 1 });
            }
        }
        this.world.visible = false;
        h.parent.add(this.world);
        this.mountUi();
    }

    get speedFactor(): number { return 0.5 + 0.5 * (1 - Math.min(1, this.slow / 1.1)); }
    heading(z: number): number { return Math.atan2(0.315 * Math.cos(z * 0.045), 1); }

    private mountUi(): void {
        const mk = (css: string, parent: HTMLElement, text = ''): HTMLElement => { const e = document.createElement('div'); e.style.cssText = css; e.textContent = text; parent.appendChild(e); return e; };
        this.ui = mk('position:absolute;inset:0;display:none;pointer-events:none;z-index:5', this.h.root);
        this.prompt = mk('position:absolute;left:50%;top:24%;transform:translateX(-50%);font-size:clamp(18px,4vw,32px);letter-spacing:3px;font-weight:bold;color:#ffd27a;text-shadow:0 0 8px #000,0 0 18px #000;text-align:center;width:90%', this.ui);
        const button = (kind: Kind, label: string, pos: string, size: number) => {
            const b = mk(`position:absolute;${pos};width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,0.16);border:3px solid rgba(255,255,255,0.55);display:flex;align-items:center;justify-content:center;font-size:${size > 100 ? 20 : 16}px;font-weight:bold;letter-spacing:2px;pointer-events:auto;touch-action:none;user-select:none`, this.ui, label);
            b.addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); this.press(kind); });
            this.btns[kind] = b;
        };
        const SB = 'env(safe-area-inset-bottom,0px)';
        button('duck', 'DUCK', `left:18px;bottom:calc(190px + ${SB})`, 104);
        button('jump', 'JUMP', `right:18px;bottom:calc(190px + ${SB})`, 104);
        button('swat', 'SWAT', `left:50%;margin-left:-45px;bottom:calc(250px + ${SB})`, 90);
    }

    /** Button / key press. Records the track so the first one is easy to tell apart from spam. */
    press(kind: Kind): void {
        if (!this.active) return;
        this.act = kind;
        if (kind === 'jump') { this.actT = 0.9; this.h.jumpPhysics(); }
        else if (kind === 'duck') { this.actT = 0.85; this.h.setHead(0.82); this.h.sfx.noise(0.18, 700, 0.8, 0.05, 0, 'lowpass'); }
        else { this.actT = 0.7; this.h.sfx.noise(0.1, 1100, 1, 0.07, 0, 'bandpass'); }
    }

    start(resume: boolean): void {
        const h = this.h;
        this.active = true;
        this.t = 0; this.stumbles = 0; this.act = 'none'; this.actT = 0; this.slow = 0; this.gap = 20; this.gapTarget = 20;
        for (const o of this.obs) o.done = h.p.z <= o.z + 0.5;
        for (const c of this.critters) { c.spawned = c.ob.done; c.state = 'idle'; c.rig.group.visible = false; }
        h.rig.group.visible = true;
        this.world.visible = true;
        this.ui.style.display = 'block';
        h.objective('RUN. Tap JUMP, DUCK and SWAT to clear the path. The bunker is ahead.');
        h.checkpoint();
        h.track('gauntlet_started', { resumed: resume });
    }

    stop(): void {
        this.active = false;
        this.ui.style.display = 'none';
        this.world.visible = false;
        this.h.setHead(null);
        for (const c of this.critters) c.rig.group.visible = false;
    }

    private stumble(reason: string): void {
        const h = this.h;
        this.stumbles++;
        this.gapTarget -= 5.5;
        if (this.stumbles >= 4) this.gapTarget = 0;
        this.slow = 1.1;
        h.shake(1);
        h.sfx.thud(0.5);
        h.sfx.noise(0.3, 300, 1, 0.12, 0, 'lowpass');
        h.say('PROTAGONIST', ['Ugh— keep moving!', 'It is right behind me!', 'Get up. GET UP.', 'Too slow...'][Math.min(3, this.stumbles - 1)], 1.6);
        h.track('gauntlet_stumble', { reason, count: this.stumbles });
    }

    private clear(ob: Ob, how: string): void {
        this.gapTarget = Math.min(MAX_GAP, this.gapTarget + 1.2);
        this.h.track('gauntlet_cleared', { kind: ob.kind, how });
        if (ob.cp) this.h.checkpoint();
    }

    private resolve(ob: Ob): void {
        const p = this.h.p;
        if (ob.kind === 'jump') {
            if (p.y > 0.18) { this.h.sfx.step('dirt', 1.4); this.clear(ob, 'jump'); } else this.stumble('jump_missed');
        } else if (ob.kind === 'duck') {
            if (this.act === 'duck' && this.actT > 0) { this.h.sfx.noise(0.25, 900, 0.6, 0.06, 0, 'lowpass'); this.clear(ob, 'duck'); } else this.stumble('duck_missed');
        }
    }

    private updateCritters(dt: number): void {
        const h = this.h, p = h.p;
        for (const c of this.critters) {
            const g = c.rig.group;
            if (!c.spawned && !c.ob.done && p.z <= c.ob.z + 19) {
                c.spawned = true; c.state = 'run'; c.t = 0;
                c.side = Math.random() < 0.5 ? -1 : 1;
                c.z = p.z - 21; c.x = pathX(c.z) + c.side * 3.6; c.y = 0;
                g.visible = true;
                h.say('PROTAGONIST', 'Something small... in the trees. It is coming fast!', 2.4);
                h.sfx.tone(1200, 0.2, 0.06, c.side * 0.8, 'square', 700);
            }
            if (c.state === 'idle') continue;
            c.t += dt;
            if (c.state === 'run' || c.state === 'lunge') {
                const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz) || 1;
                if (c.state === 'run' && d < 4.6) { c.state = 'lunge'; c.t = 0; h.sfx.tone(900, 0.3, 0.09, c.side * 0.5, 'sawtooth', 1500); }
                const sp = c.state === 'lunge' ? 10 : 4.2;
                c.x += (dx / d) * sp * dt; c.z += (dz / d) * sp * dt;
                c.y = c.state === 'lunge' ? 1.25 * Math.sin(Math.min(1, c.t / 0.5) * Math.PI * 0.85) : Math.abs(Math.sin(c.t * 12)) * 0.35;
                g.rotation.y = Math.atan2(-dx, -dz);
                c.rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(c.t * 22 + i * 1.7) * 0.9; });
                c.rig.jaw.scale.y = c.state === 'lunge' ? 3 : 1;
                if (this.act === 'swat' && this.actT > 0 && d < 7.5) {
                    c.state = 'flung'; c.t = 0; c.vx = -c.side * 9; c.vz = 2; c.vy = 5;
                    c.ob.done = true; this.gapTarget = Math.min(MAX_GAP, this.gapTarget + 1.5);
                    h.sfx.tone(1700, 0.25, 0.1, c.side, 'square', 300); h.sfx.thud(0.25);
                    h.track('gauntlet_critter_swatted'); h.say('PROTAGONIST', 'Get OFF!', 1.4);
                } else if (d < 1.05) {
                    c.state = 'flung'; c.t = 0; c.vx = c.side * 6; c.vz = 3; c.vy = 4;
                    c.ob.done = true; this.stumble('critter_bite'); h.flash();
                }
            } else {
                c.vy -= 18 * dt;
                c.x += c.vx * dt; c.z += c.vz * dt; c.y = Math.max(0, c.y + c.vy * dt);
                g.rotation.z += dt * 14; g.rotation.x += dt * 9;
                if (c.t > 0.9) { c.state = 'idle'; g.visible = false; g.rotation.set(0, 0, 0); }
            }
            g.position.set(c.x, c.y, c.z);
        }
    }

    update(dt: number): void {
        if (!this.active) return;
        const h = this.h, p = h.p, rig = h.rig;
        this.t += dt;
        this.slow = Math.max(0, this.slow - dt);
        if (this.actT > 0) {
            this.actT -= dt;
            if (this.actT <= 0) { if (this.act === 'duck') h.setHead(null); this.act = 'none'; }
        }
        // the creature closes in smoothly
        const d = this.gapTarget - this.gap;
        this.gap += Math.sign(d) * Math.min(Math.abs(d), 7 * dt);
        const cz = p.z + this.gap;
        rig.group.position.set(pathX(cz) + Math.sin(this.t * 1.4) * 1.2, 0, cz);
        rig.group.rotation.y = 0;
        this.phase += dt * 11;
        rig.arms.forEach((a, i) => { a.rotation.x = Math.sin(this.phase + i * 1.6) * 0.7 - 0.6; });
        rig.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.phase + i * Math.PI) * 0.7; });
        rig.torso.position.y = 2.2 + Math.abs(Math.sin(this.phase)) * 0.12;
        rig.jawL.rotation.z = 0.4; rig.jawR.rotation.z = -0.4;
        this.stepT -= dt;
        if (this.stepT <= 0) {
            this.stepT = 0.38;
            h.sfx.thud(0.08 + 0.3 * Math.max(0, 1 - this.gap / MAX_GAP), 0);
            h.sfx.tone(55, 0.22, 0.12 * Math.max(0.2, 1 - this.gap / MAX_GAP), 0, 'sine', 40);
        }
        for (const ob of this.obs) if (!ob.done && ob.kind !== 'swat' && p.z <= ob.z) { ob.done = true; this.resolve(ob); }
        this.updateCritters(dt);
        for (const c of this.critters) if (!c.ob.done && c.spawned && c.state === 'idle') c.ob.done = true;
        // prompts
        let text = '';
        let want: Kind | null = null;
        const live = this.critters.find((c) => c.state === 'run' || c.state === 'lunge');
        if (live) { text = 'SWAT IT!  (E / tap)'; want = 'swat'; }
        else {
            const next = this.obs.find((o) => !o.done && o.kind !== 'swat');
            if (next && p.z - next.z < 22) { text = next.label; want = next.kind; }
        }
        this.prompt.textContent = text;
        (Object.keys(this.btns) as Kind[]).forEach((k) => {
            const on = k === want;
            this.btns[k].style.background = on ? 'rgba(255,210,122,0.45)' : 'rgba(255,255,255,0.16)';
            this.btns[k].style.borderColor = on ? '#ffd27a' : 'rgba(255,255,255,0.55)';
            this.btns[k].style.transform = on ? 'scale(1.1)' : 'scale(1)';
        });
        if (this.gap <= 2.2) { this.stop(); h.capture(); return; }
        if (p.z <= GAUNTLET_END_Z) {
            const gap = this.gap;
            this.stop();
            h.track('gauntlet_completed', { stumbles: this.stumbles });
            h.finished(gap);
        }
    }
}
