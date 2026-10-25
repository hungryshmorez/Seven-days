import * as THREE from 'three';
import { glowSprite } from './world.ts';
import { companion } from './companions.ts';

/**
 * The search game's opening: a fishing boat at night, closing on the island.
 * The boat is built around the origin, pointing down -Z (bow ahead). The camera
 * stands at the bow and looks back over the searchers and boatman toward the stern.
 */
export const BOAT_X = -600;

export class Boat {
    group = new THREE.Group();
    private island = new THREE.Group();
    private lantern = new THREE.PointLight(0xffc98a, 40, 26, 1.2);
    private captain: THREE.Group;
    private sea: THREE.Mesh;
    private t = 0;
    private dog!: THREE.Group;
    private dogHead!: THREE.Group;
    private dogTail!: THREE.Group;
    private boatRoot = new THREE.Group();

    constructor() {
        this.group.add(this.boatRoot);
        const std = (c: number, e = 0, rough = 0.95) => new THREE.MeshStandardMaterial({ color: c, roughness: rough, emissive: e });
        const add = (mesh: THREE.Mesh, x: number, y: number, z: number, parent: THREE.Object3D = this.boatRoot) => {
            mesh.position.set(x, y, z); parent.add(mesh); return mesh;
        };
        const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D) =>
            add(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m), x, y, z, parent);

        // Water: lit by the moon, with a faint sheen so it reads as sea, not a black void.
        this.sea = new THREE.Mesh(new THREE.PlaneGeometry(500, 500), new THREE.MeshStandardMaterial({ color: 0x23425a, roughness: 0.55, metalness: 0.1 }));
        this.sea.rotation.x = -Math.PI / 2; this.sea.position.set(0, -0.35, -120);
        this.group.add(this.sea);

        // Hull: pointed bow toward -Z, square stern toward +Z. Flat deck at y=0.
        const wood = std(0x5a4330), paint = std(0x7a8a90), dark = std(0x2a2118);
        const shape = new THREE.Shape();
        const pts: [number, number][] = [[-1.6, 4], [1.6, 4], [1.7, -2.5], [0.9, -6], [0, -8], [-0.9, -6], [-1.7, -2.5]];
        pts.forEach(([px, py], i) => (i ? shape.lineTo(px, py) : shape.moveTo(px, py)));
        const hull = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false }), wood);
        hull.rotation.x = -Math.PI / 2; hull.position.set(0, -0.6, 0);
        this.boatRoot.add(hull);

        // gunwales
        for (const s of [-1, 1]) {
            box(0.16, 0.5, 11.5, paint, s * 1.7, 0.1, -1.5);
        }

        // deck planks
        for (let i = 0; i < 9; i++) box(3.0, 0.03, 0.12, dark, 0, 0.02, -6 + i * 1.1);

        // wheelhouse / cabin at the stern, with a warm window
        box(2.2, 1.6, 1.8, paint, 0, 0.9, 2.6);
        box(1.6, 0.6, 0.05, std(0xffd27a, 0xb07a20), 0, 1.1, 1.7);

        // mast with a lantern on top
        box(0.14, 3.2, 0.14, wood, 1.55, 1.7, -3.6);
        this.lantern.position.set(1.55, 3.6, -3.6);
        // warm fill light over the passengers so clothes and faces read from the bow camera
        const fill = new THREE.PointLight(0xffd9a8, 22, 12, 1.4);
        fill.position.set(0, 3.2, -0.2);
        this.boatRoot.add(fill);
        this.boatRoot.add(this.lantern);
        const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.14, 10, 8), new THREE.MeshBasicMaterial({ color: 0xffd9a0 }));
        bulb.position.copy(this.lantern.position); this.boatRoot.add(bulb);

        // coiled rope and crates
        box(0.9, 0.5, 0.9, dark, -1.0, 0.25, 0.8);
        const rope = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.09, 6, 14), std(0x8a7a5a));
        rope.rotation.x = Math.PI / 2; add(rope, 1.0, 0.12, 0.2);

        // The boatman: stands at the wheel, facing the bow (-Z), plainly in view from the stern.
        this.captain = companion(3);
        this.captain.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) { const mat = (m.material as THREE.MeshStandardMaterial).clone(); mat.color.multiplyScalar(0.55).add(new THREE.Color(0x2a3626)); m.material = mat; }
        });
        // stands just in front of the wheelhouse, between the two back passengers, facing the bow camera
        this.captain.position.set(0, 0, 1.45); this.captain.rotation.y = 0;
        this.boatRoot.add(this.captain);

        // Four searchers seated amidships, facing the stern (Sarah, Jessica, Thomas, Liam).
        // Stylised 3D figures built to match the reference looks; they are NOT the roster friends.
        const seats: [number, number, number][] = [[-0.95, 0.05, -0.4], [0.95, 0.05, -0.4], [-0.95, 0.05, 1.0], [0.95, 0.05, 1.0]];
        const looks = [
            { jacket: 0x7a5232, fur: 0xe8dcc0, pants: 0x2c3a4c, skin: 0xc8a48a, hair: 0x4a2e1c }, // Sarah: brown shearling jacket
            { jacket: 0x6e6a4e, pants: 0x6e6a4e, skin: 0xc8a48a, hair: 0x6a4a2c, fur: 0x6e6a4e }, // Jessica: olive jumpsuit
            { jacket: 0x9aa4a8, pants: 0x3a4248, skin: 0xb58a74, hair: 0x3a2e24, fur: 0x9aa4a8 }, // Thomas: grey shirt
            { jacket: 0x5a5a40, pants: 0x3a3a30, skin: 0xb58a74, hair: 0x3a3a3a, fur: 0x5a5a40 }, // Liam: hooded olive jacket
        ];
        seats.forEach(([x, y, z], i) => {
            const L = looks[i];
            const searcher = new THREE.Group();
            const seat = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.12, 0.45), std(0x2e231a));
            seat.position.set(0, 0.42, 0);
            const legs = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.36), std(L.pants));
            legs.position.set(0, 0.7, 0.05);
            const torso = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.62, 0.3), std(L.jacket));
            torso.position.set(0, 1.2, 0);
            const neck = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.12, 0.2), std(L.skin));
            neck.position.set(0, 1.56, 0);
            const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 10, 8), std(L.skin));
            head.position.set(0, 1.72, 0);
            const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), std(L.hair));
            hair.position.set(0, 1.78, 0);
            searcher.add(seat, legs, torso, neck, head, hair);
            if (i === 3) { // Liam: hood
                const hood = new THREE.Mesh(new THREE.SphereGeometry(0.22, 10, 8), std(L.fur));
                hood.position.set(0, 1.74, -0.03); hood.scale.set(1, 1.05, 0.9);
                searcher.add(hood);
            }
            searcher.position.set(x, y, z);
            searcher.rotation.y = Math.PI; // face the stern so the camera sees them
            this.boatRoot.add(searcher);
        });

        // The dog: a scruffy brown mutt at the bow, facing the island, ears up.
        this.dog = new THREE.Group();
        const fur = std(0x6b4a2c), darkFur = std(0x2b1d12), pale = std(0xb89a72);
        const part = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.dog) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
            mesh.position.set(x, y, z); parent.add(mesh); return mesh;
        };
        part(0.42, 0.36, 0.8, fur, 0, 0.5, 0);
        part(0.32, 0.2, 0.3, pale, 0, 0.38, -0.25);
        this.dogHead = new THREE.Group(); this.dogHead.position.set(0, 0.8, -0.45); this.dog.add(this.dogHead);
        part(0.32, 0.3, 0.32, fur, 0, 0, 0, this.dogHead);
        part(0.16, 0.14, 0.22, pale, 0, -0.06, -0.24, this.dogHead);
        part(0.07, 0.06, 0.06, darkFur, 0, -0.02, -0.36, this.dogHead);
        part(0.09, 0.22, 0.1, darkFur, -0.11, 0.24, 0.02, this.dogHead);
        part(0.09, 0.22, 0.1, darkFur, 0.11, 0.24, 0.02, this.dogHead);
        for (const [lx, lz] of [[-0.13, -0.3], [0.13, -0.3], [-0.13, 0.3], [0.13, 0.3]]) part(0.11, 0.36, 0.11, fur, lx, 0.17, lz);
        this.dogTail = new THREE.Group(); this.dogTail.position.set(0, 0.62, 0.42); this.dog.add(this.dogTail);
        part(0.08, 0.08, 0.36, fur, 0, 0.08, 0.15, this.dogTail).rotation.x = -0.5;
        // the dog stands on the deck at the bow (bow is toward -Z)
        this.dog.position.set(1.0, 0, -4.4); // off to the side so it doesn't block the shot
        this.boatRoot.add(this.dog);

        // Moonlight and a moon in the sky ahead, so the scene reads clearly.
        const moonLight = new THREE.DirectionalLight(0xb8c8ec, 1.5);
        moonLight.position.set(30, 50, 20);
        moonLight.target.position.set(0, 0, -20);
        this.group.add(moonLight, moonLight.target);
        const moonDisc = new THREE.Mesh(new THREE.CircleGeometry(5, 28), new THREE.MeshBasicMaterial({ color: 0xeef2ff, fog: false, side: THREE.DoubleSide }));
        moonDisc.position.set(-30, 45, -200); moonDisc.lookAt(0, 0, 0);
        this.group.add(moonDisc);
        const moonGlow = glowSprite('rgba(200,215,255,0.9)', 40, 0);
        moonGlow.position.copy(moonDisc.position);
        this.group.add(moonGlow);

        // The island: a dark mass ahead with a fire glow on the beach.
        const mound = new THREE.Mesh(new THREE.ConeGeometry(42, 22, 10), std(0x1a2a22));
        mound.position.y = 6; mound.scale.set(1.6, 1, 0.7);
        this.island.add(mound);
        for (let i = 0; i < 22; i++) {
            const tree = new THREE.Mesh(new THREE.ConeGeometry(2, 8, 6), std(0x12201a));
            tree.position.set((Math.random() - 0.5) * 80, 11 + Math.random() * 3, (Math.random() - 0.5) * 12);
            this.island.add(tree);
        }
        const fire = glowSprite('rgba(255,150,60,1)', 10, 3);
        fire.position.set(-6, 3, 4);
        this.island.add(fire);
        const fireLight = new THREE.PointLight(0xff9a4a, 30, 40, 1.4);
        fireLight.position.set(-6, 3, 4);
        this.island.add(fireLight);
        this.island.position.set(0, -0.2, -160);
        this.group.add(this.island);
        this.group.visible = false;
    }

    /** Camera position in the stern, looking forward at the bow and island. */
    /** Cinematic shot: camera stands at the bow and looks back over the passengers toward the stern. */
    cameraHome(): { x: number; y: number; z: number } { return { x: 0, y: 2.6, z: -6.8 }; }

    /** Put the whole boat at the scene's ride position (the boat is built around its own origin). */
    place(): void {
        // Build the ride at the world origin so the camera and every part of the boat share one space.
        this.group.position.set(0, 0, 0);
        this.sea.position.set(0, -0.35, -120);
        this.island.position.set(-30, -0.2, -160);
        this.group.updateMatrixWorld(true);
    }

    /** progress 0 to 1: how close the island is. */
    tick(dt: number, progress: number): void {
        this.t += dt;
        this.lantern.position.x = 1.55 + Math.sin(this.t * 1.3) * 0.2;
        this.lantern.intensity = 40 + Math.sin(this.t * 7) * 2;
        // island sits off to the left of the bow so the passengers stay in front of the lens
        this.island.position.z = -160 + 150 * progress;
        this.sea.position.y = -0.35 + Math.sin(this.t * 1.1) * 0.05;
        // gentle rolling of the whole boat in the swell
        this.boatRoot.rotation.z = Math.sin(this.t * 0.9) * 0.02;
        this.boatRoot.position.y = Math.sin(this.t * 1.1) * 0.05;
        this.captain.rotation.y = Math.sin(this.t * 0.4) * 0.12;
        this.dogTail.rotation.y = Math.sin(this.t * 9) * 0.5;
        this.dogHead.rotation.y = Math.sin(this.t * 0.5) * 0.35;
        this.dogHead.rotation.x = progress > 0.8 ? -0.15 : 0;
        this.dog.position.y = Math.sin(this.t * 1.3) * 0.01;
    }
}
