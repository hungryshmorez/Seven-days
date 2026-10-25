/**
 * DAY THREE — the home dream (bible section 2, Day Three): a childhood home
 * that stops feeling safe. A burned accomplice figure, a pentagram, a white
 * figure. This act runs inside Day Three after the fall into the forest.
 * Same Env/Director/rig/VHS systems. NOTHING interactive is built here.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { terrify } from './scary.ts';
import { buildBurnedCrawler, buildWhiteFigure } from './creatureModels.ts';
const noVeins = <T extends THREE.Material>(m: T): T => { m.userData.creatureVeins = 0; return m; };

export function buildDay3Home(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    const house = new THREE.Group();
    house.position.set(0, -200, 0);
    scene.add(house);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(12, 12), new THREE.MeshStandardMaterial({ color: 0x6a4a34, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    house.add(floor);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(12, 3.2, 12), new THREE.MeshStandardMaterial({ color: 0xe8d8b8, side: THREE.BackSide }));
    walls.position.y = 1.6;
    house.add(walls);
    const table = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.15, 1.2), new THREE.MeshStandardMaterial({ color: 0x8a5a34 }));
    table.position.set(0, 0.8, -1);
    house.add(table);
    const tv = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.9, 0.1), new THREE.MeshBasicMaterial({ color: 0x202838 }));
    tv.position.set(0, 1.1, -5.8);
    house.add(tv);
    const photograph = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.6), new THREE.MeshBasicMaterial({ color: 0xd8cdb2 }));
    photograph.position.set(3.2, 1.7, -5.92);
    house.add(photograph);
    // the burned accomplice: a small charred figure that crawls on the walls
    const accomplice = new THREE.Group();
    const childM = new THREE.MeshStandardMaterial({ color: 0x333333, roughness: 0.9 });
    const crawlerFlesh = new THREE.MeshStandardMaterial({ color: 0x6a1a10, roughness: 0.9 });
    const crawlerChar = new THREE.MeshStandardMaterial({ color: 0x0a0604, roughness: 1 });
    const crawlerHead = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), crawlerFlesh);
    crawlerHead.position.set(0, 0.5, 0);
    accomplice.add(crawlerHead, buildBurnedCrawler(crawlerFlesh, crawlerChar).group);
    accomplice.position.set(-4, 0, -5);
    accomplice.visible = false;
    house.add(accomplice);
    // burned accomplice (Day Three home): charred sphere body, extra crawling legs
    const burnM = new THREE.MeshStandardMaterial({ color: 0x1a0c08, roughness: 0.8 });
    const aSmile = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.03, 6, 12, Math.PI), new THREE.MeshBasicMaterial({ color: 0xffffff }));
    aSmile.position.set(0, 0.42, 0.3);
    aSmile.rotation.x = Math.PI;
    accomplice.add(aSmile);
    terrify(env, accomplice, { creature: 'burned_accomplice', eyes: { at: [0, 0.56, 0.31], spread: [0.24, 0, 0], size: 0.06, color: 0xfff0a0 }, teeth: { at: [0, 0.39, 0.34], spread: [0.36, 0, 0], count: 7, size: 0.08 }, twitch: 1, breathe: 0.05 });
    // pentagram that glows near the end
    const pent = new THREE.Group();
    pent.position.set(0, 0.02, -2);
    house.add(pent);
    const pentRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 2.75, 5), new THREE.MeshBasicMaterial({ color: 0xff5a20, transparent: true, opacity: 0 }));
    pentRing.rotation.x = -Math.PI / 2;
    pent.add(pentRing);
    const candleM = new THREE.MeshBasicMaterial({ color: 0xffcc66 });
    const candles: THREE.Mesh[] = [];
    for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        const c = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 5), candleM);
        c.position.set(Math.cos(a) * 2.65, 0.15, Math.sin(a) * 2.65);
        c.visible = false;
        pent.add(c);
        candles.push(c);
    }
    // the white figure (memory of a mother?) in the kitchen doorway
    const figure = new THREE.Group();
    figure.add(buildWhiteFigure(noVeins(new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 })), noVeins(new THREE.MeshStandardMaterial({ color: 0xc8b8a8, roughness: 0.6 })), noVeins(new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.5 }))).group);
    figure.position.set(4.5, 0, -4);
    figure.visible = false;
    house.add(figure);
    terrify(env, figure, { creature: 'white_figure', eyes: { at: [0, 2.46, 0.19], spread: [0.1, 0, 0], size: 0.035, color: 0x000000, blink: false } });
    let accompliceZ = -4;
    env.onFrame.push((_d, t) => {
        pentRing.material.opacity = glowPent;
        if (accomplice.visible) accomplice.position.z = accompliceZ + Math.sin(t * 0.7) * 0.3;
    });
    let glowPent = 0;
    const place = (x: number, z: number) => rig.pos.set(x, -198.3, z);
    place(0, 4);
    rig.yaw = Math.PI;
    rig.pitch = -0.02;
    rig.lookFreedom = 0.5;
    rig.shake = 0.1;
    rig.onStep = () => audio.step(0.5);
    fx.fade = 1;
    dir.tween(0, 2, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(3, () => env.say('YOU', 'This is my kitchen. This is my house. Why does it feel like I was just here?'));
    dir.at(8, () => env.say('YOU', 'The news is still on.'));
    dir.at(12, () => { tv.material = new THREE.MeshBasicMaterial({ color: 0x6a88b8 }); });
    dir.at(20, () => {
        env.say('NEWS REPORTER', 'Three people are confirmed dead. Several others are still missing.', { pitch: 0.9, rate: 0.85 });
        audio.breath(0.25);
    });
    dir.at(26, () => env.say('NEWS REPORTER', 'Investigators have not yet released the names.', { pitch: 0.9, rate: 0.85 }));
    dir.at(31, () => env.say('YOU', 'Missing. Please call. Last seen. That is my face.'));
    dir.at(36, () => env.title('LAST SEEN', 3));
    dir.at(40, () => env.say('YOU', 'I am right here. Why does it say missing?'));
    dir.at(45, () => { env.glitch(0.4, 0.4); });
    dir.at(51, () => audio.horrorBeat('day3', 'home_takeover', 'build', { wind: 0, hum: 0.005, hiss: 0 }, 4));
    dir.at(56, () => { audio.creatureSound('burned_accomplice', 4, 'reveal'); audio.horrorBeat('day3', 'home_takeover', 'scare', { hum: 0.025 }); });
    dir.at(86, () => { fx.corr = 0.1; rig.fovKick = 0; audio.horrorBeat('day3', 'kitchen_return', 'release', { wind: 0, hum: 0.015, hiss: 0.005 }, 6); });
    dir.at(51, () => {
        // the lights dim; the accomplice crawls
        house.traverse((o) => {
            if (!(o instanceof THREE.Mesh)) return;
            for (let p: THREE.Object3D | null = o; p; p = p.parent) if (p === accomplice) return; // the crawler keeps its own skin
            o.material = childM;
        });
        accomplice.visible = true;
        env.say('YOU', "It's okay. We got out. It's okay...");
    });
    dir.tween(52, 6, (p) => {
        accompliceZ = lerp(-4, -1, p);
        accomplice.position.x = lerp(-4, 1, p);
    });
    dir.at(60, () => { accomplice.visible = false; env.glitch(0.5, 0.4); });
    dir.at(64, () => env.say('???', 'We almost had enough stones.', { pitch: 1.2, rate: 0.8 }));
    dir.at(68, () => { candles.forEach((c) => (c.visible = true)); });
    dir.tween(68, 6, (p) => (glowPent = p * 0.8));
    dir.at(74, () => env.say('???', 'Four stones. North, south, east, west.', { pitch: 1.2, rate: 0.8 }));
    dir.at(80, () => env.say('???', 'If the fire goes out, the attempt fails.', { pitch: 1.2, rate: 0.8 }));
    // the white figure in the doorway
    dir.at(86, () => {
        figure.visible = true;
        rig.yaw = Math.PI - 0.7;
        env.say('YOU', 'Mom?');
    });
    dir.at(90, () => env.say('???', "Your room is exactly as you left it.", { pitch: 0.9, rate: 0.8 }));
    dir.at(93, () => env.finish());
}
