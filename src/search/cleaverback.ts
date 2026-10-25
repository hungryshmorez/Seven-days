import * as THREE from 'three';

export interface CleaverbackRig {
    group: THREE.Group;
    torso: THREE.Mesh;
    head: THREE.Group;
    jawL: THREE.Mesh;
    jawR: THREE.Mesh;
    arms: THREE.Group[];
    legs: THREE.Group[];
    bladeArm: THREE.Group;
}

/** Original design: six-limbed, bark-plated hump, rope mane, split jaw, one rusted butcher blade. */
export function buildCleaverback(): CleaverbackRig {
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0x1e1812, roughness: 1, emissive: 0x0a0806 });
    const bark = new THREE.MeshStandardMaterial({ color: 0x2c2218, roughness: 0.9 });
    const rope = new THREE.MeshStandardMaterial({ color: 0x0d0b09, roughness: 1 });
    const rust = new THREE.MeshStandardMaterial({ color: 0x7a4326, roughness: 0.5, metalness: 0.6 });
    const bone = new THREE.MeshStandardMaterial({ color: 0x8a8272, roughness: 0.6 });
    const amber = new THREE.MeshBasicMaterial({ color: 0xffa21f, fog: false });

    const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 12), fur);
    torso.scale.set(1.1, 1.35, 0.95);
    torso.position.set(0, 2.2, 0);
    g.add(torso);

    const hump = new THREE.Mesh(new THREE.SphereGeometry(0.85, 10, 8), bark);
    hump.scale.set(1.3, 0.8, 1);
    hump.position.set(0, 3.3, 0.35);
    g.add(hump);

    for (let i = 0; i < 9; i++) {
        const r = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.07, 0.9 + Math.random() * 0.6, 5), rope);
        r.position.set((i - 4) * 0.2, 2.9, -0.1 + Math.random() * 0.2);
        r.rotation.x = 0.3;
        g.add(r);
    }

    const head = new THREE.Group();
    head.position.set(0, 3.0, -0.85);
    const skull = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.6, 0.9), fur);
    head.add(skull);
    const jawL = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, 0.8), bone);
    jawL.position.set(-0.18, -0.35, -0.1);
    const jawR = jawL.clone();
    jawR.position.x = 0.18;
    head.add(jawL, jawR);
    for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), amber);
        eye.position.set(0.2 * s, 0.1, -0.46);
        head.add(eye);
    }
    g.add(head);

    const limb = (x: number, y: number, z: number, len: number, mat: THREE.Material): THREE.Group => {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, z);
        const m = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.15, len, 7), mat);
        m.position.y = -len / 2;
        pivot.add(m);
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.35, 5), bone);
        claw.position.y = -len - 0.1;
        claw.rotation.x = Math.PI;
        pivot.add(claw);
        g.add(pivot);
        return pivot;
    };
    const legs = [limb(-0.6, 1.2, 0.3, 1.3, fur), limb(0.6, 1.2, 0.3, 1.3, fur)];
    const arms = [
        limb(-1.0, 2.9, -0.2, 1.9, fur),
        limb(1.0, 2.9, -0.2, 1.9, fur),
        limb(-1.0, 2.4, 0.1, 1.7, bark),
        limb(1.0, 2.4, 0.1, 1.7, bark),
    ];
    const bladeArm = arms[1];
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 0.6), rust);
    blade.position.set(0, -2.3, -0.2);
    bladeArm.add(blade);
    g.scale.setScalar(1.25);
    return { group: g, torso, head, jawL, jawR, arms, legs, bladeArm };
}
