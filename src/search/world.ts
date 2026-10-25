import * as THREE from 'three';

export const pathX = (z: number): number => Math.sin(z * 0.045) * 7;
export const CAMP_Z = -55;
export const CAMP_X = pathX(CAMP_Z);
export const LOG_Z = -120;
export const FENCE_Z = -185;
export const BUN_Z = -205;
export const BUN_X = pathX(BUN_Z);
export const BUN_DOOR_Z = BUN_Z - 8;
export const X0 = 300; // bunker interior offset

export interface Circle { x: number; z: number; r: number }
export interface Box { minx: number; maxx: number; minz: number; maxz: number; h: number }

export interface World {
    scene: THREE.Scene;
    colliders: Circle[];
    boxes: Box[];
    fire: THREE.PointLight;
    mastLight: THREE.Sprite;
    floodLight: THREE.PointLight;
    beaconGlow: THREE.Sprite;
    phone: THREE.Mesh;
    outdoor: THREE.Group;
    flashlightMesh: THREE.Mesh;
    mapMesh: THREE.Mesh;
    recorderMesh: THREE.Mesh;
    paperMesh: THREE.Mesh;
}

function rng(seed: number): () => number {
    let a = seed;
    return () => {
        a |= 0;
        a = (a + 0x6d2b79f5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function noiseTexture(base: [number, number, number], rep: number): THREE.CanvasTexture {
    const c = document.createElement('canvas');
    c.width = c.height = 128;
    const x = c.getContext('2d')!;
    // Soft, low-contrast mottling. Per-pixel high-contrast noise shimmered like TV snow.
    x.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    x.fillRect(0, 0, 128, 128);
    for (let i = 0; i < 128; i += 4) {
        for (let j = 0; j < 128; j += 4) {
            const v = 0.9 + Math.random() * 0.16;
            x.fillStyle = `rgb(${base[0] * v | 0},${base[1] * v | 0},${base[2] * v | 0})`;
            x.fillRect(i, j, 4, 4);
        }
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rep, rep);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
}

export function glowSprite(color: string, size: number, y: number): THREE.Sprite {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d')!;
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const s = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), blending: THREE.AdditiveBlending, depthWrite: false, fog: false, transparent: true })
    );
    s.scale.setScalar(size);
    s.position.y = y;
    return s;
}

const std = (color: number, rough = 0.9, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) =>
    new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });

function box(w: number, h: number, d: number, mat: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
}

