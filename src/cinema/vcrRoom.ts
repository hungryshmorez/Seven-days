/**
 * THE VCR ROOM — second cycle only.
 * When a day you are exploring in the cinematic game ends, the recording stops and you are standing in a small
 * dim living room: a couch, a lamp, a tape on the coffee table and a television with a VCR. Walk over, take the
 * tape, put it in. The picture tears and you are somewhere else (the other game, playing the same day as a tape).
 */
import * as THREE from 'three';
import type { Env } from './director.ts';
import { smooth } from './director.ts';
import { store } from '../state/store.ts';

const ROOM = { minX: -2.7, maxX: 2.7, minZ: -3.0, maxZ: 3.3 };

function labelTexture(n: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = 256; c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#d9d2c0'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#7a1010'; x.fillRect(0, 0, 256, 26);
    x.fillStyle = '#1a1a1a'; x.font = 'bold 40px monospace'; x.fillText('TAPE ' + String(n).padStart(2, '0'), 24, 82);
    x.font = '18px monospace'; x.fillText('DO NOT WATCH ALONE', 24, 112);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

/** Builds the room into env.scene, places the player and wires the two interactions. `onInserted` fires once the tape is in. */
export function buildVcrRoom(env: Env, tapeNo: number, onInserted: () => void): void {
    const { scene, rig, audio, dir, fx } = env;
    const std = (color: number, roughness = 0.85, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const room = new THREE.Group();
    scene.add(room);
    scene.background = new THREE.Color(0x07090c);
    const add = <T extends THREE.Object3D>(o: T, x: number, y: number, z: number): T => { o.position.set(x, y, z); room.add(o); return o; };

    // shell
    const walls = new THREE.Mesh(new THREE.BoxGeometry(5.8, 2.7, 6.6), std(0x4a4036, 0.95));
    (walls.material as THREE.Material).side = THREE.BackSide;
    add(walls, 0, 1.35, 0.15);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(5.8, 6.6), std(0x2e2218, 0.7));
    floor.rotation.x = -Math.PI / 2;
    add(floor, 0, 0.001, 0.15);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 2.0), std(0x5a2a22, 1));
    rug.rotation.x = -Math.PI / 2;
    add(rug, 0, 0.006, 0.2);

    // couch (left) and coffee table with the tape
    const couch = new THREE.Group();
    const seat = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.42, 2.0), std(0x3b4a3a, 0.95)); seat.position.y = 0.21; couch.add(seat);
    const back = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.6, 2.0), std(0x34423a, 0.95)); back.position.set(-0.38, 0.62, 0); couch.add(back);
    add(couch, -2.2, 0, 0.4);
    const table = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.06, 0.7), std(0x5c4430, 0.6)); top.position.y = 0.44; table.add(top);
    for (const [x, z] of [[-0.48, -0.28], [0.48, -0.28], [-0.48, 0.28], [0.48, 0.28]]) { const l = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.42, 0.06), std(0x2a1f16)); l.position.set(x, 0.21, z); table.add(l); }
    const TABLE = new THREE.Vector3(-0.9, 0, 0.7);
    add(table, TABLE.x, 0, TABLE.z);
    const tape = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.105), [std(0x111111), std(0x111111), new THREE.MeshStandardMaterial({ map: labelTexture(tapeNo), roughness: 0.6 }), std(0x111111), std(0x111111), std(0x111111)]);
    tape.position.set(0.1, 0.49, 0.02);
    tape.rotation.y = 0.5;
    table.add(tape);

    // TV stand, television, VCR
    const TV = new THREE.Vector3(0.9, 0, -2.75);
    const stand = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.5, 0.55), std(0x2a2a2e, 0.5, 0.3));
    add(stand, TV.x, 0.25, TV.z);
    const vcr = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.1, 0.4), std(0x18181a, 0.4, 0.5));
    add(vcr, TV.x, 0.55, TV.z + 0.02);
    const slot = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.03, 0.02), new THREE.MeshBasicMaterial({ color: 0x020202 }));
    add(slot, TV.x, 0.56, TV.z + 0.225);
    const led = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.015, 0.01), new THREE.MeshBasicMaterial({ color: 0xff2020 }));
    add(led, TV.x + 0.24, 0.585, TV.z + 0.225);
    const tvBody = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.85, 0.75), std(0x1d1d20, 0.5, 0.2));
    add(tvBody, TV.x, 1.03 + 0.07, TV.z);
    const screenMat = new THREE.MeshBasicMaterial({ color: 0x14202c });
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.62), screenMat);
    add(screen, TV.x, 1.1, TV.z + 0.378);

    // light: one warm lamp, one cold screen glow
    const lampBase = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 0.05, 10), std(0x2a2018));
    add(lampBase, 2.2, 0.025, 1.4);
    const lampPole = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 1.35, 6), std(0x2a2018));
    add(lampPole, 2.2, 0.7, 1.4);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd7a0).multiplyScalar(1.4), side: THREE.DoubleSide }));
    add(shade, 2.2, 1.45, 1.4);
    const lamp = new THREE.PointLight(0xffc27a, 55, 9, 1.5);
    add(lamp, 2.2, 1.35, 1.4);
    const glow = new THREE.PointLight(0x7fa8ff, 22, 7, 1.6);
    add(glow, TV.x, 1.2, TV.z + 1.1);
    scene.add(new THREE.HemisphereLight(0x8a8a9a, 0x2a2018, 1.6));
    fx.exposure = 1.8;

    // the player's place and the walls / furniture they cannot walk through
    rig.pos.set(0.3, 1.55, 2.6);
    rig.yaw = 0.15; rig.pitch = -0.04; rig.lookFreedom = 0; rig.roll = 0; rig.walk = 0; rig.shake = 0.02; rig.fovKick = 0;
    const ex = env.explore;
    ex.active = true; ex.speed = 2.0;
    ex.bounds = ROOM;
    const boxes: [number, number, number, number][] = [
        [-2.75, -1.1, -0.6, 1.9],                       // couch
        [TABLE.x - 0.6, TABLE.z - 0.42, TABLE.x + 0.6, TABLE.z + 0.42], // coffee table
        [TV.x - 0.8, TV.z - 0.4, TV.x + 0.8, TV.z + 0.4],               // TV stand
    ];
    ex.collide = (x, z) => boxes.some(([a, b, c, d]) => x > a && x < c && z > b && z < d);

    let held = false;
    let inserting = false;
    const near = (v: THREE.Vector3, r: number) => Math.hypot(rig.pos.x - v.x, rig.pos.z - v.z) < r;
    const label = () => (inserting ? '' : !held ? (near(TABLE, 1.8) ? 'Take the tape' : '') : near(TV, 2.0) ? 'Put the tape in the VCR' : '');
    const use = () => {
        if (inserting) return;
        if (!held && near(TABLE, 1.8)) {
            held = true; tape.visible = false;
            audio.thump(60, 0.3, 0.6);
            env.say('YOU', `Tape ${String(tapeNo).padStart(2, '0')}. It is my handwriting.`);
            return;
        }
        if (held && near(TV, 2.0)) {
            inserting = true;
            ex.active = false;
            audio.thump(50, 0.6, 1.2);
            env.say('YOU', 'If I put this in, I go back in. I know that now.');
            dir.at(dir.time + 1.6, () => { audio.staticBurst(0.9, 0.5); screenMat.color.set(0xdfe8ff); env.glitch(0.9, 0.8); fx.corr = 0.9; });
            dir.tween(dir.time + 1.8, 1.6, (p) => { fx.fade = smooth(p); fx.fovKick = 22 * p; });
            dir.at(dir.time + 3.6, () => { store.patch({ useLabel: '' }); onInserted(); });
            return;
        }
        if (held) env.say('YOU', 'The VCR. That is where it goes.');
        else if (near(TV, 2.2)) env.say('YOU', 'The VCR is empty. The tape is on the coffee table.');
        else env.say('YOU', 'Nothing here. The tape was on the table.');
    };
    ex.onUse = use;

    let last = '';
    env.onFrame.push((_dt, t) => {
        const l = label();
        if (l !== last) { last = l; store.patch({ useLabel: l }); }
        // the screen breathes; the LED blinks
        if (!inserting) screenMat.color.setRGB(0.06 + 0.02 * Math.sin(t * 2.1) + Math.random() * 0.012, 0.11, 0.16);
        led.visible = Math.sin(t * 5) > -0.3;
        glow.intensity = 22 + Math.sin(t * 9) * 2;
    });
    // fade in
    fx.fade = 1;
    dir.at(dir.time + 0.05, () => {
        audio.level('hum', 0.02, 1.5); audio.level('ocean', 0, 0.5); audio.level('wind', 0, 0.5); audio.level('hiss', 0.01, 1);
        env.title('', 0);
        env.say('YOU', 'Another recording ends. There is a tape on the table.');
    });
    dir.tween(dir.time + 0.1, 2.2, (p) => (fx.fade = 1 - smooth(p)));
}
