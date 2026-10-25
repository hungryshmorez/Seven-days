/**
 * DAY TWO — the Nostalgia Warehouse. Memory screens, a false exit, the
 * Cleaverback returning, and the RENDER DISTANCE elevator.
 * Built on the same Env/Director/rig/VHS systems as the other days.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { terrify } from './scary.ts';
import { stageAct } from './director.ts';
import { boneMat, buildCleaverback, metalMat } from './creatureModels.ts';
import { buildDay2Bedroom } from './day2Bedroom.ts';

export function buildDay2(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x171310);
    scene.fog = new THREE.FogExp2(0x171310, 0.028);
    scene.add(new THREE.HemisphereLight(0xd8c8a8, 0x2a2018, 0.5));
    const amber = new THREE.PointLight(0xffb050, 3, 40, 1.2);
    amber.position.set(0, 6, -30);
    scene.add(amber);
    // floor of cracked concrete + faded aisle carpet
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), new THREE.MeshStandardMaterial({ color: 0x4a4038, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, 0, -40);
    scene.add(floor);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(6, 120), new THREE.MeshStandardMaterial({ color: 0x6a2a2a, roughness: 1 }));
    carpet.rotation.x = -Math.PI / 2;
    carpet.position.set(0, 0.01, -40);
    scene.add(carpet);
    // shelving racks both sides, stacked with dusty boxes
    const rackM = new THREE.MeshStandardMaterial({ color: 0x5a5148, roughness: 0.8, metalness: 0.3 });
    const boxM = new THREE.MeshStandardMaterial({ color: 0x8a7455, roughness: 1 });
    const boxM2 = new THREE.MeshStandardMaterial({ color: 0x6a7a8a, roughness: 1 });
    for (let side = -1; side <= 1; side += 2) {
        for (let a = 0; a < 6; a++) {
            const rack = new THREE.Mesh(new THREE.BoxGeometry(1.2, 6, 10), rackM);
            rack.position.set(side * 8, 3, -a * 16 - 6);
            scene.add(rack);
            for (let s = 0; s < 3; s++) {
                const bx = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 2.2), (s + a) % 2 ? boxM : boxM2);
                bx.position.set(side * 8, 1.2 + s * 2, -a * 16 - 6 + (s % 2 ? 1.5 : -1.5));
                bx.rotation.y = (s * 0.3 + a) % 0.6;
                scene.add(bx);
            }
        }
    }
    // rows of old TVs playing static / memory colors
    const tvMats: THREE.MeshBasicMaterial[] = [];
    const tvGeo = new THREE.PlaneGeometry(1.8, 1.3);
    for (let i = 0; i < 24; i++) {
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((i * 0.13) % 1, 0.5, 0.4) });
        tvMats.push(m);
        const tv = new THREE.Mesh(tvGeo, m);
        const side = i % 2 ? 1 : -1;
        tv.position.set(side * 5.5, 1.6 + (i % 3) * 0.8, -Math.floor(i / 2) * 8 - 8);
        tv.rotation.y = side * -0.5;
        scene.add(tv);
    }
    env.onFrame.push((_d, t) => {
        tvMats.forEach((m, i) => {
            const f = Math.sin(t * 7 + i * 1.7) > 0.92 ? 0.05 : 0.35 + 0.1 * Math.sin(t * 3 + i);
            m.color.setHSL((i * 0.13) % 1, 0.5, f);
        });
    });
    // the false exit door at the far end
    const exitDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4.5, 0.3), new THREE.MeshStandardMaterial({ color: 0x2a6a3a, emissive: 0x1d5c2a }));
    exitDoor.position.set(0, 2.25, -92);
    scene.add(exitDoor);
    // the RENDER DISTANCE lift (elevator) on the right
    const lift = new THREE.Group();
    lift.position.set(7.5, 0, -55);
    scene.add(lift);
    const liftBody = new THREE.Mesh(new THREE.BoxGeometry(3.4, 5, 3), new THREE.MeshStandardMaterial({ color: 0x3a3f4a, roughness: 0.5, metalness: 0.6 }));
    liftBody.position.y = 2.5;
    lift.add(liftBody);
    const liftDoorL = new THREE.Mesh(new THREE.BoxGeometry(0.8, 3.6, 0.1), new THREE.MeshStandardMaterial({ color: 0x9aa2b0, metalness: 0.8, roughness: 0.3 }));
    liftDoorL.position.set(-0.42, 1.8, -1.55);
    lift.add(liftDoorL);
    const liftDoorR = liftDoorL.clone();
    liftDoorR.position.x = 0.42;
    lift.add(liftDoorR);
    const liftLamp = new THREE.Mesh(new THREE.SphereGeometry(0.12, 8, 6), new THREE.MeshBasicMaterial({ color: 0x30ff70 }));
    liftLamp.position.set(0, 4.6, -1.6);
    lift.add(liftLamp);
    // memory screens: translucent colored planes hanging mid-air
    const memMats: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 10; i++) {
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(0.08 + i * 0.06, 0.6, 0.4), transparent: true, opacity: 0.5, side: THREE.DoubleSide });
        memMats.push(m);
        const p = new THREE.Mesh(new THREE.PlaneGeometry(4, 2.6), m);
        p.position.set(i % 2 ? 3.5 : -3.5, 3, -14 - i * 7);
        p.rotation.y = i % 2 ? -0.4 : 0.4;
        scene.add(p);
    }
    env.onFrame.push((_d, t) => memMats.forEach((m, i) => (m.opacity = 0.35 + 0.2 * Math.sin(t * 1.3 + i * 2))));
    // ---- the Cleaverback returns (taller, thinner here) ----
    const beast = new THREE.Group();
    const hide = new THREE.MeshStandardMaterial({ color: 0x2e2018, roughness: 1 });
    beast.add(buildCleaverback(hide, boneMat(), metalMat()).group);
    beast.position.set(0, 0, -70);
    beast.visible = false;
    scene.add(beast);
    terrify(env, beast, { creature: 'cleaverback',
        eyes: { at: [0, 5.1, 1.33], spread: [0.4, 0, 0], size: 0.07, color: 0xffd28a },
        teeth: { at: [0, 4.62, 1.88], spread: [0.22, 0, 0], count: 6, size: 0.09 },
        legs: { at: [0, 0.85, 0], count: 4, length: 0.85, thickness: 0.09 },
        twitch: 0.5, breathe: 0.04,
    });
    // ================= TIMELINE =================
    const place = (x: number, z: number) => rig.pos.set(x, 1.7, z);
    place(0, 6);
    rig.yaw = 0;
    rig.pitch = -0.02;
    rig.lookFreedom = 0.55;
    rig.shake = 0.12;
    rig.onStep = () => audio.step(0.7);
    fx.corr = 0.08;
    fx.fade = 1;
    dir.at(0, () => {
        audio.level('wind', 0.03, 2);
        audio.level('hum', 0.16, 2);
        audio.level('hiss', 0.03, 2);
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(2, () => env.title('DAY TWO — THE NOSTALGIA WAREHOUSE', 5));
    dir.at(3, () => env.say('SYSTEM VOICE', 'Warm memories. Quiet aisles. Take your time.', { pitch: 0.8, rate: 0.85 }));
    dir.at(7, () => env.say('YOU', 'These are my memories.'));
    dir.at(10, () => env.say('SYSTEM VOICE', 'They belong to us now.', { pitch: 0.8, rate: 0.85 }));
    // walk the aisle
    dir.at(13, () => (rig.walk = 1));
    dir.tween(13, 15, (p) => {
        place(Math.sin(p * 5) * 0.8, lerp(6, -34, smooth(p)));
        rig.yaw = Math.sin(p * 2.2) * 0.12;
    });
    dir.at(30, () => {
        rig.walk = 0;
        fx.corr = 0.12;
        env.say('YOU', 'A way out. There — the green door.');
        fx.corr = 0.12;
    });
    dir.at(36, () => (rig.walk = 1));
    dir.tween(36, 8, (p) => place(lerp(0, 0, p), lerp(-34, -52, smooth(p))));
    dir.at(38, () => audio.creatureSound('cleaverback', 25, 'approach', 0.3));
    dir.at(30.5, () => audio.horrorBeat('day2', 'false_exit', 'build', { wind: 0.02, hum: 0.008, hiss: 0.005 }, 7));
    dir.at(37, () => audio.horrorBeat('day2', 'warehouse_beast', 'scare', { wind: 0.03 }));
    dir.at(39, () => { fx.corr = 0.12; rig.fovKick = 0; audio.creatureSound('cleaverback', 18, 'approach', 0.2); });
    dir.at(60.5, () => audio.horrorBeat('day2', 'bedroom_threshold', 'release', { wind: 0, hum: 0.015, hiss: 0.005 }, 3));
    // the false exit: door opens onto a wall + the Cleaverback is back
    dir.at(45, () => {
        rig.walk = 0;
        exitDoor.material = new THREE.MeshStandardMaterial({ color: 0x333333 });
        env.say('YOU', "It's a wall. It's just a painted wall.");
        audio.breath();
    });
    dir.at(42, () => audio.creatureSound('cleaverback', 12, 'reveal', 0.2));
    dir.at(42, () => {
        beast.visible = true;
        beast.position.set(0, 0, -64);
        audio.thump(35, 0.09, 2);
        env.glitch(0.08, 0.2);
    });
    dir.tween(42, 3, (p) => {
        rig.yaw = lerp(0, Math.atan2(-(beast.position.x - rig.pos.x), -(beast.position.z - rig.pos.z)), smooth(p) * 0.6);
    });
    dir.at(47, () => env.say('???', 'You didn’t get away. You just changed channels.', { pitch: 0.4, rate: 0.7 }));
    dir.at(50, () => { beast.visible = false; fx.corr = 0.1; });
    // run to the lift, doors open
    dir.at(53, () => (rig.walk = 1.9));
    dir.tween(53, 5, (p) => {
        place(lerp(0, 6.4, smooth(p)), lerp(-52, -53.6, smooth(p)));
        rig.yaw = lerp(rig.yaw, Math.PI / 2, 0.1);
    });
    dir.at(58, () => {
        rig.walk = 0;
        rig.yaw = -Math.PI / 2; // face the doors (-x side)
    });
    dir.tween(59, 2.5, (p) => {
        liftDoorL.position.x = -0.42 - p * 0.7;
        liftDoorR.position.x = 0.42 + p * 0.7;
    });
    dir.at(62, () => env.say('YOU', "Render distance. It says 'render distance'."));
    dir.tween(63, 2, (p) => {
        place(lerp(6.4, 7.5, p), -53.6);
    });
    dir.at(65.5, () => {
        fx.corr = 0.4;
        audio.thump(45, 0.7, 1.5);
    });
    // D2-S04: the bedroom insert runs first (at ~66s). After it resolves, the lift
    // descent continues seamlessly here — the SAME buildDay2 call, director
    // offset — because resetting the shared AudioEngine or rebuilding the scene
    // in a second call corrupted the audio mix and duplicated the timeline.
    stageAct(env, 66, buildDay2Bedroom);
    // reflection shows a figure that is not the protagonist
    dir.at(66 + 35, () => {
        env.say('YOU', 'Wait. In the reflection — that’s not me.');
        env.glitch(0.35, 0.6);
    });
    dir.at(66 + 40, () => env.say('REFLECTION', 'Closer than you think.', { pitch: 0.6, rate: 0.8 }));
    dir.at(66 + 45, () => { env.glitch(0.7, 0.5); audio.thump(35, 0.9, 2); });
    // doors close, long descent, day title appears mid-descent
    dir.tween(66 + 47, 2, (p) => {
        liftDoorL.position.x = -1.12 + p * 0.7;
        liftDoorR.position.x = 1.12 - p * 0.7;
    });
    dir.tween(66 + 49, 9, (p) => {
        // the lift descends: world slides up past the doors' seam + rumble
        lift.position.y = -p * 30;
        rig.pos.y = 1.7 - p * 0.4;
        rig.shake = 0.12 + p * 0.2;
        amber.intensity = 3 - p * 2;
    });
    dir.at(66 + 52, () => env.title('DAY THREE — RENDER DISTANCE', 5));
    dir.at(66 + 56, () => env.say('YOU', 'Going down. It just keeps going down.'));
    dir.at(66 + 59, () => env.finish());
}