export function buildWorld(): World {
    const scene = new THREE.Scene();
    const fogCol = 0x0d1822;
    scene.background = new THREE.Color(fogCol);
    scene.fog = new THREE.FogExp2(fogCol, 0.03);
    const colliders: Circle[] = [];
    const boxes: Box[] = [];
    const outdoor = new THREE.Group();
    scene.add(outdoor);
    const rand = rng(7);

    // ground, beach, sea
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(400, 400), new THREE.MeshStandardMaterial({ map: noiseTexture([46, 56, 36], 90), roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(0, 0, -110);
    outdoor.add(ground);
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(60, 18), new THREE.MeshStandardMaterial({ map: noiseTexture([150, 135, 105], 12), roughness: 1 }));
    sand.rotation.x = -Math.PI / 2;
    sand.position.set(0, 0.02, -1);
    outdoor.add(sand);
    const sea = new THREE.Mesh(new THREE.PlaneGeometry(300, 200), std(0x0c2233, 0.3, { metalness: 0.4 }));
    sea.rotation.x = -Math.PI / 2;
    sea.position.set(0, -0.05, 107);
    outdoor.add(sea);
    for (const s of [-1, 1]) {
        outdoor.add(box(10, 14, 30, std(0x1b1d20), s * 21, 5, -8));
    }

    // The boatman's boat, moored at the waterline with two big fog lamps angled down the path.
    const moored = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(3.2, 0.9, 7), std(0x5a4330));
    hull.position.set(0, 0.2, 0);
    moored.add(hull);
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.1, 6.4), std(0x3a2d20));
    deck.position.set(0, 0.7, 0);
    moored.add(deck);
    for (const s of [-1, 1]) {
        const lampPost = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.6, 0.12), std(0x2a2a2a));
        lampPost.position.set(s * 1.4, 1.5, -2.2);
        moored.add(lampPost);
        const lampHead = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.35, 0.5), new THREE.MeshBasicMaterial({ color: 0xffe2a0 }));
        lampHead.position.set(s * 1.4, 2.9, -2.2);
        moored.add(lampHead);
        const beam = new THREE.SpotLight(0xffe2a0, 900, 90, 0.42, 0.6, 1.2);
        beam.position.set(s * 1.4, 2.9, -2.2);
        beam.target.position.set(s * 1.4, 0, -30);
        moored.add(beam, beam.target);
    }
    moored.position.set(-6, 0, -4);
    outdoor.add(moored);

    // pines (instanced)
    const spots: { x: number; z: number; s: number }[] = [];
    for (let i = 0; i < 1500 && spots.length < 950; i++) {
        const z = 2 - rand() * 238;
        const side = rand() < 0.5 ? -1 : 1;
        const x = pathX(z) + side * (4.4 + rand() * 24);
        if (z > -7 && Math.abs(x) < 20) continue;
        if (Math.hypot(x - CAMP_X, z - CAMP_Z) < 12.5) continue;
        if (Math.hypot(x - BUN_X, z - BUN_Z) < 15) continue;
        spots.push({ x, z, s: 0.8 + rand() * 0.7 });
    }
    const trunkM = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.28, 0.4, 6, 6), std(0x2a1d14), spots.length);
    const cones = [
        new THREE.InstancedMesh(new THREE.ConeGeometry(2.3, 4, 7), std(0x112016), spots.length),
        new THREE.InstancedMesh(new THREE.ConeGeometry(1.8, 3.6, 7), std(0x142a1b), spots.length),
        new THREE.InstancedMesh(new THREE.ConeGeometry(1.2, 3, 7), std(0x163020), spots.length),
    ];
    const dummy = new THREE.Object3D();
    spots.forEach((t, i) => {
        dummy.rotation.set(0, rand() * 6, 0);
        dummy.scale.setScalar(t.s);
        dummy.position.set(t.x, 3 * t.s, t.z);
        dummy.updateMatrix();
        trunkM.setMatrixAt(i, dummy.matrix);
        [4.8, 7, 9].forEach((y, k) => {
            dummy.position.set(t.x, y * t.s, t.z);
            dummy.updateMatrix();
            cones[k].setMatrixAt(i, dummy.matrix);
        });
        if (Math.abs(t.x - pathX(t.z)) < 18) colliders.push({ x: t.x, z: t.z, r: 0.5 * t.s });
    });
    outdoor.add(trunkM, ...cones);

    // landmark: crooked pine
    const crooked = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.45, 9, 6), std(0x2a1d14));
    crooked.position.set(pathX(-42) - 4, 4, -42);
    crooked.rotation.z = 0.5;
    outdoor.add(crooked);
    // landmark: red cloth on branch near the fork
    const cloth = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.9), new THREE.MeshStandardMaterial({ color: 0xb01818, side: THREE.DoubleSide, emissive: 0x330000 }));
    cloth.position.set(pathX(-30) + 3.2, 2.2, -30);
    outdoor.add(cloth);
    // mast
    const mastX = pathX(-25) + 6;
    outdoor.add(box(0.3, 14, 0.3, std(0x555a60, 0.5, { metalness: 0.6 }), mastX, 7, -25));
    outdoor.add(box(2.4, 0.2, 0.2, std(0x555a60), mastX, 10, -25));
    const mastLight = glowSprite('rgba(255,40,40,1)', 3.2, 14);
    mastLight.position.x = mastX;
    mastLight.position.z = -25;
    outdoor.add(mastLight);
    colliders.push({ x: mastX, z: -25, r: 0.4 });

    // beach props
    const canoe = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 4, 8, 1, false, 0, Math.PI), std(0x2a5a6a, 0.6));
    canoe.rotation.set(0, 0.4, Math.PI / 2);
    canoe.rotation.order = 'YXZ';
    canoe.position.set(4, 0.45, -2);
    canoe.rotation.set(Math.PI / 2, 0, 0.4);
    outdoor.add(canoe);
    colliders.push({ x: 4, z: -2, r: 1.2 });
    const flashlightMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.25, 8), std(0x222222, 0.4, { metalness: 0.7, emissive: 0x222211 }));
    flashlightMesh.rotation.z = Math.PI / 2;
    flashlightMesh.position.set(1.2, 0.08, -3);
    outdoor.add(flashlightMesh);
    const mapMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.4), new THREE.MeshStandardMaterial({ color: 0xb9a778, emissive: 0x1a1608 }));
    mapMesh.rotation.x = -Math.PI / 2;
    mapMesh.position.set(-1.5, 0.05, -5);
    outdoor.add(mapMesh);
    // boot prints that end at spawn
    for (let i = 0; i < 8; i++) {
        const p = new THREE.Mesh(new THREE.PlaneGeometry(0.18, 0.4), new THREE.MeshBasicMaterial({ color: 0x1a1710 }));
        p.rotation.x = -Math.PI / 2;
        p.position.set(-1 + (i % 2) * 0.3, 0.04, -6 + i * 0.7);
        outdoor.add(p);
    }

    // campsite
    const cx = CAMP_X;
    const cz = CAMP_Z;
    const tent = (lx: number, lz: number, rot: number, color: number) => {
        const t = new THREE.Mesh(new THREE.ConeGeometry(2.1, 1.9, 4), std(color, 0.8));
        t.position.set(cx + lx, 0.95, cz + lz);
        t.rotation.y = rot + Math.PI / 4;
        outdoor.add(t);
        boxes.push({ minx: cx + lx - 1.4, maxx: cx + lx + 1.4, minz: cz + lz - 1.4, maxz: cz + lz + 1.4, h: 1.6 });
    };
    tent(-6, -3, 0.2, 0x2d4a6a);
    tent(6.5, -4, -0.3, 0x5a3a2a);
    tent(-5.5, 5, 0.5, 0xd2a81f);
    const table = box(2.2, 0.8, 0.9, std(0x4a3320), cx + 5, 0.4, cz + 2);
    outdoor.add(table);
    boxes.push({ minx: cx + 3.8, maxx: cx + 6.2, minz: cz + 1.5, maxz: cz + 2.5, h: 0.8 });
    const stain = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.5), new THREE.MeshBasicMaterial({ color: 0x3a0505 }));
    stain.rotation.x = -Math.PI / 2;
    stain.position.set(cx + 4.6, 0.81, cz + 2);
    outdoor.add(stain);
    for (let i = 0; i < 3; i++) outdoor.add(box(0.5, 0.1, 0.5, std(0x333b4a), cx - 2 + i * 1.1, 0.25, cz + 4 - i * 0.6));
    for (let i = 0; i < 3; i++) {
        const sb = box(0.8, 0.15, 1.9, std([0x7a2a2a, 0x2a5a4a, 0x6a5a2a][i]), cx - 3 + i * 1.3, 0.08, cz - 6 + i * 0.4);
        sb.rotation.y = rand();
        outdoor.add(sb);
    }
    const phone = box(0.08, 0.02, 0.16, new THREE.MeshStandardMaterial({ color: 0x111111, emissive: 0x3355aa, emissiveIntensity: 1.2 }), cx + 5, 0.82, cz + 2.1);
    outdoor.add(phone);
    outdoor.add(box(0.5, 0.3, 0.2, std(0x222222), cx - 3, 0.15, cz + 2));
    const paperMesh = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 0.25), new THREE.MeshStandardMaterial({ color: 0xcfc6a6, emissive: 0x201c10 }));
    paperMesh.rotation.x = -Math.PI / 2;
    paperMesh.position.set(cx + 8, 0.03, cz - 1);
    outdoor.add(paperMesh);
    const recorderMesh = box(0.12, 0.05, 0.2, std(0x1a1a1a, 0.4), cx - 3.5, 0.06, cz - 3.5);
    outdoor.add(recorderMesh);
    // dragged footprints trail
    for (let i = 0; i < 10; i++) {
        const d = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), new THREE.MeshBasicMaterial({ color: 0x14110c }));
        d.rotation.x = -Math.PI / 2;
        d.position.set(cx + 2 - i * 0.7, 0.04, cz - 3 - i * 0.9);
        outdoor.add(d);
    }
    // fire
    const fireM = new THREE.Mesh(new THREE.ConeGeometry(0.4, 0.9, 6), new THREE.MeshBasicMaterial({ color: 0xff7a1a }));
    fireM.position.set(cx + 2.5, 0.45, cz);
    outdoor.add(fireM);
    const fire = new THREE.PointLight(0xff8a30, 60, 30, 2);
    fire.position.set(cx + 2.5, 1.1, cz);
    outdoor.add(fire);
    const fireGlow = glowSprite('rgba(255,140,40,0.9)', 7, 2.2);
    fireGlow.position.x = cx + 2.5;
    fireGlow.position.z = cz;
    outdoor.add(fireGlow);
    colliders.push({ x: cx + 2.5, z: cz, r: 0.7 });

    // log
    const logX = pathX(LOG_Z);
    const log = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 28, 8), std(0x3a2a1c));
    log.rotation.z = Math.PI / 2;
    log.position.set(logX, 0.3, LOG_Z);
    outdoor.add(log);
    boxes.push({ minx: logX - 14, maxx: logX + 14, minz: LOG_Z - 0.4, maxz: LOG_Z + 0.4, h: 0.6 });

    // fence with a broken gate
    const fx = pathX(FENCE_Z);
    const segs: [number, number][] = [[fx - 16, fx - 1.7], [fx + 1.7, fx + 16]];
    for (const [a, b] of segs) {
        outdoor.add(box(b - a, 0.12, 0.1, std(0x555555, 0.6, { metalness: 0.5 }), (a + b) / 2, 1.7, FENCE_Z));
        outdoor.add(box(b - a, 0.12, 0.1, std(0x555555, 0.6, { metalness: 0.5 }), (a + b) / 2, 0.8, FENCE_Z));
        for (let x = a; x <= b; x += 2) outdoor.add(box(0.12, 2.1, 0.12, std(0x444444, 0.6, { metalness: 0.5 }), x, 1, FENCE_Z));
        boxes.push({ minx: a, maxx: b, minz: FENCE_Z - 0.2, maxz: FENCE_Z + 0.2, h: 2.2 });
    }
    const gate = box(1.5, 1.8, 0.08, std(0x6a3a20, 0.8), fx - 1.7, 0.9, FENCE_Z + 0.6);
    gate.rotation.y = 0.9;
    outdoor.add(gate);

    // bunker
    const concrete = std(0x5c5f61, 0.95);
    const bz = BUN_Z - 12;
    outdoor.add(box(14, 5, 8, concrete, BUN_X, 2.5, bz));
    boxes.push({ minx: BUN_X - 7, maxx: BUN_X + 7, minz: bz - 4, maxz: bz + 4, h: 5 });
    outdoor.add(box(2.4, 3, 0.4, concrete, BUN_X, 1.5, BUN_DOOR_Z - 0.1));
    const door = box(1.3, 2.2, 0.12, std(0x6a3a20, 0.5, { metalness: 0.5 }), BUN_X + 0.9, 1.15, BUN_DOOR_Z + 0.35);
    door.rotation.y = -0.9;
    outdoor.add(door);
    outdoor.add(box(1.6, 2.2, 0.1, std(0x000000), BUN_X - 0.2, 1.1, BUN_DOOR_Z + 0.02));
    const lamp = box(0.4, 0.2, 0.4, new THREE.MeshBasicMaterial({ color: 0xfff2c0 }), BUN_X + 3.5, 4, BUN_DOOR_Z + 0.3);
    outdoor.add(lamp);
    const floodLight = new THREE.PointLight(0xfff0c0, 70, 26, 2);
    floodLight.position.set(BUN_X + 3.5, 3.8, BUN_DOOR_Z + 1.5);
    outdoor.add(floodLight);
    for (let i = 0; i < 5; i++) {
        const sl = box(0.4, 0.05, 0.6, std(0x777777), BUN_X - 1 + i * 0.5, 0.025 + i * 0.12, BUN_DOOR_Z + 1.2 + i * 0.6);
        sl.visible = false; // stairwell is implied by the squeeze-in transition
        outdoor.add(sl);
    }

    // beacon: tall light shaft + glow above the bunker clearing, visible over the treetops
    const beam = new THREE.Mesh(
        new THREE.CylinderGeometry(0.7, 2.4, 44, 14, 1, true),
        new THREE.MeshBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, fog: false, side: THREE.DoubleSide })
    );
    beam.position.set(BUN_X, 22, BUN_DOOR_Z + 2);
    outdoor.add(beam);
    const beaconGlow = glowSprite('rgba(255,235,170,0.95)', 14, 40);
    beaconGlow.position.x = BUN_X;
    beaconGlow.position.z = BUN_DOOR_Z + 2;
    outdoor.add(beaconGlow);

    // trail markers from the camp to the bunker: red cloth strips on posts and snapped branches
    const clothMat = new THREE.MeshStandardMaterial({ color: 0xd42020, emissive: 0x801010, side: THREE.DoubleSide });
    const postMat = std(0x4a3320);
    for (let z = CAMP_Z - 10, i = 0; z > BUN_Z + 6; z -= 9, i++) {
        const side = i % 2 === 0 ? 1 : -1;
        const x = pathX(z) + side * 3.1;
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 2.2, 5), postMat);
        post.position.set(x, 1.1, z);
        outdoor.add(post);
        const strip = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.8), clothMat);
        strip.position.set(x - side * 0.1, 1.8, z);
        strip.rotation.set(0.1, i, 0.15);
        outdoor.add(strip);
        const br = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 1.1), postMat);
        br.position.set(pathX(z - 4) - side * 2.2, 0.08, z - 4);
        br.rotation.y = i * 1.3;
        outdoor.add(br);
    }

    // lights shared by exterior
    const moon = new THREE.DirectionalLight(0x8aa4cc, 0.4);
    moon.position.set(-10, 30, 10);
    moon.name = 'moon';
    scene.add(moon);
    const hemi = new THREE.HemisphereLight(0x3a4e66, 0x15130f, 1.4);
    hemi.name = 'hemi';
    scene.add(hemi);

    return { scene, colliders, boxes, fire, mastLight, floodLight, beaconGlow, phone, outdoor, flashlightMesh, mapMesh, recorderMesh, paperMesh };
}
