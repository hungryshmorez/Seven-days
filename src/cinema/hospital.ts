/**
 * THE HOSPITAL — the true ending on the second cycle.
 * On the first cycle, reaching the hospital is fatal (handled in day7.ts).
 * On the second cycle the living room is fatal and this route is the required ending.
 * Tone: restrained and human. Staff decide to withdraw life support; the protagonist
 * screams and no one hears. Family gave seven more days; they begged him to wake.
 * Exact staff and family wording is an open detail (bible section 0b); lines below are
 * working drafts and are marked as such in the chapter notes.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { furnishHospitalRoom } from './hospitalRoom.ts';

export function buildHospital(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x0a1a1a);
    scene.fog = new THREE.FogExp2(0x0a1a1a, 0.05);
    scene.add(new THREE.HemisphereLight(0xcfe8e0, 0x203028, 0.8));
    const ceiling = new THREE.PointLight(0xe8fff4, 2.2, 14, 1.2);
    ceiling.position.set(0, 3, 0);
    scene.add(ceiling);
    // ---- a single hospital room: bed, monitor, curtain, window ----
    const room = new THREE.Group();
    scene.add(room);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(10, 10), new THREE.MeshStandardMaterial({ color: 0x3a4a48, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2;
    room.add(floor);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.5, 2.2), new THREE.MeshStandardMaterial({ color: 0xe0e8e6 }));
    bed.position.set(0, 0.5, -2);
    bed.userData.look = 0.3; // clean sheets, not a stone block
    room.add(bed);
    const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.5, 0.1), new THREE.MeshBasicMaterial({ color: 0x102018 }));
    monitor.position.set(-1.6, 1.4, -2.6);
    room.add(monitor);
    const line = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.2), new THREE.MeshBasicMaterial({ color: 0x40ff90 }));
    line.position.set(-1.6, 1.4, -2.54);
    room.add(line);
    const curtainG = new THREE.PlaneGeometry(3, 2.4, 60, 1);
    { const cp = curtainG.attributes.position; for (let i = 0; i < cp.count; i++) cp.setZ(i, Math.sin(cp.getX(i) * 9) * 0.06 + Math.sin(cp.getX(i) * 3.1) * 0.04); curtainG.computeVertexNormals(); }
    const curtain = new THREE.Mesh(curtainG, new THREE.MeshStandardMaterial({ color: 0xa8b8b0, side: THREE.DoubleSide }));
    curtain.position.set(2, 1.2, -1);
    curtain.rotation.y = Math.PI / 2;
    room.add(curtain);
    // the cubic hands of the protagonist's own body on the blanket (out of focus)
    const hand = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.08, 0.5), new THREE.MeshStandardMaterial({ color: 0xd8c0a8 }));
    hand.position.set(0.2, 0.8, -1.4);
    hand.visible = false; // the body in the bed (below) replaces the placeholder hands
    room.add(hand);
    furnishHospitalRoom(env, room);
    env.onFrame.push((_d, t) => {
        // the monitor's line pulses slowly
        line.scale.x = 0.8 + Math.sin(t * 2) * 0.2;
    });
    // ================= TIMELINE =================
    const place = (x: number, z: number) => rig.pos.set(x, 1.4, z);
    place(0, 2);
    rig.yaw = 0; // face the bed (yaw π pointed the camera at the empty side of the room)
    rig.pitch = -0.05;
    rig.lookFreedom = 0.3;
    rig.shake = 0.03;
    rig.walk = 0;
    rig.onStep = () => audio.step(0.3);
    fx.corr = 0.2;
    fx.fade = 1;
    dir.at(0, () => {
        audio.level('hum', 0.04, 2);
        audio.level('hiss', 0.04, 2);
        env.title('THE HOSPITAL', 3);
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    // the monitor's steady tone; the protagonist hears voices through the wall
    dir.at(6, () => env.say('STAFF', 'He is still with us. Just barely.', { pitch: 0.9, rate: 0.85 }));
    dir.at(14, () => env.say('STAFF', 'The scans are clear. There is nothing left to repair.', { pitch: 0.9, rate: 0.85 }));
    dir.at(22, () => env.say('STAFF', 'He is too far gone.', { pitch: 0.9, rate: 0.85 }));
    dir.at(28, () => env.say('STAFF', "He wouldn't have wanted this. Letting him go is better.", { pitch: 0.9, rate: 0.85 }));
    // the family, begging him to wake, then the decision
    dir.at(36, () => env.say('FAMILY', 'Please wake up. Please. We were given seven more days.', { pitch: 1.1, rate: 0.85 }));
    dir.at(44, () => {
        audio.level('hum', 0.0, 1.5);
        env.glitch(0.2, 0.3);
    });
    dir.at(50, () => env.say('STAFF', 'Withdrawing life support now.', { pitch: 0.9, rate: 0.8 }));
    dir.at(56, () => {
        // the protagonist screams; nobody hears
        audio.staticBurst(0.5, 0.4);
        env.glitch(0.7, 0.5);
        fx.corr = 0.6;
        env.say('YOU', "I'm HERE! I'm right here! Can anybody hear me?", { pitch: 1.2, rate: 1.0, volume: 1 });
    });
    dir.at(64, () => {
        // the monitor's tone flattens into a single line
        line.visible = false;
        audio.level('hum', 0.0, 0.5);
        fx.corr = 0.4;
    });
    dir.tween(70, 6, (p) => {
        audio.level('hiss', lerp(0.04, 0, smooth(p)), 0.1);
    });
    dir.tween(76, 4, (p) => (fx.fade = lerp(1, 0, smooth(p))));
    dir.at(81, () => env.finish());
}
