/**
 * DAY THREE — the unfinished level. Original creatures stand in for the
 * copyrighted characters in the script:
 *   - "Blur Runner" (the blue figure, a fixed grin, finger to mouth)
 *   - "Fox Glitch" (the injured fox-like figure whose eyes go black)
 * Story beats are kept; the episode ends on a DAY FOUR title and a fall
 * into the forest.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { setFriend } from './crash.ts';
import { terrify } from './scary.ts';
import { buildFox, buildWraith } from './creatureModels.ts';
import { stageAct } from './director.ts';
import { buildDay3Home } from './day3Home.ts';

export function buildDay3(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x05060c);
    scene.fog = new THREE.FogExp2(0x05060c, 0.02);
    scene.add(new THREE.HemisphereLight(0x6070a0, 0x202030, 0.6));
    const sun = new THREE.DirectionalLight(0xa0b0ff, 0.8);
    sun.position.set(20, 40, 10);
    scene.add(sun);
    // ---- checkerboard floor that only partly "loaded" ----
    const checker = new THREE.Group();
    scene.add(checker);
    const tile = new THREE.PlaneGeometry(4, 4);
    tile.rotateX(-Math.PI / 2);
    const mA = new THREE.MeshStandardMaterial({ color: 0x3a7a3a, roughness: 1 });
    const mB = new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 1 });
    const grey = new THREE.MeshStandardMaterial({ color: 0x555555, roughness: 1, wireframe: false });
    const tiles: THREE.Mesh[] = [];
    for (let i = -12; i <= 12; i++) {
        for (let j = -12; j <= 12; j++) {
            const loaded = Math.abs(i * 7 + j * 3) % 11 > 2;
            const m = new THREE.Mesh(tile, loaded ? ((i + j) % 2 ? mA : mB) : grey);
            m.position.set(i * 4, 0, j * 4 - 20);
            checker.add(m);
            tiles.push(m);
        }
    }
    // floating frozen objects
    const cubeG = new THREE.BoxGeometry(1.5, 1.5, 1.5);
    const cubeM = new THREE.MeshStandardMaterial({ color: 0xe0c040, roughness: 0.5 });
    const floaters: THREE.Mesh[] = [];
    for (let i = 0; i < 12; i++) {
        const c = new THREE.Mesh(cubeG, cubeM);
        c.position.set(-30 + i * 5, 8 + (i % 3) * 3, -40 - (i % 4) * 8);
        scene.add(c);
        floaters.push(c);
    }
    env.onFrame.push((_d, t) => {
        floaters.forEach((c, i) => {
            if (!frozen) c.rotation.y = t * 0.6 + i; // frozen when the world stops
        });
    });
    // ---- hills, bridge, loop structures ----
    const hill = new THREE.Mesh(new THREE.ConeGeometry(30, 22, 10), new THREE.MeshStandardMaterial({ color: 0x2a3a5a, roughness: 1 }));
    hill.position.set(-30, 0, -80);
    scene.add(hill);
    const loopM = new THREE.MeshStandardMaterial({ color: 0x7040c0, roughness: 0.4, metalness: 0.2 });
    const loop = new THREE.Mesh(new THREE.TorusGeometry(6, 0.5, 8, 28), loopM);
    loop.position.set(16, 6, -48);
    scene.add(loop);
    const loop2 = new THREE.Mesh(new THREE.TorusGeometry(4, 0.4, 8, 24), loopM);
    loop2.position.set(-14, 4, -70);
    scene.add(loop2);
    const bridgeM = new THREE.MeshStandardMaterial({ color: 0x6a4a2a, roughness: 1 });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 16), bridgeM);
    bridge.position.set(0, 1.2, -30);
    scene.add(bridge);
    const bridgeBroken = new THREE.Mesh(new THREE.BoxGeometry(6, 0.4, 5), bridgeM);
    bridgeBroken.position.set(0, 1.2, -46);
    bridgeBroken.rotation.x = 0.4;
    scene.add(bridgeBroken);
    // distant castle that flickers between shapes
    const castle = new THREE.Group();
    castle.position.set(40, 0, -110);
    scene.add(castle);
    const cb = new THREE.Mesh(new THREE.BoxGeometry(14, 16, 14), new THREE.MeshStandardMaterial({ color: 0x404a6a, roughness: 1 }));
    cb.position.y = 8;
    castle.add(cb);
    for (let i = 0; i < 4; i++) {
        const tw = new THREE.Mesh(new THREE.ConeGeometry(2.5, 6, 6), new THREE.MeshStandardMaterial({ color: 0x603060 }));
        tw.position.set(i % 2 ? 5 : -5, 17, i < 2 ? 5 : -5);
        castle.add(tw);
    }
    env.onFrame.push((_d, t) => {
        castle.visible = frozen || Math.floor(t * 9) % 3 !== 0; // flickers
    });
    // ---- the blue runner (original) ----
    const runner = new THREE.Group();
    const runnerM = new THREE.MeshStandardMaterial({ color: 0x1e5cff, roughness: 0.4 });
    runnerM.userData.creatureVeins = 0.15;
    const wraith = buildWraith(runnerM);
    const head = wraith.head;
    const eyeD = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeR = new THREE.MeshBasicMaterial({ color: 0xff2020 });
    const socketL = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), eyeD);
    socketL.position.set(-0.3, 3.3, 0.65);
    const socketR = socketL.clone();
    socketR.position.x = 0.3;
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), eyeR);
    pupil.position.set(0.3, 3.3, 0.8);
    runner.add(wraith.group, socketL, socketR, pupil);
    runner.visible = false;
    scene.add(runner);
    terrify(env, runner, { creature: 'velocity_wraith', teeth: { at: [0, 2.95, 0.74], spread: [0.6, 0, 0], count: 9, size: 0.11 }, twitch: 0.7, dropout: true });
    // ---- the fox-like figure (original) ----
    const fox = new THREE.Group();
    const foxM = new THREE.MeshStandardMaterial({ color: 0xc86a20, roughness: 0.6 });
    foxM.userData.creatureVeins = 0;
    const foxDark = new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.7 });
    const foxPale = new THREE.MeshStandardMaterial({ color: 0xe8dcc8, roughness: 0.7 });
    foxPale.userData.creatureVeins = 0;
    const foxBody = buildFox(foxM, foxDark, foxPale);
    const fEyeW = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const fEyeB = new THREE.MeshBasicMaterial({ color: 0x000000 });
    const eyeA = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 6), fEyeW);
    eyeA.position.set(1.28, 1.8, 0.2);
    const eyeB = eyeA.clone();
    eyeB.position.z = -0.2;
    fox.add(foxBody.group, eyeA, eyeB);
    fox.position.set(-6, 0, -22);
    fox.visible = false;
    scene.add(fox);
    terrify(env, fox, { creature: 'fox_figure', twitch: 0.45, breathe: 0.03 });
    // ---- the chase path: unloaded platforms and a gap ----
    const plat = new THREE.Mesh(new THREE.BoxGeometry(4, 0.6, 4), bridgeM);
    const gapPlats: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
        const p = plat.clone();
        p.position.set(-4 + i * 1.5, 0.3 + (i % 2) * 0.6, -34 - i * 6);
        scene.add(p);
        gapPlats.push(p);
    }
    // void with abandoned models
    const voidMesh = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshBasicMaterial({ color: 0x010102 }));
    voidMesh.rotation.x = -Math.PI / 2;
    voidMesh.position.y = -30;
    scene.add(voidMesh);
    const relic = new THREE.Mesh(new THREE.BoxGeometry(2, 4, 2), new THREE.MeshStandardMaterial({ color: 0x5a5a6a, wireframe: true }));
    relic.position.set(0, -20, -45);
    scene.add(relic);
    // ---- debug chamber (dark room with monitors) ----
    const chamber = new THREE.Group();
    chamber.position.set(0, -60, -40);
    chamber.visible = false;
    scene.add(chamber);
    const floorC = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x0a0a12, roughness: 0.7 }));
    floorC.rotation.x = -Math.PI / 2;
    chamber.add(floorC);
    const monitorG = new THREE.PlaneGeometry(3, 2);
    const monitorMats: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 60; i++) {
        const mm = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((i * 0.07) % 1, 0.6, 0.45) });
        monitorMats.push(mm);
        const mon = new THREE.Mesh(monitorG, mm);
        mon.position.set(-40 + (i % 10) * 8, 4 + Math.floor(i / 10) * 3, -10 - Math.floor(i / 10) * 2);
        chamber.add(mon);
    }
    const terminal = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.6), new THREE.MeshStandardMaterial({ color: 0x222233 }));
    terminal.position.set(0, 1, -6);
    chamber.add(terminal);
    const door404 = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.3), new THREE.MeshStandardMaterial({ color: 0x402020 }));
    door404.position.set(0, 2, -18);
    chamber.add(door404);
    env.onFrame.push((_d, t) => {
        monitorMats.forEach((m, i) => (m.color.setHSL(((i * 0.07) + t * 0.05) % 1, 0.6, 0.35 + 0.15 * Math.sin(t * 2 + i))));
    });
    // ---- forest (ending) ----
    const forest = new THREE.Group();
    forest.position.set(0, -200, 0);
    forest.visible = false;
    scene.add(forest);
    const forestGround = new THREE.Mesh(new THREE.PlaneGeometry(600, 600), new THREE.MeshStandardMaterial({ color: 0x0d1a0d, roughness: 1 }));
    forestGround.rotation.x = -Math.PI / 2;
    forest.add(forestGround);
    // ---- shared state ----
    let frozen = false;
    let collapsing = 0;
    env.onFrame.push((_d, t) => {
        if (collapsing > 0) {
            collapsing = Math.max(0, collapsing - _d);
            checker.position.y = -(1 - collapsing) * 2;
        }
        if (!frozen) {
            // gentle drift of the grid, stops when frozen
            checker.rotation.y = Math.sin(t * 0.02) * 0.01;
        }
    });
    // ================= TIMELINE =================
    const place = (x: number, y: number, z: number) => rig.pos.set(x, y, z);
    place(0, 1.7, 8);
    rig.yaw = Math.PI;
    rig.pitch = -0.03;
    rig.lookFreedom = 0.6;
    rig.shake = 0.12;
    rig.onStep = () => audio.step(0.8);
    fx.corr = 0.3;
    fx.fade = 1;
    dir.at(0, () => {
        audio.level('wind', 0.1, 2);
        audio.level('hum', 0.12, 2);
        env.say('YOU', "This isn't real. None of this is fucking real.");
    });
    dir.tween(0, 2.5, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(4, () => {
        audio.staticBurst(0.4, 0.2);
    });
    dir.at(5, () => env.title('WELCOME TO THE LAST LEVEL', 4));
    dir.at(10, () => env.title('YOU HAVE ALREADY LOST', 4));
    dir.at(10.5, () => env.say('RADIO', 'Distant melody from nowhere.'));
    // walk the floor
    dir.at(14, () => (rig.walk = 1));
    dir.tween(14, 8, (p) => {
        place(lerp(0, -2, smooth(p)), 1.7, lerp(8, -10, smooth(p)));
        rig.yaw = Math.PI * (1 - p * 0.2);
    });
    dir.at(18.5, () => audio.horrorBeat('day3', 'unfinished_hillside', 'build', { wind: 0.025, hum: 0.015, hiss: 0.005 }, 3));
    dir.at(20, () => audio.creatureSound('velocity_wraith', 65, 'approach', -0.7));
    dir.at(22, () => audio.creatureSound('velocity_wraith', 60, 'reveal', -0.5));
    dir.at(37, () => { audio.creatureSound('velocity_wraith', 6, 'reveal'); audio.horrorBeat('day3', 'runner_closes', 'scare', { hum: 0.06 }); });
    dir.at(41, () => { fx.corr = 0.12; audio.horrorBeat('day3', 'valley', 'release', { hum: 0.015, wind: 0.025 }, 3); });
    dir.at(42, () => audio.creatureSound('fox_figure', 12, 'approach', -0.5));
    dir.at(44, () => audio.creatureSound('fox_figure', 10, 'reveal', -0.5));
    dir.at(70, () => audio.horrorBeat('day3', 'broken_platforms', 'build', { wind: 0, hum: 0.005, hiss: 0.005 }, 5));
    dir.at(95, () => { fx.corr = 0.12; audio.horrorBeat('day3', 'debug_chamber', 'release', { wind: 0, hum: 0.02 }, 10); });
    // the blue runner crosses the hillside
    dir.at(22, () => {
        runner.visible = true;
        runner.position.set(-50, 0, -80);
        audio.thump(60, 0.6, 1);
    });
    dir.tween(22, 1.2, (p) => {
        runner.position.x = lerp(-50, 40, p);
        // the world distorts as it passes
        fx.corr = 0.3 + 0.4 * Math.sin(p * Math.PI);
    });
    dir.at(24, () => (runner.visible = false));
    // the broken bridge and the far silhouette (runner stands still)
    dir.tween(25, 3, (p) => {
        place(lerp(-2, 0, smooth(p)), 1.7, lerp(-10, -26, smooth(p)));
        rig.yaw = lerp(rig.yaw, 0, 0.05);
    });
    dir.at(28, () => {
        runner.visible = true;
        runner.position.set(0, 0, -50);
        // finger to mouth
        head.rotation.z = 0.2;
        env.say('???', 'Shhh. The world hasn\'t finished loading.', { pitch: 1.4, rate: 0.9 });
        frozen = true;
    });
    dir.at(33, () => {
        // environment freezes
        rig.walk = 0;
        audio.level('wind', 0, 0.2);
        audio.level('hum', 0.25, 0.5);
        fx.corr = 0.55;
    });
    dir.at(37, () => {
        runner.position.set(0, 0, -20); // suddenly much closer
        audio.thump(70, 0.9, 1.5);
        env.glitch(0.6, 0.4);
        env.say('YOU', 'What the fuck?');
    });
    dir.at(41, () => {
        runner.visible = false;
        frozen = false;
    });
    // the fox-like figure in the valley
    dir.at(44, () => {
        fox.visible = true;
        rig.walk = 1;
        env.say('YOU', 'Hey, you. Are you hurt?');
    });
    dir.tween(44, 6, (p) => {
        place(lerp(-2, -4, smooth(p)), 1.7, lerp(-26, -32, smooth(p)));
        const ty = Math.atan2(-(fox.position.x - rig.pos.x), -(fox.position.z - rig.pos.z));
        rig.yaw = lerp(rig.yaw, ty, 0.04);
        rig.pitch = -0.1;
    });
    dir.at(51, () => {
        rig.walk = 0;
        env.say('???', "Don't run when the music stops.", { pitch: 1.2, rate: 0.85 });
    });
    dir.at(56, () => env.say('YOU', 'What are you?'));
    dir.at(60, () => env.say('???', 'Something that used to have a name.', { pitch: 1.2, rate: 0.85 }));
    dir.at(65, () => {
        fEyeW.color.setHex(0x000000); // eyes turn black
        eyeA.material = fEyeB;
        eyeB.material = fEyeB;
        audio.thump(45, 0.6, 1.2);
    });
    dir.at(69, () => env.say('???', 'He can hear your footsteps.', { pitch: 1.2, rate: 0.85 }));
    dir.at(72, () => {
        // distorted electronic alarm
        audio.staticBurst(1.2, 0.08);
        audio.thump(55, 0.08, 1.5);
        env.glitch(0.08, 0.2);
        fx.corr = 0.12;
    });
    // the chase: blue runner charges over collapsing platforms
    dir.at(76, () => {
        fox.visible = false;
        runner.visible = true;
        runner.position.set(0, 0, -40);
        rig.walk = 1.8;
        env.say('YOU', 'Run. Run!');
    });
    dir.tween(76, 7, (p) => {
        place(lerp(-4, -4, p), 1.7, lerp(-32, -58, smooth(p)));
        runner.position.z = lerp(-40, -54, p);
        runner.position.y = Math.abs(Math.sin(p * 20)) * 0.4;
        // platforms fail to render under the protagonist's feet
        gapPlats.forEach((pl, i) => (pl.visible = !(p > 0.3 + i * 0.08 && i % 2 === 0)));
        fx.corr = 0.6 + 0.2 * Math.sin(p * 10);
    });
    dir.at(83, () => {
        rig.walk = 0;
        // leap and hand catches the edge: camera swings down into the void
        env.glitch(0.9, 0.5);
        audio.thump(50, 1, 1.5);
    });
    dir.tween(83, 3, (p) => {
        rig.pitch = lerp(-0.1, -0.9, smooth(p));
        rig.roll = Math.sin(p * 12) * 0.2 * (1 - p);
    });
    dir.at(86, () => {
        env.say('???', "You can't outrun something that knows the map.", { pitch: 1.4, rate: 0.9 });
    });
    dir.at(90, () => {
        // loses grip: falls into the debug chamber
        rig.roll = 0;
        rig.pitch = -0.2;
        chamber.visible = true;
        collapsing = 1;
        audio.thump(40, 1, 1.8);
        env.glitch(1, 0.6);
    });
    dir.tween(90, 4, (p) => {
        rig.pos.y = lerp(1.7, -58, smooth(p));
        fx.corr = lerp(0.6, 0.85, p);
    });
    dir.at(95, () => {
        runner.visible = false;
        env.say('YOU', "That's me.");
    });
    dir.at(99, () => env.say('SYSTEM', 'All outcomes remain available until selection.', { pitch: 0.7, rate: 0.8 }));
    dir.at(104, () => env.title('WORLD STATE: CORRUPTED', 3));
    dir.at(108, () => env.say('???', "You're getting closer. That's not necessarily good."));
    // collapse and the emergency door
    dir.at(114, () => {
        rig.walk = 1.8;
        audio.level('hum', 0.4, 1);
        env.glitch(1, 0.5);
        env.say('YOU', 'The door. Get to the door.');
    });
    dir.tween(114, 4, (p) => {
        place(lerp(0, 0, p), -58, lerp(-40, -20, smooth(p)));
        rig.yaw = Math.PI;
    });
    dir.at(119, () => {
        // the blue runner appears between frozen frames at the far end, then charges
        runner.visible = true;
        runner.position.set(0, 0, -30);
        env.say('???', 'You can not leave a level that is still loading.', { pitch: 1.4, rate: 0.9 });
    });
    dir.at(123, () => {
        door404.material = new THREE.MeshStandardMaterial({ color: 0x80ff80, emissive: 0x80ff80 });
        env.title('404 — WORLD NOT FOUND', 2);
    });
    dir.at(125, () => {
        // forces the door open and falls through
        audio.thump(60, 1, 2);
        env.glitch(1, 0.8);
        rig.pitch = -0.4;
    });
    // fall through darkness into the forest
    dir.tween(127, 6, (p) => {
        rig.pos.y = lerp(-58, -200, smooth(p));
        rig.pitch = lerp(-0.4, -1.2, p);
        rig.roll = Math.sin(p * 9) * 0.3 * (1 - p);
        fx.fade = smooth(Math.min(1, p * 1.4));
    });
    dir.at(133, () => {
        // the electronic music becomes wind through pine trees
        chamber.visible = false;
        runner.visible = false;
        forest.visible = true;
        scene.background = new THREE.Color(0x030806);
        scene.fog = new THREE.FogExp2(0x030806, 0.05);
        audio.level('hum', 0, 1.5);
        audio.level('wind', 0.4, 2);
        audio.thump(40, 0.6, 1.5);
        rig.pos.set(0, -198.3, 0);
        checker.visible = false;
        rig.pitch = -0.2;
        rig.roll = 0;
    });
    dir.tween(133, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(138, () => {
        env.say('YOU', 'Wet dirt. Trees. Where...');
    });
    dir.at(143, () => {
        audio.level('wind', 0.15, 2);
        env.title('DAY FOUR — CONNECTION LOST', 6);
    });
    // Oliver is caught in a broken section of the level and does not come through.
    dir.at(146, () => {
        env.say('YOU', 'Oliver, stay on the path. Oliver!');
        setFriend('Oliver', 'lost');
    });
    // Home-dream act (bible Day Three): runs after Oliver is lost, shifting the ending.
    stageAct(env, 150, buildDay3Home);
    dir.at(153 + 93 - 3, () => env.finish());
}
