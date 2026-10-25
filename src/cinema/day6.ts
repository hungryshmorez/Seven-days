/**
 * DAY SIX — the corrupted children's broadcast. Original characters:
 *   - "Host": a smiling presenter with a painted backdrop
 *   - "Puppet Friend": a frightened puppet who warns the protagonist
 *   - "Tall Smile": a grinning animatronic in a neighborhood of TV windows
 * Beats kept: forced cheerful interview, wrong-answer doors, the warning,
 * the TV neighborhood, the animatronic facility, the control room, the
 * system diagram, the smashed console, the countdown, and the transition
 * into the Day Seven core.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { terrify } from './scary.ts';
import { buildHostess, buildPuppetLamb, buildTallSmile } from './creatureModels.ts';

export function buildDay6(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x2a0a40);
    scene.fog = new THREE.FogExp2(0x2a0a40, 0.02);
    scene.add(new THREE.HemisphereLight(0xffffff, 0x303030, 0.9));
    const studioLight = new THREE.PointLight(0xffe0a0, 4, 40, 1.2);
    studioLight.position.set(0, 8, 6);
    scene.add(studioLight);
    // ---- studio set ----
    const studio = new THREE.Group();
    scene.add(studio);
    const carpet = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x3050c0, roughness: 1 }));
    carpet.rotation.x = -Math.PI / 2;
    studio.add(carpet);
    const backdrop = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), new THREE.MeshBasicMaterial({ color: 0x40b040 }));
    backdrop.position.set(0, 5, -10);
    studio.add(backdrop);
    const sunDisc = new THREE.Mesh(new THREE.CircleGeometry(1.4, 16), new THREE.MeshBasicMaterial({ color: 0xffe040 }));
    sunDisc.position.set(-6, 8, -9.9);
    studio.add(sunDisc);
    // three colorful doors: HOME / PARK / SCHOOL
    const doorMats = [0xff4040, 0x40c0ff, 0xf0c040];
    const doors: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.4, 0.2), new THREE.MeshStandardMaterial({ color: doorMats[i] }));
        d.position.set(-6 + i * 6, 1.7, -4);
        studio.add(d);
        doors.push(d);
    }
    // dark room with abandoned cameras behind HOME
    const cameraRoom = new THREE.Group();
    cameraRoom.position.set(-6, 0, -20);
    cameraRoom.visible = false;
    scene.add(cameraRoom);
    const crFloor = new THREE.Mesh(new THREE.PlaneGeometry(20, 20), new THREE.MeshStandardMaterial({ color: 0x080808 }));
    crFloor.rotation.x = -Math.PI / 2;
    cameraRoom.add(crFloor);
    for (let i = 0; i < 12; i++) {
        const cam = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.4, 0.8), new THREE.MeshStandardMaterial({ color: 0x222222 }));
        cam.position.set(-7 + (i % 6) * 2.6, 0.9 + Math.floor(i / 6) * 1.2, -2 - Math.floor(i / 6) * 2);
        cameraRoom.add(cam);
    }
    // ---- Host (original presenter) ----
    const host = new THREE.Group();
    const skin = new THREE.MeshStandardMaterial({ color: 0xf0c8a0, roughness: 0.7 });
    skin.userData.creatureVeins = 0.08;
    const hostGirl = buildHostess(new THREE.MeshStandardMaterial({ color: 0xc02060, roughness: 0.8 }), skin, new THREE.MeshStandardMaterial({ color: 0x1a0f0a, roughness: 0.6 }), new THREE.MeshStandardMaterial({ color: 0xf0e0c0, roughness: 0.5 }));
    host.add(hostGirl.group);
    const hostSmile = new THREE.Mesh(new THREE.TorusGeometry(0.22, 0.03, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x402020 }));
    hostSmile.position.set(0, 2.75, 0.45);
    hostSmile.rotation.z = Math.PI;
    host.add(hostSmile);
    host.position.set(-3, 0, -5);
    host.visible = false;
    scene.add(host);
    terrify(env, host, { creature: 'miss_merrily', eyes: { at: [0, 3.0, 0.46], spread: [0.24, 0, 0], size: 0.06, color: 0x101010, blink: false }, teeth: { at: [0, 2.72, 0.48], spread: [0.36, 0, 0], count: 8, size: 0.06 }, twitch: 0.35 });
    // ---- Puppet Friend (original, frightened) ----
    const puppet = new THREE.Group();
    const wool = new THREE.MeshStandardMaterial({ color: 0xf0f0e8, roughness: 1 });
    puppet.add(buildPuppetLamb(wool, new THREE.MeshStandardMaterial({ color: 0xd8c8b0, roughness: 1 })).group);
    const pEye = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color: 0x111111 }));
    pEye.position.set(0.2, 2.3, 0.5);
    puppet.add(pEye);
    puppet.position.set(3, 0, -4);
    puppet.visible = false;
    scene.add(puppet);
    // ---- neighborhood: houses whose windows show TVs ----
    const hood = new THREE.Group();
    hood.position.set(0, 0, -60);
    hood.visible = false;
    scene.add(hood);
    const houses: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(5, 4, 5), new THREE.MeshStandardMaterial({ color: [0xffb0c0, 0xb0ffd0, 0xb0d0ff][i % 3] }));
        h.position.set(-12 + i * 5, 2, (i % 2) * 4);
        hood.add(h);
        houses.push(h);
        const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.2), new THREE.MeshBasicMaterial({ color: 0x80c0ff }));
        tv.position.set(-12 + i * 5, 2.2, (i % 2) * 4 + 2.55);
        hood.add(tv);
    }
    const bunkerDoor = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 0.2), new THREE.MeshStandardMaterial({ color: 0x3a2a1a }));
    bunkerDoor.position.set(0, 1.5, -4);
    hood.add(bunkerDoor);
    // ---- Tall Smile (original grinning animatronic) ----
    const smile = new THREE.Group();
    const metal = new THREE.MeshStandardMaterial({ color: 0x9a8a70, roughness: 0.5, metalness: 0.3 });
    smile.add(buildTallSmile(metal, new THREE.MeshStandardMaterial({ color: 0x1c1812, roughness: 0.6, metalness: 0.4 })).group);
    const sGrin = new THREE.Mesh(new THREE.TorusGeometry(0.45, 0.04, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0x200000 }));
    sGrin.position.set(0, 4.6, 0.75);
    sGrin.rotation.z = Math.PI;
    smile.add(sGrin);
    smile.position.set(-4, 0, -90);
    smile.visible = false;
    scene.add(smile);
    terrify(env, smile, { creature: 'tall_smile', eyes: { at: [0, 5.05, 0.75], spread: [0.5, 0, 0], size: 0.12, color: 0xff3a20 }, teeth: { at: [0, 4.5, 0.79], spread: [0.7, 0, 0], count: 9, size: 0.13 }, arms: { shoulderY: 3.9, width: 0.75, length: 3.4, thickness: 0.06, color: 0x6a5c48 }, twitch: 0.6 });
    // ---- facility: decaying performers and monitors ----
    const facility = new THREE.Group();
    facility.position.set(0, 0, -130);
    facility.visible = false;
    scene.add(facility);
    const fFloor = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x1a1a22, roughness: 1 }));
    fFloor.rotation.x = -Math.PI / 2;
    facility.add(fFloor);
    const monitorMats: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 40; i++) {
        const m = new THREE.MeshBasicMaterial({ color: 0x306080 });
        monitorMats.push(m);
        const mon = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 1), m);
        mon.position.set(-18 + (i % 10) * 4, 2 + Math.floor(i / 10) * 1.6, -10);
        facility.add(mon);
    }
    // ---- control room with hundreds of monitors ----
    const control = new THREE.Group();
    control.position.set(0, 0, -200);
    control.visible = false;
    scene.add(control);
    const cFloor = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x0c0c12, roughness: 0.8 }));
    cFloor.rotation.x = -Math.PI / 2;
    control.add(cFloor);
    const wallMons: THREE.MeshBasicMaterial[] = [];
    for (let i = 0; i < 80; i++) {
        const m = new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL((i * 0.09) % 1, 0.7, 0.45) });
        wallMons.push(m);
        const mon = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 1.6), m);
        mon.position.set(-30 + (i % 16) * 4, 3 + Math.floor(i / 16) * 2.2, -12);
        control.add(mon);
    }
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(6, 1.2, 2), new THREE.MeshStandardMaterial({ color: 0x222233 }));
    console_.position.set(0, 0.6, -4);
    control.add(console_);
    const diagram = new THREE.Mesh(new THREE.PlaneGeometry(6, 3), new THREE.MeshBasicMaterial({ color: 0x102030 }));
    diagram.position.set(0, 4, -11.9);
    control.add(diagram);
    const diagramText = new THREE.Mesh(new THREE.PlaneGeometry(4, 0.6), new THREE.MeshBasicMaterial({ color: 0x80ffa0 }));
    diagramText.position.set(0, 4, -11.8);
    control.add(diagramText);
    env.onFrame.push((_d, t) => {
        wallMons.forEach((m, i) => m.color.setHSL(((i * 0.09) + t * 0.04) % 1, 0.7, 0.35 + 0.1 * Math.sin(t * 3 + i)));
        monitorMats.forEach((m, i) => m.color.setHSL(((i * 0.05) + t * 0.1) % 1, 0.4, 0.3 + 0.1 * Math.sin(t + i)));
    });
    let studioPower = 1;
    // ---- glitch / live-broadcast flicker ----
    env.onFrame.push((_d, t) => {
        studioLight.intensity = studioPower * (4 + Math.sin(t * 7) * 0.4);
        sunDisc.visible = Math.floor(t * 4) % 7 !== 0;
    });
    // ================= TIMELINE =================
    const place = (x: number, z: number) => rig.pos.set(x, 1.7, z);
    place(0, 1);
    rig.yaw = 0;
    rig.pitch = -0.02;
    rig.lookFreedom = 0.5;
    rig.shake = 0.12;
    rig.onStep = () => audio.step(0.6);
    fx.corr = 0.15;
    fx.fade = 1;
    dir.at(0, () => {
        audio.level('hiss', 0.1, 1);
        env.say('???', 'Hi, friend! Are you ready to learn something new?', { pitch: 1.5, rate: 0.9 });
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(5, () => {
        // the protagonist stays silent; the host's smile freezes
        audio.level('hiss', 0.04, 1);
        env.say('???', 'I asked you a question.', { pitch: 1.5, rate: 0.9 });
    });
    dir.at(10, () => {
        // lights dim
        studioPower = 0.25;
        audio.level('hum', 0.12, 1);
        env.say('???', "Host, maybe we should let our guest rest.", { pitch: 1.2, rate: 0.85 });
        puppet.visible = true;
    });
    dir.at(14, () => env.say('???', 'Nobody asked you.', { pitch: 1.5, rate: 0.9 }));
    dir.at(18, () => {
        env.say('YOU', 'There is no exit. There is no exit anywhere.');
        rig.yaw = 0.8;
    });
    dir.tween(18, 3, (p) => (rig.yaw = lerp(0.8, -0.2, smooth(p))));
    dir.at(0, () => audio.creatureSound('miss_merrily', 12, 'approach', -0.4));
    dir.at(3.5, () => { host.visible = true; audio.creatureSound('miss_merrily', 7, 'reveal', -0.4); });
    dir.at(8, () => audio.creatureSound('buttonbell', 8, 'approach', 0.5));
    dir.at(10, () => audio.creatureSound('buttonbell', 6, 'reveal', 0.5));
    dir.at(33, () => audio.horrorBeat('day6', 'wrong_door', 'build', { hum: 0.005, hiss: 0, wind: 0 }, 11));
    dir.at(43.5, () => audio.creatureSound('miss_merrily', 5, 'approach', -0.2));
    dir.at(45, () => { studioPower = 0.5; audio.creatureSound('miss_merrily', 1.5, 'reveal'); audio.horrorBeat('day6', 'host_at_lens', 'scare', { hum: 0.03 }); });
    dir.at(49.5, () => { fx.corr = 0.1; studioPower = 0.7; audio.horrorBeat('day6', 'puppet_warning', 'release', { hum: 0.01, hiss: 0.003 }, 15); });
    dir.at(68, () => audio.creatureSound('buttonbell', 6, 'lie', 0.5));
    // Mr. Stillwell remains the existing off-screen neighbour, not a renamed Tall Smile.
    dir.at(83, () => audio.creatureSound('mr_stillwell', 18, 'approach', -0.6));
    dir.at(114, () => audio.horrorBeat('day6', 'keepsake_aisle', 'build', { hum: 0.005, hiss: 0.003 }, 5));
    dir.at(117, () => audio.creatureSound('tall_smile', 12, 'approach', -0.5));
    dir.at(120, () => audio.creatureSound('tall_smile', 4, 'reveal', -0.5));
    dir.at(134, () => { fx.corr = 0.1; audio.horrorBeat('day6', 'control_room', 'release', { hum: 0.02, hiss: 0.005 }, 15); });
    dir.at(157, () => audio.creatureSound('splicemaster', 22, 'approach'));
    dir.at(160, () => audio.creatureSound('splicemaster', 18, 'reveal'));
    dir.at(204, () => audio.horrorBeat('day6', 'final_channel', 'release', { hum: 0.015, hiss: 0.003 }, 8));
    // educational segment: three doors
    dir.at(24, () => {
        env.title('WHICH DOOR TAKES US HOME?', 3);
        env.say('???', 'Which door takes us home?', { pitch: 1.5, rate: 0.9 });
    });
    dir.tween(27, 4, (p) => {
        place(lerp(0, -3, smooth(p)), lerp(1, -1, smooth(p)));
        rig.yaw = lerp(-0.2, -0.3, p);
    });
    dir.at(32, () => {
        // approaching HOME: the host's expression changes
        env.say('???', "That's not what the script says.", { pitch: 1.5, rate: 0.9 });
    });
    dir.at(37, () => {
        doors[0].material = new THREE.MeshStandardMaterial({ color: 0x000000 });
        cameraRoom.visible = true;
        audio.thump(40, 0.05, 1.2);
        env.glitch(0.08, 0.2);
        fx.corr = 0.12;
    });
    dir.at(40, () => {
        // the dark room of abandoned cameras; the protagonist retreats
        rig.walk = 1.8;
        rig.yaw = 0;
        env.say('YOU', 'Cameras. Dozens of them. Get out.');
    });
    dir.tween(40, 3, (p) => {
        place(lerp(-3, -3, p), lerp(-1, 4, smooth(p)));
    });
    dir.at(45, () => {
        // host appears directly in front of the lens
        host.position.set(-3, 0, 3);
        rig.walk = 0;
        audio.thump(50, 0.7, 1.4);
        fx.corr = 0.65;
    });
    dir.at(47, () => env.say('???', 'Try again.', { pitch: 1.5, rate: 0.9 }));
    // interruption: puppet friend's warning
    dir.at(52, () => {
        env.title('ON AIR', 2);
        audio.level('hum', 0.01, 0.5);
        env.glitch(0.05, 0.2);
    });
    dir.at(55, () => env.say('???', 'Listen carefully. She does not control the show.', { pitch: 1.2, rate: 0.85 }));
    dir.at(60, () => env.say('YOU', 'Then who does?'));
    dir.at(64, () => env.say('???', 'The thing behind the cameras.', { pitch: 1.2, rate: 0.85 }));
    dir.at(68, () => {
        // a studio camera turns toward them; the puppet resumes smiling
        audio.staticBurst(0.6, 0.3);
        env.say('???', "And that's how we make new friends!", { pitch: 1.4, rate: 0.9 });
    });
    dir.at(74, () => env.title('ON AIR', 1.2));
    // escape to the neighborhood
    dir.at(78, () => {
        cameraRoom.visible = false;
        puppet.visible = false;
        hood.visible = true;
        rig.pos.set(0, 1.7, -40);
        rig.yaw = 0;
        rig.walk = 1;
    });
    dir.tween(78, 6, (p) => {
        rig.pos.z = lerp(-40, -54, smooth(p));
    });
    dir.at(86, () => {
        // Tall Smile's neighbor counterpart: a smiling figure in front of a painted house
        smile.visible = false;
        env.say('???', "You don't belong in this neighborhood.", { pitch: 0.9, rate: 0.8 });
        rig.walk = 0;
    });
    dir.at(92, () => env.say('YOU', "I know. I'm trying to leave."));
    dir.at(96, () => env.say('???', 'Then why do you keep coming back?', { pitch: 0.9, rate: 0.8 }));
    dir.at(101, () => {
        // the protagonist turns; every house shows the bunker door
        houses.forEach((h) => (h.material = new THREE.MeshStandardMaterial({ color: 0x402818 })));
        bunkerDoor.position.set(0, 1.5, 0);
        rig.yaw = Math.PI;
        audio.thump(40, 0.6, 1.2);
        env.glitch(0.7, 0.5);
    });
    dir.at(106, () => env.say('???', 'Someone is watching you through your own eyes.', { pitch: 0.9, rate: 0.8 }));
    // facility: broken performers
    dir.at(112, () => {
        hood.visible = false;
        facility.visible = true;
        rig.pos.set(0, 1.7, -118);
        rig.yaw = 0;
        rig.walk = 1;
        audio.level('hum', 0.15, 1);
    });
    dir.tween(112, 7, (p) => {
        rig.pos.z = lerp(-118, -128, smooth(p));
    });
    dir.at(120, () => {
        rig.walk = 0;
        smile.visible = true;
        smile.position.set(-4, 0, -128);
        audio.thump(35, 0.5, 1);
    });
    dir.tween(120, 2, (p) => {
        smile.rotation.y = lerp(0, 0.9, smooth(p));
    });
    dir.at(124, () => env.say('???', 'You will be remembered forever.', { pitch: 0.5, rate: 0.7 }));
    dir.at(128, () => {
        rig.walk = 1.8;
        env.say('YOU', 'Back off.');
    });
    dir.tween(128, 4, (p) => {
        rig.pos.z = lerp(-128, -140, p);
        smile.position.z = lerp(-128, -136, p);
    });
    // control room
    dir.at(134, () => {
        facility.visible = false;
        smile.visible = false;
        control.visible = true;
        rig.pos.set(0, 1.7, -180);
        rig.yaw = 0;
        rig.walk = 0.8;
        audio.level('hum', 0.02, 1);
    });
    dir.tween(134, 6, (p) => {
        rig.pos.z = lerp(-180, -192, smooth(p));
    });
    dir.at(142, () => {
        rig.walk = 0;
        diagramText.material.color.setHex(0x80ffa0);
        env.title('THE STITCHING PROCESS', 2.5);
    });
    dir.at(146, () => env.title('INPUT: HUMAN MEMORY', 2));
    dir.at(149, () => env.title('PROCESS: RECURSIVE SIMULATION', 2));
    dir.at(152, () => env.title('OUTPUT: PERMANENT CHARACTER', 2));
    dir.at(156, () => env.say('YOU', 'You built all this just to keep people trapped?'));
    dir.at(160, () => {
        // the operator appears across every monitor
        wallMons.forEach((m) => m.color.setHex(0xfff0c0));
        env.say('???', 'Trapped? No. Preserved.', { pitch: 0.4, rate: 0.7 });
        fx.corr = 0.75;
    });
    dir.at(166, () => env.say('???', 'You were never trying to escape the story.', { pitch: 0.4, rate: 0.7 }));
    dir.at(172, () => env.say('???', 'You were proving you could survive being part of it.', { pitch: 0.4, rate: 0.7 }));
    dir.at(178, () => {
        // protagonist smashes the console
        audio.thump(70, 1, 1.5);
        env.glitch(1, 0.8);
        fx.corr = 0.9;
        console_.visible = false;
    });
    dir.at(182, () => {
        // alarms
        audio.staticBurst(1.5, 0.6);
        env.title('BROADCAST FAILURE', 2.5);
    });
    // collapse
    dir.at(188, () => {
        env.say('???', 'You cannot leave before the episode ends!', { pitch: 1.5, rate: 0.9 });
        rig.walk = 1.8;
        audio.level('hum', 0.35, 1);
    });
    dir.tween(188, 6, (p) => {
        rig.pos.z = lerp(-192, -150, smooth(p));
        fx.corr = 0.9 + 0.05 * Math.sin(p * 20);
    });
    dir.at(196, () => {
        // countdown
        env.title('00:00:10', 1.0);
    });
    for (const [t, s] of [[197, '00:00:09'], [198, '00:00:08'], [199, '00:00:07']] as const) {
        dir.at(t, () => env.title(s, 0.9));
    }
    dir.at(200, () => {
        // the final channel: a giant TV above an empty stage
        audio.thump(60, 0.8, 2);
        env.glitch(1, 0.8);
        fx.corr = 1;
    });
    dir.at(203, () => {
        env.title('00:00:00', 1.2);
        rig.walk = 0;
        audio.level('hum', 0.4, 0.5);
    });
    dir.tween(206, 6, (p) => {
        // falls through the screen, a tunnel of memories
        rig.pos.z = lerp(-150, -220, smooth(p));
        fx.fade = smooth(Math.min(1, p * 1.2));
    });
    dir.at(213, () => {
        // the tunnel opens: a vast chamber with the Core
        audio.level('hum', 0.5, 1);
        audio.thump(30, 1, 3);
        env.title('DAY SEVEN — THE SUB-BASS CORE.', 4);
    });
    dir.at(220, () => env.finish());
}
