/**
 * DAY SEVEN — the Sub-Bass Core and the living-room finale.
 * The Splicemaster is a figure of tape ribbons, lenses and CRT circuitry;
 * the ending is played quietly and ends on the exact text sequence required
 * by the screenplay.
 */
import * as THREE from 'three';
import { type Env, lerp, smooth } from './director.ts';
import { store, saveProgress } from '../state/store.ts';
import { FRIEND_NAMES } from './crash.ts';
import { buildPrologue, terrainH } from './prologue.ts';
import { terrify } from './scary.ts';
import { buildSplicemasterBody, metalMat } from './creatureModels.ts';

export function buildDay7(env: Env) {
    const { scene, rig, audio, dir, fx } = env;
    scene.background = new THREE.Color(0x030306);
    scene.fog = new THREE.FogExp2(0x030306, 0.03);
    scene.add(new THREE.HemisphereLight(0x304060, 0x050508, 0.4));
    // the Core: a colossal pulsing column of cables and reels
    const core = new THREE.Group();
    const columnM = new THREE.MeshStandardMaterial({ color: 0x14141c, roughness: 0.6, metalness: 0.3 });
    const column = new THREE.Mesh(new THREE.CylinderGeometry(3, 4, 40, 10), columnM);
    column.position.y = 20;
    core.add(column);
    const reelM = new THREE.MeshBasicMaterial({ color: 0x30304a });
    for (let i = 0; i < 8; i++) {
        const reel = new THREE.Mesh(new THREE.TorusGeometry(4.6 + (i % 3) * 0.4, 0.18, 6, 24), reelM);
        reel.position.y = 3 + i * 4.5;
        reel.rotation.x = Math.PI / 2;
        core.add(reel);
    }
    core.position.z = -26;
    scene.add(core);
    // the Splicemaster: a hunched projectionist of tape ribbons and lens housings
    const splice = new THREE.Group();
    const bodyM = new THREE.MeshBasicMaterial({ color: 0x0a0a10 });
    const lensM = new THREE.MeshBasicMaterial({ color: 0xc8dcff });
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.35, 12, 8), lensM);
    lens.position.set(0, 3.7, 0.5);
    const reelHead = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.08, 5, 16), reelM);
    reelHead.position.set(0, 3.3, 0);
    const spBody = buildSplicemasterBody(new THREE.MeshStandardMaterial({ color: 0x0a0a10, roughness: 0.8 }), new THREE.MeshStandardMaterial({ color: 0x241c14, roughness: 0.35, metalness: 0.3 }), metalMat(0x6a6a74));
    splice.add(spBody.group, lens, reelHead);
    splice.position.set(0, 0, -10);
    splice.visible = false;
    scene.add(splice);
    terrify(env, splice, { creature: 'splicemaster', eyes: [{ at: [0, 3.1, 0.56], spread: [0.62, 0, 0], size: 0.12, color: 0xa8d0ff }, { at: [0, 2.7, 0.58], spread: [0.9, -0.1, 0], size: 0.07, color: 0xa8d0ff }], arms: { shoulderY: 3.0, width: 0.8, length: 3.2, thickness: 0.06 }, twitch: 0.4, breathe: 0.03 });
    // a quiet ambient floor hum with a single distant pulse
    env.onFrame.push((_d, t) => {
        const pulse = 0.5 + Math.sin(t * 0.6) * 0.5;
        columnM.emissive.setRGB(0.02 * pulse, 0.02 * pulse, 0.05 * pulse);
        reelM.color.setRGB(0.2 + 0.1 * pulse, 0.2 + 0.1 * pulse, 0.3 + 0.1 * pulse);
    });
    // ================= TIMELINE =================
    const place = (x: number, z: number) => rig.pos.set(x, 1.7, z);
    place(0, 6);
    rig.yaw = 0;
    rig.pitch = -0.02;
    rig.lookFreedom = 0.6;
    rig.shake = 0.05;
    rig.onStep = () => audio.step(0.5);
    fx.corr = 0.08;
    fx.fade = 1;
    dir.at(0, () => {
        audio.level('hum', 0.04, 2);
    });
    dir.tween(0, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(0.5, () => audio.horrorBeat('day7', 'core_presence', 'build', { hum: 0.008, wind: 0, hiss: 0.003 }, 5));
    dir.at(2, () => audio.creatureSound('splicemaster', 20, 'approach'));
    dir.at(6, () => audio.creatureSound('splicemaster', 16, 'reveal'));
    dir.at(69, () => audio.horrorBeat('day7', 'refused_offer', 'build', { hum: 0, hiss: 0 }, 13));
    dir.at(80, () => audio.creatureSound('splicemaster', 9, 'approach'));
    dir.at(84, () => { audio.creatureSound('splicemaster', 6, 'reveal'); audio.horrorBeat('day7', 'core_mutation', 'scare', { hum: 0.07, hiss: 0.01 }); });
    dir.at(95, () => audio.horrorBeat('day7', 'last_recording', 'release', { hum: 0.008, hiss: 0.002 }, 12));
    dir.at(120, () => audio.horrorBeat('day7', 'recording_stops', 'release', { hum: 0, hiss: 0, wind: 0 }, 14));
    // D7-S01: heart of the system
    dir.at(3, () => env.say('YOU', 'SPLICEMASTER!'));
    dir.at(6, () => {
        splice.visible = true;
        env.say('???', 'You made it.', { pitch: 0.5, rate: 0.7 });
    });
    dir.tween(7, 4, (p) => {
        place(0, lerp(6, 0, p));
        rig.yaw = lerp(0, Math.PI, smooth(p) * 0.2);
    });
    dir.at(12, () => env.say('YOU', 'Let me out.'));
    dir.at(16, () => env.say('???', 'You still think there’s an outside.', { pitch: 0.5, rate: 0.7 }));
    // D7-S02: original broadcast
    dir.at(22, () => {
        env.say('???', 'Most people break before the third day.', { pitch: 0.5, rate: 0.7 });
        fx.corr = 0.12;
    });
    dir.at(28, () => env.say('YOU', 'And the ones who don’t?'));
    dir.at(32, () => env.say('???', 'They become useful.', { pitch: 0.5, rate: 0.7 }));
    // D7-S03: memory revelation
    dir.at(38, () => {
        env.say('YOU', 'I don’t remember that.');
        fx.corr = 0.18;
    });
    dir.at(43, () => env.say('???', 'Of course you don’t.', { pitch: 0.5, rate: 0.7 }));
    dir.at(48, () => env.say('???', 'You didn’t find the tape. The tape found you.', { pitch: 0.5, rate: 0.7 }));
    // D7-S04: the final offer
    dir.at(56, () => {
        env.title('00:07:00');
        env.say('???', 'No more running. No more fear. You can be whatever you want.', { pitch: 0.5, rate: 0.7 });
    });
    dir.at(64, () => env.say('YOU', 'And everyone else stays trapped?'));
    dir.at(68, () => env.say('???', 'Everyone gets to be remembered.', { pitch: 0.5, rate: 0.7 }));
    dir.at(74, () => {
        env.say('YOU', 'Then I’d rather break the whole fucking thing.');
        env.glitch(0.18, 0.25);
        audio.thump(38, 0.12, 2);
    });
    // D7-S05: the Splicemaster mutates
    dir.at(82, () => {
        env.say('???', 'You cannot destroy a story while you’re still inside it.', { pitch: 0.4, rate: 0.6 });
        fx.corr = 0.95;
        rig.fovKick = 12;
    });
    dir.tween(84, 4, (p) => {
        splice.scale.setScalar(lerp(1, 3, smooth(p)));
        splice.position.z = lerp(-10, -6, smooth(p));
    });
    dir.at(90, () => env.glitch(1, 0.8));
    // D7-S07 / D7-S08: breaking the story and the last frame
    dir.at(100, () => {
        env.say('YOU', 'You need me to keep watching.');
    });
    dir.at(106, () => env.say('???', 'Don’t.', { pitch: 0.4, rate: 0.6 }));
    dir.at(110, () => {
        env.say('???', 'DON’T TURN IT OFF!', { pitch: 0.4, rate: 0.9, volume: 1 });
        audio.thump(45, 1, 2);
    });
    dir.tween(112, 3, (p) => {
        fx.fade = 1 - smooth(p);
        fx.corr = lerp(0.95, 1, p);
    });
    dir.at(116, () => {
        env.say('YOU', 'End recording.');
        audio.staticBurst(1, 1.2);
        env.glitch(1, 1);
    });
    dir.tween(117, 3, (p) => (fx.fade = smooth(p)));
    // D7-S09: the living room. Clean hands, a warm room, a VCR click.
    const living = new THREE.Group();
    const couchM = new THREE.MeshStandardMaterial({ color: 0x6a3a2a, roughness: 0.9 });
    const couch = new THREE.Mesh(new THREE.BoxGeometry(3, 0.8, 1), couchM);
    couch.position.set(0, 0.4, -3.5);
    const oldTv = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1, 0.9), new THREE.MeshStandardMaterial({ color: 0x2a2a2a }));
    oldTv.position.set(0, 1.2, -6);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.7), new THREE.MeshBasicMaterial({ color: 0x1040a0 }));
    screen.position.set(0, 1.2, -5.54);
    const lamp2 = new THREE.PointLight(0xffc890, 1.6, 10, 1.4);
    lamp2.position.set(-2, 2.4, -3);
    living.add(couch, oldTv, screen, lamp2);
    living.visible = false;
    scene.add(living);
    // Living-room lighting/fog take over only at its entry cue below.
    const screenOn = () => {
        screen.visible = true;
    };
    // Cycle branch: on the second cycle the living room is fatal. The true route is the hospital.
    const secondCycle = store.get().loopCount >= 1;
    if (secondCycle) {
        // Second cycle: the living room is fatal. The screen goes out and the run
        // ends here; the required route is the hospital chapter that follows.
        dir.at(122, () => {
            fx.corr = 0.8;
            env.glitch(0.9, 0.6);
            audio.thump(50, 1, 1.5);
        });
        dir.tween(124, 3, (p) => (fx.fade = smooth(p)));
        dir.at(128, () => {
            store.patch({ title: 'THE LIVING ROOM IS NOT THE WAY OUT' });
            env.say('YOU', 'No. That room is the trap. Not again.');
        });
        dir.at(134, () => env.finish());
        return;
    }
    dir.at(122, () => {
        living.visible = true;
        scene.background = new THREE.Color(0x1a120c);
        scene.fog = null;
        rig.fovKick = 0;
        rig.shake = 0.05;
        splice.visible = false;
        core.visible = false;
        fx.corr = 0.15;
        rig.pitch = 0;
        rig.yaw = 0;
        rig.lookFreedom = 0;
        place(0, 1);
        env.title('');
    });
    dir.tween(122, 3, (p) => (fx.fade = 1 - smooth(p)));
    dir.at(126, () => env.say('YOU', 'What…?'));
    dir.at(130, () => {
        env.say('YOU', 'SEVEN DAYS. Please watch until the end.');
        screenOn();
    });
    dir.at(133, () => audio.creatureSound('splicemaster', 8, 'approach'));
    dir.at(136, () => { audio.creatureSound('splicemaster', 7, 'reveal'); env.say('???', 'Welcome back.', { pitch: 0.7, rate: 0.85 }); });
    // D7-S10: installation successful. Exact on-screen text, in order.
    dir.at(144, () => {
        env.say('YOU', 'Hello? Anybody? Where the hell is everybody?');
    });
    dir.tween(152, 6, (p) => {
        fx.corr = lerp(0.15, 0.9, p);
        rig.fovKick = lerp(0, 14, p);
    });
    dir.at(158, () => env.say('???', 'You did finish the story.', { pitch: 0.7, rate: 0.85 }));
    dir.at(164, () => env.say('???', 'Now you get to tell it.', { pitch: 0.7, rate: 0.85 }));
    dir.at(170, () => env.title('INSTALLING NEW HOST…', 3));
    dir.at(174, () => env.title('MEMORY TRANSFER COMPLETE.', 3));
    dir.at(178, () => env.title('IDENTITY REASSIGNED.', 3));
    dir.at(182, () => env.title('INSTALLATION SUCCESSFUL.', 4));
    dir.at(187, () => env.title('PLAY AGAIN?', 4));
    dir.tween(190, 3, (p) => (fx.fade = smooth(p)));
    // ===== The loop: the first run ends, and the protagonist wakes at the first campsite =====
    // The hospital path is an extra route; this is the canon living-room ending that loops.
    dir.at(194, () => {
        // Remember that the loop has happened, so the next run plays with friends as enemies.
        store.patch({ loopCount: store.get().loopCount + 1 });
        // All four friends return hostile, including those previously recorded lost.
        store.patch({ friends: Object.fromEntries(FRIEND_NAMES.map((name) => [name, 'hostile'])) });
        saveProgress();
        // Previously the fade returned to the living room while dialogue claimed a beach.
        // Reuse the Prologue island in this same viewpoint; no extra chapter/title card.
        scene.children.forEach((node) => { node.visible = false; });
        buildPrologue(env, { backdropOnly: true });
        rig.pos.set(0, Math.max(terrainH(0, 16), -0.2) + 1.7, 16);
        rig.yaw = Math.PI;
        rig.pitch = -0.05;
        rig.roll = 0;
        rig.walk = 0;
        rig.shake = 0.15;
        rig.fovKick = 0;
        rig.lookFreedom = 0.4;
        fx.corr = 0.15;
        fx.fade = 1;
        audio.level('hum', 0, 1);
        audio.level('ocean', 0.5, 2);
        audio.level('wind', 0.15, 2);
    });
    dir.tween(196, 3, (p) => (fx.fade = 1 - smooth(p)));
    // Back on the beach. No caption: the confusion is carried by the protagonist's own words.
    dir.at(202, () => env.say('YOU', 'The beach again. Wet sand. The plane is in pieces behind me.'));
    dir.at(208, () => env.say('YOU', 'What the hell do I have to do this again for? Am I already dead?'));
    dir.at(216, () => env.finish());
}
