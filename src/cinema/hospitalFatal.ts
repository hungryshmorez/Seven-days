/**
 * FIRST-CYCLE HOSPITAL — fatal (bible section 0b, canon structure step 1).
 * Reaching the hospital on the first run kills the protagonist. This is an
 * outcome, not a gratuitous scene: restrained tone, no gore. It does not
 * complete the chapter and does not advance the story.
 * Lines are working drafts (open detail in bible section 0b).
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { furnishHospitalRoom } from './hospitalRoom.ts';
export function buildHospitalFatal(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x0a1a1a);
    scene.fog = new THREE.FogExp2(0x0a1a1a, 0.05);
    scene.add(new THREE.HemisphereLight(0xcfe8e0, 0x203028, 0.8));
    const ceiling = new THREE.PointLight(0xe8fff4, 2.2, 14, 1.2);
    ceiling.position.set(0, 3, 0);
    scene.add(ceiling);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x3a4a48, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 2.2), new THREE.MeshStandardMaterial({ color: 0xe0e8e6 }));
    bed.position.set(0, 0.5, -2);
    bed.userData.look = 0.3; // clean sheets, not a stone block
    scene.add(bed);
    furnishHospitalRoom(env, scene, { monitor: true });

    const place = (x: number, z: number) => rig.pos.set(x, 1.4, z);
    place(0, 2);
    rig.yaw = 0; // face the bed (yaw π pointed the camera at the empty side of the room)
    rig.pitch = -0.05;
    rig.lookFreedom = 0.2;
    rig.shake = 0.02;
    rig.walk = 0;
    fx.corr = 0.25;
    fx.fade = 1;

    dir.at(0, () => {
        audio.level('hum', 0.04, 2);
        env.title('THE HOSPITAL', 3);
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(6, () => env.say('STAFF', 'He is still with us. Just barely.', { pitch: 0.9, rate: 0.85 }));
    dir.at(14, () => env.say('YOU', 'Wait. I came back. I came back here.'));
    dir.at(22, () => {
        // the room turns cold; the monitor's tone drops into one line
        audio.level('hum', 0, 2);
        fx.corr = 0.55;
        env.glitch(0.4, 0.4);
    });
    dir.at(28, () => env.say('YOU', 'Too early. It is too early for this.'));
    dir.tween(34, 6, (p) => {
        rig.pitch = lerp(-0.05, -0.5, smooth(p));
        fx.corr = lerp(0.55, 0.9, p);
    });
    dir.at(42, () => {
        // the recording stops at the first cycle's end; no completion is recorded.
        env.title('YOU DID NOT WAKE UP.', 4);
    });
    dir.tween(46, 4, (p) => (fx.fade = smooth(p)));
    dir.at(51, () => env.finish());
}
