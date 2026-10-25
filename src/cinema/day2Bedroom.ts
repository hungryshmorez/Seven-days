/**
 * DAY TWO — the childhood bedroom (cinematic insert, runs before the RENDER
 * DISTANCE lift). Bible section 2 Day Two: "A childhood bedroom where SPLICEMASTER
 * says, 'The best memories are the ones we can use again.'"
 * This is a cinematic insert, NOT an interactive puzzle. Puzzles are not built.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { terrify } from './scary.ts';
import { buildSplicemasterBody, metalMat } from './creatureModels.ts';

export function buildDay2Bedroom(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    const room = new THREE.Group();
    scene.add(room);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.MeshStandardMaterial({ color: 0x5a4632, roughness: 1 }));
    floor.rotation.x = -Math.PI / 2;
    room.add(floor);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(8, 3, 8), new THREE.MeshStandardMaterial({ color: 0xd8c4a0, side: THREE.BackSide }));
    walls.position.y = 1.5;
    room.add(walls);
    const bed = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.5, 2.4), new THREE.MeshStandardMaterial({ color: 0x9ab4d0 }));
    bed.position.set(-2.5, 0.25, -2);
    room.add(bed);
    const toyBox = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.6, 0.7), new THREE.MeshStandardMaterial({ color: 0xc86a4a }));
    toyBox.position.set(2.5, 0.3, -3);
    room.add(toyBox);
    // SPLICEMASTER: a tall figure with camera-lens eyes, standing in the corner
    const splice = new THREE.Group();
    const bodyM = new THREE.MeshBasicMaterial({ color: 0x0a0a10 });
    const lensM = new THREE.MeshBasicMaterial({ color: 0xc8dcff });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 8), lensM);
    lens.position.set(0, 2.44, 0.5);
    const spBody = buildSplicemasterBody(new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 0.35, metalness: 0.3 }), metalMat(0x6a6a74));
    spBody.group.scale.setScalar(0.66);
    splice.add(spBody.group, lens);
    splice.position.set(3, 0, -3.5);
    splice.visible = false;
    room.add(splice);
    terrify(env, splice, { creature: 'splicemaster', eyes: { at: [0, 2.3, 0.45], spread: [0.5, 0, 0], size: 0.09, color: 0xa8d0ff }, arms: { shoulderY: 2.3, width: 0.6, length: 2.2, thickness: 0.04 }, twitch: 0.4, breathe: 0.02, dropout: true });
    const place = (x: number, z: number) => rig.pos.set(x, 1.2, z); // lying-height POV
    place(0, 2.5);
    rig.yaw = 0.3;
    rig.pitch = 0.05;
    rig.lookFreedom = 0.4;
    rig.shake = 0.05;
    fx.fade = 1;
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(1, () => {
        audio.level('wind', 0, 1);
        audio.level('hum', 0.02, 2);
        audio.level('hiss', 0.04, 2);
    });
    dir.at(4, () => env.title('THE BEDROOM', 3));
    dir.at(8, () => env.say('SPLICEMASTER', 'The best memories are the ones we can use again.', { pitch: 0.5, rate: 0.75 }));
    dir.at(14, () => { splice.visible = true; env.glitch(0.3, 0.5); });
    dir.at(18, () => env.say('YOU', 'I don’t want to wake up'));
    dir.at(20, () => env.say('YOU', 'Why can’t I wake up?'));
    dir.at(24, () => env.say('YOU', 'Mom? Dad? Why aren’t I home?'));
    dir.at(29, () => {
        rig.yaw = 0.9; // look toward the corner
        lens.scale.setScalar(1.6);
    });
    dir.at(34, () => { audio.breath(); });
    dir.at(42, () => env.say('SPLICEMASTER', 'Don’t be afraid... Don’t let them erase you! Don’t forget!'));
    dir.at(48, () => { audio.thump(30, 0.8, 2); env.glitch(0.8, 0.5); });
    dir.tween(50, 3, (p) => (fx.fade = smooth(p)));
    dir.at(53, () => env.finish());
}
