import * as THREE from 'three';
import { companion } from './companions.ts';

/**
 * The boatman and his dog, waiting on the opening beach beside the moored boat.
 * If you never leave them (walk up, sit down) the dog curls against you and the island slowly lets you go.
 */
export class BeachDog {
    group = new THREE.Group();
    readonly home = new THREE.Vector3(-2.6, 0, -2.6);
    readonly dog = new THREE.Group();
    readonly man: THREE.Group;
    private head = new THREE.Group();
    private tail = new THREE.Group();
    private body: THREE.Mesh;
    private legs: THREE.Mesh[] = [];
    private lie = 0;
    private heading = 0;
    private t = 0;

    constructor(parent: THREE.Object3D) {
        const std = (c: number) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.95 });
        const fur = std(0x6b4a2c), dark = std(0x2b1d12), pale = std(0xb89a72);
        const part = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number, p: THREE.Object3D = this.dog) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
            mesh.position.set(x, y, z); p.add(mesh); return mesh;
        };
        this.body = part(0.42, 0.36, 0.8, fur, 0, 0.5, 0);
        part(0.32, 0.2, 0.3, pale, 0, 0.38, -0.25);
        this.head.position.set(0, 0.8, -0.45); this.dog.add(this.head);
        part(0.32, 0.3, 0.32, fur, 0, 0, 0, this.head);
        part(0.16, 0.14, 0.22, pale, 0, -0.06, -0.24, this.head);
        part(0.07, 0.06, 0.06, dark, 0, -0.02, -0.36, this.head);
        part(0.09, 0.22, 0.1, dark, -0.11, 0.24, 0.02, this.head);
        part(0.09, 0.22, 0.1, dark, 0.11, 0.24, 0.02, this.head);
        for (const [lx, lz] of [[-0.13, -0.3], [0.13, -0.3], [-0.13, 0.3], [0.13, 0.3]]) this.legs.push(part(0.11, 0.36, 0.11, fur, lx, 0.17, lz));
        this.tail.position.set(0, 0.62, 0.42); this.dog.add(this.tail);
        part(0.08, 0.08, 0.36, fur, 0, 0.08, 0.15, this.tail).rotation.x = -0.5;
        this.dog.position.copy(this.home);
        const dl = new THREE.PointLight(0xffd9a8, 6, 5, 1.6); dl.position.set(0, 1.3, 0); this.dog.add(dl);

        // the boatman, same coat as on the water
        this.man = companion(3);
        this.man.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) { const mat = (m.material as THREE.MeshStandardMaterial).clone(); mat.color.multiplyScalar(0.55).add(new THREE.Color(0x2a3626)); m.material = mat; }
        });
        this.man.position.set(-3.7, 0.02, -3.9);
        this.group.add(this.dog, this.man);
        // a little lantern light so the pair read against the fog lamps
        const glow = new THREE.PointLight(0xffd9a8, 14, 9, 1.5);
        glow.position.set(-3.1, 2.2, -3.0);
        this.group.add(glow);
        parent.add(this.group);
    }

    /** `sit` is the player's seated position/yaw while they are sitting; null otherwise. */
    update(dt: number, px: number, pz: number, yaw: number, sitting: boolean): void {
        this.t += dt;
        const dog = this.dog;
        // where the dog wants to be
        let tx = this.home.x, tz = this.home.z;
        if (sitting) {
            const fx = -Math.sin(yaw), fz = -Math.cos(yaw), rx = Math.cos(yaw), rz = -Math.sin(yaw);
            tx = px + rx * 0.85 + fx * 0.25; tz = pz + rz * 0.85 + fz * 0.25;
        }
        const dx = tx - dog.position.x, dz = tz - dog.position.z;
        const dist = Math.hypot(dx, dz);
        let walking = false;
        if (dist > 0.12) {
            const v = Math.min(dist / dt, sitting ? 2.4 : 1.6);
            dog.position.x += (dx / dist) * v * dt; dog.position.z += (dz / dist) * v * dt;
            this.heading = Math.atan2(-dx, -dz); walking = true;
        } else if (sitting) {
            // settled beside the player: nose toward their lap
            this.heading = yaw - 1.25;
        } else {
            const ax = px - dog.position.x, az = pz - dog.position.z;
            if (Math.hypot(ax, az) < 14) this.heading = Math.atan2(-ax, -az);
        }
        let dy = this.heading - dog.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        dog.rotation.y += dy * Math.min(1, dt * 5);

        // lie down once settled
        const wantLie = sitting && !walking ? 1 : 0;
        this.lie += (wantLie - this.lie) * Math.min(1, dt * 1.6);
        const l = this.lie;
        dog.position.y = -0.2 * l + (walking ? Math.abs(Math.sin(this.t * 9)) * 0.03 : 0);
        for (const leg of this.legs) leg.scale.y = 1 - 0.7 * l;
        this.body.position.y = 0.5 - 0.1 * l;
        this.head.position.y = 0.8 - 0.3 * l + Math.sin(this.t * 1.7) * 0.012 * l;
        this.head.rotation.x = 0.35 * l + (walking ? 0 : Math.sin(this.t * 0.9) * 0.05);
        this.head.rotation.z = Math.sin(this.t * 0.6) * 0.12 * (1 - l) + 0.25 * l;
        this.tail.rotation.y = Math.sin(this.t * (sitting ? 5 : 9)) * (0.5 - 0.25 * l);

        // the boatman watches, shifts his weight
        const m = this.man;
        const mx = px - m.position.x, mz = pz - m.position.z;
        const want = Math.atan2(-mx, -mz);
        let md = want - m.rotation.y;
        while (md > Math.PI) md -= Math.PI * 2;
        while (md < -Math.PI) md += Math.PI * 2;
        m.rotation.y += md * Math.min(1, dt * 1.5);
        m.position.y = 0.02 + Math.sin(this.t * 1.3) * 0.006;
    }

    /** Where the player's prompt should point. */
    interactPoint(out: THREE.Vector3): THREE.Vector3 {
        return out.set(this.dog.position.x, 0.7, this.dog.position.z);
    }

    dispose(): void { this.group.removeFromParent(); }
}
