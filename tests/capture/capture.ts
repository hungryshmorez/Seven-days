/**
 * Visual capture harness (dev tool, not shipped): mounts one episode with no UI and lets a
 * script seek the timeline, so every scene can be screenshotted at fixed story times.
 *   ?ep=day3            episode id
 *   window.__seek(t)    advance the story clock to t seconds (story time, not wall time)
 */
import { CinemaEngine, EPISODES } from '../../src/cinema/engine.ts';
import { store } from '../../src/state/store.ts';
import { LOOKS } from '../../src/cinema/look.ts';
import { buildHumanoid } from '../../src/cinema/humanoid.ts';
import * as THREE from 'three';

const id = new URLSearchParams(location.search).get('ep') ?? 'prologue';
// ?exposure=2&lamp=10&bloom=.5&dust=.5 override the chapter's tuned look for quick comparisons
const qs = new URLSearchParams(location.search);
for (const k of ['exposure', 'lamp', 'bloom', 'dust'] as const) if (qs.has(k)) LOOKS[id] = { ...(LOOKS[id] ?? {}), [k]: Number(qs.get(k)) };
const def = id === '__humans' ? humanLineup() : EPISODES.find((e) => e.id === id)!;
/** A lit test room with the four friends, standing and seated, for judging the humanoid builder. */
function humanLineup() {
    return { id: '__humans', label: 'humans', subtitle: '', build: (env: any) => {
        const T = THREE;
        env.scene.background = new T.Color(0x0a0c10);
        env.scene.add(new T.HemisphereLight(0x8090b0, 0x202020, 0.8));
        const key = new T.PointLight(0xffd8a0, 30, 12, 2); key.position.set(1.5, 2.6, 1.5); env.scene.add(key);
        const floor = new T.Mesh(new T.PlaneGeometry(20, 20), new T.MeshStandardMaterial({ color: 0x3a3632 })); floor.rotation.x = -Math.PI / 2; env.scene.add(floor);
        const looks: any[] = [
            { top: 0x8a2a2a, skin: 0xd2a488, hair: { color: 0x3a2214, style: 'long' }, build: 0.2, bottom: 0x2c3040 },
            { top: 0x5a4632, skin: 0xb08060, hair: { color: 0x1a1410, style: 'cap' }, build: 0.6, bottom: 0x3a3a30 },
            { top: 0xd03a9a, skin: 0xe0b898, hair: { color: 0xc8a040, style: 'short' }, build: 0.8, bottom: 0x2050a0 },
            { top: 0x111114, skin: 0x9a6a4a, hair: { color: 0x6a6a6a, style: 'short' }, build: 0.4, bottom: 0x111114 },
        ];
        looks.forEach((l, i) => {
            const st = buildHumanoid(l); st.group.position.set(-1.5 + i, 0, -3); st.group.rotation.y = Math.PI; env.scene.add(st.group);
            const se = buildHumanoid({ ...l, pose: 'seated' }); se.group.position.set(-1.5 + i, 0, -1.2); se.group.rotation.y = Math.PI; env.scene.add(se.group);
            const seat = new T.Mesh(new T.BoxGeometry(0.5, 0.08, 0.5), new T.MeshStandardMaterial({ color: 0x334466 })); seat.position.set(-1.5 + i, 0.48, -1.1); env.scene.add(seat);
        });
        env.rig.pos.set(0, 1.45, 1.6); env.rig.pitch = -0.12; env.fx.fade = 0; env.fx.corr = 0.03;
    } };
}
store.patch({ reducedMotion: false, paused: false });
const host = document.getElementById('host')!;
const engine = new CinemaEngine(host, def, () => { (window as any).__ended = true; }, (e) => { (window as any).__error = String(e); });
const e = engine as any;
(window as any).__e = e;
(window as any).__seek = (target: number) => {
    const step = 1 / 30;
    let guard = 0;
    while (e.dir.time < target && guard++ < 200000 && !e.finished && !e.disposed) {
        e.clock += step;
        e.dir.update(step);
        for (const cb of e.frameCbs) cb(step, e.clock);
        if (e.explore.active) e.stepExplore(step);
        e.rig.update(step, false);
        e.scene.updateMatrixWorld(); // raycasts read world matrices, normally refreshed by the render
        e.look?.update(step, e.clock);
    }
    e.last = performance.now();
    return e.dir.time;
};
(window as any).__ready = true;

/** Creature gallery: list every terrify()'d creature in this chapter and frame one, lit as in the chapter. */
let creatures: THREE.Object3D[] = [];
(window as any).__creatures = () => {
    // rescan every call: later acts of a chapter build their creatures when they begin
    creatures = [];
    e.scene.traverse((o: THREE.Object3D) => { if (o.userData.creature || o.userData.human) creatures.push(o); });
    return creatures.map((c) => c.userData.creature ?? 'human');
};
(window as any).__frame = (i: number, top: number | false = false) => {
    const c = creatures[i];
    for (let p: THREE.Object3D | null = c; p; p = p.parent) p.visible = true;
    e.fx.fade = 0; e.fx.corr = 0.05; e.fx.tear = 0;
    c.updateWorldMatrix(true, true);
    const box = new THREE.Box3().setFromObject(c), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
    const q = c.getWorldQuaternion(new THREE.Quaternion());
    const fwd = new THREE.Vector3(0, 0, 1).applyQuaternion(q); fwd.y = 0; fwd.normalize();
    const dist = Math.max(size.y * 0.75, size.x) + 1.2;
    if (top !== false) { c.getWorldPosition(center); center.y += top; size.set(6, 6, 6); }
    const rig = e.rig;
    rig.pos.copy(center).addScaledVector(fwd, dist);
    rig.pos.y = top !== false ? center.y : size.y < 2 ? center.y + 0.45 : Math.max(1.6, center.y);
    rig.yaw = Math.atan2(fwd.x, fwd.z);
    rig.pitch = Math.atan2(center.y - rig.pos.y, dist);
    rig.smoothedYaw = rig.yaw; rig.smoothedPitch = rig.pitch; rig.shake = 0; rig.walk = 0;
    e.explore.active = false;
    if (c.userData.human) { rig.pos.copy(center).addScaledVector(fwd.negate(), 1.3); rig.pos.y = center.y + 0.25; rig.yaw = Math.atan2(-fwd.x, -fwd.z) + Math.PI; rig.pitch = -0.15; rig.smoothedYaw = rig.yaw; rig.smoothedPitch = rig.pitch; }
    return c.userData.creature;
};
