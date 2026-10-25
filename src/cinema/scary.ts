/**
 * Shared "make it scarier" pass for the existing procedural creatures.
 * Adds features without replacing a creature's shape or its scripted motion:
 *   - eyes that glow through fog and darkness, with uneven or one-eyed blinks
 *   - teeth: a jagged alternating row
 *   - long hanging arms with thin fingers, or extra jointed legs
 *   - twitch: sudden snaps, sometimes held in a wrong head-cocked pose
 *   - breathing: a slow, uneven swell
 *   - dropout: the creature briefly vanishes, as if the tape skipped
 *
 * Motion lives on a private pivot inside each creature group, so it never
 * fights with the chapter's own position, rotation or scale animation.
 */
import * as THREE from 'three';
import type { Env } from './director.ts';
import type { CreatureId, CreatureTrigger } from './audio.ts';
import { store } from '../state/store.ts';
import { makeFleshMaterial, skinCreature } from './creatureSkin.ts';

type V3 = [number, number, number];

export interface EyeSpec {
    /** Midpoint between the eyes, in the creature's local space. */
    at: V3;
    /** Offset from one eye to the other. */
    spread: V3;
    size?: number;
    color?: number;
    /** Blinking. Default true. Set false for a fixed, unblinking stare. */
    blink?: boolean;
    /** Attach to a moving part, such as a head that turns. */
    parent?: THREE.Object3D;
}

export interface TeethSpec {
    at: V3;
    spread: V3;
    count?: number;
    size?: number;
    parent?: THREE.Object3D;
}

export interface TerrorOptions {
    /** Sound identity is internal only; unidentified speakers remain ??? on screen. */
    creature?: CreatureId;
    eyes?: EyeSpec | EyeSpec[];
    teeth?: TeethSpec | TeethSpec[];
    /** Long hanging arms ending in thin fingers. */
    arms?: { shoulderY: number; width: number; length: number; thickness?: number; z?: number; color?: number };
    /** Extra jointed legs radiating from one point. */
    legs?: { at: V3; count: number; length: number; thickness?: number; color?: number };
    /** Twitch strength, 0 to 1. */
    twitch?: number;
    /** Breathing amplitude, for example 0.03. */
    breathe?: number;
    /** Brief tape-skip disappearances. */
    dropout?: boolean;
}

