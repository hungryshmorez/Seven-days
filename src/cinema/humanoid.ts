/**
 * Procedural people. One builder for every human in the recordings (the
 * friends, figures in doorways), replacing box torsos and ball heads with a
 * proportioned body: shaped torso, jointed arms and legs, hands, a face with
 * brows, nose, ears and eyes that blink, and hair. Everything is primitives, so
 * it costs no downloads and matches the rest of the footage.
 *
 * Convention: the figure faces -Z (the way chapters already placed props in
 * front of their old box people). Feet on y = 0 standing; seated on a 0.5 m seat.
 * Optional idle life (breathing, small head turns, blinks) runs via `animate`.
 */
import * as THREE from 'three';
import type { Env } from './director.ts';
import { store } from '../state/store.ts';

export interface HumanOptions {
    pose?: 'standing' | 'seated';
    /** Overall scale; 1 ≈ 1.75 m. */
    height?: number;
    /** 0 = slight, 1 = broad. */
    build?: number;
    skin?: number;
    top?: number;
    bottom?: number;
    shoes?: number;
    hair?: { color: number; style: 'short' | 'long' | 'bun' | 'bald' | 'cap' };
    /** Sleeves cover the arms (top colour); otherwise forearms show skin. */
    longSleeves?: boolean;
    /** No shoes (a patient in bed). */
    barefoot?: boolean;
}

export interface Human {
    group: THREE.Group;
    head: THREE.Group;
    chest: THREE.Mesh;
    arms: { shoulder: THREE.Group; elbow: THREE.Group }[];
    eyes: THREE.Mesh[];
}

const fabric = (color: number) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.92 });
    m.userData.look = 0.45; // light wear, not wall grime
    return m;
};
const skinMat = (color: number) => {
    const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55, emissive: new THREE.Color(color).multiplyScalar(0.03) });
    m.userData.look = 0;
    return m;
};

/** A limb segment from `a` to `b` (local), radius tapering r0 → r1, with a rounded joint at `a`. */
function limb(parent: THREE.Object3D, len: number, r0: number, r1: number, mat: THREE.Material) {
    const seg = new THREE.Mesh(new THREE.CylinderGeometry(r1, r0, len, 14, 3), mat);
    seg.position.y = -len / 2;
    const joint = new THREE.Mesh(new THREE.SphereGeometry(r0 * 1.02, 14, 10), mat);
    parent.add(seg, joint);
    const end = new THREE.Group();
    end.position.y = -len;
    parent.add(end);
    return end;
}

