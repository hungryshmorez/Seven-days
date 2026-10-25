/** Original abandoned-mall recording. No franchise rooms, brands or character assets. */
import * as THREE from 'three';
import { animateHumanoid, buildHumanoid } from './humanoid.ts';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { type Env, lerp, smooth } from './director.ts';
import { setFriend } from './crash.ts';
import { terrify } from './scary.ts';
import { buildMoppetArm, buildMoppetBody } from './creatureModels.ts';

export function buildDay1Mall(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x080d12);
    scene.fog = new THREE.FogExp2(0x10202a, 0.022);
    scene.add(new THREE.HemisphereLight(0x92b4c5, 0x22202b, 1.1));
    const moon = new THREE.DirectionalLight(0x8cbed2, 1.7);
    moon.position.set(-8, 20, 10);
    scene.add(moon);
    const stone = new THREE.MeshStandardMaterial({ color: 0x8a9091, roughness: 0.86 });
    const teal = new THREE.MeshStandardMaterial({ color: 0x226976, roughness: 0.8 });
    const metal = new THREE.MeshStandardMaterial({ color: 0x354451, roughness: 0.6, metalness: 0.4 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x121c24, roughness: 0.94 });
    const warm = new THREE.MeshBasicMaterial({ color: 0xd7a36c });
    const box = (parent: THREE.Object3D, w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material) => {
        const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
        m.position.set(x, y, z);
        parent.add(m);
        return m;
    };
    // Canvas text is original signage, not borrowed artwork. Engine disposes these maps.
    const placard = (text: string, w: number, h: number, x: number, y: number, z: number, color = '#b6d4cc') => {
        const canvas = document.createElement('canvas');
        canvas.width = 768; canvas.height = 192;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Mall signage could not be created');
        ctx.fillStyle = '#10202a'; ctx.fillRect(0, 0, 768, 192);
        ctx.strokeStyle = '#527b80'; ctx.lineWidth = 4; ctx.strokeRect(10, 10, 748, 172);
        ctx.fillStyle = color; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = 'bold 36px monospace';
        text.split('\n').forEach((line, i, lines) => ctx.fillText(line, 384, 96 + (i - (lines.length - 1) / 2) * 44, 724));
        const texture = new THREE.CanvasTexture(canvas);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }));
        mesh.position.set(x, y, z); scene.add(mesh);
        return mesh;
    };
    const mall = new THREE.Group(); scene.add(mall);
    box(mall, 30, 0.2, 104, 0, -0.14, -36, stone);
    box(mall, 0.5, 11, 104, -15, 5.5, -36, dark);
    box(mall, 0.5, 11, 104, 15, 5.5, -36, dark);
    box(mall, 30, 0.4, 104, 0, 11, -36, dark);
    // Distinct slate/terracotta tile grid; no yellow corridor treatment.
    const tile = new THREE.MeshStandardMaterial({ color: 0x875d50, roughness: 0.95 });
    for (let z = 10; z > -87; z -= 3) box(mall, 0.2, 0.025, 2.9, 0, 0, z, tile);
    for (let i = 0; i < 8; i++) {
        const z = 6 - i * 12;
        for (const side of [-1, 1]) {
            box(mall, 1.0, 10, 1.0, side * 10, 5, z, stone);
            box(mall, 5.0, 0.65, 8.6, side * 12, 4.8, z - 4, teal);
            // Recessed shutters, repetitive horizontal ribs, dark windows.
            box(mall, 0.25, 4.2, 8.6, side * 14.3, 2.1, z - 4, metal);
            for (let n = 0; n < 11; n++) box(mall, 0.3, 0.035, 8.4, side * 14.1, 0.3 + n * 0.35, z - 4, stone);
        }
        box(mall, 4, 0.1, 0.8, 0, 10.6, z - 2, warm);
    }
    // Upper balcony rails and the long atrium void.
    for (const side of [-1, 1]) {
        box(mall, 4.8, 0.3, 90, side * 12.3, 5.3, -35, stone);
        box(mall, 0.09, 0.1, 90, side * 9.8, 6.4, -35, metal);
        for (let z = 7; z > -81; z -= 3) box(mall, 0.06, 1.1, 0.08, side * 9.8, 5.85, z, metal);
    }
    placard('HOLLOWMERE GALLERIA\nTHANK YOU FOR COMING BACK', 10, 2.5, 0, 6.8, -5);
    placard('FOOD COURT     /     EAST WING\nALL STORES CLOSED', 7, 1.8, 0, 5.6, -31);
    const exitA = placard('EXIT  >', 2.2, 0.55, -4, 3.9, -15, '#8eeec2');
    const exitB = placard('EXIT  >', 2.2, 0.55, -4, 3.9, -50, '#8eeec2');
    exitB.visible = false;
    // A drained ornamental fountain, not a featureless hallway.
    const basin = new THREE.Mesh(new THREE.CylinderGeometry(3.0, 3.4, 0.6, 24, 1, true), stone);
    basin.position.set(4.5, 0.3, -22); mall.add(basin);
    box(mall, 1.1, 2.6, 1.1, 4.5, 1.5, -22, teal);
    const emptyWater = new THREE.Mesh(new THREE.CircleGeometry(2.9, 24), dark);
    emptyWater.rotation.x = -Math.PI / 2; emptyWater.position.set(4.5, 0.04, -22); mall.add(emptyWater);
    // Twin escalators lead up to a bricked-off landing. They never animate.
    for (const side of [-1, 1]) {
        for (let step = 0; step < 17; step++) box(mall, 1.65, 0.25, 0.55, side * 7.3, step * 0.26 + 0.12, -28 - step * 0.52, metal);
        box(mall, 2.6, 4.6, 0.5, side * 7.3, 7.3, -37.2, stone);
    }
    // Directory and the reassignment terminal face the authored camera route.
    box(mall, 3.4, 3, 0.6, -2.7, 1.5, -39.5, metal);
    placard('YOU ARE HERE\nNO EXITS ON THIS LEVEL', 3.0, 0.8, -2.7, 2.4, -39.16);
    box(mall, 1.5, 1.5, 0.8, 0, 0.75, -47, metal);
    placard('THE SYSTEM DOES NOT KILL USERS.\nIT REASSIGNS THEM.', 4.4, 1.1, 0, 2.0, -46.55, '#92e9ba');
    // Empty food court, toppled chairs and a children's display behind one shutter.
    const chairM = new THREE.MeshStandardMaterial({ color: 0xaa7667, roughness: 0.9 });
    for (let i = 0; i < 6; i++) {
        const x = (i % 2 ? -1 : 1) * 5.4;
        box(mall, 2, 0.12, 1.6, x, 1.0, -55 - Math.floor(i / 2) * 6, stone);
        const chair = box(mall, 0.8, 0.9, 0.8, x + 1.5, 0.45, -55 - Math.floor(i / 2) * 6, chairM);
        chair.rotation.z = i % 3 === 0 ? 1.4 : 0;
    }
    placard('LITTLE LANTERN PLAYHOUSE\nPERFORMANCE CANCELLED', 6, 1.5, 0, 4.2, -64);
    const shutter = box(mall, 8, 0.35, 0.3, 0, 4.0, -64, metal);
    box(mall, 2.2, 3.6, 0.3, 0, 1.8, -85, teal);
    placard('SERVICE ACCESS\nRECEIVING', 3.4, 0.85, 0, 3, -84.7);
    // Mitzi's remembered counterpart; no copied character design.
    const mitziBody = buildHumanoid({ top: (teal as THREE.MeshStandardMaterial).color.getHex(), bottom: 0x1c1e26, skin: 0xd2a488,
        hair: { color: 0x3a2214, style: 'long' }, build: 0.2 });
    const mitzi = mitziBody.group;
    mitzi.rotation.y = Math.PI; // faces the approaching camera
    animateHumanoid(env, mitziBody, 0.4);
    mitzi.position.set(-2.5, 0, -56); scene.add(mitzi);
    // Morrow Moppet: nursery-display marionette, asymmetrical legs, teal drapery,
    // overlong hands, horizontal porcelain teeth. Procedural placeholder performance.
    const moppet = new THREE.Group(); scene.add(moppet);
    const wood = new THREE.MeshStandardMaterial({ color: 0x4e352e, roughness: 0.95 });
    const porcelain = new THREE.MeshStandardMaterial({ color: 0xd0c7ad, roughness: 0.48 });
    moppet.add(buildMoppetBody(teal, wood, porcelain).group);
    const joints: THREE.Group[] = [];
    for (const side of [-1, 1]) {
        const arm = new THREE.Group(); arm.position.set(side * 0.6, 2.0, 0);
        arm.add(buildMoppetArm(wood, porcelain, side));
        moppet.add(arm); joints.push(arm);
        box(moppet, 0.015, 4, 0.015, side * 0.62, 4.0, 0, porcelain);
    }
    moppet.position.set(0, 0, -66); moppet.visible = false;
    terrify(env, moppet, { creature: 'morrow_moppet', eyes: { at: [0, 2.62, 0.21], spread: [0.36, 0, 0], size: 0.06, color: 0xdff4ff }, twitch: 0.9, breathe: 0.01, dropout: true });
    let chase = false;
    let silence = false;
    const emergency = new THREE.PointLight(0xe48c64, 14, 26, 1.6);
    emergency.position.set(-3, 5, -56); scene.add(emergency);
    env.onFrame.push((_dt, t) => {
        // Stops held between taut-string lunges; motion uses absolute time, not accumulation.
        if (moppet.visible) {
            const pose = Math.floor(t * (chase ? 6 : 2)) % 4;
            joints.forEach((joint, i) => { joint.rotation.z = pose === 0 ? (i ? 0.6 : -0.6) : Math.sin(t * 3 + i) * 0.16; });
            moppet.children[0].rotation.y = Math.sin(t * 1.1) * 0.12;
        }
        emergency.intensity = silence ? 7 : 13 + Math.sin(t * 8) * 1.3;
    });
    const place = (x: number, z: number) => rig.pos.set(x, 1.7, z);
    const faceAt = (x: number, z: number) => { rig.yaw = Math.atan2(-(x - rig.pos.x), -(z - rig.pos.z)); };
    place(0, 11); rig.yaw = 0; rig.pitch = 0; rig.roll = 0;
    rig.walk = 0; rig.shake = 0.08; rig.fovKick = 0; rig.lookFreedom = 0.5;
    rig.onStep = () => audio.step(0.45);
    env.explore.active = false; fx.corr = 0.08; fx.fade = 1;
    dir.at(0, () => {
        RundotGameAPI.analytics.recordCustomEvent('story_mall_entered', { episode: 'day1' });
        audio.level('wind', 0, 2); audio.level('hum', 0.08, 2); audio.level('hiss', 0.025, 2);
    });
    dir.tween(0, 3, p => { fx.fade = 1 - smooth(p); });
    dir.at(4, () => env.title('HOLLOWMERE GALLERIA', 4));
    dir.at(9, () => env.say('YOU', 'A mall. Everything is shuttered. Why are the lights still on?'));
    dir.at(15, () => { rig.walk = 0.8; });
    dir.tween(15, 14, p => { place(lerp(0, -2, p), lerp(11, -16, smooth(p))); });
    dir.at(30, () => { rig.walk = 0; env.say('MITZI', 'The directory says the east wing. Stay where I can see you.'); });
    dir.at(38, () => { faceAt(4.5, -22); env.say('YOU', 'The fountain is dry. Those escalators lead into a wall.'); });
    dir.tween(45, 13, p => { place(-2, lerp(-16, -35, smooth(p))); rig.yaw = lerp(-0.65, 0, smooth(p)); });
    dir.at(59, () => { rig.walk = 0; faceAt(-2.7, -39.5); env.say('YOU', 'You are here. No exits on this level.'); });
    dir.at(66, () => { exitA.visible = false; exitB.visible = true; env.say('YOU', 'That exit sign was behind us.'); });
    dir.tween(72, 8, p => { place(lerp(-2, 0, p), lerp(-35, -43, smooth(p))); rig.yaw = 0; });
    dir.at(81, () => env.title('THE SYSTEM DOES NOT KILL USERS.', 4));
    dir.at(86, () => env.title('IT REASSIGNS THEM.', 4));
    dir.at(91, () => env.say('YOU', 'Reassigns them. Into what?'));
    dir.at(98, () => {
        silence = true; audio.level('hum', 0, 2); audio.level('hiss', 0, 2);
        env.say('MITZI', 'Someone left a puppet in the playhouse.');
    });
    dir.tween(105, 8, p => { place(0, lerp(-43, -53, smooth(p))); });
    dir.at(103, () => audio.horrorBeat('day1', 'playhouse', 'build', { hum: 0, hiss: 0, wind: 0 }, 6));
    dir.at(109, () => audio.creatureSound('morrow_moppet', 16, 'approach', 0.1));
    dir.at(114, () => { rig.walk = 0; moppet.visible = true; audio.creatureSound('morrow_moppet', 13, 'reveal'); env.say('YOU', 'Mitzi. Step away from it.'); });
    dir.at(121, () => audio.horrorBeat('day1', 'playhouse_shutter', 'scare', { hum: 0 }));
    dir.at(130, () => audio.creatureSound('morrow_moppet', 7, 'reveal'));
    dir.at(146, () => audio.horrorBeat('day1', 'service_access', 'release', { hum: 0.025, hiss: 0.005 }, 8));
    dir.at(121, () => {
        mitzi.visible = false; moppet.visible = false; shutter.position.y = 1.3;
        audio.thump(40, 0.55, 0.7); env.glitch(0.45, 0.3);
        setFriend('Mitzi Goins', 'missing');
        RundotGameAPI.analytics.recordCustomEvent('story_friend_missing', { friend: 'Mitzi Goins', location: 'hollowmere_galleria' });
    });
    dir.at(123, () => env.say('YOU', 'Mitzi? Mitzi, where did you go?'));
    dir.at(130, () => {
        chase = true; moppet.visible = true; moppet.position.z = -46; rig.walk = 1.8; audio.level('hum', 0.1, 1);
        RundotGameAPI.analytics.recordCustomEvent('story_moppet_chase_started', { episode: 'day1' });
        env.say('YOU', 'The service door. Go!');
    });
    // Player runs forward down the food court. The puppet follows, then the camera
    // looks back briefly: it is a performed chase, not interactive pursuit AI.
    dir.tween(130, 8, p => { place(0, lerp(-53, -66, p)); moppet.position.z = lerp(-46, -62, p); });
    dir.tween(138, 3, p => { rig.yaw = Math.PI * smooth(p); moppet.position.z = lerp(-62, -67, p); place(0, lerp(-66, -72, p)); });
    dir.at(141, () => { audio.thump(38, 0.45, 0.7); });
    dir.tween(141, 4, p => { rig.yaw = Math.PI * (1 - smooth(p)); place(0, lerp(-72, -81, p)); moppet.position.z = lerp(-67, -75, p); });
    dir.at(146, () => { rig.walk = 0; moppet.visible = false; fx.corr = 0.1; });
    dir.at(148, () => env.say('PA SYSTEM', 'THE SYSTEM DOES NOT KILL USERS. IT REASSIGNS THEM.', { pitch: 0.65, rate: 0.85 }));
    dir.at(156, () => env.say('YOU', 'It took her. The mall kept her.'));
    dir.tween(163, 3, p => { fx.fade = smooth(p); });
    dir.at(167, () => {
        RundotGameAPI.analytics.recordCustomEvent('story_mall_escaped', { episode: 'day1' });
        env.finish();
    });
}
