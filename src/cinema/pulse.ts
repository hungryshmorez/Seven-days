/**
 * THE PULSE — the hidden survival ending (bible section 0b).
 * Reached ONLY by standing still at the very beginning for a long time without
 * pressing or moving. A doctor says, "I've got a pulse." The protagonist wakes in
 * the hospital the next morning, alive. This does not change the canon endings and
 * is not a normal route.
 */
import * as THREE from 'three';
import { type Env } from './director.ts';

export function buildPulse(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x0a1418);
    scene.fog = new THREE.FogExp2(0x0a1418, 0.04);
    scene.add(new THREE.HemisphereLight(0xbfe0d8, 0x1c2a24, 0.7));
    const lamp = new THREE.PointLight(0xe8fff2, 2, 12, 1.2);
    lamp.position.set(0, 3, 0);
    scene.add(lamp);
    const room = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x2a3a40, roughness: 1 }));
    room.rotation.x = -Math.PI / 2;
    scene.add(room);

    const place = (x: number, z: number) => rig.pos.set(x, 1.5, z);
    place(0, 2);
    rig.yaw = Math.PI;
    rig.pitch = -0.1;
    rig.lookFreedom = 0.15;
    rig.shake = 0.01;
    rig.walk = 0;
    fx.corr = 0.15;
    fx.fade = 1;

    dir.at(0, () => {
        audio.level('hum', 0.03, 2);
        env.title('THE NEXT MORNING', 3);
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - (1 - Math.abs(p * 2 - 1)) * 0 + (p > 0 ? 0 : 0)));
    dir.tween(0, 3, (p) => (fx.fade = 1 - p));
    dir.at(5, () => env.say('DOCTOR', "I've got a pulse. He's alive.", { pitch: 0.85, rate: 0.85 }));
    dir.at(11, () => env.say('YOU', '...the island. Was any of it...'));
    dir.at(17, () => env.say('DOCTOR', 'Easy. You were found on the shore at dawn. Rest now.', { pitch: 0.85, rate: 0.85 }));
    dir.tween(22, 4, (p) => (fx.fade = p));
    dir.at(27, () => env.finish());
}
