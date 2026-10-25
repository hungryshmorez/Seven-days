import * as THREE from 'three';
import { companion } from './companions.ts';

/** The charter plane cabin for the opening cutscene. Sits far from the island; the camera is the protagonist's seat. */
export const CABIN_X = -600;
const ROWS = [-4.2, -6.0, -7.8, -9.6];

export class Cabin {
    group = new THREE.Group();
    phase = 0; // 0 calm flight, 1 engine failing, 2 breach
    private t = 0;
    private warn = new THREE.PointLight(0xff2a1a, 0, 9, 1.6);
    private lamp = new THREE.PointLight(0xffe2b0, 26, 14, 1.5);
    private windows: THREE.Mesh[] = [];
    private sloppy: THREE.Group;

    constructor() {
        const std = (c: number, e = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.9, emissive: e });
        const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
            const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
            mesh.position.set(CABIN_X + x, y, z); this.group.add(mesh); return mesh;
        };
        const shell = std(0xb9b6ae), carpet = std(0x3a4252), seat = std(0x2c4a6a), trim = std(0x6a6a70);
        box(3.4, 0.1, 19, carpet, 0, -0.05, -6);
        box(3.4, 0.1, 19, shell, 0, 2.2, -6);
        for (const s of [-1, 1]) {
            box(0.1, 2.3, 19, shell, s * 1.65, 1.1, -6);
            box(0.5, 0.18, 17, trim, s * 1.5, 1.95, -6); // overhead bins
        }
        box(3.4, 2.3, 0.1, std(0x55565c), 0, 1.1, -15); // cockpit door
        box(3.4, 2.3, 0.1, shell, 0, 1.1, 3.4);
        box(0.8, 1.7, 0.06, std(0x2a2a2e), 0, 1.0, -14.9);
        for (const z of ROWS) {
            for (const sx of [-0.8, 0.8]) {
                box(0.52, 0.42, 0.55, seat, sx, 0.25, z);
                box(0.52, 0.8, 0.12, seat, sx, 0.8, z + 0.3);
                box(0.3, 0.16, 0.1, std(0x3a5a7a), sx, 1.28, z + 0.32);
            }
            for (const s of [-1, 1]) {
                const w = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.38), new THREE.MeshBasicMaterial({ color: 0x9fc6ff }));
                w.position.set(CABIN_X + s * 1.595, 1.2, z); w.rotation.y = -s * Math.PI / 2;
                this.group.add(w); this.windows.push(w);
            }
        }
        // seated friends: Oliver, Mitzi (front), Alan beside you, Sloppy behind
        const place = (i: number, x: number, z: number): THREE.Group => {
            const f = companion(i); f.scale.setScalar(0.92);
            f.position.set(CABIN_X + x, -0.22, z); this.group.add(f); return f;
        };
        place(3, 0.8, ROWS[0]); place(2, -0.8, ROWS[0]); place(0, -0.8, ROWS[1]);
        this.sloppy = place(1, 0.8, ROWS[2]);
        this.lamp.position.set(CABIN_X, 2.0, -6);
        this.warn.position.set(CABIN_X, 2.0, -9);
        this.group.add(this.lamp, this.warn);
        this.group.visible = false;
    }

    tick(dt: number): void {
        this.t += dt;
        if (this.phase >= 1) {
            this.warn.intensity = Math.sin(this.t * 9) > 0 ? 45 : 0;
            this.lamp.intensity = 10 + Math.random() * 14;
            this.windows.forEach((w) => (w.material as THREE.MeshBasicMaterial).color.setHex(this.phase >= 2 ? 0xff7a2a : 0xd8a070));
        } else {
            this.warn.intensity = 0;
            this.lamp.intensity = 26;
            this.windows.forEach((w, i) => (w.material as THREE.MeshBasicMaterial).color.setHex(Math.sin(this.t * 0.6 + i) > 0.92 ? 0xe8f2ff : 0x9fc6ff));
        }
    }

    hideSloppy(): void { this.sloppy.visible = false; }
    reset(): void { this.phase = 0; this.sloppy.visible = true; }
}
