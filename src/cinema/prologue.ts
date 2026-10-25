/**
 * PROLOGUE — the island. A bodycam wakes on a moonlit beach, walks to an
 * abandoned camp, finds a radio and a tape, and is watched from the treeline.
 * This is the first finished scene; later days reuse the same Director/rig/VHS.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth, runAct } from './director.ts';
import { buildCrash } from './crash.ts';
import { store, saveProgress } from '../state/store.ts';
import { terrify } from './scary.ts';
import { buildWatcher } from './creatureModels.ts';

export function terrainH(x: number, z: number): number {
    const slope = THREE.MathUtils.clamp((12 - z) * 0.08, -2, 3);
    return slope + Math.sin(x * 0.13) * Math.cos(z * 0.11) * 0.5 + Math.sin(x * 0.4 + z * 0.3) * 0.08;
}
const SEA_Y = -0.6;
const CAMP = new THREE.Vector3(-5, 0, -8);
const TABLE = new THREE.Vector3(-3.4, 0, -7.4);
const WATCHER = new THREE.Vector3(10, 0, -24);

function rand(seed: number) {
    let s = seed;
    return () => ((s = (s * 16807) % 2147483647) / 2147483647);
}

export function buildPrologue(env: Env, options: { backdropOnly?: boolean } = {}) {
    const { scene, rig, audio, dir, fx } = env;
    const rnd = rand(42);

    scene.background = new THREE.Color(0x0a1118);
    scene.fog = new THREE.FogExp2(0x0a1118, 0.03);

    // --- lighting: cold moon, warm fire ---
    scene.add(new THREE.HemisphereLight(0x4a6688, 0x1a1c14, 0.55));
    const moon = new THREE.DirectionalLight(0x8aa6d8, 0.9);
    moon.position.set(-30, 40, 20);
    scene.add(moon);
    const moonDisc = new THREE.Mesh(
        new THREE.CircleGeometry(5, 24),
        new THREE.MeshBasicMaterial({ color: 0xdfe8ff, fog: false })
    );
    moonDisc.position.set(-60, 70, 150).multiplyScalar(1);
    moonDisc.lookAt(0, 0, 0);
    scene.add(moonDisc);
    const starGeo = new THREE.BufferGeometry();
    const sp: number[] = [];
    for (let i = 0; i < 400; i++) {
        const a = rnd() * Math.PI * 2;
        const e = 0.1 + rnd() * 1.2;
        sp.push(Math.cos(a) * Math.cos(e) * 300, Math.sin(e) * 300, Math.sin(a) * Math.cos(e) * 300);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(sp, 3));
    scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ size: 1.4, color: 0xffffff, fog: false, sizeAttenuation: false })));

    // --- terrain ---
    const tg = new THREE.PlaneGeometry(220, 220, 110, 110);
    tg.rotateX(-Math.PI / 2);
    const pos = tg.attributes.position;
    const colors: number[] = [];
    const sand = new THREE.Color(0x8f8366);
    const wet = new THREE.Color(0x4a4636);
    const grass = new THREE.Color(0x2a3622);
    for (let i = 0; i < pos.count; i++) {
        const x = pos.getX(i);
        const z = pos.getZ(i);
        const y = terrainH(x, z);
        pos.setY(i, y);
        const c = y < -0.2 ? wet : z < -6 ? grass : sand.clone().lerp(grass, THREE.MathUtils.clamp((8 - z) / 20, 0, 1));
        colors.push(c.r, c.g, c.b);
    }
    tg.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    tg.computeVertexNormals();
    scene.add(new THREE.Mesh(tg, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })));

    // --- sea (animated) ---
    const sg = new THREE.PlaneGeometry(260, 260, 52, 52);
    sg.rotateX(-Math.PI / 2);
    const sea = new THREE.Mesh(
        sg,
        new THREE.MeshStandardMaterial({ color: 0x0d2a3c, roughness: 0.25, metalness: 0.3, transparent: true, opacity: 0.92 })
    );
    sea.position.y = SEA_Y;
    scene.add(sea);
    const sPos = sg.attributes.position;
    env.onFrame.push((_dt, t) => {
        for (let i = 0; i < sPos.count; i++) {
            const x = sPos.getX(i);
            const z = sPos.getZ(i);
            sPos.setY(i, Math.sin(x * 0.25 + t * 0.9) * 0.12 + Math.sin(z * 0.2 - t * 0.7) * 0.15 + Math.sin(t * 0.7 - z * 0.05) * 0.2);
        }
        sPos.needsUpdate = true;
        sg.computeVertexNormals();
    });

    // --- forest ---
    const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 5, 6);
    const coneG = new THREE.ConeGeometry(1.8, 5, 7);
    const trunkM = new THREE.MeshStandardMaterial({ color: 0x2a1f16, roughness: 1 });
    const leafM = new THREE.MeshStandardMaterial({ color: 0x14261a, roughness: 1 });
    const trees: THREE.Group[] = [];
    for (let i = 0; i < 130; i++) {
        const x = (rnd() - 0.5) * 120;
        const z = -14 - rnd() * 70;
        if (Math.hypot(x - CAMP.x, z - CAMP.z) < 9) continue;
        if (Math.hypot(x - WATCHER.x, z - WATCHER.z) < 3) continue;
        const g = new THREE.Group();
        const s = 0.8 + rnd() * 0.9;
        const tr = new THREE.Mesh(trunkG, trunkM);
        tr.position.y = 2.5;
        const c1 = new THREE.Mesh(coneG, leafM);
        c1.position.y = 5.5;
        const c2 = new THREE.Mesh(coneG, leafM);
        c2.position.y = 8;
        c2.scale.setScalar(0.7);
        g.add(tr, c1, c2);
        g.scale.setScalar(s);
        g.position.set(x, terrainH(x, z) - 0.2, z);
        scene.add(g);
        trees.push(g);
    }
    env.onFrame.push((_dt, t) => {
        trees.forEach((g, i) => (g.rotation.z = Math.sin(t * 0.6 + i) * 0.008)); // wind sway
    });
    // a few rocks on the beach
    const rockG = new THREE.DodecahedronGeometry(0.6, 0);
    const rockM = new THREE.MeshStandardMaterial({ color: 0x3a3a3c, roughness: 1 });
    for (let i = 0; i < 18; i++) {
        const x = (rnd() - 0.5) * 50;
        const z = 4 + rnd() * 14;
        const r = new THREE.Mesh(rockG, rockM);
        r.position.set(x, terrainH(x, z) + 0.1, z);
        r.scale.set(0.5 + rnd(), 0.4 + rnd() * 0.5, 0.5 + rnd());
        r.rotation.y = rnd() * 6;
        scene.add(r);
    }

    // --- camp ---
    const camp = new THREE.Group();
    camp.position.set(CAMP.x, terrainH(CAMP.x, CAMP.z), CAMP.z);
    scene.add(camp);
    const tent = new THREE.Mesh(
        new THREE.ConeGeometry(2.2, 1.8, 4),
        new THREE.MeshStandardMaterial({ color: 0x5a6a3a, roughness: 0.9 })
    );
    tent.position.set(-3, 0.9, -3);
    tent.rotation.y = Math.PI / 4;
    camp.add(tent);
    const stoneM = new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 1 });
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), stoneM);
        s.position.set(Math.cos(a) * 0.55, 0.1, Math.sin(a) * 0.55);
        camp.add(s);
    }
    const flames: THREE.Mesh[] = [];
    for (let i = 0; i < 4; i++) {
        const f = new THREE.Mesh(
            new THREE.ConeGeometry(0.2, 0.7, 6),
            new THREE.MeshBasicMaterial({ color: i % 2 ? 0xff9a2a : 0xff5a10, transparent: true, opacity: 0.85 })
        );
        f.position.set((rnd() - 0.5) * 0.3, 0.35, (rnd() - 0.5) * 0.3);
        camp.add(f);
        flames.push(f);
    }
    const fire = new THREE.PointLight(0xff8a3a, 2.4, 14, 1.6);
    fire.position.set(0, 0.9, 0);
    camp.add(fire);
    // logs to sit on
    const logM = new THREE.MeshStandardMaterial({ color: 0x3a2a1a, roughness: 1 });
    for (const [lx, lz, ry] of [[1.6, 0.6, 0.4], [-0.4, 1.7, 1.8]] as const) {
        const l = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 1.4, 8), logM);
        l.rotation.z = Math.PI / 2;
        l.rotation.y = ry;
        l.position.set(lx, 0.2, lz);
        camp.add(l);
    }
    // table with radio and tape
    const tableLocal = new THREE.Vector3(TABLE.x - CAMP.x, 0, TABLE.z - CAMP.z);
    const table = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.08, 0.7), logM);
    table.position.set(tableLocal.x, 0.8, tableLocal.z);
    camp.add(table);
    for (const [ox, oz] of [[-0.5, -0.28], [0.5, -0.28], [-0.5, 0.28], [0.5, 0.28]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.8, 0.07), logM);
        leg.position.set(tableLocal.x + ox, 0.4, tableLocal.z + oz);
        camp.add(leg);
    }
    const radio = new THREE.Group();
    const rb = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.2, 0.12), new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.6 }));
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.5, 4), new THREE.MeshStandardMaterial({ color: 0x999999 }));
    ant.position.set(0.12, 0.3, 0);
    ant.rotation.z = -0.35;
    const dial = new THREE.Mesh(new THREE.CircleGeometry(0.05, 12), new THREE.MeshBasicMaterial({ color: 0x66ff88 }));
    dial.position.set(-0.08, 0, 0.061);
    radio.add(rb, ant, dial);
    radio.position.set(tableLocal.x - 0.25, 0.94, tableLocal.z);
    radio.rotation.y = 0.3;
    camp.add(radio);
    const tape = new THREE.Group();
    const tb = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.1), new THREE.MeshStandardMaterial({ color: 0x0c0c0c, roughness: 0.5 }));
    const tl = new THREE.Mesh(new THREE.PlaneGeometry(0.12, 0.05), new THREE.MeshBasicMaterial({ color: 0xd8d2b8 }));
    tl.rotation.x = -Math.PI / 2;
    tl.position.y = 0.016;
    tape.add(tb, tl);
    tape.position.set(tableLocal.x + 0.25, 0.86, tableLocal.z + 0.05);
    tape.rotation.y = -0.4;
    camp.add(tape);

    // embers
    const eg = new THREE.BufferGeometry();
    const ep = new Float32Array(40 * 3);
    eg.setAttribute('position', new THREE.BufferAttribute(ep, 3));
    const embers = new THREE.Points(eg, new THREE.PointsMaterial({ color: 0xffa040, size: 0.05 }));
    camp.add(embers);
    const seeds = Array.from({ length: 40 }, () => rnd() * 5);
    let flicker = 1;
    let blackout = 0; // scripted light failure
    env.onFrame.push((_dt, t) => {
        flames.forEach((f, i) => {
            f.scale.set(1 + Math.sin(t * 11 + i) * 0.2, 1 + Math.sin(t * 13 + i * 2) * 0.3, 1);
            f.rotation.y = t * 2 + i;
        });
        fire.intensity = (2.4 + Math.sin(t * 17) * 0.4 + Math.sin(t * 31) * 0.3) * flicker * (1 - blackout);
        for (let i = 0; i < 40; i++) {
            const p = (t * 0.4 + seeds[i]) % 3;
            ep[i * 3] = Math.sin(seeds[i] * 9 + p) * 0.5 * p * 0.5;
            ep[i * 3 + 1] = 0.6 + p * 0.9;
            ep[i * 3 + 2] = Math.cos(seeds[i] * 7 + p) * 0.4 * p * 0.5;
        }
        eg.attributes.position.needsUpdate = true;
    });

    // --- the watcher: tall, thin, wrong ---
    const watcher = new THREE.Group();
    const watcherSkin = new THREE.MeshStandardMaterial({ color: 0x0b0b10, roughness: 0.5 });
    const { group: watcherBody, head: wh } = buildWatcher(watcherSkin);
    watcher.add(watcherBody);
    watcher.position.set(WATCHER.x, terrainH(WATCHER.x, WATCHER.z), WATCHER.z);
    watcher.visible = false;
    scene.add(watcher);
    terrify(env, watcher, { creature: 'watcher', eyes: { at: [0, 0.04, 0.2], spread: [0.15, 0, 0], size: 0.04, color: 0xe8ecff, parent: wh }, twitch: 0.7, breathe: 0.02, dropout: true });
    env.onFrame.push((_dt, t) => {
        if (watcher.visible) {
            watcher.rotation.y = Math.atan2(rig.pos.x - WATCHER.x, rig.pos.z - WATCHER.z);
            wh.rotation.z = Math.sin(t * 0.7) * 0.05 + (Math.floor(t * 3) % 5 === 0 ? 0.5 : 0); // neck jerks
        }
    });

    // Reuse the exact island for the finale without scheduling another crash or chapter.
    if (options.backdropOnly) return;

    // ================= TIMELINE =================
    const eye = 1.7;
    const place = (x: number, z: number) => rig.pos.set(x, Math.max(terrainH(x, z), SEA_Y + 0.4) + eye, z);
    place(0, 16);
    rig.yaw = Math.PI;
    rig.pitch = -0.05;
    rig.lookFreedom = 0.6;
    rig.shake = 0.15;
    rig.onStep = () => audio.step(0.8);
    fx.corr = 0.08;
    fx.fade = 1;

    // ===== Act I: the plane crash and the friends (crash.ts), then the beach =====
    // The crash plays first; the beach timeline below starts at BEACH_START.
    const savedOffset = dir.offset;
    const islandVisibility = scene.children.map((node) => ({ node, visible: node.visible }));
    const islandBackground = scene.background;
    const islandFog = scene.fog;
    islandVisibility.forEach(({ node }) => { node.visible = false; });
    runAct(env, 0, buildCrash);
    const crashNodes = scene.children.filter((node) => !islandVisibility.some((entry) => entry.node === node));
    const revealShore = () => {
        crashNodes.forEach((node) => { node.visible = false; });
        islandVisibility.forEach(({ node, visible }) => { node.visible = visible; });
        scene.background = islandBackground;
        scene.fog = islandFog;
        place(0, 16);
        rig.yaw = Math.PI;
        rig.pitch = -0.05;
        rig.roll = 0;
        rig.walk = 0;
        rig.shake = 0.15;
        rig.fovKick = 0;
        rig.lookFreedom = 0.6;
        fx.corr = 0.1; // clear picture on the shore
    };
    // The post-impact wake-up now shows the shore, not the still-intact cabin.
    dir.at(40, revealShore);
    dir.tween(66, 3, (p) => { fx.fade = smooth(p); });
    const BEACH_START = 70;
    // Shift every beach cue below; keep offsets scoped to this build.
    dir.offset = savedOffset + BEACH_START;
    dir.at(0, () => {
        revealShore();
        fx.fade = 1;
        fx.corr = 0.08;
        audio.level('ocean', 0.55, 3);
        audio.level('wind', 0.2, 4);
        audio.level('hiss', 0.04, 2);
    });
    dir.tween(0, 3.5, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(4, () => {
        audio.breath();
        env.say('YOU', 'Hello? Anybody? Where the hell is everybody?');
    });

    // Hidden pulse ending: the player has been completely still since the opening.
    // Checked once; if the idle threshold is met the chapter hands off to the survival ending.
    dir.at(20, () => {
        if (env.idleSeconds() >= 60) {
            store.patch({ pulseTriggered: true });
            saveProgress();
            env.finish();
        }
    });
    // turn away from the sea
    dir.tween(9, 3.5, (p) => {
        rig.yaw = lerp(Math.PI, 0, smooth(p));
        rig.pitch = lerp(-0.05, 0.02, smooth(p));
    });
    dir.at(13, () => env.say('YOU', 'Okay. Okay. Keep moving. Find a road.'));
    // walk along the rail to the camp
    const path = new THREE.CatmullRomCurve3([
        new THREE.Vector3(0, 0, 16),
        new THREE.Vector3(-0.8, 0, 9),
        new THREE.Vector3(-2.6, 0, 2),
        new THREE.Vector3(-3, 0, -4.2),
    ]);
    const tmp = new THREE.Vector3();
    // Explore run: the player takes over at the shore. The camp and trees block the walk.
    const exploreStart = () => {
        env.explore.active = true;
        env.explore.bounds = { minX: -40, maxX: 40, minZ: -26, maxZ: 16 };
        env.explore.collide = (x, z) => {
            // Camp table, tent, fire ring and the wide tree trunks block the path.
            if (Math.hypot(x - CAMP.x, z - CAMP.z) < 1.1) return true;
            if (Math.hypot(x - (CAMP.x - 3), z - (CAMP.z - 3)) < 1.4) return true;
            return trees.some((g) => Math.hypot(x - g.position.x, z - g.position.z) < 0.6 * g.scale.x);
        };
        env.explore.onUse = () => {
            if (Math.hypot(rig.pos.x - TABLE.x, rig.pos.z - TABLE.z) < 2) env.say('YOU', 'The radio. Someone was just talking on it.');
        };
    };
    dir.at(15, () => {
        rig.walk = 1;
        exploreStart();
    });
    dir.tween(15, 20, (p) => {
        if (env.explore.active) return;
        path.getPoint(smooth(p) * 0.5 + p * 0.5, tmp);
        place(tmp.x, tmp.z);
        // keep eyes on the firelight; settle toward the radio at the end
        const ty = Math.atan2(-(CAMP.x - rig.pos.x), -(CAMP.z - rig.pos.z));
        rig.yaw = lerp(rig.yaw, ty, 0.04);
        rig.pitch = lerp(0.02, -0.3, smooth(Math.max(0, (p - 0.7) / 0.3)));
        audio.level('ocean', lerp(0.55, 0.18, p), 0.5);
        if (p >= 1) rig.walk = 0;
    });
    dir.at(21, () => env.say('YOU', "There's a fire. Somebody's out here."));
    dir.at(28, () => {
        rig.shake = 0.25;
        env.say('YOU', "Hello? I'm not going to hurt you!");
    });
    dir.at(35.5, () => {
        rig.walk = 0;
        env.explore.active = false; // the camp is reached: the scripted beats below take over
    });
    // the radio
    dir.at(37, () => {
        audio.staticBurst(0.8, 0.5);
        audio.level('hum', 0.12, 1);
        fx.corr = 0.25;
        env.glitch(0.3, 0.5);
    });
    dir.at(38.5, () => env.say('RADIO', '...day one of seven... please stay where you are...', { pitch: 0.2, rate: 0.7, volume: 0.9 }));
    dir.at(43.5, () => env.say('YOU', 'Seven what? Seven what?!'));
    dir.tween(44, 2, (p) => (rig.pitch = lerp(-0.3, -0.42, smooth(p))));
    dir.at(48, () => {
        env.say('YOU', "That tape... that's not mine.");
        audio.thump(45, 0.7, 1.5);
    });
    dir.at(51, () => audio.horrorBeat('prologue', 'treeline', 'build', { ocean: 0, wind: 0, hum: 0.01, hiss: 0.005 }, 4));
    dir.at(53.5, () => audio.creatureSound('watcher', 24, 'approach', -0.5));
    dir.at(55, () => audio.creatureSound('watcher', 18, 'reveal', -0.5));
    dir.at(58.5, () => audio.horrorBeat('prologue', 'treeline', 'release', { hum: 0.015, hiss: 0.01 }, 3));

    // silence, then the watcher
    dir.at(53, () => {
        audio.level('ocean', 0, 0.8);
        audio.level('wind', 0, 0.8);
        audio.level('hum', 0.01, 1.5);
        audio.level('hiss', 0.005, 1);
        fx.corr = 0.55;
        rig.shake = 0.6;
        rig.fovKick = 3;
    });
    dir.tween(53, 4, (p) => (flicker = 1 - 0.5 * Math.abs(Math.sin(p * 40))));
    dir.at(55, () => {
        watcher.visible = true;
        rig.lookFreedom = 0;
        audio.thump(38, 1, 2);
        env.glitch(0.6, 0.3);
    });
    dir.tween(55, 2.2, (p) => {
        const ty = Math.atan2(-(WATCHER.x - rig.pos.x), -(WATCHER.z - rig.pos.z));
        rig.yaw = lerp(0, ty, smooth(p));
        rig.pitch = lerp(-0.42, 0.18, smooth(p));
    });
    dir.at(58, () => {
        audio.breath(0.35);
        env.say('YOU', "Don't look. Don't look at it.");
    });
    dir.at(62, () => {
        env.glitch(1, 0.6);
        watcher.visible = false;
        blackout = 1;
        fx.corr = 0.92;
        rig.fovKick = 14;
        audio.thump(30, 1, 2.5);
        audio.flutter(0.8);
    });
    dir.tween(63.5, 2, (p) => (fx.fade = smooth(p)));
    dir.at(64.5, () => {
        audio.level('hum', 0, 1.5);
        audio.level('hiss', 0, 1.5);
        env.title('DAY ONE');
    });
    dir.at(72, () => env.finish());
    dir.offset = savedOffset;
}
