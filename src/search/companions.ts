import * as THREE from 'three';

export const COMPANIONS = [
    { name: 'Alan', role: 'the famous movie director', color: 0x38414c },
    { name: 'Sloppy', role: 'the rodeo clown', color: 0x22b9b4 },
    { name: 'Mitzi Goins', role: 'the athlete and runner', color: 0x963d61 },
    { name: 'Oliver', role: 'their elder, a priest and glitch exploiter', color: 0x24232c },
] as const;

/** Simple scene stand-ins until final character artwork is chosen. */
export function companion(index: number): THREE.Group {
    const g = new THREE.Group();
    const m = (color: number) => new THREE.MeshStandardMaterial({ color, roughness: 0.9 });
    const part = (w: number, h: number, d: number, color: number, x: number, y: number, z = 0) => {
        const a = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m(color));
        a.position.set(x, y, z); g.add(a); return a;
    };
    const color = COMPANIONS[index].color;
    part(0.55, 0.65, 0.3, color, 0, 1.12);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), m(index === 1 ? 0xe8d9cd : 0xb58a74));
    head.position.y = 1.66; g.add(head);
    for (const s of [-1, 1]) {
        part(0.18, 0.78, 0.2, index === 2 ? 0x29232b : 0x30333b, s * 0.16, 0.4);
        part(0.16, 0.62, 0.18, color, s * 0.36, 1.12);
        part(0.23, 0.11, 0.4, index === 2 ? 0xe5d9cc : 0x1e1c22, s * 0.16, 0.07, -0.06);
    }
    if (index === 0) {
        part(0.44, 0.1, 0.42, 0x111419, 0, 1.86);
        part(0.19, 0.14, 0.25, 0x111419, 0.34, 1.03, -0.19);
    }
    if (index === 1) {
        // Oversized turquoise / magenta / yellow 1980s windbreaker and rodeo hat.
        part(0.7, 0.23, 0.34, 0xe3419a, 0, 1.28);
        part(0.7, 0.09, 0.36, 0xf3df53, 0, 1.12);
        part(0.82, 0.05, 0.55, 0xc59a62, 0, 1.88);
        part(0.36, 0.16, 0.3, 0xc59a62, 0, 1.98);
        const nose = new THREE.Mesh(new THREE.SphereGeometry(0.06, 8, 6), m(0xc8243b));
        nose.position.set(0, 1.66, -0.19); g.add(nose);
    }
    if (index === 2) { part(0.24, 0.22, 0.02, 0xe7e1d6, 0, 1.2, -0.16); }
    if (index === 3) {
        part(0.14, 0.06, 0.025, 0xf0ebe0, 0, 1.45, -0.16);
        part(0.035, 0.17, 0.035, 0xcbb36e, 0, 1.17, -0.18);
        part(0.11, 0.03, 0.035, 0xcbb36e, 0, 1.21, -0.18);
    }
    return g;
}