export function buildHumanoid(o: HumanOptions = {}): Human {
    const s = o.height ?? 1;
    const b = o.build ?? 0.5;
    const seated = o.pose === 'seated';
    const skin = skinMat(o.skin ?? 0xc8a080);
    const top = fabric(o.top ?? 0x4a4a52);
    const bottom = fabric(o.bottom ?? 0x2a2c34);
    const shoeM = new THREE.MeshStandardMaterial({ color: o.shoes ?? 0x141210, roughness: 0.5 });
    const group = new THREE.Group();
    const body = new THREE.Group();
    body.scale.setScalar(s);
    group.add(body);
    const w = 0.9 + b * 0.25; // shoulder/hip width factor

    // hips: standing 0.95 m; seated so the head lands where the old box people had theirs
    const hipY = seated ? 0.58 : 0.95;
    const pelvis = new THREE.Mesh(new THREE.SphereGeometry(0.15, 18, 12), bottom);
    pelvis.scale.set(1.15 * w, 0.75, 0.85);
    pelvis.position.y = hipY;
    body.add(pelvis);

    // torso: a lathed profile (waist → chest → shoulders), flattened front-to-back
    const prof = [
        [0.0, 0.0], [0.135, 0.0], [0.14, 0.08], [0.128, 0.18], [0.145, 0.3], [0.165, 0.4], [0.17, 0.46], [0.13, 0.52], [0.06, 0.56], [0.0, 0.565],
    ].map(([r, y]) => new THREE.Vector2(r * w, y));
    const chest = new THREE.Mesh(new THREE.LatheGeometry(prof, 22), top);
    chest.scale.z = 0.62;
    chest.position.y = hipY;
    body.add(chest);
    const shoulderY = hipY + 0.47;

    // neck + head
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.056, 0.12, 12), skin);
    neck.position.y = hipY + 0.6;
    body.add(neck);
    const head = new THREE.Group();
    head.position.y = hipY + 0.69;
    body.add(head);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), skin);
    skull.scale.set(0.9, 1.08, 1.0);
    const jaw = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 12), skin);
    jaw.position.set(0, -0.055, -0.025);
    jaw.scale.set(1.05, 0.9, 1.05);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.016, 0.045, 8), skin);
    nose.rotation.x = -Math.PI / 2 - 0.25;
    nose.position.set(0, -0.005, -0.112);
    head.add(skull, jaw, nose);
    for (const side of [-1, 1]) {
        const ear = new THREE.Mesh(new THREE.SphereGeometry(0.022, 10, 8), skin);
        ear.scale.set(0.5, 1.2, 0.9);
        ear.position.set(side * 0.094, 0, 0.005);
        head.add(ear);
    }
    const eyes: THREE.Mesh[] = [];
    const white = new THREE.MeshStandardMaterial({ color: 0xd8d2c8, roughness: 0.25 });
    const iris = new THREE.MeshBasicMaterial({ color: 0x15100c });
    const brow = new THREE.MeshStandardMaterial({ color: o.hair?.color ?? 0x2a1d14, roughness: 0.9 });
    for (const side of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), white);
        eye.position.set(side * 0.034, 0.018, -0.094);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.0075, 8, 6), iris);
        pupil.position.z = -0.011;
        eye.add(pupil);
        const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.034, 0.006, 0.01), brow);
        b2.position.set(side * 0.034, 0.042, -0.1);
        b2.rotation.z = side * -0.12;
        head.add(eye, b2);
        eyes.push(eye);
    }
    const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.004, 0.006), new THREE.MeshBasicMaterial({ color: 0x3a1a18 }));
    mouth.position.set(0, -0.058, -0.098);
    head.add(mouth);

    // hair
    const hairStyle = o.hair?.style ?? 'short';
    if (hairStyle !== 'bald') {
        const hm = new THREE.MeshStandardMaterial({ color: o.hair?.color ?? 0x2a1d14, roughness: 0.75 });
        hm.userData.look = 0;
        const cap = new THREE.Mesh(new THREE.SphereGeometry(0.112, 22, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hm);
        cap.scale.set(0.95, 1.1, 1.06);
        cap.position.set(0, 0.012, 0.006);
        cap.rotation.x = 0.25;
        head.add(cap);
        if (hairStyle === 'long') {
            const back = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.26, 18, 2, true, Math.PI * 0.15, Math.PI * 1.7), hm);
            back.position.set(0, -0.09, 0.02);
            back.rotation.y = Math.PI;
            hm.side = THREE.DoubleSide;
            head.add(back);
        } else if (hairStyle === 'bun') {
            const bun = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), hm);
            bun.position.set(0, 0.07, 0.085);
            head.add(bun);
        } else if (hairStyle === 'cap') {
            const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.01, 18, 1, false, 0, Math.PI), hm);
            brim.position.set(0, 0.06, -0.08);
            brim.rotation.y = Math.PI / 2;
            brim.scale.z = 0.9;
            head.add(brim);
        }
    }

    // arms
    const arms: Human['arms'] = [];
    const sleeve = o.longSleeves === false ? skin : top;
    for (const side of [-1, 1]) {
        const shoulder = new THREE.Group();
        shoulder.position.set(side * 0.19 * w, shoulderY, 0);
        shoulder.rotation.z = side * 0.08;
        body.add(shoulder);
        const elbowEnd = limb(shoulder, 0.28, 0.052, 0.044, top);
        const elbow = new THREE.Group();
        elbowEnd.add(elbow);
        const wrist = limb(elbow, 0.25, 0.043, 0.034, sleeve);
        const hand = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), skin);
        hand.scale.set(0.6, 1.25, 1.0);
        hand.position.y = -0.045;
        const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.012, 0.03, 4, 8), skin);
        thumb.position.set(side * -0.015, -0.03, -0.03);
        thumb.rotation.x = 0.6;
        wrist.add(hand, thumb);
        arms.push({ shoulder, elbow });
        if (seated) {
            // hands resting on the thighs
            shoulder.rotation.x = 0.35;
            elbow.rotation.x = 1.05;
        } else {
            elbow.rotation.x = 0.12;
        }
    }

    // legs
    for (const side of [-1, 1]) {
        const hip = new THREE.Group();
        hip.position.set(side * 0.09 * w, hipY - 0.03, 0);
        body.add(hip);
        if (seated) hip.rotation.x = Math.PI / 2 - 0.05; // thighs forward along -z
        const knee = limb(hip, seated ? 0.44 : 0.43, 0.078, 0.058, bottom);
        const kneeJ = new THREE.Group();
        knee.add(kneeJ);
        if (seated) kneeJ.rotation.x = -(Math.PI / 2 - 0.1); // shins back down
        const ankle = limb(kneeJ, seated ? 0.46 : 0.44, 0.056, 0.042, bottom);
        const shoe = new THREE.Mesh(new THREE.CapsuleGeometry(0.045, 0.14, 4, 10), o.barefoot ? skin : shoeM);
        if (o.barefoot) shoe.scale.setScalar(0.8);
        shoe.rotation.x = Math.PI / 2;
        shoe.position.set(0, -0.04, -0.05);
        shoe.scale.set(1, 1, 0.7);
        ankle.add(shoe);
    }
    group.userData.human = true;
    group.traverse((c) => { if ((c as THREE.Mesh).isMesh) { c.castShadow = true; c.receiveShadow = true; } });
    return { group, head, chest, arms, eyes };
}

/** Idle life: breathing, small head turns, blinks. Stops when the figure is hidden. */
export function animateHumanoid(env: Env, h: Human, seed = 0) {
    let nextBlink = 1 + seed;
    let blinkUntil = 0;
    let lookYaw = 0, lookTarget = 0, nextLook = 2 + seed * 1.3;
    env.onFrame.push((dt, t) => {
        if (!h.group.visible) return;
        const reduced = store.get().reducedMotion;
        const br = Math.sin(t * 1.4 + seed) * 0.5 + 0.5;
        h.chest.scale.x = 1 + br * 0.018;
        h.chest.scale.z = 0.62 * (1 + br * 0.03);
        if (t > nextLook) { lookTarget = (Math.random() - 0.5) * 0.7; nextLook = t + 2 + Math.random() * 4; }
        lookYaw += (lookTarget - lookYaw) * Math.min(1, dt * 2.5);
        h.head.rotation.y = reduced ? 0 : lookYaw;
        h.head.rotation.x = reduced ? 0 : Math.sin(t * 0.37 + seed) * 0.04;
        if (t > nextBlink) { blinkUntil = t + 0.11; nextBlink = t + 2.5 + Math.random() * 4; }
        const shut = t < blinkUntil;
        for (const e of h.eyes) e.scale.y = shut ? 0.1 : 1;
    });
}
