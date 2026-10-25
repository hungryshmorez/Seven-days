/**
 * PROLOGUE OPENING — the plane crash. The protagonist is on a small plane with
 * friends; a mechanical fault brings it down on the island. Friends are with
 * the protagonist at impact, then some are lost in the crash and some are
 * still missing when the protagonist walks the island.
 *
 * Friend state is tracked in the store (friends) so later days can read who
 * is still alive, who has vanished, and who has turned hostile on the loop.
 */
import * as THREE from 'three';
import { animateHumanoid, buildHumanoid, type HumanOptions } from './humanoid.ts';
import { type Env, lerp, smooth } from './director.ts';
import { store, saveProgress } from '../state/store.ts';

export const FRIEND_NAMES = ['Mitzi Goins', 'Alan', 'Sloppy', 'Oliver'] as const;
export type FriendName = (typeof FRIEND_NAMES)[number];
export type FriendState = 'with-you' | 'missing' | 'lost' | 'hostile';

/** Set the friend roster once at the crash. Existing state is kept on reload. */
export function initFriends(): Record<FriendName, FriendState> {
    const existing = store.get().friends as Record<FriendName, FriendState> | undefined;
    const roster = Object.fromEntries(FRIEND_NAMES.map((name) => [name,
        store.get().loopCount > 0 ? 'hostile' : existing?.[name] ?? 'with-you',
    ])) as Record<FriendName, FriendState>;
    store.patch({ friends: roster });
    saveProgress();
    return roster;
}

/** Record a friend's state change and save it (used by later days). */
export function setFriend(name: FriendName, state: FriendState) {
    const cur = (store.get().friends ?? initFriends()) as Record<FriendName, FriendState>;
    store.patch({ friends: { ...cur, [name]: store.get().loopCount > 0 ? 'hostile' : state } });
    saveProgress();
}

