import * as THREE from 'three';

export interface MoppetRig {
    group: THREE.Group;
    head: THREE.Group;
    longArm: THREE.Group[]; // chain of cloth segments (index 0 = shoulder)
    stiffArm: THREE.Group;
    stiffElbow: THREE.Group;
    legs: THREE.Group[];
    cloth: THREE.Group;
}

/** Morrow Moppet: faded-teal nursery marionette, uneven wooden legs, one long cloth arm, one stiff jointed arm, horizontal porcelain-tooth mouth. Front faces -z. */
export function buildMoppet(): MoppetRig {
    const g = new THREE.Group();
    const teal = new THREE.MeshStandardMaterial({ color: 0x3a8582, roughness: 1, emissive: 0x0c2a28, side: THREE.DoubleSide });
    const wood = new THREE.MeshStandardMaterial({ color: 0x8a6a45, roughness: 0.7, emissive: 0x1a1208 });
    const face = new THREE.MeshStandardMaterial({ color: 0xcdb48a, roughness: 0.6, emissive: 0x241d12 });
    const china = new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.2, emissive: 0x333330 });
    const dark = new THREE.MeshBasicMaterial({ color: 0x050303 });

    const cloth = new THREE.Group();
    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.95, 1.7, 12, 1, true), teal);
    robe.position.y = 2.15;
    const hem = new THREE.Mesh(new THREE.ConeGeometry(1.05, 0.8, 12, 1, true), teal);
    hem.position.y = 1.4;
    hem.scale.set(1, 1, 0.8);
    cloth.add(robe, hem);
    g.add(cloth);

    const mkLeg = (x: number, hipY: number): THREE.Group => {
        const p = new THREE.Group();
        p.position.set(x, hipY, 0);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.045, hipY, 6), wood);
        m.position.y = -hipY / 2;
        const foot = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.06, 0.3), wood);
        foot.position.set(0, -hipY + 0.03, -0.06);
        p.add(m, foot);
        g.add(p);
        return p;
    };
    const legs = [mkLeg(-0.22, 1.45), mkLeg(0.22, 1.8)];

    const head = new THREE.Group();
    head.position.set(0, 3.25, 0);
    const skull = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), face);
    skull.scale.set(0.34, 0.44, 0.34);
    head.add(skull);
    for (const s of [-1, 1]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), dark);
        e.position.set(0.12 * s, 0.1, -0.3);
        head.add(e);
    }
    const seam = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.05, 0.05), dark);
    seam.position.set(0, -0.14, -0.3);
    head.add(seam);
    for (let i = 0; i < 9; i++) {
        const t = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.08, 0.03), china);
        t.position.set(-0.19 + i * 0.0475, -0.14, -0.325);
        head.add(t);
    }
    g.add(head);

    // long cloth arm (left): chain of segments
    const longArm: THREE.Group[] = [];
    let parent: THREE.Object3D = g;
    for (let i = 0; i < 5; i++) {
        const seg = new THREE.Group();
        seg.position.set(i === 0 ? -0.4 : 0, i === 0 ? 2.7 : -0.6, 0);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.6, 6), teal);
        m.position.y = -0.3;
        seg.add(m);
        parent.add(seg);
        longArm.push(seg);
        parent = seg;
    }
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 6), face);
    hand.position.y = -0.65;
    longArm[4].add(hand);
    for (let f = 0; f < 3; f++) {
        const fing = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.012, 0.5, 4), wood);
        fing.position.set((f - 1) * 0.05, -0.9, 0);
        longArm[4].add(fing);
    }

    // stiff jointed arm (right)
    const stiffArm = new THREE.Group();
    stiffArm.position.set(0.4, 2.7, 0);
    const up = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.75, 6), wood);
    up.position.y = -0.375;
    stiffArm.add(up);
    const stiffElbow = new THREE.Group();
    stiffElbow.position.y = -0.75;
    const low = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.04, 0.85, 6), wood);
    low.position.y = -0.425;
    const knuckles = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.3, 0.05), wood);
    knuckles.position.y = -1.0;
    stiffElbow.add(low, knuckles, new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), wood));
    stiffArm.add(stiffElbow);
    g.add(stiffArm);

    // marionette strings
    const sm = new THREE.MeshBasicMaterial({ color: 0x777766 });
    for (const [x, y] of [[0, 3.6], [-0.4, 2.8], [0.4, 2.8], [0, 2.3]] as [number, number][]) {
        const s = new THREE.Mesh(new THREE.CylinderGeometry(0.005, 0.005, 4.2 - y, 3), sm);
        s.position.set(x, y + (4.2 - y) / 2, 0);
        g.add(s);
    }
    return { group: g, head, longArm, stiffArm, stiffElbow, legs, cloth };
}
