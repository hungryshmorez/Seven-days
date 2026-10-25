/**
 * Set dressing shared by both hospital endings: the room itself (walls, ceiling
 * panel, window with blinds), the bed's occupant — the protagonist's own body
 * under a blanket, breathing on the ventilator — and the IV stand, chair and
 * monitor cart around it. Purely visual; the chapters keep their timelines.
 */
import * as THREE from 'three';
import type { Env } from './director.ts';
import { buildHumanoid } from './humanoid.ts';

export function furnishHospitalRoom(env: Env, parent: THREE.Object3D, opts: { monitor?: boolean } = {}) {
    const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => { o.position.set(x, y, z); parent.add(o); return o; };
    const std = (color: number, roughness = 0.8, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });

    // the room: pale green walls, a ceiling, skirting
    const walls = new THREE.Mesh(new THREE.BoxGeometry(7, 3, 7.4), std(0x9fb4ac, 0.85));
    (walls.material as THREE.Material).side = THREE.BackSide;
    walls.userData.castShadow = false;
    add(walls, 0, 1.5, -0.2);
    const skirt = new THREE.Mesh(new THREE.BoxGeometry(6.98, 0.12, 7.38), std(0x4e5e58, 0.6));
    (skirt.material as THREE.Material).side = THREE.BackSide;
    add(skirt, 0, 0.06, -0.2);

    // ceiling light panel over the bed: a cold, slightly uneven tube light
    const panelM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xe8fff6).multiplyScalar(1.8) });
    add(new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.04, 0.5), panelM), 0, 2.98, -1.9);
    const tube = new THREE.SpotLight(0xe0fff0, 22, 9, 1.0, 0.8, 2);
    add(tube, 0, 2.9, -1.9);
    tube.target.position.set(0, 0, -1.9);
    parent.add(tube.target);
    env.onFrame.push((_d, t) => {
        // a failing ballast: mostly steady, occasional dips
        const dip = Math.sin(t * 37) > 0.985 ? 0.4 : 1;
        tube.intensity = 22 * dip;
        panelM.color.setRGB(1.62 * dip, 1.8 * dip, 1.72 * dip);
    });

    // window on the left wall: night outside, venetian blinds
    const night = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: 0x0d1a2a }));
    night.rotation.y = Math.PI / 2;
    add(night, -3.48, 1.6, -1.2);
    const frameM = std(0xc8d0cc, 0.5);
    for (const [w, h, y, z] of [[0.06, 1.3, 1.6, -0.39], [0.06, 1.3, 1.6, -2.01], [0.06, 0.06, 2.24, -1.2], [0.06, 0.06, 0.96, -1.2]] as const) {
        const f = new THREE.Mesh(new THREE.BoxGeometry(w, h, z === -1.2 ? 1.68 : 0.06), frameM);
        add(f, -3.45, y, z);
    }
    const slatM = std(0xd8dcd8, 0.45);
    for (let i = 0; i < 14; i++) {
        const s = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.012, 1.6), slatM);
        s.rotation.z = 0.5;
        add(s, -3.42, 1.06 + i * 0.08, -1.2);
    }

    // the bed: frame, mattress, pillow, blanket and the patient
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.08, 2.3), std(0x8a9490, 0.35, 0.7));
    add(frame, 0, 0.27, -2);
    for (const [x, z] of [[-0.55, -3.05], [0.55, -3.05], [-0.55, -0.95], [0.55, -0.95]]) {
        add(new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.27, 8), frame.material), x, 0.135, z);
    }
    const headboard = new THREE.Mesh(new THREE.BoxGeometry(1.25, 0.7, 0.06), std(0xb8c4c0, 0.4));
    add(headboard, 0, 0.9, -3.12);
    const rail = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.25, 1.1), frame.material);
    add(rail, 0.64, 0.95, -1.9);
    const pillow = new THREE.Mesh(new THREE.SphereGeometry(0.3, 18, 10), std(0xe8eeec, 0.9));
    pillow.scale.set(1.3, 0.35, 0.75);
    add(pillow, 0, 0.84, -2.78);

    const patient = buildHumanoid({ skin: 0xc4a490, top: 0x9fc0c8, bottom: 0x9fc0c8, hair: { color: 0x2a1d14, style: 'short' }, build: 0.35, barefoot: true });
    patient.group.rotation.set(-Math.PI / 2, Math.PI, 0); // on his back, head to the wall
    add(patient.group, 0, 0.88, -0.98);
    for (const e of patient.eyes) e.scale.y = 0.08; // eyes closed
    const blanket = new THREE.Mesh(new THREE.BoxGeometry(1.08, 0.26, 1.34, 6, 2, 8), std(0x7f9ea6, 0.95));
    {
        // let it sag over the body and drape at the sides
        const p = blanket.geometry.attributes.position;
        for (let i = 0; i < p.count; i++) {
            const x = p.getX(i), y = p.getY(i);
            const edge = Math.abs(x) / 0.54;
            p.setY(i, y - edge * edge * 0.12 + (y > 0 ? 0.04 * Math.cos(x * 6) : 0));
        }
        blanket.geometry.computeVertexNormals();
    }
    add(blanket, 0, 0.86, -1.63); // folded down at the chest so the face shows
    env.onFrame.push((_d, t) => {
        // ventilator rhythm: a slow, mechanical rise and fall
        const v = Math.max(0, Math.sin(t * 1.25)) ** 2;
        patient.chest.scale.z = 0.62 * (1 + v * 0.06);
        blanket.position.y = 0.86 + v * 0.008;
    });

    // IV stand with a bag and a line down to the arm
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 1.9, 8), std(0xb0b8b8, 0.3, 0.8));
    add(pole, 0.95, 0.95, -2.5);
    add(new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.22, 0.03, 12), pole.material), 0.95, 0.03, -2.5);
    const bag = new THREE.Mesh(new THREE.CapsuleGeometry(0.07, 0.16, 4, 10), new THREE.MeshStandardMaterial({ color: 0xdfeff0, roughness: 0.15, transparent: true, opacity: 0.55 }));
    bag.scale.z = 0.5;
    add(bag, 0.95, 1.72, -2.45);
    const lineM = new THREE.MeshStandardMaterial({ color: 0xe8f0f0, roughness: 0.2, transparent: true, opacity: 0.7 });
    const lineCurve = new THREE.CatmullRomCurve3([new THREE.Vector3(0.95, 1.6, -2.45), new THREE.Vector3(0.85, 1.0, -2.2), new THREE.Vector3(0.45, 0.95, -1.9), new THREE.Vector3(0.28, 0.93, -1.75)]);
    parent.add(new THREE.Mesh(new THREE.TubeGeometry(lineCurve, 24, 0.005, 5), lineM));

    // a visitor's chair, empty
    const chairM = std(0x5a6a72, 0.7);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.5), chairM), 1.7, 0.45, -0.6);
    add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 0.06), chairM), 1.7, 0.72, -0.37);
    for (const [x, z] of [[1.48, -0.38], [1.92, -0.38], [1.48, -0.82], [1.92, -0.82]]) add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.45, 6), pole.material), x, 0.22, z);

    // monitor cart (the true ending already has its monitor; the fatal one gets this)
    if (opts.monitor) {
        const cart = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.1, 0.4), std(0xc0c8c6, 0.5));
        add(cart, -1.6, 0.55, -2.6);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.34), new THREE.MeshBasicMaterial({ color: 0x0c2418 }));
        add(screen, -1.6, 1.4, -2.38);
        const trace = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.02), new THREE.MeshBasicMaterial({ color: new THREE.Color(0x40ff90).multiplyScalar(1.8) }));
        add(trace, -1.6, 1.4, -2.37);
        env.onFrame.push((_d, t) => { trace.scale.y = 1 + Math.max(0, Math.sin(t * 7)) ** 16 * 6; });
    } else {
        add(new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.15, 0.4), std(0xc0c8c6, 0.5)), -1.6, 0.575, -2.6);
    }
    return { patient };
}
