import * as THREE from 'three';
import { X0 } from './world.ts';

export interface Bunker {
    group: THREE.Group;
    light: THREE.PointLight;
    crtScreen: THREE.Mesh;
    crtGroup: THREE.Group;
    crtCanvas: HTMLCanvasElement;
    crtTex: THREE.CanvasTexture;
    tray: THREE.Mesh;
    tapeMesh: THREE.Mesh;
    leverMesh: THREE.Mesh;
    boltMesh: THREE.Mesh;
    doors: THREE.Mesh[];
    walls: THREE.Group;
    clockHand: THREE.Mesh;
}

const mat = (c: number, r = 0.9, m = 0) => new THREE.MeshStandardMaterial({ color: c, roughness: r, metalness: m });
const box = (w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    b.position.set(X0 + x, y, z);
    return b;
};

/** Tight concrete bunker room, 7x7. Entry door on the +z wall. */
export function buildBunker(): Bunker {
    const group = new THREE.Group();
    const walls = new THREE.Group();
    group.add(walls);

    const conc = mat(0x6a6d70, 0.95);
    walls.add(box(7, 0.2, 7, mat(0x4a4c4e), 0, -0.1, 0));
    walls.add(box(7, 0.2, 7, conc, 0, 3.1, 0));
    walls.add(box(7, 3, 0.3, conc, 0, 1.5, -3.65));
    walls.add(box(7, 3, 0.3, conc, 0, 1.5, 3.65));
    walls.add(box(0.3, 3, 7, conc, -3.65, 1.5, 0));
    walls.add(box(0.3, 3, 7, conc, 3.65, 1.5, 0));

    // steel entry door + bolt
    group.add(box(1.4, 2.3, 0.12, mat(0x6a3a20, 0.5, 0.5), 0, 1.15, 3.45));
    const boltMesh = box(0.5, 0.08, 0.08, mat(0x999999, 0.3, 0.8), -0.9, 1.2, 3.35);
    group.add(boltMesh);

    // hidden second door-shaped outline behind paneling (west wall)
    const outline = mat(0x2e3033, 1);
    group.add(box(0.05, 2.1, 0.06, outline, -3.48, 1.05, -2.2));
    group.add(box(0.05, 2.1, 0.06, outline, -3.48, 1.05, -1.2));
    group.add(box(0.05, 0.06, 1.0, outline, -3.48, 2.1, -1.7));

    // table, CRT, VCR
    group.add(box(2.4, 0.8, 0.8, mat(0x4a3a2a), 0, 0.4, -2.9));
    const crtGroup = new THREE.Group();
    crtGroup.position.set(X0 - 0.5, 1.25, -2.9);
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.75, 0.8), mat(0x2b2b2d, 0.5));
    crtGroup.add(body);
    const crtCanvas = document.createElement('canvas');
    crtCanvas.width = 256;
    crtCanvas.height = 192;
    const crtTex = new THREE.CanvasTexture(crtCanvas);
    crtTex.colorSpace = THREE.SRGBColorSpace;
    const crtScreen = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.56), new THREE.MeshBasicMaterial({ map: crtTex }));
    crtScreen.position.set(0, 0.02, 0.405);
    crtGroup.add(crtScreen);
    group.add(crtGroup);
    group.add(box(0.7, 0.13, 0.42, mat(0x1b1b1d, 0.4), 0.75, 0.865, -2.9));
    const tray = box(0.4, 0.02, 0.2, mat(0x050505), 0.75, 0.88, -2.7);
    group.add(tray);
    tray.visible = false;
    group.add(box(0.1, 0.02, 0.02, new THREE.MeshBasicMaterial({ color: 0xff2020 }), 1.0, 0.93, -2.68));

    // generator switch (east wall)
    group.add(box(0.3, 0.8, 0.6, mat(0x3a4a3a, 0.6, 0.4), 3.3, 1.2, 0.6));
    const leverMesh = box(0.08, 0.4, 0.08, mat(0xcc3322, 0.4), 3.12, 1.25, 0.6);
    leverMesh.rotation.z = 0.6;
    group.add(leverMesh);

    // shelf + tape
    group.add(box(0.5, 0.06, 1.4, mat(0x4a3a2a), -3.35, 1.0, -0.5));
    const tapeMesh = box(0.2, 0.03, 0.12, mat(0x111111, 0.5), -3.35, 1.05, -0.5);
    group.add(tapeMesh);
    group.add(box(0.2, 0.04, 0.13, new THREE.MeshBasicMaterial({ color: 0xcc2222 }), -3.35, 1.075, -0.5));

    // analog clock
    const clock = new THREE.Mesh(new THREE.CircleGeometry(0.25, 20), new THREE.MeshBasicMaterial({ color: 0xcfcfc0 }));
    clock.position.set(X0 - 3.48, 2.3, 1.5);
    clock.rotation.y = Math.PI / 2;
    group.add(clock);
    const clockHand = box(0.01, 0.2, 0.01, new THREE.MeshBasicMaterial({ color: 0x000000 }), -3.46, 2.4, 1.5);
    clockHand.position.set(X0 - 3.45, 2.3, 1.5);
    group.add(clockHand);

    // duplicate doors that appear during the tape sequence
    const doors: THREE.Mesh[] = [];
    const spots: [number, number, number][] = [[-3.45, 1.1, 1.2], [3.45, 1.1, -1.8], [-1.8, 1.1, -3.45]];
    spots.forEach(([x, y, z], i) => {
        const d = new THREE.Mesh(new THREE.BoxGeometry(i === 2 ? 1.3 : 0.1, 2.2, i === 2 ? 0.1 : 1.3), mat(0x6a3a20, 0.5, 0.5));
        d.position.set(X0 + x, y, z);
        d.scale.y = 0.001;
        d.visible = false;
        group.add(d);
        doors.push(d);
    });

    const light = new THREE.PointLight(0xff5a3a, 4, 14, 2);
    light.position.set(X0, 2.7, 0);
    group.add(light);
    group.visible = false;
    return { group, light, crtScreen, crtGroup, crtCanvas, crtTex, tray, tapeMesh, leverMesh, boltMesh, doors, walls, clockHand };
}