export function buildCrash(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x05080c);
    scene.fog = new THREE.FogExp2(0x05080c, 0.05);
    scene.add(new THREE.HemisphereLight(0x8090b0, 0x1a1a1a, 0.6));

    // ---- a small charter plane at night: fuselage, seats, windows, overhead lights ----
    const cabin = new THREE.Group();
    const hull = new THREE.Mesh(
        new THREE.CylinderGeometry(1.6, 1.6, 14, 18, 1, true),
        new THREE.MeshStandardMaterial({ color: 0x4a4a52, roughness: 0.8, side: THREE.BackSide })
    );
    hull.rotation.x = Math.PI / 2;
    hull.position.y = 1.2;
    cabin.add(hull);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(2.8, 14), new THREE.MeshStandardMaterial({ color: 0x2a2228, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    cabin.add(floor);
    const aisle = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 14), new THREE.MeshStandardMaterial({ color: 0x5a1e22, roughness: 1 }));
    aisle.rotation.x = -Math.PI / 2;
    aisle.position.y = 0.005;
    cabin.add(aisle);
    // overhead bins
    const binM = new THREE.MeshStandardMaterial({ color: 0x8a8a90, roughness: 0.6 });
    for (const side of [-1, 1]) {
        const bin = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.35, 12), binM);
        bin.position.set(side * 1.05, 2.15, 0);
        cabin.add(bin);
    }
    // seats: two per row, either side of the aisle
    const seatM = new THREE.MeshStandardMaterial({ color: 0x223048, roughness: 0.9 });
    for (let row = 0; row < 6; row++) {
        for (const side of [-1, 1]) {
            const seat = new THREE.Group();
            const base = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.15, 0.5), seatM);
            base.position.y = 0.45;
            const back = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.75, 0.12), seatM);
            back.position.set(0, 0.85, 0.22);
            seat.add(base, back);
            seat.position.set(side * 0.65, 0, 2.6 - row * 1.2);
            cabin.add(seat);
        }
    }
    // windows: a moonlit sky with clouds sliding past, so the plane is clearly flying
    const skyCanvas = document.createElement('canvas');
    skyCanvas.width = 256;
    skyCanvas.height = 128;
    const g2 = skyCanvas.getContext('2d');
    if (g2) {
        const grad = g2.createLinearGradient(0, 0, 0, 128);
        grad.addColorStop(0, '#0b1a3a');
        grad.addColorStop(1, '#2a3c5c');
        g2.fillStyle = grad;
        g2.fillRect(0, 0, 256, 128);
        g2.fillStyle = '#e8eeff';
        g2.beginPath();
        g2.arc(190, 34, 12, 0, Math.PI * 2);
        g2.fill();
        for (let i = 0; i < 14; i++) {
            g2.fillStyle = 'rgba(200,210,235,' + (0.25 + (i % 3) * 0.12) + ')';
            g2.beginPath();
            g2.ellipse((i * 47) % 256, 70 + (i % 4) * 12, 26 + (i % 3) * 10, 7, 0, 0, Math.PI * 2);
            g2.fill();
        }
    }
    const skyTex = new THREE.CanvasTexture(skyCanvas);
    skyTex.colorSpace = THREE.SRGBColorSpace;
    skyTex.wrapS = THREE.RepeatWrapping;
    const windowM = new THREE.MeshBasicMaterial({ map: skyTex, fog: false });
    for (let i = 0; i < 8; i++) {
        for (const side of [-1, 1]) {
            const w = new THREE.Mesh(new THREE.PlaneGeometry(0.32, 0.42), windowM);
            w.position.set(side * 1.5, 1.35, 3.2 - i * 1.2);
            w.rotation.y = -side * Math.PI / 2;
            cabin.add(w);
        }
    }
    // warm cabin lights
    const cabinLights: THREE.PointLight[] = [];
    for (let i = 0; i < 3; i++) {
        const l = new THREE.PointLight(0xffd8a0, 1.4, 6, 1.4);
        l.position.set(0, 2.3, 2 - i * 3.5);
        cabin.add(l);
        cabinLights.push(l);
    }
    // cockpit door with a warning light that only comes on at the fault
    const cockpit = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.9), new THREE.MeshStandardMaterial({ color: 0x3a3a40 }));
    cockpit.position.set(0, 1, -4.6);
    cabin.add(cockpit);
    const panel = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.18), new THREE.MeshBasicMaterial({ color: 0xff3020 }));
    panel.position.set(0, 2.05, -4.58);
    panel.visible = false;
    cabin.add(panel);
    // the friends, seated: Mitzi across the aisle, Alan and Sloppy ahead, Oliver further up
    const person = (body: number, x: number, z: number, extra?: (g: THREE.Group) => void, look: HumanOptions = {}, seed = 0) => {
        const h = buildHumanoid({ pose: 'seated', top: body, ...look });
        const p = h.group;
        extra?.(p);
        p.position.set(x, 0, z);
        cabin.add(p);
        animateHumanoid(env, h, seed);
        return p;
    };
    person(0x8a2a2a, -0.65, 2.6, undefined, { skin: 0xd2a488, hair: { color: 0x3a2214, style: 'long' }, build: 0.2, bottom: 0x2c3040 }, 0); // Mitzi Goins
    person(0x5a4632, 0.65, 1.4, (p) => { // Alan, the movie guy, with his camera
        const cam = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.12, 0.22), new THREE.MeshStandardMaterial({ color: 0x111111 }));
        cam.position.set(0.15, 1.0, -0.2);
        p.add(cam);
    }, { skin: 0xb08060, hair: { color: 0x1a1410, style: 'cap' }, build: 0.6, bottom: 0x3a3a30 }, 1.7);
    person(0xd03a9a, -0.65, 1.4, (p) => { // Sloppy, the 80s rodeo clown
        const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.08, 12), new THREE.MeshStandardMaterial({ color: 0xf0c020 }));
        hat.position.y = 1.4;
        p.add(hat);
    }, { skin: 0xe0b898, hair: { color: 0xc8a040, style: 'short' }, build: 0.8, bottom: 0x2050a0 }, 3.1);
    person(0x111114, -0.65, 0.2, (p) => { // Oliver, the priest
        const collar = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.05, 0.02), new THREE.MeshBasicMaterial({ color: 0xffffff }));
        collar.position.set(0, 1.155, -0.06);
        p.add(collar);
    }, { skin: 0x9a6a4a, hair: { color: 0x6a6a6a, style: 'short' }, build: 0.4, bottom: 0x111114 }, 4.6);
    // oxygen masks hidden in the ceiling until the fault
    const masks: THREE.Mesh[] = [];
    for (let i = 0; i < 6; i++) {
        const m = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.1, 0.12), new THREE.MeshStandardMaterial({ color: 0xf0d020 }));
        m.position.set(i % 2 ? 0.65 : -0.65, 2.0, 2.4 - Math.floor(i / 2) * 1.2);
        m.visible = false;
        cabin.add(m);
        masks.push(m);
    }
    scene.add(cabin);
    let inFlight = true;
    let alarm = false;
    env.onFrame.push((_d, t) => {
        skyTex.offset.x = t * 0.04; // clouds passing the windows
        if (inFlight) {
            cabin.rotation.z = Math.sin(t * 0.4) * 0.015; // gentle bank
            cabin.position.y = Math.sin(t * 1.3) * 0.01; // light turbulence
        }
        if (alarm) {
            const on = Math.floor(t * 6) % 2 === 0;
            panel.visible = on;
            cabinLights.forEach((l, i) => (l.intensity = (Math.sin(t * 23 + i * 3) > 0.2 ? 1.2 : 0.2)));
        }
    });
    const place = (x: number, y: number, z: number) => rig.pos.set(x, y, z);
    place(0.65, 1.15, 2.6); // the protagonist's seat, aisle view toward the cockpit
    rig.yaw = 0;
    rig.pitch = -0.05;
    rig.lookFreedom = 0.6;
    rig.shake = 0.06;
    fx.corr = 0.08;
    fx.fade = 1;
    const friends = initFriends();
    void friends;
    // ===== Boarding and the warning =====
    dir.at(0, () => {
        audio.level('hum', 0.06, 2);
        audio.level('wind', 0.15, 3);
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(3, () => env.say('YOU', 'Everybody buckle up. Mitzi, you still have the map?'));
    dir.tween(7, 1.2, (p) => (rig.yaw = lerp(0, 1.1, smooth(p))));
    dir.at(8, () => env.say('MITZI', 'I have it. Stop worrying, we land in an hour.'));
    dir.tween(11, 1.2, (p) => (rig.yaw = lerp(1.1, 0, smooth(p))));
    dir.at(12, () => env.say('ALAN', 'The engine is making that sound again.'));
    dir.at(16, () => env.say('SLOPPY', 'Alan, don’t. Not right now.'));
    dir.at(20, () => env.say('OLIVER', 'Something’s burning. I can smell it.'));
    // ===== The fault and the crash =====
    dir.at(26, () => {
        audio.thump(40, 0.9, 1.5);
        inFlight = false;
        alarm = true;
        masks.forEach((m) => (m.visible = true));
        env.glitch(0.5, 0.3);
        env.say('PILOT', 'Mayday. We’ve lost the engine. Brace. Brace.', { pitch: 0.8, rate: 1.1 });
    });
    dir.tween(26, 6, (p) => {
        rig.pitch = lerp(-0.05, -0.6, smooth(p));
        rig.shake = lerp(0.1, 1.2, p);
        cabin.rotation.z = lerp(0, 0.4, smooth(p));
        masks.forEach((m, i) => {
            m.position.y = lerp(2.0, 1.55, Math.min(1, p * 3));
            m.position.x += Math.sin(p * 30 + i) * 0.002;
        });
        skyTex.offset.y = -p * 0.3; // the horizon tilts away through the windows
    });
    dir.at(33, () => {
        audio.thump(60, 1, 2);
        env.glitch(1, 0.8);
        rig.shake = 1.2;
        fx.corr = 0.45;
        env.say('YOU', 'Hold on! Hold on!');
    });
    dir.at(37, () => {
        // impact: the cabin is torn open and the protagonist is thrown onto sand
        rig.shake = 0.3;
        alarm = false;
        fx.fade = 1;
        fx.corr = 0.2;
        audio.staticBurst(0.8, 0.5);
    });
    // ===== Waking on the shore: friends found and missing =====
    dir.tween(40, 4, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(42, () => {
        rig.pitch = -0.3;
        env.say('YOU', 'Mitzi? Alan? Anybody?');
    });
    dir.at(46, () => env.say('OLIVER', 'Over here. I think I’m all right.'));
    dir.at(50, () => env.say('YOU', 'Sloppy? Where’s Sloppy?'));
    dir.at(54, () => env.say('MITZI', 'I don’t know. He was right behind me.'));
    dir.at(58, () => {
        // Alan is found hurt; Sloppy is not with them.
        env.say('YOU', 'Alan, stay down. We’ll find Sloppy.');
    });
    dir.at(63, () => {
        env.say('YOU', 'We stick together. We find the others, we find help.');
        rig.pitch = 0;
        // Sloppy was thrown from the cabin in the crash and is not found.
        setFriend('Sloppy', 'lost');
    });
    // No finish() here: the crash is an act inside the Prologue, which ends the episode.
}
