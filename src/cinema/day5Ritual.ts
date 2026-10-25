/**
 * DAY FIVE — the stone-circle retry (act between the crawlspace and the
 * painted studio). Rebuilt brisk and visible: two short attempts that fail,
 * each failure cutting to black faster; nobody burns. Beats: hearth room,
 * the white figure's instructions, the burned figure's warnings, the radio
 * contradicting the ritual, and the final failure into the broadcast.
 */
import * as THREE from 'three';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import { type Env, lerp, smooth } from './director.ts';
import { terrify } from './scary.ts';
import { buildRitualPresence, buildWhiteFigure } from './creatureModels.ts';
const noVeins = <T extends THREE.Material>(m: T): T => { m.userData.creatureVeins = 0; return m; };

export function buildDay5Ritual(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    const room = new THREE.Group();
    scene.add(room);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.MeshStandardMaterial({ color: 0x221a18, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    room.add(floor);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(14, 3.4, 14), new THREE.MeshStandardMaterial({ color: 0x18100e, side: THREE.BackSide }));
    walls.position.y = 1.7;
    room.add(walls);
    // four stones at the compass points
    const stoneM = new THREE.MeshStandardMaterial({ color: 0x5a5048, roughness: 1 });
    const mkStone = (x: number, z: number) => {
        const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.32), stoneM);
        s.position.set(x, 0.3, z);
        s.visible = false;
        room.add(s);
        return s;
    };
    const stones = {
        north: mkStone(0, -3),
        south: mkStone(0, 3),
        east: mkStone(3, 0),
        west: mkStone(-3, 0),
    };
    scene.add(new THREE.HemisphereLight(0x604838, 0x18100c, 0.7));
    const flame = new THREE.PointLight(0xff7a30, 1.8, 9, 1.6);
    flame.position.set(0, 0.9, 0);
    room.add(flame);
    const ring = new THREE.Mesh(new THREE.RingGeometry(2.5, 2.65, 40), new THREE.MeshBasicMaterial({ color: 0xff5a20, transparent: true, opacity: 0 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    room.add(ring);
    // the white figure, standing at the north stone
    const figureWhite = new THREE.Group();
    figureWhite.add(buildWhiteFigure(noVeins(new THREE.MeshStandardMaterial({ color: 0xe8e4dc, roughness: 0.9 })), noVeins(new THREE.MeshStandardMaterial({ color: 0xc8b8a8, roughness: 0.6 })), noVeins(new THREE.MeshStandardMaterial({ color: 0x0b0806, roughness: 0.5 })), false).group);
    figureWhite.position.set(0, 0, -3.8);
    figureWhite.visible = false;
    room.add(figureWhite);
    terrify(env, figureWhite, { creature: 'white_figure', eyes: { at: [0, 2.44, 0.19], spread: [0.12, 0, 0], size: 0.045, color: 0x000000, blink: false }, arms: { shoulderY: 1.95, width: 0.42, length: 2.0, thickness: 0.035, color: 0xd8d2c6 }, twitch: 0.3, dropout: true });
    const presence = new THREE.Group();
    presence.add(buildRitualPresence(new THREE.MeshStandardMaterial({ color: 0x2a2220, roughness: 0.9 })).group);
    presence.position.set(0, 0, 4.2);
    presence.visible = false;
    room.add(presence);
    terrify(env, presence, { creature: 'ritual_presence', eyes: { at: [0, 2.8, 0.52], spread: [0.2, 0, 0], size: 0.055, color: 0xff2a10 } });
    env.onFrame.push((_d, t) => {
        flame.intensity = 1.8 + Math.sin(t * 11) * 0.5 + Math.sin(t * 23) * 0.3;
        ring.material.opacity = Math.max(ring.material.opacity, 0.12) + Math.sin(t * 2.4) * 0.02 * (ring.material.opacity > 0 ? 1 : 0);
    });
    // The ritual is staged in the crawlspace's world space: the camera, lights
    // and background must be set here, not inherited from the studio.
    const place = (x: number, z: number) => rig.pos.set(x, 1.4, z);
    dir.at(0, () => {
        scene.background = new THREE.Color(0x030303);
        scene.fog = new THREE.FogExp2(0x030303, 0.09);
        place(0, 3.4);
        rig.yaw = Math.PI;
        rig.pitch = -0.06;
        rig.lookFreedom = 0.45;
        rig.shake = 0.08;
        rig.walk = 0;
        fx.corr = 0.1;
        fx.fade = 1;
        audio.level('hum', 0.02, 1);
    });
    dir.tween(0, 2, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(2, () => { stones.north.visible = true; stones.south.visible = true; });
    dir.at(18, () => { stones.east.visible = true; stones.west.visible = true; ring.material.opacity = 0.45; });
    dir.at(8, () => audio.creatureSound('ritual_presence', 12, 'approach', -0.45));
    dir.at(12, () => audio.creatureSound('ritual_presence', 9, 'reveal', -0.45));
    dir.at(26, () => audio.creatureSound('white_figure', 8, 'approach', 0.25));
    dir.at(45, () => { fx.corr = 0.12; audio.horrorBeat('day5', 'retry_breathing_room', 'release', { hum: 0.01, hiss: 0.003 }, 9); });
    dir.at(3, () => env.say('RADIO', 'To exit, the circle must be completed again.', { pitch: 0.5, rate: 0.75 }));
    dir.at(10, () => env.say('RADIO', 'Complete the ritual. Make me proud.', { pitch: 0.5, rate: 0.75 }));
    dir.at(20, () => { figureWhite.visible = true; env.say('???', 'Four stones, four directions. Then the fire.', { pitch: 1.2, rate: 0.8 }); });
    dir.at(30, () => { presence.visible = true; env.say('???', 'It is only the pain that frees it.', { pitch: 0.4, rate: 0.7 }); });
    dir.at(35, () => env.say('RADIO', 'Set yourself on fire. Then the holy cleanse.', { pitch: 0.5, rate: 0.75 }));
    dir.at(41, () => ({}) /* stones completed */);
    dir.at(41, () => env.say('YOU', "C'mon. It was nearly finished."));
    dir.at(47, () => env.say('RADIO', 'It has failed. Place the stones again.', { pitch: 0.5, rate: 0.75 }));
    dir.at(52, () => { stones.south.visible = false; stones.north.visible = false; figureWhite.visible = false; audio.thump(40, 0.025, 0.7); env.glitch(0.05, 0.15); fx.corr = 0.12; });
    dir.at(54, () => { stones.south.visible = true; stones.north.visible = true; stones.east.visible = true; stones.west.visible = true; ring.material.opacity = 0.6; });
    dir.at(60, () => { flame.intensity = 2.2; audio.thump(50, 0.6, 1.2); fx.corr = 0.8; env.glitch(0.9, 0.5); });
    dir.at(66, () => { flame.intensity = 0; fx.fade = 1; });
    dir.at(68, () => RundotGameAPI.analytics.recordCustomEvent('story_ritual_passed_out', { episode: 'day5' }));
    dir.at(72, () => env.finish());
}
