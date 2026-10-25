/**
 * DAY ONE — the forest road and a ranger station whose clock runs backward.
 * Original creature design (a tall siren-headed silhouette on the treeline).
 * Reuses the Prologue's world builders via the same Env/Director/rig/VHS systems.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { terrainH } from './prologue.ts';
import { terrify } from './scary.ts';
import { buildSirenWatcher } from './creatureModels.ts';
import { buildDay1Mall } from './day1Mall.ts';

export function buildDay1(env: Env) {
    // Preserve the original approach footage. The abandoned station becomes the
    // way into Hollowmere Galleria; only the mall act completes this recording.
    buildDay1Approach({ ...env, finish: () => {
        env.scene.children.forEach(node => { node.visible = false; });
        const previous = env.dir.offset;
        env.dir.offset = env.dir.time;
        try { buildDay1Mall(env); } finally { env.dir.offset = previous; }
    } });
}

function buildDay1Approach(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x070b10);
    scene.fog = new THREE.FogExp2(0x070b10, 0.045);
    scene.add(new THREE.HemisphereLight(0x3a5070, 0x101410, 0.45));
    const moon = new THREE.DirectionalLight(0x7f9fd0, 0.7);
    moon.position.set(-20, 40, 10);
    scene.add(moon);
    // ground: a dirt road running into the dark
    const g = new THREE.PlaneGeometry(160, 160, 60, 60);
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position;
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        pos.setY(i, Math.sin(x * 0.2) * 0.2 + Math.cos(z * 0.15) * 0.25);
    }
    g.computeVertexNormals();
    scene.add(new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: 0x1d2418, roughness: 1 })));
    const road = new THREE.Mesh(
        new THREE.PlaneGeometry(3, 160),
        new THREE.MeshStandardMaterial({ color: 0x3b3224, roughness: 1 })
    );
    road.rotation.x = -Math.PI / 2;
    road.position.set(0, 0.02, 0);
    scene.add(road);
    // trees lining the road
    const trunkG = new THREE.CylinderGeometry(0.2, 0.3, 6, 6);
    const coneG = new THREE.ConeGeometry(2, 6, 7);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 1 });
    const leafM = new THREE.MeshStandardMaterial({ color: 0x0f1f14, roughness: 1 });
    const trees: THREE.Group[] = [];
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
        const side = i % 2 ? 1 : -1;
        const z = -60 + rnd() * 90;
        const x = side * (4 + rnd() * 25);
        const t = new THREE.Group();
        const tr = new THREE.Mesh(trunkG, trunkM);
        tr.position.y = 3;
        const c = new THREE.Mesh(coneG, leafM);
        c.position.y = 7;
        t.add(tr, c);
        t.position.set(x, terrainH(x, z) * 0.2, z);
        t.scale.setScalar(0.8 + rnd() * 0.7);
        scene.add(t);
        trees.push(t);
    }
    env.onFrame.push((_d, t) => trees.forEach((tr, i) => (tr.rotation.z = Math.sin(t * 0.7 + i) * 0.01)));
    // ranger station: a small hut with a window and a wall clock
    const station = new THREE.Group();
    station.position.set(0, 0, -22);
    scene.add(station);
    const wallM = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 1 });
    const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 5), wallM);
    hut.position.y = 1.6;
    station.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(5, 2, 4), new THREE.MeshStandardMaterial({ color: 0x1a1410, roughness: 1 }));
    roof.position.y = 4.2;
    roof.rotation.y = Math.PI / 4;
    station.add(roof);
    const doorway = new THREE.PointLight(0xffb060, 2, 12, 1.5);
    doorway.position.set(0, 2, 2);
    station.add(doorway);
    const windowLight = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1), new THREE.MeshBasicMaterial({ color: 0xffc070 }));
    windowLight.position.set(0, 1.8, 2.52);
    station.add(windowLight);
    // day-counter sign
    const signTex = new THREE.Mesh(
        new THREE.PlaneGeometry(1.6, 0.6),
        new THREE.MeshBasicMaterial({ color: 0xd8c8a0 })
    );
    signTex.position.set(-3.5, 1.4, 0);
    signTex.rotation.y = -Math.PI / 2;
    station.add(signTex);
    const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.1), wallM);
    signPost.position.set(-3.5, 0.7, 0);
    station.add(signPost);
    // the watcher: original tall, siren-headed silhouette on the treeline
    const watcher = new THREE.Group();
    const dark = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const sirenSkin = new THREE.MeshStandardMaterial({ color: 0x0a0a0e, roughness: 0.5 });
    const sirenParts = buildSirenWatcher(sirenSkin);
    const body = sirenParts.body;
    const headPole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2, 5), dark);
    headPole.position.y = 9.8;
    const speaker = sirenParts.horn;
    speaker.position.y = 10.8;
    speaker.rotation.x = Math.PI / 2;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.15, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false }));
    lamp.position.set(0, 11.4, 0.4);
    watcher.add(body, headPole, speaker, lamp);
    watcher.position.set(-18, 0, -60);
    watcher.visible = false;
    scene.add(watcher);
    terrify(env, watcher, { creature: 'watcher', arms: { shoulderY: 8.6, width: 0.75, length: 7.6, thickness: 0.09 }, twitch: 0.35, breathe: 0.015, dropout: true });
    env.onFrame.push((_d, t) => {
        if (watcher.visible) {
            lamp.visible = Math.floor(t * 4) % 2 === 0;
            speaker.rotation.z = Math.sin(t * 0.9) * 0.15;
        }
    });
    // flickering station clock + lights
    let stationLights = 1;
    env.onFrame.push((_d, t) => {
        doorway.intensity = 2 * (stationLights * (0.85 + Math.sin(t * 23) * 0.15));
        windowLight.visible = stationLights > 0.1;
    });
    // ================= TIMELINE =================
    const place = (x: number, z: number) => rig.pos.set(x, terrainH(x, z) * 0.2 + 1.7, z);
    place(0, 14);
    rig.yaw = 0;
    rig.pitch = -0.02;
    rig.lookFreedom = 0.5;
    rig.shake = 0.15;
    rig.onStep = () => audio.step(0.8);
    fx.corr = 0.12;
    fx.fade = 1;
    dir.at(0, () => {
        audio.level('wind', 0.2, 3);
        audio.level('hiss', 0.05, 2);
        audio.level('hum', 0.06, 2);
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(3, () => env.say('YOU', 'Okay. The radio said a road. Just follow the road.'));
    // walk the road to the station
    dir.at(6, () => (rig.walk = 1));
    dir.tween(6, 14, (p) => {
        const z = lerp(14, -14, smooth(p));
        place(lerp(0, 0.4, p), z);
        rig.yaw = Math.sin(p * 3) * 0.05;
    });
    dir.at(14, () => env.say('YOU', 'Something about the trees. They keep moving closer.'));
    dir.at(19, () => (rig.walk = 0));
    // the station, the flicker, the clock
    dir.at(21, () => {
        env.say('YOU', 'Hello? Anyone here?');
        audio.breath();
    });
    dir.tween(21, 2, (p) => {
        stationLights = 1 - Math.abs(Math.sin(p * 12)) * 0.4;
    });
    dir.at(25, () => {
        env.say('YOU', "The clock's running backwards.");
        rig.yaw = -0.4;
    });
    dir.at(29, () => {
        stationLights = 0;
        fx.corr = 0.55;
        audio.thump(40, 0.8, 1.6);
        env.glitch(0.5, 0.4);
    });
    dir.at(31, () => {
        stationLights = 1;
        env.title('DAY 01');
        env.say('YOU', 'Day one. Day one. It says day one.');
    });
    dir.at(34, () => audio.horrorBeat('day1', 'road_watcher', 'build', { wind: 0.025, hum: 0.01, hiss: 0.005 }, 4));
    dir.at(36, () => audio.creatureSound('watcher', 55, 'approach', -0.6));
    dir.at(40, () => { audio.creatureSound('watcher', 50, 'reveal', -0.6); audio.horrorBeat('day1', 'road_watcher', 'scare', { wind: 0.02 }); });
    dir.at(49, () => audio.horrorBeat('day1', 'road_watcher', 'release', { wind: 0.07, hum: 0.015, hiss: 0.005 }, 3));
    // the radio / watcher
    dir.at(38, () => {
        audio.staticBurst(0.6, 0.4);
        fx.corr = 0.35;
    });
    dir.at(40, () => {
        watcher.visible = true;
        rig.lookFreedom = 0;
        audio.thump(35, 0.9, 2);
        env.glitch(0.7, 0.4);
    });
    dir.tween(40, 2.5, (p) => {
        const ty = Math.atan2(-(watcher.position.x - rig.pos.x), -(watcher.position.z - rig.pos.z));
        rig.yaw = lerp(rig.yaw, ty, smooth(p) * 0.5);
        rig.pitch = lerp(0, 0.35, smooth(p));
    });
    dir.at(46, () => env.say('???', 'Remain where you are. Assistance is on the way.', { pitch: 0.3, rate: 0.6 }));
    dir.at(52, () => {
        env.say('YOU', "I'm not going to stay here.");
        rig.walk = 1.8;
    });
    // the run back to the station: the sign now reads DAY 02
    dir.tween(52, 5, (p) => {
        place(lerp(0.4, 0, p), lerp(-14, -22, p));
        rig.yaw = 0;
        rig.pitch = lerp(0.35, 0, smooth(p));
    });
    dir.at(56, () => {
        watcher.visible = false;
        fx.corr = 0.85;
        rig.fovKick = 10;
        audio.thump(30, 1, 2.5);
        audio.flutter(0.7);
        env.glitch(0.9, 0.5);
    });
    dir.at(58, () => {
        rig.walk = 0;
        env.title('DAY 02');
        env.say('YOU', 'No. I was just on day one.');
    });
    dir.tween(62, 2, (p) => (fx.fade = smooth(p)));
    // The impossible DAY 02 sign remains an anomaly inside Day One.
    // Mitzi's disappearance and her original line now occur inside the mall.
    dir.at(62, () => env.say('MITZI', 'There is a shopping entrance behind the station. Come on.'));
    dir.at(65, () => env.finish());
}
