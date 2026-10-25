/**
 * DAY FIVE — the painted cartoon studio. Original monsters (no copyrighted names):
 *   - "Grin Cat": tall, stretchy, white-gloved, grins past its face
 *   - "Hound": hunched dog-like silhouette whose head turns while its body stays still
 *   - "Ink Man": a dripping, living-ink figure with a fixed smile
 * Beats kept: painted street, cat blocks the way, theater curtains open,
 * ink factory with a projector erasing the protagonist's double, chase,
 * the film strip tear, and the transition into Day Six.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth, runAct, stageAct } from './director.ts';
import { buildDay5Crawl } from './day5Crawl.ts';
import { buildDay5Ritual } from './day5Ritual.ts';
import { terrify } from './scary.ts';
import { boneMat, buildGrinCat, buildHound, buildInkMan, catArmGeometry, catGloveGeometry, dripGeometry } from './creatureModels.ts';
/** Crawlspace runs 0–100s, the ritual 100–172s (brisk first round), then the painted studio. */
const RITUAL_START = 100;
const STUDIO_START = 172;
export function buildDay5(env: Env) {
    // Opening act: the crawlspace, hatch room and TV interlude. Then the studio.
    runAct(env, 0, buildDay5Crawl);
    stageAct(env, RITUAL_START, buildDay5Ritual);
    buildDay5Studio(env, STUDIO_START);
}
function buildDay5Studio(env: Env, startAt: number) {
    stageAct(env, startAt, buildDay5StudioBody, undefined, true);
}
function buildDay5StudioBody(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.add(new THREE.HemisphereLight(0xdddddd, 0x222222, 0.7));
    const spot = new THREE.SpotLight(0xffffff, 60, 80, 0.5, 0.6);
    spot.position.set(0, 14, 10);
    scene.add(spot);
    scene.add(spot.target);
    // helper: a painted flat facade
    const paint = (w: number, h: number, shade: number) =>
        new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: new THREE.Color(shade, shade, shade) }));
    // ---- painted street ----
    const street = new THREE.Group();
    scene.add(street);
    const streetFloor = new THREE.Mesh(new THREE.PlaneGeometry(40, 120), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 1 }));
    streetFloor.rotation.x = -Math.PI / 2;
    streetFloor.position.set(0, 0, -20);
    street.add(streetFloor);
    for (let i = 0; i < 6; i++) {
        const f = paint(7, 9, 0.3 + (i % 3) * 0.1);
        f.position.set(i % 2 ? 12 : -12, 4.5, -i * 10 + 4);
        f.rotation.y = i % 2 ? -Math.PI / 2 : Math.PI / 2;
        street.add(f);
    }
    // bending streetlights
    const lampPoles: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 6, 6), new THREE.MeshStandardMaterial({ color: 0x444444 }));
        pole.position.set(i % 2 ? 6 : -6, 3, -i * 12);
        street.add(pole);
        lampPoles.push(pole);
    }
    // painted clouds on wires
    const clouds: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
        const c = paint(4, 1.4, 0.85);
        c.position.set(-4 + i * 2, 12 + (i % 2), -10 - i * 4);
        scene.add(c);
        clouds.push(c);
    }
    env.onFrame.push((_d, t) => {
        clouds.forEach((c, i) => (c.position.x = -4 + i * 2 + Math.sin(t * 0.3 + i) * 0.04));
        lampPoles.forEach((p, i) => (p.rotation.z = Math.sin(t * 0.5 + i) * 0.05 + (rig.pos.z < -4 ? 0.04 : 0)));
    });
    // ---- Grin Cat (original stretchy cartoon cat) ----
    const cat = new THREE.Group();
    const catM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.6 });
    const glove = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 });
    cat.add(buildGrinCat(catM, glove).group);
    const grin = new THREE.Mesh(new THREE.TorusGeometry(0.85, 0.06, 6, 16, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    grin.position.set(0, 6.1, 1.0);
    grin.rotation.z = Math.PI;
    cat.add(grin);
    const arms: THREE.Mesh[] = [];
    for (const side of [-1, 1]) {
        const arm = new THREE.Mesh(catArmGeometry(), catM);
        arm.position.set(side * 1.2, 4.2, 0);
        const g = new THREE.Mesh(catGloveGeometry(), glove);
        g.position.y = -3.6;
        arm.add(g);
        cat.add(arm);
        arms.push(arm);
    }
    cat.position.set(-18, 0, -40);
    cat.visible = false;
    scene.add(cat);
    terrify(env, cat, { creature: 'grin_cat', eyes: { at: [0, 6.62, 0.96], spread: [0.8, 0, 0], size: 0.16, color: 0xfff2b0 }, teeth: { at: [0, 5.76, 1.03], spread: [1.25, 0, 0], count: 11, size: 0.18 }, twitch: 0.5, dropout: true });
    env.onFrame.push((_d, t) => {
        if (!cat.visible) return;
        // stretch / freeze cycle
        const stretch = 1 + Math.abs(Math.sin(t * 2)) * 0.3;
        arms.forEach((a, i) => (a.scale.y = stretch * (i ? 1 : 0.9)));
        if (Math.floor(t * 2) % 5 === 0) return; // frozen pose beats
        cat.rotation.z = Math.sin(t * 3) * 0.04;
    });
    // ---- Hound (original hunched dog-like shape) ----
    const hound = new THREE.Group();
    const houndM = new THREE.MeshStandardMaterial({ color: 0x0a0a0a, roughness: 0.9 });
    const houndParts = buildHound(houndM, boneMat());
    hound.add(houndParts.body);
    const hHead = houndParts.head;
    hHead.position.set(0, 0, 0);
    hHead.position.set(1.7, 2.2, 0);
    hound.add(hHead);
    hound.position.set(0, 0, -60);
    hound.visible = false;
    scene.add(hound);
    // The body stays still: no twitch here. Eyes and teeth ride on the turning head.
    terrify(env, hound, { creature: 'hound', eyes: { parent: hHead, at: [0.36, 0.14, 0], spread: [0, 0, 0.5], size: 0.09, color: 0xff3010, blink: false }, teeth: { parent: hHead, at: [0.95, -0.2, 0], spread: [0, 0, 0.3], count: 6, size: 0.1 }, breathe: 0.05, dropout: true });
    // ---- Ink Man (original dripping figure) ----
    const ink = new THREE.Group();
    const inkM = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2, metalness: 0.4 });
    const iBody = buildInkMan(inkM).group;
    ink.add(iBody);
    const grinFace = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.05, 6, 14, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    grinFace.position.set(0, 2.62, 0.7);
    grinFace.rotation.z = Math.PI;
    ink.add(grinFace);
    const drips: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
        const d = new THREE.Mesh(dripGeometry(), inkM);
        d.position.set((i - 3) * 0.3, 0.3, 0.9);
        ink.add(d);
        drips.push(d);
    }
    ink.position.set(0, 0, -30);
    ink.visible = false;
    scene.add(ink);
    terrify(env, ink, { creature: 'ink_man', eyes: { at: [0, 3.05, 0.62], spread: [0.5, 0, 0], size: 0.11, color: 0xffffff }, teeth: { at: [0, 2.62, 0.68], spread: [0.62, 0, 0], count: 8, size: 0.1 }, twitch: 0.3, breathe: 0.06 });
    env.onFrame.push((_d, t) => {
        if (!ink.visible) return;
        drips.forEach((d, i) => (d.position.y = 0.3 + (Math.sin(t * 3 + i) + 1) * 0.1));
        iBody.scale.y = 1 + Math.sin(t * 2) * 0.03;
    });
    // ---- painted doorway -> theater with a sitting shape ----
    const theater = new THREE.Group();
    theater.position.set(0, 0, -90);
    theater.visible = false;
    scene.add(theater);
    const stage = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 10), new THREE.MeshStandardMaterial({ color: 0x2a2a2a, roughness: 1 }));
    stage.position.set(0, 0.5, -8);
    theater.add(stage);
    const curtainL = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshBasicMaterial({ color: 0x551111, side: THREE.DoubleSide }));
    curtainL.position.set(-5, 4, -3);
    theater.add(curtainL);
    const curtainR = curtainL.clone();
    curtainR.position.x = 5;
    theater.add(curtainR);
    // ---- ink factory: drawing tables, projector, the erased double ----
    const factory = new THREE.Group();
    factory.position.set(0, 0, -140);
    factory.visible = false;
    scene.add(factory);
    const floorF = new THREE.Mesh(new THREE.PlaneGeometry(60, 60), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 1 }));
    floorF.rotation.x = -Math.PI / 2;
    factory.add(floorF);
    const projector = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 3), new THREE.MeshStandardMaterial({ color: 0x333333, metalness: 0.5 }));
    projector.position.set(0, 2, -6);
    factory.add(projector);
    const beam = new THREE.Mesh(new THREE.PlaneGeometry(4, 4), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
    beam.position.set(0, 2, -2);
    beam.rotation.y = Math.PI;
    factory.add(beam);
    const lockedDoor = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 0.3), new THREE.MeshStandardMaterial({ color: 0x402020 }));
    lockedDoor.position.set(0, 2, -18);
    factory.add(lockedDoor);
    const inkPool = new THREE.Mesh(new THREE.CircleGeometry(1, 16), inkM);
    inkPool.rotation.x = -Math.PI / 2;
    inkPool.position.set(0, 0.02, -16);
    inkPool.scale.set(1, 1, 1);
    factory.add(inkPool);
    const swarm = new THREE.Group();
    factory.add(swarm);
    for (let i = 0; i < 8; i++) {
        const sp = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.4, 0.4), inkM);
        sp.position.set((i - 4) * 2, 0.5, -10 - (i % 3) * 3);
        swarm.add(sp);
    }
    env.onFrame.push((_d, t) => {
        swarm.children.forEach((c, i) => (c.rotation.y = t * 1.2 + i));
    });
    // ================= TIMELINE =================
    const place = (x: number, z: number) => rig.pos.set(x, 1.7, z);
    rig.onStep = () => audio.step(0.7);
    spot.target.position.set(0, 0, 0);
    // Studio camera state is applied when the studio begins, not at build time,
    // so the crawlspace act keeps its own camera.
    dir.at(0, () => {
        scene.background = new THREE.Color(0x0a0a0a);
        scene.fog = new THREE.FogExp2(0x0a0a0a, 0.04);
        place(0, 0);
        rig.yaw = 0;
        rig.pitch = -0.02;
        rig.lookFreedom = 0.5;
        rig.shake = 0.15;
        fx.corr = 0.2;
        fx.fade = 1;
    });
    dir.at(0, () => {
        audio.level('hum', 0.04, 1);
        audio.level('hiss', 0.12, 1);
        env.say('YOU', 'What kind of place is this?');
    });
    dir.tween(0, 3, (p) => {
        fx.fade = 1 - smooth(p);
        spot.intensity = 60;
    });
    dir.at(4, () => {
        audio.level('hum', 0, 0.5);
        env.title('DAY FIVE — EVERYBODY SMILES HERE.', 3);
    });
    dir.at(8, () => {
        // a cheerful piano melody starts
        env.say('PIANO', 'A cheerful piano melody.', { pitch: 1.2, rate: 1.2 });
        audio.breath(0.1);
    });
    dir.at(12, () => {
        // shadow behind the protagonist
        audio.thump(40, 0.04, 1.2);
        env.glitch(0.04, 0.15);
        rig.yaw = Math.PI * 0.6;
    });
    dir.tween(12, 3, (p) => {
        rig.yaw = lerp(Math.PI * 0.6, 0, smooth(p));
    });
    dir.at(9, () => audio.horrorBeat('day5', 'painted_street', 'build', { hum: 0, hiss: 0.003, wind: 0 }, 5));
    dir.at(12.5, () => audio.creatureSound('grin_cat', 35, 'approach', -0.5));
    dir.at(16, () => { audio.creatureSound('grin_cat', 30, 'reveal', -0.5); audio.horrorBeat('day5', 'painted_street', 'scare', { hiss: 0.015 }); });
    dir.at(40, () => audio.horrorBeat('day5', 'theatre_threshold', 'release', { hum: 0.01, hiss: 0.005 }, 6));
    dir.at(47, () => audio.creatureSound('hound', 16, 'approach', 0.3));
    dir.at(50, () => audio.creatureSound('hound', 12, 'reveal', 0.3));
    dir.at(71, () => audio.horrorBeat('day5', 'projector', 'release', { hum: 0.015, hiss: 0.005 }, 12));
    dir.at(85, () => audio.horrorBeat('day5', 'ink_door', 'build', { hum: 0.005, hiss: 0 }, 8));
    dir.at(89, () => audio.creatureSound('ink_man', 10, 'approach'));
    dir.at(94, () => { audio.creatureSound('ink_man', 6, 'reveal'); audio.horrorBeat('day5', 'ink_door', 'scare', { hum: 0.06 }); });
    dir.at(120, () => { rig.shake = 0.1; rig.fovKick = 0; fx.corr = 0.12; audio.horrorBeat('day5', 'editing_room', 'release', { hum: 0.015, hiss: 0.005 }, 9); });
    // Grin Cat emerges
    dir.at(16, () => {
        cat.visible = true;
        cat.position.set(-18, 0, -30);
        audio.thump(50, 0.8, 1.5);
        env.glitch(0.5, 0.5);
        fx.corr = 0.45;
    });
    dir.tween(16, 4, (p) => {
        const ty = Math.atan2(-(cat.position.x - rig.pos.x), -(cat.position.z - rig.pos.z));
        rig.yaw = lerp(rig.yaw, ty, 0.1);
        rig.pitch = lerp(-0.02, -0.25, smooth(p));
    });
    dir.at(20, () => env.say('???', 'Well, well! Look what wandered into the picture!', { pitch: 1.8, rate: 0.9 }));
    dir.at(25, () => {
        rig.walk = 1;
        rig.yaw = Math.PI;
        env.say('YOU', 'Back away. Back away.');
    });
    dir.tween(25, 4, (p) => {
        place(lerp(0, 0, p), lerp(0, 8, smooth(p)));
    });
    dir.at(30, () => {
        // cat stretches an arm across the street
        cat.position.z = 8;
        rig.walk = 0;
        audio.thump(45, 0.7, 1.4);
    });
    dir.at(32, () => env.say('???', "Leaving already? We haven't even started the show!", { pitch: 1.8, rate: 0.9 }));
    dir.at(37, () => {
        // music cuts out
        audio.level('hiss', 0.2, 0.2);
        env.glitch(0.6, 0.4);
    });
    dir.at(39, () => {
        cat.visible = false;
        rig.walk = 1.8;
        env.say('YOU', 'Doorway. Go to the doorway.');
    });
    // theater with a seated shape
    dir.at(42, () => {
        theater.visible = true;
        rig.pos.set(0, 1.7, -40);
        rig.yaw = 0;
    });
    dir.tween(42, 6, (p) => {
        rig.pos.z = lerp(-40, -84, smooth(p));
    });
    dir.at(50, () => {
        hound.visible = true;
        hound.position.set(0, 0, -96);
        hound.rotation.y = Math.PI;
        rig.walk = 0;
        audio.breath(0.2);
    });
    dir.tween(50, 2, (p) => {
        hHead.rotation.y = lerp(0, 0.9, smooth(p));
    });
    dir.at(54, () => env.say('???', 'You smell like the outside.', { pitch: 0.6, rate: 0.8 }));
    dir.at(58, () => {
        rig.walk = 1.8;
        env.say('YOU', 'Stay back. Stay the fuck back.');
    });
    dir.tween(58, 3, (p) => {
        rig.pos.z = lerp(-84, -74, smooth(p));
    });
    dir.at(62, () => {
        // the hound appears behind the protagonist without moving
        hound.position.set(0, 0, -72);
        hHead.rotation.y = 0.4;
        audio.thump(35, 0.6, 1);
        env.glitch(0.7, 0.4);
    });
    dir.at(65, () => env.say('???', 'Nobody comes from outside anymore.', { pitch: 0.6, rate: 0.8 }));
    dir.at(70, () => {
        // curtains open by themselves
        curtainL.position.x = -9;
        curtainR.position.x = 9;
        audio.thump(40, 0.04, 1.2);
        hound.visible = false;
        theater.visible = false;
    });
    // ink factory
    dir.at(74, () => {
        factory.visible = true;
        rig.pos.set(0, 1.7, -130);
        rig.yaw = 0;
        rig.walk = 1;
        audio.level('hum', 0.12, 1);
    });
    dir.tween(74, 8, (p) => {
        rig.pos.z = lerp(-130, -150, smooth(p));
        rig.pitch = lerp(0, -0.25, smooth(p));
    });
    dir.at(82, () => {
        // projector plays the protagonist's double being erased
        beam.material.opacity = 0.5;
        env.say('YOU', "They're turning us into these things.");
        rig.walk = 0;
    });
    dir.at(88, () => {
        // ink leaks under a locked door
        inkPool.scale.set(4, 4, 4);
        audio.thump(38, 0.035, 1.5);
    });
    // Ink Man bursts through
    dir.at(94, () => {
        lockedDoor.visible = false;
        ink.visible = true;
        // Ink is a world-space actor; factory is centred at z=-140.
        ink.position.set(0, 0, -156);
        audio.thump(55, 0.9, 1.5);
        env.glitch(0.8, 0.5);
        fx.corr = 0.65;
    });
    dir.at(98, () => env.say('???', 'Every good story needs a permanent cast.', { pitch: 0.5, rate: 0.7 }));
    dir.at(103, () => {
        rig.walk = 1.8;
        rig.yaw = Math.PI;
        env.say('YOU', 'Run! Run!');
    });
    dir.tween(103, 6, (p) => {
        rig.pos.z = lerp(-150, -130, p);
        rig.yaw = lerp(Math.PI, Math.PI, p);
        ink.position.z = lerp(-156, -140, p);
        inkPool.scale.setScalar(4 + p * 6);
    });
    dir.at(108, () => {
        // falling mechanical arm narrowly missed
        audio.thump(60, 0.9, 1.2);
        env.glitch(0.9, 0.6);
        rig.shake = 0.8;
    });
    dir.at(112, () => {
        // all three cornered for the three-way pursuit
        cat.visible = true;
        cat.position.set(-8, 0, -120);
        hound.visible = true;
        hound.position.set(8, 0, -124);
        fx.corr = 0.85;
        rig.shake = 0.9;
        rig.fovKick = 6;
    });
    dir.tween(112, 6, (p) => {
        rig.pos.z = lerp(-130, -146, smooth(p));
        ink.position.x = 4;
        ink.position.z = lerp(-140, -144, p);
    });
    dir.at(120, () => {
        // film-editing machine: the world freezes into a frame
        rig.walk = 0;
        cat.visible = false;
        hound.visible = false;
        ink.visible = false;
        env.say('???', 'You keep ruining the ending.', { pitch: 0.4, rate: 0.7 });
        audio.level('hum', 0.015, 0.3);
    });
    dir.at(124, () => env.say('YOU', 'Then stop writing it.'));
    dir.at(130, () => {
        // film strip tears, world tears down the middle
        fx.corr = 1;
        fx.tear = 1;
        audio.thump(65, 1, 2);
        env.glitch(1, 1);
    });
    dir.tween(132, 3, (p) => {
        fx.fade = smooth(p);
    });
    dir.at(136, () => {
        // flash, television changing channels
        audio.staticBurst(1, 0.6);
        env.title('DAY SIX — THE BROADCAST.', 3);
    });
    // Hand off to Day Six at the end of the film tear. Day Six is a separate
    // episode file (it is not nested inside this build), so Day Five stays
    // self-contained and cannot fail on a second studio's setup.
    dir.at(140, () => env.finish());
}