const v = (a: V3) => new THREE.Vector3(a[0], a[1], a[2]);
const lum = (c: THREE.Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

/** Apply the horror pass to a creature group or a single mesh. */
export function terrify(env: Env, root: THREE.Object3D, o: TerrorOptions) {
    // Group roots receive a private pivot. A mesh root is posed by its chapter,
    // so it only receives attached features and no added body motion.
    root.userData.creature = o.creature ?? 'creature';
    const isGroup = !(root as THREE.Mesh).isMesh;
    let pivot: THREE.Object3D = root;
    if (isGroup) {
        const p = new THREE.Group();
        [...root.children].forEach((c) => p.add(c));
        root.add(p);
        pivot = p;
    }

    const part = <T extends THREE.Object3D>(o: T): T => { o.traverse((c) => { c.userData.creaturePart = true; }); return o; };

    // ---- eyes: a wet dark socket, a glowing iris pushed into HDR so the bloom haloes it, a pin of light ----
    const eyes: { iris: THREE.Mesh; mat: THREE.MeshBasicMaterial; base: THREE.Color; blink: boolean }[] = [];
    const socketM = new THREE.MeshStandardMaterial({ color: 0x060404, roughness: 0.25 });
    socketM.userData.look = 0;
    const pinM = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });
    for (const e of ([] as EyeSpec[]).concat(o.eyes ?? [])) {
        const size = e.size ?? 0.08;
        const raw = new THREE.Color(e.color ?? 0xff2a14);
        // Black eyes stay black (a void reads scarier than a light). Coloured eyes glow.
        const base = lum(raw) < 0.02 ? raw : raw.clone().multiplyScalar(2.6);
        const mid = v(e.at);
        const half = v(e.spread).multiplyScalar(0.5);
        for (const side of [-1, 1]) {
            const pos = mid.clone().addScaledVector(half, side);
            const socket = part(new THREE.Mesh(new THREE.SphereGeometry(size * 1.5, 16, 12), socketM));
            socket.position.copy(pos);
            socket.scale.z = 0.5;
            const mat = new THREE.MeshBasicMaterial({ color: base.clone(), fog: false });
            const iris = part(new THREE.Mesh(new THREE.SphereGeometry(size, 16, 12), mat));
            iris.position.copy(pos);
            // a slit pupil, slightly off-centre, gives the stare a direction
            const pupil = part(new THREE.Mesh(new THREE.SphereGeometry(size * 0.55, 10, 8), new THREE.MeshBasicMaterial({ color: 0x000000 })));
            pupil.scale.set(0.28, 1, 0.4);
            pupil.position.set(0, 0, size * 0.72);
            iris.add(pupil);
            const pin = part(new THREE.Mesh(new THREE.SphereGeometry(size * 0.2, 6, 5), pinM));
            pin.position.set(size * 0.3, size * 0.3, size * 0.88);
            iris.add(pin);
            (e.parent ?? pivot).add(socket, iris);
            eyes.push({ iris, mat, base, blink: e.blink !== false });
        }
    }

    // ---- teeth: uneven, yellowed, tilted, in a dark gum line ----
    const toothM = new THREE.MeshStandardMaterial({ color: 0xcfc3a0, roughness: 0.32, emissive: 0x16130c });
    toothM.userData.look = 0;
    const gumM = makeFleshMaterial(0x2a0c0c, { amp: 0, roughness: 0.3, veins: 0.4 });
    let tseed = 11;
    const trnd = () => ((tseed = (tseed * 16807) % 2147483647) / 2147483647);
    for (const t of ([] as TeethSpec[]).concat(o.teeth ?? [])) {
        const count = t.count ?? 8;
        const size = t.size ?? 0.12;
        const mid = v(t.at);
        const spread = v(t.spread);
        const parent = t.parent ?? pivot;
        const gum = part(new THREE.Mesh(new THREE.CapsuleGeometry(size * 0.28, Math.max(0.01, spread.length()), 4, 10), gumM));
        gum.position.copy(mid);
        gum.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), spread.clone().normalize());
        gum.scale.set(1, 1, 0.6);
        parent.add(gum);
        for (let i = 0; i < count; i++) {
            const f = count === 1 ? 0 : i / (count - 1) - 0.5;
            const len = size * (0.75 + trnd() * 0.7);
            const tooth = part(new THREE.Mesh(new THREE.ConeGeometry(size * (0.22 + trnd() * 0.14), len, 8, 2), toothM));
            tooth.position.copy(mid).addScaledVector(spread, f);
            const down = i % 2 === 0;
            tooth.rotation.set(down ? Math.PI : 0, trnd() * 0.6, (trnd() - 0.5) * 0.5);
            tooth.position.y += down ? len * 0.3 : -len * 0.3;
            tooth.position.z += size * 0.08;
            parent.add(tooth);
        }
    }

    // ---- long arms: shoulder, elbow, wrist, a narrow palm and jointed, curling fingers ----
    type ArmRig = { arm: THREE.Group; elbow: THREE.Group; fingers: THREE.Group[] };
    const armRigs: ArmRig[] = [];
    if (o.arms) {
        const a = o.arms;
        const th = a.thickness ?? 0.06;
        const m = makeFleshMaterial(new THREE.Color(a.color ?? 0x050505).addScalar(0.008), { amp: th * 0.25, roughness: 0.5 });
        const upperLen = a.length * 0.44, foreLen = a.length * 0.44, handLen = a.length * 0.12;
        for (const side of [-1, 1]) {
            const arm = new THREE.Group();
            arm.position.set(side * a.width, a.shoulderY, a.z ?? 0);
            const shoulder = new THREE.Mesh(new THREE.SphereGeometry(th * 1.5, 14, 10), m);
            const upper = new THREE.Mesh(new THREE.CylinderGeometry(th * 1.1, th * 0.8, upperLen, 14, 8), m);
            upper.position.y = -upperLen / 2;
            const elbow = new THREE.Group();
            elbow.position.y = -upperLen;
            const knob = new THREE.Mesh(new THREE.SphereGeometry(th * 1.05, 12, 8), m);
            const fore = new THREE.Mesh(new THREE.CylinderGeometry(th * 0.85, th * 0.55, foreLen, 14, 8), m);
            fore.position.y = -foreLen / 2;
            const wrist = new THREE.Group();
            wrist.position.y = -foreLen;
            const palm = new THREE.Mesh(new THREE.SphereGeometry(th * 1.4, 12, 8), m);
            palm.scale.set(1.1, 1.6, 0.55);
            palm.position.y = -th * 1.2;
            wrist.add(palm);
            const fingers: THREE.Group[] = [];
            for (let f = 0; f < 5; f++) {
                const thumb = f === 4;
                let parent: THREE.Object3D = wrist;
                const root = new THREE.Group();
                root.position.set(thumb ? side * th * 1.4 : (f - 1.5) * th * 0.75, thumb ? -th * 1.2 : -th * 2.6, thumb ? th * 0.5 : 0);
                root.rotation.z = thumb ? side * 0.9 : (f - 1.5) * 0.09;
                wrist.add(root);
                fingers.push(root);
                parent = root;
                const segs = thumb ? 2 : 3;
                for (let k = 0; k < segs; k++) {
                    const len = handLen * (thumb ? 0.45 : 0.62) * (1 - k * 0.2) * (f === 1 || f === 2 ? 1.12 : 1);
                    const r = th * 0.32 * (1 - k * 0.22);
                    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r * 0.85, r, len, 8, 2), m);
                    seg.position.y = -len / 2;
                    const joint = new THREE.Group();
                    joint.position.y = -len;
                    const n = new THREE.Group();
                    n.add(seg, joint);
                    parent.add(n);
                    if (k > 0) n.rotation.x = 0.18; // knuckles curl in a little at rest
                    parent = joint;
                    if (k === segs - 1) {
                        const nail = new THREE.Mesh(new THREE.ConeGeometry(r * 0.7, len * 0.55, 8), toothM);
                        nail.rotation.x = Math.PI;
                        nail.position.y = -len * 0.2;
                        joint.add(nail);
                    }
                }
            }
            elbow.add(knob, fore, wrist);
            arm.add(shoulder, upper, elbow);
            part(arm);
            pivot.add(arm);
            armRigs.push({ arm, elbow, fingers });
        }
    }

    // ---- extra jointed legs: thigh, swollen knee, a long shin ending in a hooked claw ----
    const legRigs: THREE.Group[] = [];
    if (o.legs) {
        const l = o.legs;
        const th = l.thickness ?? 0.04;
        const m = makeFleshMaterial(new THREE.Color(l.color ?? 0x080404).addScalar(0.008), { amp: th * 0.2, roughness: 0.5 });
        const upperLen = l.length * 0.5;
        const lowerLen = l.length * 0.65;
        const lift = 1.0;
        for (let i = 0; i < l.count; i++) {
            const leg = new THREE.Group();
            leg.position.copy(v(l.at));
            leg.rotation.y = (i / l.count) * Math.PI * 2 + 0.3;
            const upper = new THREE.Mesh(new THREE.CylinderGeometry(th * 0.9, th * 1.2, upperLen, 12, 6), m);
            upper.geometry.translate(0, upperLen / 2, 0);
            upper.rotation.z = -lift;
            const knee = new THREE.Group();
            knee.position.set(Math.sin(lift) * upperLen, Math.cos(lift) * upperLen, 0);
            const kneeKnob = new THREE.Mesh(new THREE.SphereGeometry(th * 1.35, 12, 8), m);
            const lower = new THREE.Mesh(new THREE.CylinderGeometry(th, th * 0.3, lowerLen, 12, 8), m);
            lower.geometry.translate(0, -lowerLen / 2, 0);
            lower.rotation.z = -0.35;
            const claw = new THREE.Mesh(new THREE.ConeGeometry(th * 0.35, th * 3, 8), toothM);
            claw.position.y = -lowerLen - th;
            claw.rotation.x = Math.PI + 0.4;
            lower.add(claw);
            knee.add(kneeKnob, lower);
            leg.add(upper, knee);
            part(leg);
            pivot.add(leg);
            legRigs.push(leg);
        }
    }

    // ---- the body itself: lit flesh, smoother primitives, a slow writhe, a cold rim ----
    const syncSkin = skinCreature(root);

    // ---- motion ----
    const twitch = o.twitch ?? 0;
    const breathe = o.breathe ?? 0;
    let nextTwitch = 1 + Math.random() * 3;
    let holdUntil = 0;
    const off = { rx: 0, ry: 0, rz: 0, px: 0 };
    let nextBlink = 2 + Math.random() * 4;
    let blinkUntil = 0;
    let oneEyed = false;
    let dropUntil = 0;
    let wasVisible = false;
    const world = new THREE.Vector3();
    const sound = (trigger: CreatureTrigger) => {
        if (!o.creature || env.fx.fade > 0.85) return;
        root.getWorldPosition(world);
        const dx = world.x - env.rig.pos.x, dz = world.z - env.rig.pos.z;
        const pan = (dx * Math.cos(env.rig.yaw) - dz * Math.sin(env.rig.yaw)) / Math.max(1, Math.hypot(dx, dz));
        env.audio.creatureSound(o.creature, world.distanceTo(env.rig.pos), trigger, pan);
    };
    env.onFrame.push((dt, t) => {
        let shown = root.visible;
        for (let parent = root.parent; parent && shown; parent = parent.parent) shown = parent.visible;
        if (!shown) { wasVisible = false; return; }
        syncSkin();
        if (!wasVisible) {
            nextTwitch = t + 2 + Math.random() * 3;
            nextBlink = t + 3 + Math.random() * 4;
            blinkUntil = dropUntil = holdUntil = 0;
            wasVisible = true;
        }
        // Accessibility changes visuals only. Discrete sound timing continues unchanged.
        const reduced = store.get().reducedMotion;
        // eyes: unsteady glow and blinking, sometimes only one eye
        if (eyes.length) {
            if (t > nextBlink) {
                blinkUntil = t + 0.12;
                oneEyed = Math.random() < 0.3;
                nextBlink = t + 2.5 + Math.random() * 5;
                if (eyes.some(e => e.blink)) sound('blink');
            }
            const glow = 0.78 + Math.sin(t * 7.3) * 0.08 + (Math.random() < 0.04 ? 0.3 : 0);
            eyes.forEach((e, i) => {
                e.mat.color.copy(e.base).multiplyScalar(reduced ? 0.9 : Math.min(1.3, glow));
                const shut = e.blink && t < blinkUntil && (!oneEyed || i % 2 === 0);
                e.iris.scale.y = !reduced && shut ? 0.08 : 1;
            });
        }
        if (!isGroup) return;
        // twitch: sharp snaps, sometimes held in a wrong pose
        if (twitch > 0) {
            if (t > nextTwitch) {
                sound('twitch');
                const s = twitch;
                off.rz = (Math.random() - 0.5) * 0.5 * s;
                off.rx = (Math.random() - 0.5) * 0.25 * s;
                off.ry = (Math.random() - 0.5) * 0.6 * s;
                off.px = (Math.random() - 0.5) * 0.16 * s;
                const held = Math.random() < 0.25;
                holdUntil = t + (held ? 0.6 + Math.random() * 0.8 : 0.06 + Math.random() * 0.1);
                nextTwitch = t + (held ? 2.5 : 0.9) + Math.random() * (4 / (0.5 + s));
            }
            if (t > holdUntil) {
                off.rx = off.ry = off.rz = off.px = 0;
            }
            pivot.rotation.set(reduced ? 0 : off.rx, reduced ? 0 : off.ry, reduced ? 0 : off.rz);
            pivot.position.x = reduced ? 0 : off.px;
        }
        // breathing: slow, slightly uneven swell
        if (breathe > 0) {
            const s = reduced ? 0 : Math.sin(t * 1.6) + Math.sin(t * 2.9) * 0.3;
            pivot.scale.set(1 - s * breathe * 0.4, 1 + s * breathe, 1 - s * breathe * 0.4);
        }
        // limbs: idle sway on arms, constant skitter on legs
        armRigs.forEach((r, i) => {
            r.arm.rotation.z = reduced ? 0 : Math.sin(t * 0.7 + i * 2) * 0.06 + off.rz * 0.6;
            r.arm.rotation.x = reduced ? 0 : Math.sin(t * 0.5 + i) * 0.05;
            // the elbow hangs slightly bent and drifts; a twitch snaps it
            r.elbow.rotation.x = reduced ? 0.15 : 0.15 + Math.sin(t * 0.4 + i * 1.3) * 0.12 + Math.abs(off.rx) * 1.5;
            // fingers flex one after another, never quite together
            r.fingers.forEach((f, k) => { f.rotation.x = reduced ? 0.1 : 0.1 + (Math.sin(t * 1.1 + k * 0.7 + i) * 0.5 + 0.5) * 0.35; });
        });
        legRigs.forEach((l, i) => { l.rotation.x = reduced ? 0 : Math.sin(t * 13 + i * 1.7) * 0.12; });
        // dropout: the tape skips past the creature for a frame or two
        if (o.dropout) {
            if (t > dropUntil && Math.random() < dt * 0.12) {
                dropUntil = t + 0.05 + Math.random() * 0.05;
                sound('dropout');
            }
            pivot.visible = reduced || t > dropUntil;
        }
    });
    return { pivot, eyes: eyes.map((e) => e.iris) };
}
