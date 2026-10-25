import * as THREE from 'three';

export interface SurvivorRig { group: THREE.Group; legs: THREE.Group[]; arms: THREE.Group[]; head: THREE.Group }

/** The stranded survivor: hi-vis jacket, beanie, bandaged arm. Faces -Z by default. */
export function buildSurvivor(): SurvivorRig {
    const g = new THREE.Group();
    const m = (c: number, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 1, emissive: e });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.56, 0.84, 0.32), m(0xc85a1c, 0x1a0a02));
    body.position.y = 1.2; g.add(body);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.07, 0.34), m(0xcfd2c8));
    stripe.position.y = 1.12; g.add(stripe);
    const head = new THREE.Group();
    head.position.y = 1.68;
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), m(0xa87c66));
    skull.position.y = 0.14; head.add(skull);
    const beanie = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 6, 0, Math.PI * 2, 0, Math.PI * 0.55), m(0x2d3b4a));
    beanie.position.y = 0.2; head.add(beanie);
    g.add(head);
    const limb = (mat: THREE.Material, w: number, len: number, x: number, y: number): THREE.Group => {
        const pivot = new THREE.Group();
        pivot.position.set(x, y, 0);
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, len, w), mat);
        mesh.position.y = -len / 2; pivot.add(mesh); g.add(pivot);
        return pivot;
    };
    const legs = [limb(m(0x2a2e38), 0.18, 0.82, -0.14, 0.82), limb(m(0x2a2e38), 0.18, 0.82, 0.14, 0.82)];
    const arms = [limb(m(0xc85a1c), 0.13, 0.64, -0.37, 1.55), limb(m(0xc85a1c), 0.13, 0.64, 0.37, 1.55)];
    const bandage = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.22, 0.16), m(0xe8e2d4));
    bandage.position.set(0, -0.35, 0); arms[0].add(bandage);
    return { group: g, legs, arms, head };
}

export interface SkitterRig { group: THREE.Group; legs: THREE.Group[]; jaw: THREE.Mesh }

/** A small, fast, spined creature that leaps at the player. Faces -Z by default. */
export function buildSkitter(): SkitterRig {
    const g = new THREE.Group();
    const fur = new THREE.MeshStandardMaterial({ color: 0x2a1d17, roughness: 1 });
    const body = new THREE.Mesh(new THREE.SphereGeometry(0.3, 10, 8), fur);
    body.scale.set(1, 0.8, 1.35); body.position.y = 0.42; g.add(body);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), fur);
    head.position.set(0, 0.5, -0.38); g.add(head);
    for (const s of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), new THREE.MeshBasicMaterial({ color: 0xe8e4d0 }));
        eye.position.set(s * 0.1, 0.58, -0.53); g.add(eye);
        const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), new THREE.MeshBasicMaterial({ color: 0x050505 }));
        pupil.position.set(s * 0.1, 0.58, -0.6); g.add(pupil);
    }
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.05, 0.2), new THREE.MeshStandardMaterial({ color: 0x9a1818, emissive: 0x440000 }));
    jaw.position.set(0, 0.4, -0.5); g.add(jaw);
    for (let i = 0; i < 5; i++) {
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.28, 5), new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 1 }));
        spine.position.set((i - 2) * 0.09, 0.78 - Math.abs(i - 2) * 0.05, -0.1 + i * 0.1); g.add(spine);
    }
    const legs: THREE.Group[] = [];
    for (const [x, z] of [[-0.2, -0.22], [0.2, -0.22], [-0.2, 0.25], [0.2, 0.25]] as [number, number][]) {
        const pivot = new THREE.Group();
        pivot.position.set(x, 0.3, z);
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.02, 0.45, 5), fur);
        leg.position.y = -0.22; pivot.add(leg); g.add(pivot); legs.push(pivot);
    }
    return { group: g, legs, jaw };
}
