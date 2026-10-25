/**
 * DAY FOUR — the forest that resets. Original creatures:
 *   - "Speaker Tower" (the tall siren-headed figure; loudspeakers for a head)
 *   - "Long Neck" (the pale horse-like head on an impossibly long neck)
 * Story beats kept: the clock resets at midnight, the radio voice copies
 * the protagonist, the tower steps closer, a montage of repeated nights,
 * a root tunnel with a photograph, and a countdown into a cartoon-lit door
 * that leads to DAY FIVE.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { terrify } from './scary.ts';
import { buildLongNeck, buildSpeakerTower } from './creatureModels.ts';

export function buildDay4(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x02050a);
    scene.fog = new THREE.FogExp2(0x0a1410, 0.035);
    scene.add(new THREE.HemisphereLight(0x405060, 0x0a0f0a, 0.5));
    const moon = new THREE.DirectionalLight(0x9ab0d8, 0.6);
    moon.position.set(-30, 50, 20);
    scene.add(moon);
    let seed = 99;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    // ---- forest floor & trees ----
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 300, 40, 40), new THREE.MeshStandardMaterial({ color: 0x102014, roughness: 1 }));
    ground.rotation.x = -Math.PI / 2;
    scene.add(ground);
    const trunkG = new THREE.CylinderGeometry(0.25, 0.4, 8, 6);
    const coneG = new THREE.ConeGeometry(2.6, 7, 7);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x21170f, roughness: 1 });
    const leafM = new THREE.MeshStandardMaterial({ color: 0x0b1d12, roughness: 1 });
    const trees: THREE.Group[] = [];
    for (let i = 0; i < 160; i++) {
        const x = (rnd() - 0.5) * 120;
        const z = -10 - rnd() * 90;
        if (Math.abs(x) < 4 && z > -20) continue; // keep the path clear
        const t = new THREE.Group();
        const tr = new THREE.Mesh(trunkG, trunkM);
        tr.position.y = 4;
        const c1 = new THREE.Mesh(coneG, leafM);
        c1.position.y = 8;
        t.add(tr, c1);
        t.position.set(x, 0, z);
        t.scale.setScalar(0.8 + rnd() * 0.8);
        scene.add(t);
        trees.push(t);
    }
    env.onFrame.push((_d, t) => trees.forEach((tr, i) => (tr.rotation.z = Math.sin(t * 0.5 + i) * 0.012)));
    // ---- ranger station (reused from Day One look) ----
    const station = new THREE.Group();
    station.position.set(0, 0, -20);
    scene.add(station);
    const hut = new THREE.Mesh(new THREE.BoxGeometry(6, 3.2, 5), new THREE.MeshStandardMaterial({ color: 0x3e2e1e, roughness: 1 }));
    hut.position.y = 1.6;
    station.add(hut);
    const windowMat = new THREE.MeshBasicMaterial({ color: 0xffc070 });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1.1), windowMat);
    win.position.set(0, 1.8, 2.52);
    station.add(win);
    const bulb = new THREE.PointLight(0xffb060, 2, 12, 1.5);
    bulb.position.set(0, 2, 2);
    station.add(bulb);
    // wall clock
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.4, 16), new THREE.MeshBasicMaterial({ color: 0xe8e0c8 }));
    clockFace.position.set(-2, 2.2, 2.53);
    station.add(clockFace);
    const clockHand = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.35, 0.01), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    clockHand.position.set(-2, 2.3, 2.55);
    station.add(clockHand);
    // sign that changes its text
    const signMat = new THREE.MeshBasicMaterial({ color: 0xd8c8a0 });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.7), signMat);
    sign.position.set(-4, 1.5, -2);
    sign.rotation.y = Math.PI / 4;
    scene.add(sign);
    const signPost = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.1), trunkM);
    signPost.position.set(-4, 0.75, -2);
    scene.add(signPost);
    const night = { n: 1 };
    const signTint = new THREE.Color();
    // ---- Speaker Tower (original siren-headed giant) ----
    const tower = new THREE.Group();
    const towerM = new THREE.MeshBasicMaterial({ color: 0x080608 });
    const towerParts = buildSpeakerTower(towerM, new THREE.MeshStandardMaterial({ color: 0x07070a, roughness: 0.4 }));
    tower.add(towerParts.group);
    const speakerL = new THREE.Group();
    speakerL.add(towerParts.horn(1));
    speakerL.rotation.z = Math.PI / 2;
    speakerL.position.set(0, 20, 1.6);
    tower.add(speakerL);
    const speakerR = new THREE.Group();
    speakerR.add(towerParts.horn(1));
    speakerR.rotation.z = Math.PI / 2;
    speakerR.position.set(0, 20, -1.6);
    tower.add(speakerR);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff2020, fog: false }));
    lamp.position.set(0, 21.5, 0);
    tower.add(lamp);
    tower.position.set(-30, 0, -90);
    tower.visible = false;
    scene.add(tower);
    terrify(env, tower, { creature: 'speaker_tower', arms: { shoulderY: 15.5, width: 1.3, length: 13, thickness: 0.15 }, twitch: 0.25, breathe: 0.01 });
    env.onFrame.push((_d, t) => {
        if (!tower.visible) return;
        speakerL.rotation.x = t * 0.6;
        speakerR.rotation.x = -t * 0.4;
        lamp.visible = Math.floor(t * 3) % 2 === 0;
    });
    // ---- Long Neck (original horse-like head) ----
    const neck = new THREE.Group();
    const pale = new THREE.MeshStandardMaterial({ color: 0xc8c0b0, roughness: 0.7 });
    const longNeck = buildLongNeck(pale, new THREE.MeshStandardMaterial({ color: 0xe0d8c4, roughness: 0.5 }));
    neck.add(longNeck.group);
    const segs = longNeck.segs;
    neck.position.set(-6, 9, -16);
    neck.visible = false;
    scene.add(neck);
    terrify(env, neck, { creature: 'long_neck', eyes: { at: [0, 0.42, 1.55], spread: [1.02, 0, 0], size: 0.13, color: 0xd8f0ff }, teeth: { at: [0, -0.62, 2.0], spread: [0, 0, 0], count: 1, size: 0.01 }, twitch: 0.4 });
    env.onFrame.push((_d, t) => {
        if (!neck.visible) return;
        segs.forEach((s, i) => (s.position.x = Math.sin(t * 0.8 + i * 0.4) * 0.8 * (i / 16)));
    });
    // ---- root tunnel + tapes + photograph ----
    const tunnel = new THREE.Group();
    tunnel.position.set(0, 0, -34);
    tunnel.visible = false;
    scene.add(tunnel);
    const tRoof = new THREE.Mesh(new THREE.BoxGeometry(4, 0.4, 14), trunkM);
    tRoof.position.y = 2.2;
    tunnel.add(tRoof);
    const tWall = new THREE.Mesh(new THREE.PlaneGeometry(14, 2), new THREE.MeshStandardMaterial({ color: 0x1a120a, roughness: 1 }));
    tWall.position.set(0, 1, -7);
    tunnel.add(tWall);
    const tapes: THREE.Mesh[] = [];
    for (let i = 0; i < 14; i++) {
        const tp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.06, 0.25), new THREE.MeshStandardMaterial({ color: 0x0c0c0c }));
        tp.position.set((rnd() - 0.5) * 3, 0.03, -2 - rnd() * 8);
        tp.rotation.y = rnd() * 3;
        tunnel.add(tp);
        tapes.push(tp);
    }
    const photo = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({ color: 0xbfb49a }));
    photo.position.set(1.1, 1.3, -6.9);
    tunnel.add(photo);
    const scratch = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.5), new THREE.MeshBasicMaterial({ color: 0x9a1010 }));
    scratch.position.set(-1.6, 1.4, -6.95);
    tunnel.add(scratch);
    // ---- countdown door with cartoon-animal decorations ----
    const doorGroup = new THREE.Group();
    doorGroup.position.set(0, 0, -44);
    doorGroup.visible = false;
    scene.add(doorGroup);
    const door = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 0.2), new THREE.MeshStandardMaterial({ color: 0x5a3a1a, roughness: 0.9 }));
    door.position.y = 1.6;
    doorGroup.add(door);
    const spot = new THREE.SpotLight(0xffffff, 0, 40, 0.5, 0.6);
    spot.position.set(0, 8, -10);
    spot.target = doorGroup;
    scene.add(spot);
    scene.add(spot.target);
    // ---- final black room (transition to Day Five) ----
    const blackRoom = new THREE.Group();
    blackRoom.position.set(0, 0, -60);
    blackRoom.visible = false;
    scene.add(blackRoom);
    const rb = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshBasicMaterial({ color: 0x000000 }));
    rb.rotation.x = -Math.PI / 2;
    blackRoom.add(rb);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    hand.position.set(0.8, 1.6, -2);
    hand.visible = false;
    blackRoom.add(hand);
    // radio + hanging recordings (shared)
    const radio = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.25, 0.2), new THREE.MeshStandardMaterial({ color: 0x1b1b1b }));
    radio.position.set(0.4, 1.0, -18);
    scene.add(radio);
    let staticOn = false;
    // ---- per-frame: clock, sign, flicker ----
    let stationLights = 1;
    env.onFrame.push((_d, t) => {
        bulb.intensity = 2 * stationLights * (0.9 + Math.sin(t * 21) * 0.1);
        win.visible = stationLights > 0.1;
        // clock hand sweeps
        clockHand.rotation.z = -t * 0.6;
        // sign: tints toward the night number
        signTint.setRGB(0.85 - night.n * 0.003, 0.8, 0.6);
        signMat.color.copy(signTint);
    });
    // ================= TIMELINE =================
    const place = (x: number, z: number) => rig.pos.set(x, 1.7, z);
    place(0, 12);
    rig.yaw = Math.PI;
    rig.pitch = -0.03;
    rig.lookFreedom = 0.6;
    rig.shake = 0.15;
    rig.onStep = () => audio.step(0.7);
    fx.corr = 0.2;
    fx.fade = 1;
    dir.at(0, () => {
        audio.level('wind', 0.15, 3);
        audio.level('hum', 0.04, 2);
        audio.level('hiss', 0.05, 2);
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(4, () => env.title('11:59 PM', 3));
    dir.at(4.5, () => env.say('YOU', 'Okay. A trail. Just follow the trail.'));
    dir.at(8, () => audio.staticBurst(0.4, 0.15));
    // walk toward the station
    dir.at(10, () => (rig.walk = 1));
    dir.tween(10, 12, (p) => {
        place(lerp(0, 0, p), lerp(12, -14, smooth(p)));
        rig.yaw = Math.PI * (1 - p * 0.05) + Math.sin(p * 4) * 0.04;
    });
    dir.at(16, () => {
        // trees rearrange: pop trees in and out of place
        trees.slice(0, 20).forEach((tr, i) => (tr.position.x += (i % 2 ? 0.8 : -0.8)));
        audio.thump(35, 0.4, 0.8);
    });
    dir.at(19, () => env.say('BIRD', 'Tweet. Tweet. Tweet.', { pitch: 1.6, rate: 1.2 }));
    dir.at(22, () => (rig.walk = 0));
    // the clock hits midnight; the sign resets
    dir.at(24, () => {
        env.say('YOU', 'The clock says eleven fifty-nine.');
        rig.yaw = Math.PI - 0.5;
    });
    dir.at(30, () => {
        stationLights = 0.2;
        audio.thump(30, 0.7, 1.4);
        env.glitch(0.6, 0.6);
        fx.corr = 0.5;
    });
    dir.at(33, () => {
        stationLights = 1;
        night.n = 2;
        env.title('12:00 AM', 3);
        // Impossible counters: the night has already been counted once.
        dir.at(35.5, () => { env.title('NIGHT 01 / 99', 2); env.glitch(0.4, 0.3); });
        dir.at(38.5, () => { env.title('NIGHT 02 / 99', 2); env.glitch(0.5, 0.3); });
        env.say('YOU', 'No. I was just there.');
        // back beside the sign
        place(-2, -10);
        rig.yaw = 0;
    });
    // the radio: announcer and a copy of the protagonist's voice
    dir.at(40, () => {
        staticOn = true;
        audio.staticBurst(0.6, 0.4);
        env.say('RADIO', 'This is an emergency warning. Do not follow voices from the treeline.', { pitch: 0.4, rate: 0.9 });
    });
    dir.at(47, () => env.say('???', "I'm outside. Open the door.", { pitch: 1, rate: 0.9 }));
    dir.at(51, () => {
        // shadow passes behind the trees; sirens
        audio.thump(40, 0.06, 1.5);
        env.glitch(0.06, 0.2);
        fx.corr = 0.12;
    });
    dir.at(44.5, () => audio.horrorBeat('day4', 'broadcast_giant', 'build', { wind: 0.015, hum: 0.005, hiss: 0.005 }, 6));
    dir.at(49.5, () => audio.creatureSound('speaker_tower', 80, 'approach', -0.6));
    dir.at(54, () => audio.creatureSound('speaker_tower', 75, 'reveal', -0.6));
    dir.at(65, () => audio.horrorBeat('day4', 'giant_step', 'scare', { hum: 0.12 }));
    dir.at(72, () => audio.horrorBeat('day4', 'forest_discoveries', 'release', { wind: 0.05, hum: 0.01, hiss: 0.005 }, 18));
    dir.at(97, () => audio.horrorBeat('day4', 'forest_silence', 'build', { wind: 0, hum: 0, hiss: 0 }, 12));
    dir.at(109, () => audio.creatureSound('long_neck', 20, 'approach', -0.4));
    dir.at(112, () => audio.creatureSound('long_neck', 16, 'reveal', -0.3));
    dir.at(126, () => audio.horrorBeat('day4', 'remembering_guide', 'release', { wind: 0.03, hum: 0.005, hiss: 0.003 }, 4));
    dir.at(128, () => audio.creatureSound('speaker_tower', 45, 'approach', -0.7));
    dir.at(130, () => audio.creatureSound('speaker_tower', 40, 'reveal', -0.7));
    dir.at(146, () => { fx.corr = 0.1; audio.horrorBeat('day4', 'root_tunnel', 'release', { wind: 0.008, hum: 0.008, hiss: 0.003 }, 15); });
    // Speaker Tower rises
    dir.at(54, () => {
        tower.visible = true;
        audio.level('hum', 0.25, 0.5);
    });
    dir.tween(54, 5, (p) => {
        const ty = Math.atan2(-(tower.position.x - rig.pos.x), -(tower.position.z - rig.pos.z));
        rig.yaw = lerp(rig.yaw, ty, smooth(p) * 0.6);
        rig.pitch = lerp(-0.03, -0.65, smooth(p));
    });
    dir.at(60, () => env.say('???', 'Remain where you are. Assistance is coming.', { pitch: 0.3, rate: 0.6 }));
    dir.at(65, () => {
        audio.thump(50, 1, 2.5);
        env.glitch(1, 0.8);
        fx.corr = 0.9;
        fx.fovKick = 0;
    });
    dir.at(66, () => {
        // takes one enormous step; windows shatter
        tower.position.z += 20;
        station.visible = true;
        windowMat.color.setHex(0x333333);
        rig.walk = 1.8;
        env.say('YOU', 'Run. Into the trees. Run!');
    });
    dir.tween(67, 4, (p) => {
        place(lerp(-2, 0, p), lerp(-10, -2, p));
        rig.yaw = Math.PI * (p - 0.5);
    });
    dir.at(72, () => {
        tower.visible = false;
        rig.walk = 0;
        audio.level('hum', 0.04, 1);
        fx.corr = 0.4;
    });
    // Discoveries inside ONE night: the forest keeps contradicting itself while the
    // protagonist walks. They are fragments of the same night, not separate days.
    const montage: [number, string, string][] = [
        [74, '12:14 AM', 'A river that loops back to its source.'],
        [80, '12:31 AM', 'A cabin with furniture nailed to the ceiling.'],
        [86, '12:47 AM', 'Footprints matching ours, walking backward.'],
        [92, '1:08 AM', 'A voice counting my breaths.'],
        [98, '1:26 AM', 'Silence. The forest stops making sound.'],
        [104, '1:52 AM', 'Recordings hanging from branches.'],
    ];
    // Staged discoveries. Each keeps its clock tag and line, and adds one visible or audible beat.
    const ceilingCabin = new THREE.Group();
    const cabinM = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
    for (let i = 0; i < 4; i++) {
        const piece = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.12, 0.7), cabinM);
        piece.position.set(-1.6 + i * 1.1, 4.2, 0);
        ceilingCabin.add(piece);
    }
    ceilingCabin.position.set(0, 0, -10);
    ceilingCabin.visible = false;
    scene.add(ceilingCabin);
    const footprints: THREE.Mesh[] = [];
    const footMat = new THREE.MeshBasicMaterial({ color: 0x0a0a0a, transparent: true, opacity: 0 });
    for (let i = 0; i < 6; i++) {
        const f = new THREE.Mesh(new THREE.CircleGeometry(0.22, 8), footMat);
        f.rotation.x = -Math.PI / 2;
        f.position.set(0.6 + (i % 2) * 0.5, 0.03, -4 - i * 0.9);
        scene.add(f);
        footprints.push(f);
    }
    const recordings: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.05, 0.25), new THREE.MeshStandardMaterial({ color: 0x0c0c0c }));
        r.position.set(-3 + i * 1.5, 3.4, -8 - (i % 2));
        r.visible = false;
        scene.add(r);
        recordings.push(r);
    }
    const riverMat = new THREE.MeshBasicMaterial({ color: 0x2a4a5a, transparent: true, opacity: 0 });
    const river = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 14), riverMat);
    river.rotation.x = -Math.PI / 2;
    river.position.set(-4, 0.04, -14);
    scene.add(river);
    const stagedBeat: Record<number, () => void> = {
        74: () => { riverMat.opacity = 0.7; audio.level('wind', 0.25, 1); },           // river visibly repeats
        80: () => { ceilingCabin.visible = true; },                                    // furniture on the ceiling
        86: () => { footMat.opacity = 0.7; },                                          // backward footprints
        92: () => { audio.breath(0.35); },                                             // voice counting breaths
        98: () => { audio.level('hum', 0, 1); audio.level('wind', 0, 1); audio.level('hiss', 0, 0.3); },   // silence
        104: () => { recordings.forEach((r) => (r.visible = true)); },                 // recordings hanging
    };
    for (const [t, tag, text] of montage) {
        dir.at(t, () => {
            env.title(tag, 1.6);
            env.say('YOU', text);
            // Preserve every discovery; small tape ticks replace the repeated jump-sting delivery.
            fx.corr = 0.1;
            if (t !== 98) audio.thump(30, 0.012, 0.18);
            env.glitch(0.035, 0.12);
            stagedBeat[t]?.();
        });
    }
    dir.at(98, () => (staticOn = true));
    dir.at(106, () => {
        // the forest goes silent
        audio.level('wind', 0, 1.5);
        audio.level('hum', 0, 1.5);
    });
    // The staged discoveries end with the montage: clear them before the Long Neck.
    dir.at(110, () => {
        ceilingCabin.visible = false;
        footprints.forEach((f) => (f.visible = false));
        recordings.forEach((r) => (r.visible = false));
        riverMat.opacity = 0;
        footMat.opacity = 0;
    });
    // Long Neck emerges on night 99
    dir.at(112, () => {
        env.title('3:07 AM', 2);
        neck.visible = true;
        audio.level('hiss', 0.008, 1);
    });
    dir.tween(112, 6, (p) => {
        neck.position.x = lerp(-6, 0, smooth(p));
        neck.position.z = lerp(-16, -8, smooth(p));
        const ty = Math.atan2(-(neck.position.x - rig.pos.x), -(neck.position.z - rig.pos.z));
        rig.yaw = lerp(rig.yaw, ty, 0.05);
        rig.pitch = lerp(-0.1, -0.2, p);
    });
    dir.at(120, () => env.say('YOU', "You're trying to show me something?"));
    dir.at(126, () => {
        // it bends its neck toward the tunnel roots
        tunnel.visible = true;
        neck.position.set(-4, 9, -14);
    });
    dir.at(130, () => {
        // Speaker Tower approaches; neck blocks the path
        tower.visible = true;
        tower.position.set(-26, 0, -60);
        audio.level('hum', 0.25, 1);
        env.say('???', 'Ten. Nine. Eight.', { pitch: 0.3, rate: 0.6 });
    });
    dir.tween(134, 6, (p) => {
        rig.pos.set(lerp(0, -1, p), 1.7, lerp(-8, -30, smooth(p)));
        rig.yaw = Math.PI;
    });
    dir.at(138, () => env.say('???', 'Seven. Six. Five.', { pitch: 0.3, rate: 0.6 }));
    dir.at(140, () => {
        // the root tunnel: crawl under
        rig.pitch = -0.4;
        audio.breath(0.3);
    });
    dir.tween(140, 6, (p) => {
        rig.pos.set(lerp(-1, 0, p), lerp(1.7, 1.0, Math.sin(p * Math.PI)), lerp(-30, -36, smooth(p)));
        rig.yaw = Math.PI;
    });
    dir.at(146, () => {
        rig.pitch = -0.15;
        env.say('YOU', 'Tapes. Children\'s drawings. Scratched into the wall...');
    });
    dir.at(150, () => env.title('THEY ARE NOT ALL HUNTERS.', 3));
    dir.at(154, () => env.title('SOME REMEMBER WHAT HAPPENED.', 3));
    dir.at(158, () => {
        // photograph of Stitch-like figure with cartoon characters (original group, no name)
        env.say('YOU', "That's the same TV from the bunker.");
    });
    // countdown: Speaker Tower
    dir.at(162, () => {
        tower.visible = true;
        rig.pos.set(0, 1.7, -36);
        env.title('10', 0.9);
    });
    for (const [t, n] of [[163, '9'], [164, '8'], [165, '7'], [166, '6'], [167, '5'], [168, '4'], [169, '3'], [170, '2'], [171, '1']] as const) {
        dir.at(t, () => env.title(n, 0.9));
    }
    dir.at(172, () => {
        // zero: the forest freezes
        audio.level('wind', 0, 0.2);
        audio.level('hiss', 0, 0.3);
        env.title('0', 0.9);
    });
    dir.at(173, () => {
        doorGroup.visible = true;
        rig.pos.set(0, 1.7, -40);
        rig.yaw = 0;
        rig.pitch = -0.02;
        rig.walk = 0.6;
    });
    dir.tween(173, 3, (p) => {
        rig.pos.z = lerp(-40, -43, smooth(p));
    });
    dir.at(177, () => {
        door.rotation.y = -1.2; // door opens
        audio.thump(40, 0.6, 1);
    });
    // the black room: spotlight, cartoon hand, film projector, backward melody
    dir.at(180, () => {
        blackRoom.visible = true;
        scene.background = new THREE.Color(0x000000);
        scene.fog = null;
        trees.forEach((t) => (t.visible = false));
        station.visible = false;
        tower.visible = false;
        neck.visible = false;
        doorGroup.visible = false;
        tunnel.visible = false;
        spot.intensity = 60;
        spot.position.set(0, 10, -58);
        spot.target.position.set(0, 0, -60);
        rig.pos.set(0, 1.7, -56);
        rig.yaw = 0;
        rig.pitch = -0.05;
        rig.walk = 0;
        audio.level('wind', 0, 0.1);
        audio.level('hum', 0, 0.1);
        audio.level('hiss', 0.1, 0.5);
        audio.thump(60, 0.4, 2);
    });
    dir.at(182, () => {
        hand.visible = true;
        env.say('???', 'Everybody smiles here!', { pitch: 1.5, rate: 0.9 });
    });
    dir.at(186, () => {
        // film projector sound replaces forest ambience; melody plays backward
        audio.staticBurst(0.8, 0.2);
    });
    dir.at(190, () => env.title('DAY FIVE — EVERYBODY SMILES HERE.', 4));
    dir.tween(193, 2, (p) => {
        hand.position.x = lerp(0.8, 0.2, smooth(p));
        hand.position.y = lerp(1.6, 1.2, smooth(p));
        if (p >= 1) hand.visible = false;
    });
    dir.tween(196, 2, (p) => (fx.fade = smooth(p)));
    dir.at(199, () => env.finish());
}
