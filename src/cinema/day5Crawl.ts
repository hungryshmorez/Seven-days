/**
 * DAY FIVE — the crawlspace (opening act, before the painted studio).
 * Original creature: "Burned Accomplice" — small crawler, burned-off skin,
 * round head, burned-off ears, a giant toothed smile and eyes. Moves like a spider.
 * Beats: bodies in the dark, a man speaking to them as friends, the chase,
 * capture, and the hatch-room interlude with the prologue crash on television.
 * Consolidated into Day Five; the studio beats follow unchanged.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { terrify } from './scary.ts';
import { buildBurnedCrawler } from './creatureModels.ts';
export function buildDay5Crawl(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x030303);
    scene.fog = new THREE.FogExp2(0x030303, 0.12);
    scene.add(new THREE.HemisphereLight(0x332222, 0x050505, 0.3));
    const lamp = new THREE.PointLight(0xffa060, 0.8, 6, 1.6);
    lamp.position.set(0, 1.4, -2);
    scene.add(lamp);
    // ---- crawlspace: low joists, dirt, a narrow passage ----
    const crawl = new THREE.Group();
    scene.add(crawl);
    const dirt = new THREE.Mesh(new THREE.PlaneGeometry(4, 60), new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 1 }));
    dirt.rotation.x = -Math.PI / 2;
    dirt.position.set(0, 0, -25);
    crawl.add(dirt);
    const roof = new THREE.Mesh(new THREE.PlaneGeometry(4, 60), new THREE.MeshStandardMaterial({ color: 0x140e0a, roughness: 1, side: THREE.DoubleSide }));
    roof.rotation.x = Math.PI / 2;
    roof.position.set(0, 1.1, -25);
    crawl.add(roof);
    const joistM = new THREE.MeshStandardMaterial({ color: 0x2a1c12, roughness: 1 });
    for (let i = 0; i < 14; i++) {
        const j = new THREE.Mesh(new THREE.BoxGeometry(3.8, 0.12, 0.12), joistM);
        j.position.set(0, 1.0, -2 - i * 4);
        crawl.add(j);
    }
    // ---- bodies in the dark (simple shapes, kept dim) ----
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x3a3030, roughness: 1 });
    const bodies: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const b = new THREE.Mesh(new THREE.CapsuleGeometry(0.25, 1.2, 3, 6), bodyM);
        b.rotation.z = Math.PI / 2;
        b.position.set(i % 2 ? 0.9 : -0.9, 0.2, -10 - i * 6);
        crawl.add(b);
        bodies.push(b);
    }
    // ---- Burned Accomplice (original crawler, placeholder shape) ----
    const acc = new THREE.Group();
    const flesh = new THREE.MeshStandardMaterial({ color: 0x6a1a10, roughness: 0.9 });
    const charM = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 1 });
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.42, 12, 10), flesh);
    head.position.y = 0.55;
    acc.add(head);
    const smile = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.05, 6, 14, Math.PI), new THREE.MeshBasicMaterial({ color: 0xf0e8d0 }));
    smile.position.set(0, 0.45, 0.36);
    smile.rotation.z = Math.PI;
    acc.add(smile);
    const eyeM = new THREE.MeshBasicMaterial({ color: 0xffe080 });
    for (const sx of [-0.16, 0.16]) {
        const e = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), eyeM);
        e.position.set(sx, 0.7, 0.34);
        acc.add(e);
    }
    const crawler = buildBurnedCrawler(flesh, charM);
    acc.add(crawler.group);
    const legs = crawler.legs;
    acc.visible = false;
    acc.position.set(0, 0, -30);
    scene.add(acc);
    terrify(env, acc, { creature: 'burned_accomplice', eyes: { at: [0, 0.7, 0.37], spread: [0.32, 0, 0], size: 0.085, color: 0xfff0a0 }, teeth: { at: [0, 0.42, 0.4], spread: [0.5, 0, 0], count: 9, size: 0.09 }, twitch: 1, breathe: 0.05 });
    env.onFrame.push((_d, t) => {
        if (!acc.visible) return;
        legs.forEach((l, i) => (l.rotation.z += Math.sin(t * 14 + i) * 0.02));
    });
    // ---- hatch room: the interlude with the television ----
    const hatch = new THREE.Group();
    hatch.position.set(0, 0, -70);
    hatch.visible = false;
    scene.add(hatch);
    const hatchRoom = new THREE.Mesh(new THREE.BoxGeometry(6, 3, 6), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 1, side: THREE.BackSide }));
    hatchRoom.position.y = 1.5;
    hatch.add(hatchRoom);
    const tv = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 0.8), new THREE.MeshStandardMaterial({ color: 0x1a1a1a }));
    tv.position.set(0, 1.2, -2.4);
    hatch.add(tv);
    const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.8), new THREE.MeshBasicMaterial({ color: 0x3a3a3a }));
    tvScreen.position.set(0, 1.2, -2.0);
    hatch.add(tvScreen);
    // hanging figures (dead "homies"), kept as simple dim shapes
    const hanging: THREE.Mesh[] = [];
    for (let i = 0; i < 3; i++) {
        const h = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 1, 3, 6), bodyM);
        h.position.set(-1.8 + i * 1.8, 2.2, 0.5);
        hatch.add(h);
        hanging.push(h);
    }
    env.onFrame.push((_d, t) => hanging.forEach((h, i) => (h.rotation.z = Math.sin(t * 0.8 + i) * 0.05)));
    // ================= TIMELINE =================
    const place = (x: number, z: number) => rig.pos.set(x, 1.4, z);
    place(0, -2);
    rig.yaw = Math.PI;
    rig.pitch = -0.03;
    rig.lookFreedom = 0.5;
    rig.shake = 0.2;
    rig.onStep = () => audio.step(0.6);
    fx.corr = 0.35;
    fx.fade = 1;
    dir.at(0, () => {
        audio.level('hum', 0.05, 1);
        audio.level('hiss', 0.1, 1);
        env.title('DAY FIVE — THE CRAWLSPACE', 3);
    });
    dir.tween(0, 2.5, (p) => (fx.fade = 1 - smooth(p)));
    // bodies in the dark; a man speaks to them as if they were friends
    dir.at(5, () => env.say('YOU', 'There are people under here. Oh god.'));
    dir.at(10, () => env.say('???', "There you all are. My friends. Don't be shy.", { pitch: 0.8, rate: 0.8 }));
    dir.at(16, () => env.say('???', 'Everybody stay nice and still for me.', { pitch: 0.8, rate: 0.8 }));
    dir.tween(18, 4, (p) => {
        rig.pos.z = lerp(-2, -12, smooth(p));
    });
    dir.at(22, () => audio.thump(30, 0.025, 0.8));
    dir.at(19, () => audio.horrorBeat('day5', 'crawlspace', 'build', { hum: 0.005, hiss: 0, wind: 0 }, 6));
    dir.at(22.5, () => audio.creatureSound('burned_accomplice', 18, 'approach', -0.35));
    dir.at(26, () => { audio.creatureSound('burned_accomplice', 10, 'reveal'); audio.horrorBeat('day5', 'crawlspace', 'scare', { hum: 0.03 }); });
    dir.at(60, () => audio.horrorBeat('day5', 'hatch_room', 'release', { hum: 0.025, hiss: 0.005 }, 15));
    // the chase begins
    dir.at(26, () => {
        acc.visible = true;
        acc.position.set(0, 0, -22);
        audio.thump(50, 0.8, 1.2);
        env.glitch(0.6, 0.5);
        fx.corr = 0.6;
        rig.walk = 1.8;
        env.say('YOU', 'Something is coming! Move!');
    });
    dir.tween(26, 14, (p) => {
        acc.position.z = lerp(-22, -10, smooth(p));
        rig.pos.z = lerp(-12, -30, smooth(p));
        rig.pitch = -0.02 + Math.sin(p * 20) * 0.02;
    });
    dir.at(34, () => env.say('???', '...hee hee...', { pitch: 1.6, rate: 0.7 }));
    dir.at(38, () => {
        // It closes in during the same pursuit, not a third consecutive jump sting.
        audio.thump(60, 0.08, 1.4);
        env.glitch(0.12, 0.2);
        fx.corr = 0.18;
    });
    dir.at(42, () => env.say('YOU', "It's right behind me! It won't stop!"));
    dir.tween(44, 8, (p) => {
        rig.pos.z = lerp(-30, -46, smooth(p));
        acc.position.z = lerp(-10, -42, smooth(p));
    });
    // capture: the protagonist is pinned and carried into the hatch room
    dir.at(54, () => {
        audio.thump(50, 1, 1.5);
        env.glitch(1, 0.8);
        fx.corr = 0.9;
        acc.visible = false;
        env.say('YOU', 'Let go. LET GO!');
    });
    dir.at(58, () => {
        hatch.visible = true;
        rig.pos.set(0, 1.4, -70);
        rig.yaw = 0;
        rig.walk = 0;
        audio.level('hum', 0.12, 1);
    });
    dir.at(60, () => {
        fx.corr = 0.4;
        env.title('THE HATCH ROOM', 2.5);
        tvScreen.material = new THREE.MeshBasicMaterial({ color: 0xa8b8d0 });
    });
    // the television shows the prologue plane crash
    dir.at(64, () => {
        env.say('TV', 'Passengers, brace. Brace. Brace for impact.', { pitch: 0.6, rate: 0.8 });
        audio.staticBurst(0.4, 0.3);
    });
    dir.at(72, () => env.say('YOU', "That's our plane. That's the crash on the island."));
    dir.at(78, () => {
        env.say('YOU', 'Why is it on a TV in a hole in the ground?');
        fx.corr = 0.55;
    });
    dir.at(84, () => {
        // the hanging figures sway; a flat voice from the dark
        env.say('???', 'Watch the whole thing. You missed the part where you lived.', { pitch: 0.5, rate: 0.7 });
        env.glitch(0.5, 0.4);
    });
    dir.tween(92, 3, (p) => (fx.fade = smooth(p)));
    dir.at(96, () => {
        // hand-off into the painted studio that follows in this same chapter
        hatch.visible = false;
        acc.visible = false;
        crawl.visible = false;
        lamp.intensity = 0;
        bodies.forEach((b) => (b.visible = false));
        env.say('YOU', 'Okay. Okay. Keep moving.');
    });
}
