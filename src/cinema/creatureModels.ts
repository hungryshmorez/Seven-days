/**
 * Hand-sculpted creature bodies. Each builder returns the parts a chapter used to
 * make from primitives, in the same local coordinates and at the same scale, so
 * the chapter's placement, animation, eyes, teeth and sounds keep working. Shapes
 * are lofted along curves with per-ring elliptical profiles, then skinned (wet
 * flesh, rim light) by the shared creature pass.
 */
import * as THREE from 'three';

export type V3 = [number, number, number];

// ---------------------------------------------------------------- toolkit

const rng = (seed: number) => () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

export interface LoftOptions {
    /** Rings along the path. */
    steps?: number;
    /** Vertices around each ring. */
    radial?: number;
    /** Organic lumpiness, in metres. */
    wobble?: number;
    seed?: number;
    /** Close the ends with a rounded cap. */
    caps?: boolean;
}

/**
 * A smooth tube along `pts` with a per-ring elliptical profile `prof(t) → [rx, rz]`
 * (rx across the body, rz front-to-back). Ends are rounded off. This is the workhorse
 * for torsos, limbs, necks, tails, fingers.
 */
export function loft(pts: V3[], prof: (t: number) => [number, number], o: LoftOptions = {}): THREE.BufferGeometry {
    const steps = o.steps ?? 28, radial = o.radial ?? 16, wob = o.wobble ?? 0;
    const rand = rng(o.seed ?? 5);
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'catmullrom', 0.5);
    const pos: number[] = [], idx: number[] = [];
    const ref = new THREE.Vector3(0, 0, 1), alt = new THREE.Vector3(1, 0, 0);
    const T = new THREE.Vector3(), S = new THREE.Vector3(), F = new THREE.Vector3();
    const phase = Array.from({ length: 6 }, () => rand() * 6.28);
    const ringCount = steps + 1;
    for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const p = curve.getPoint(t);
        curve.getTangent(t, T);
        S.crossVectors(T, Math.abs(T.dot(ref)) > 0.95 ? alt : ref).normalize();
        F.crossVectors(S, T).normalize();
        let [rx, rz] = prof(t);
        // rounded ends: pinch the first/last ring toward the axis
        if (o.caps !== false) {
            const e = Math.min(t, 1 - t) * steps;
            if (e < 1.5) { const k = Math.sqrt(Math.max(0, e / 1.5)); rx *= Math.max(0.05, k); rz *= Math.max(0.05, k); }
        }
        for (let j = 0; j < radial; j++) {
            const a = (j / radial) * Math.PI * 2;
            const w = wob ? 1 + wob * (Math.sin(a * 3 + phase[0] + t * 9) * 0.5 + Math.sin(a * 5 + phase[1] - t * 13) * 0.3 + Math.sin(t * 17 + phase[2]) * 0.2) : 1;
            const cx = Math.cos(a) * rx * w, cz = Math.sin(a) * rz * w;
            pos.push(p.x + S.x * cx + F.x * cz, p.y + S.y * cx + F.y * cz, p.z + S.z * cx + F.z * cz);
        }
    }
    for (let i = 0; i < ringCount - 1; i++) {
        for (let j = 0; j < radial; j++) {
            const a = i * radial + j, b = i * radial + (j + 1) % radial, c = a + radial, d = b + radial;
            idx.push(a, c, b, b, c, d);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
}

/** An ellipsoid with optional lumpiness. */
export function blob(rx: number, ry: number, rz: number, o: { wobble?: number; seed?: number; seg?: number } = {}): THREE.BufferGeometry {
    const g = new THREE.SphereGeometry(1, o.seg ?? 28, Math.round((o.seg ?? 28) * 0.65));
    const rand = rng(o.seed ?? 3), ph = [rand() * 6, rand() * 6, rand() * 6];
    const p = g.attributes.position;
    for (let i = 0; i < p.count; i++) {
        let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
        const w = o.wobble ? 1 + o.wobble * (Math.sin(x * 4 + ph[0]) * Math.sin(y * 3 + ph[1]) + Math.sin(z * 5 + ph[2]) * 0.5) : 1;
        p.setXYZ(i, x * rx * w, y * ry * w, z * rz * w);
    }
    g.computeVertexNormals();
    return g;
}

/** A tapered tube between two points with a slight bow, e.g. a finger segment or claw. */
const taper = (a: V3, b: V3, r0: number, r1: number, bow = 0, radial = 8) =>
    loft([a, [(a[0] + b[0]) / 2 + bow, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2], b], (t) => [r0 + (r1 - r0) * t, (r0 + (r1 - r0) * t) * 0.85], { steps: 8, radial });

export interface Mats { skin: THREE.Material; dark?: THREE.Material; bone?: THREE.Material; metal?: THREE.Material }

const rotated = (o: THREE.Mesh, axis: 'x' | 'z', a: number) => { o.rotation[axis] = a; return o; };
const mesh = (g: THREE.BufferGeometry, m: THREE.Material, x = 0, y = 0, z = 0) => {
    const o = new THREE.Mesh(g, m);
    o.position.set(x, y, z);
    return o;
};

export const boneMat = (color = 0xd8cdb4) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.55 }); m.userData.look = 0.3; return m; };
export const metalMat = (color = 0x9a9aa0) => { const m = new THREE.MeshStandardMaterial({ color, roughness: 0.4, metalness: 0.85 }); m.userData.lookKind = 3; return m; };

/** A hand hanging at `at`: palm and `n` long fingers that curl, pointing down -Y. Returns the group. */
export function hangingHand(m: THREE.Material, size = 1, n = 4, claw?: THREE.Material): THREE.Group {
    const h = new THREE.Group();
    const palm = mesh(blob(0.05 * size, 0.07 * size, 0.025 * size), m);
    palm.position.y = -0.05 * size;
    h.add(palm);
    for (let f = 0; f < n; f++) {
        const x = (f - (n - 1) / 2) * 0.026 * size;
        const len = (0.16 + (f === 1 || f === 2 ? 0.05 : 0)) * size;
        const finger = mesh(loft([[x, -0.1 * size, 0], [x * 1.3, -0.1 * size - len * 0.5, 0.012 * size], [x * 1.5, -0.1 * size - len, 0.045 * size]],
            (t) => [0.011 * size * (1 - t * 0.5), 0.010 * size * (1 - t * 0.5)], { steps: 8, radial: 6 }), m);
        h.add(finger);
        if (claw) {
            const c = mesh(taper([x * 1.5, -0.1 * size - len, 0.045 * size], [x * 1.6, -0.1 * size - len - 0.07 * size, 0.07 * size], 0.009 * size, 0.0015 * size, 0, 6), claw);
            h.add(c);
        }
    }
    return h;
}

// ---------------------------------------------------------------- the Watcher (prologue)

/**
 * A 4.3 m thin, wrong-proportioned figure: stilt legs, a narrow ribbed torso, a long neck,
 * a smooth egg of a head that sits slightly too far forward, and arms that reach the ground.
 * Parts named to match what the chapter animates: `head` (neck jerk).
 */
export function buildWatcher(m: THREE.Material) {
    const g = new THREE.Group();
    for (const s of [-1, 1]) {
        g.add(mesh(loft([[s * 0.11, 1.55, 0], [s * 0.14, 0.85, 0.12], [s * 0.15, 0.1, 0.0]], (t) => [0.075 - t * 0.035, 0.07 - t * 0.03], { steps: 18, wobble: 0.04, seed: 1 + s }), m));
        g.add(mesh(blob(0.07, 0.035, 0.17), m, s * 0.15, 0.03, 0.1)); // long flat foot
    }
    g.add(mesh(loft([[0, 1.45, 0], [0, 2.4, 0.03], [0, 3.1, 0.07], [0, 3.55, 0.1]],
        (t) => [0.15 + Math.sin(t * Math.PI * 0.9) * 0.1, 0.1 + Math.sin(t * Math.PI * 0.9) * 0.05], { steps: 36, radial: 20, wobble: 0.05, seed: 4 }), m));
    // exposed ribs: thin arcs across the chest
    for (let i = 0; i < 6; i++) {
        const y = 2.65 + i * 0.1, w = 0.2 + Math.sin(i / 5 * Math.PI) * 0.05;
        const rib = mesh(new THREE.TorusGeometry(w, 0.009, 5, 18, Math.PI), m, 0, y, 0.05);
        rib.rotation.x = Math.PI / 2 + 0.2; rib.rotation.z = Math.PI;
        g.add(rib);
    }
    g.add(mesh(loft([[0, 3.5, 0.1], [0, 3.78, 0.2], [0, 3.92, 0.26]], (t) => [0.06 - t * 0.012, 0.055], { steps: 10, radial: 10 }), m));
    const head = mesh(blob(0.2, 0.31, 0.22, { wobble: 0.02 }), m, 0, 4.05, 0.3);
    head.rotation.x = 0.18;
    g.add(head);
    for (const s of [-1, 1]) {
        const arm = new THREE.Group();
        arm.position.set(s * 0.25, 3.42, 0.08);
        arm.add(mesh(loft([[0, 0, 0], [s * 0.1, -1.0, 0.04], [s * 0.04, -2.1, 0.12], [s * 0.03, -3.05, 0.2]], (t) => [0.05 - t * 0.016, 0.045 - t * 0.014], { steps: 30, radial: 10, wobble: 0.05, seed: 8 + s }), m));
        const hand = hangingHand(m, 1.8, 5);
        hand.position.set(s * 0.03, -3.05, 0.2);
        arm.add(hand);
        g.add(arm);
    }
    return { group: g, head };
}

/** Day One's siren-headed Watcher: a 9 m stalk, a flared speaker horn for a face, a blinking lamp. */
export function buildSirenWatcher(m: THREE.Material) {
    const body = mesh(loft([[0, 0, 0], [0.05, 2.5, 0.0], [-0.04, 5.5, 0.05], [0, 9.0, 0.0]], (t) => [0.33 - t * 0.17 + Math.sin(t * 38) * 0.012, 0.28 - t * 0.14], { steps: 60, radial: 14, wobble: 0.04, seed: 2 }), m);
    body.position.y = 0;
    // horn: a bell that flares toward +Z once rotated, with a dark throat
    const prof = [[0.12, 0], [0.16, 0.12], [0.3, 0.32], [0.55, 0.52], [0.95, 0.72]].map(([r, y]) => new THREE.Vector2(r, y));
    const horn = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), m);
    (horn.material as THREE.Material).side = THREE.DoubleSide;
    return { body, horn };
}

// ---------------------------------------------------------------- Cleaverback (day 2)

/** Hunched brute with a bone-white skull, one dangling clawed arm and one carrying a cleaver. */
export function buildCleaverback(hide: THREE.Material, bone: THREE.Material, metal: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0.8, 0], [0, 2.0, 0.0], [0, 3.3, 0.25], [0, 4.25, 0.6]],
        (t) => [0.62 + Math.sin(t * Math.PI) * 0.28, 0.45 + Math.sin(t * Math.PI) * 0.15], { steps: 32, radial: 20, wobble: 0.06, seed: 11 }), hide));
    // hump over the shoulders
    g.add(mesh(blob(0.7, 0.45, 0.5, { wobble: 0.08, seed: 6 }), hide, 0, 3.7, -0.15));
    // neck, then a predator's skull: long narrow snout, hollow brow, swept-back spikes, jaw slung open
    g.add(mesh(loft([[0, 4.1, 0.45], [0, 4.55, 0.8], [0, 4.8, 1.0]], (t) => [0.3 - t * 0.1, 0.26 - t * 0.08], { steps: 10, radial: 12, wobble: 0.05 }), hide));
    const skull = new THREE.Group();
    skull.position.set(0, 4.95, 0.95);
    skull.rotation.x = 0.55;
    skull.add(mesh(blob(0.33, 0.36, 0.5, { wobble: 0.02 }), bone));
    skull.add(mesh(loft([[0, -0.05, 0.3], [0, -0.1, 0.75], [0, -0.14, 1.05]], (t) => [0.2 - t * 0.09, 0.17 - t * 0.07], { steps: 12, radial: 12 }), bone));
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.2, 0.2);
    jaw.rotation.x = 0.45;
    jaw.add(mesh(loft([[0, -0.02, 0], [0, -0.05, 0.4], [0, -0.04, 0.8]], (t) => [0.15 - t * 0.07, 0.07 - t * 0.03], { steps: 10, radial: 10 }), bone));
    skull.add(jaw);
    for (const s of [-1, 1]) {
        skull.add(mesh(taper([s * 0.22, 0.2, -0.1], [s * 0.45, 0.1, -0.85], 0.07, 0.008, 0, 8), bone));
        skull.add(mesh(taper([s * 0.28, 0.12, -0.05], [s * 0.7, -0.25, -0.65], 0.05, 0.006, 0, 8), bone));
    }
    g.add(skull);
    // spine ridge down the hump
    for (let i = 0; i < 5; i++) g.add(mesh(taper([0, 3.95 - i * 0.28, -0.25 - i * 0.02], [0, 4.4 - i * 0.28, -0.55 - i * 0.04], 0.05, 0.004, 0, 6), bone));
    // right arm: shoulder → elbow → hand, gripping a cleaver
    const armR = new THREE.Group();
    armR.position.set(0.95, 3.95, 0.25);
    armR.add(mesh(loft([[0, 0, 0], [0.3, -0.9, 0.15], [0.45, -1.7, 0.5]], (t) => [0.22 - t * 0.07, 0.2 - t * 0.06], { steps: 20, wobble: 0.05, seed: 3 }), hide));
    const blade = new THREE.Shape();
    blade.moveTo(-0.12, 0); blade.lineTo(0.12, 0); blade.lineTo(0.14, 1.5); blade.lineTo(0.55, 1.5); blade.lineTo(0.62, 1.2); blade.lineTo(0.55, 0.9); blade.lineTo(0.6, 0.55); blade.lineTo(0.14, 0.45); blade.lineTo(0.12, 0);
    const bladeG = new THREE.ExtrudeGeometry(blade, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
    const cleaver = mesh(bladeG, metal, 0.45, -1.9, 0.5);
    cleaver.rotation.set(0.1, 0.2, 2.9);
    armR.add(cleaver);
    armR.add(mesh(blob(0.14, 0.13, 0.12, { wobble: 0.1 }), hide, 0.45, -1.8, 0.5));
    g.add(armR);
    // left arm: absurdly long, trailing hooked claws on the ground
    const armL = new THREE.Group();
    armL.position.set(-0.95, 3.95, 0.25);
    armL.add(mesh(loft([[0, 0, 0], [-0.25, -1.4, 0.2], [-0.35, -2.7, 0.55], [-0.3, -3.6, 0.9]], (t) => [0.2 - t * 0.09, 0.17 - t * 0.07], { steps: 28, wobble: 0.05, seed: 9 }), hide));
    const hand = hangingHand(hide, 2.4, 4, bone);
    hand.position.set(-0.3, -3.6, 0.9);
    armL.add(hand);
    g.add(armL);
    return { group: g, skull, jaw, cleaver, armR, armL };
}

// ---------------------------------------------------------------- Velocity Wraith (day 3)

/** The blue blur-runner: a glossy, over-smooth figure mid-stride with a finger pressed to its grin. */
export function buildWraith(m: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0.95, 0], [0, 1.7, 0.08], [0, 2.45, 0.2]], (t) => [0.4 + Math.sin(t * Math.PI) * 0.12, 0.28 + Math.sin(t * Math.PI) * 0.08], { steps: 24, radial: 20 }), m));
    g.add(mesh(loft([[0, 2.3, 0.15], [0, 2.6, 0.3]], () => [0.17, 0.17], { steps: 6, radial: 12 }), m));
    // legs caught mid-stride: one reaching, one trailing
    g.add(mesh(loft([[-0.2, 1.05, 0], [-0.25, 0.55, 0.45], [-0.22, 0.05, 0.65]], (t) => [0.17 - t * 0.06, 0.16 - t * 0.06], { steps: 18, radial: 12 }), m));
    g.add(mesh(loft([[0.2, 1.05, 0], [0.24, 0.6, -0.35], [0.25, 0.12, -0.75]], (t) => [0.17 - t * 0.06, 0.16 - t * 0.06], { steps: 18, radial: 12 }), m));
    g.add(mesh(blob(0.12, 0.07, 0.24), m, -0.22, 0.04, 0.75));
    g.add(mesh(blob(0.12, 0.07, 0.24), m, 0.25, 0.08, -0.85));
    // left arm swung back, right arm folded up so a finger rests on the lips
    g.add(mesh(loft([[-0.45, 2.15, 0.1], [-0.65, 1.65, -0.2], [-0.7, 1.2, -0.55]], (t) => [0.1 - t * 0.03, 0.095 - t * 0.03], { steps: 16, radial: 10 }), m));
    g.add(mesh(loft([[0.45, 2.15, 0.1], [0.62, 1.8, 0.45], [0.25, 2.3, 0.78]], (t) => [0.1 - t * 0.03, 0.095 - t * 0.03], { steps: 16, radial: 10 }), m));
    g.add(mesh(taper([0.25, 2.3, 0.78], [0.1, 2.88, 0.86], 0.04, 0.025, 0, 8), m)); // the finger, up to the mouth
    // the head stays a sphere so the chapter's eye sockets and teeth sit exactly where they did
    const head = mesh(new THREE.SphereGeometry(0.8, 36, 26), m, 0, 3.2, 0);
    g.add(head);
    return { group: g, head };
}

// ---------------------------------------------------------------- Fox figure (day 3)

/** The injured fox: long body, bushy tail, dark socks, a lifted hind leg and a pointed muzzle. */
export function buildFox(fur: THREE.Material, dark: THREE.Material, pale: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[-0.9, 1.05, 0], [0, 1.15, 0], [0.75, 1.3, 0]], (t) => [0.4 + Math.sin(t * Math.PI) * 0.12, 0.4 + Math.sin(t * Math.PI) * 0.12], { steps: 24, radial: 16, wobble: 0.04, seed: 21 }), fur));
    g.add(mesh(blob(0.36, 0.2, 0.28, { wobble: 0.05 }), pale, 0.55, 1.1, 0)); // pale chest
    // legs: three planted, the near hind folded up
    const leg = (x: number, z: number, bent: boolean) => {
        const pts: V3[] = bent ? [[x, 1.0, z], [x - 0.2, 0.75, z * 1.1], [x - 0.05, 0.62, z * 1.1]] : [[x, 1.0, z], [x + 0.02, 0.5, z], [x + 0.04, 0.05, z]];
        g.add(mesh(loft(pts, (t) => [0.1 - t * 0.04, 0.09 - t * 0.035], { steps: 14, radial: 10 }), fur));
        if (!bent) g.add(mesh(blob(0.1, 0.06, 0.08), dark, x + 0.06, 0.05, z));
    };
    leg(-0.6, 0.22, false); leg(-0.6, -0.22, true); leg(0.55, 0.22, false); leg(0.55, -0.22, false);
    // tail: a long bushy curve, white-tipped
    g.add(mesh(loft([[-0.85, 1.2, 0], [-1.4, 1.1, 0.05], [-1.85, 0.8, 0.12], [-2.05, 0.55, 0.12]], (t) => { const k = Math.sin(Math.min(1, t * 1.25) * Math.PI * 0.8); return [0.05 + k * 0.16, 0.05 + k * 0.16]; }, { steps: 24, radial: 14, wobble: 0.12, seed: 5 }), fur));
    g.add(mesh(blob(0.14, 0.12, 0.14), pale, -2.0, 0.55, 0.12));
    // head and muzzle (the chapter's eyes ride on the head at x≈1.25)
    const head = new THREE.Group();
    head.position.set(0.95, 1.65, 0);
    head.rotation.z = -0.18;
    head.add(mesh(blob(0.42, 0.36, 0.34, { wobble: 0.02 }), fur));
    head.add(mesh(loft([[0.2, -0.06, 0], [0.7, -0.14, 0], [1.0, -0.15, 0]], (t) => [0.2 - t * 0.14, 0.17 - t * 0.1], { steps: 12, radial: 12 }), fur));
    head.add(mesh(blob(0.07, 0.06, 0.07), dark, 1.02, -0.13, 0));
    head.add(mesh(blob(0.3, 0.1, 0.24), pale, 0.45, -0.25, 0)); // pale cheeks/jaw
    for (const s of [-1, 1]) {
        const ear = mesh(taper([-0.05, 0.28, s * 0.2], [-0.12, 0.85, s * 0.3], 0.12, 0.012, 0, 8), fur);
        head.add(ear);
        head.add(mesh(taper([-0.045, 0.3, s * 0.2], [-0.11, 0.78, s * 0.3], 0.06, 0.008, 0, 6), dark));
    }
    g.add(head);
    return { group: g, head };
}

// ---------------------------------------------------------------- Long Neck (day 4)

/** A horse-like skull on a neck of heavy vertebrae. Head local +Z is forward; `segs` are animated by the chapter. */
export function buildLongNeck(skin: THREE.Material, bone: THREE.Material, count = 16) {
    const g = new THREE.Group();
    // skull: a long wedge. Profile is [height, width] because the path runs along z.
    g.add(mesh(loft([[0, 0.15, -0.5], [0, 0.1, 0.7], [0, -0.05, 1.8], [0, -0.2, 2.55]],
        (t) => [0.72 - t * 0.3 + Math.sin(t * 3) * 0.05, 0.58 - t * 0.2], { steps: 28, radial: 18, wobble: 0.03, seed: 4 }), skin));
    // brow ridge and cheek bones
    for (const s of [-1, 1]) {
        g.add(mesh(blob(0.18, 0.14, 0.5), bone, s * 0.5, 0.52, 1.5));
        g.add(mesh(blob(0.1, 0.22, 0.6), bone, s * 0.52, -0.1, 1.2));
        g.add(mesh(blob(0.07, 0.06, 0.1), skin, s * 0.2, 0.05, 2.5)); // nostril bulges
    }
    // a slack, unhinged jaw
    const jaw = new THREE.Group();
    jaw.position.set(0, -0.35, 0.3);
    jaw.rotation.x = 0.28;
    jaw.add(mesh(loft([[0, -0.1, 0], [0, -0.15, 1.1], [0, -0.1, 2.1]], (t) => [0.2 - t * 0.08, 0.4 - t * 0.2], { steps: 16, radial: 12 }), bone));
    g.add(jaw);
    const segs: THREE.Mesh[] = [];
    for (let i = 0; i < count; i++) {
        const v = mesh(blob(0.44 - i * 0.004, 0.5, 0.86, { wobble: 0.06, seed: i + 2 }), i % 2 ? skin : bone);
        v.position.set(0, -i * 0.5, -i * 1.3 - 1.4);
        v.rotation.x = 0.37;
        g.add(v);
        segs.push(v);
    }
    return { group: g, segs, jaw };
}

// ---------------------------------------------------------------- Speaker tower (day 4)

/** An 18 m mast of ribbed vertebrae with cable bundles; the two speaker horns spin on their own axes. */
export function buildSpeakerTower(m: THREE.Material, cable: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0, 0], [0.1, 6, 0], [-0.1, 12, 0.05], [0, 18, 0]], (t) => [0.95 - t * 0.55 + Math.sin(t * 70) * 0.05, 0.9 - t * 0.5 + Math.sin(t * 70) * 0.05], { steps: 90, radial: 14, wobble: 0.05, seed: 8 }), m));
    for (let i = 0; i < 5; i++) {
        const c = mesh(loft([[0.5 - i * 0.2, 17.5, 0.3], [0.7, 12, 0.4 - i * 0.2], [0.9 - i * 0.1, 4, 0.2], [1.4 + i * 0.3, 0, 0.8 - i * 0.3]], () => [0.05, 0.05], { steps: 40, radial: 6 }), cable);
        g.add(c);
    }
    const horn = (flip: number) => {
        const prof = [[0.35, -0.9], [0.45, -0.5], [0.8, -0.1], [1.4, 0.5], [1.55, 0.8]].map(([r, y]) => new THREE.Vector2(r, y * flip));
        const h = new THREE.Mesh(new THREE.LatheGeometry(prof, 24), m);
        (h.material as THREE.Material).side = THREE.DoubleSide;
        return h;
    };
    return { group: g, horn };
}

// ---------------------------------------------------------------- Grin Cat (day 5)

/** A 7 m rubber-hose cartoon cat: pear body, ears, white muzzle, long jointless arms with gloves. */
export function buildGrinCat(m: THREE.Material, glove: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0.9, 0], [0, 2.4, 0], [0, 4.1, 0.05]], (t) => [1.25 - t * 0.55 + Math.sin(t * 3) * 0.1, 0.9 - t * 0.3], { steps: 24, radial: 24 }), m));
    for (const s of [-1, 1]) {
        g.add(mesh(loft([[s * 0.5, 1.0, 0], [s * 0.5, 0.4, 0.05]], () => [0.22, 0.22], { steps: 6, radial: 10 }), m));
        g.add(mesh(blob(0.3, 0.14, 0.5), glove, s * 0.5, 0.14, 0.28)); // boots
    }
    g.add(mesh(loft([[0.2, 1.0, -0.8], [1.3, 1.6, -1.4], [2.2, 3.0, -1.2], [2.0, 4.2, -0.9]], (t) => [0.2 - t * 0.08, 0.2 - t * 0.08], { steps: 24, radial: 10 }), m)); // tail
    const head = new THREE.Group();
    head.position.set(0, 6.3, 0);
    head.add(mesh(blob(1.3, 1.0, 1.1, { wobble: 0.01 }), m));
    head.add(mesh(blob(0.65, 0.4, 0.4), glove, 0, -0.35, 0.78)); // muzzle patch
    for (const s of [-1, 1]) {
        head.add(mesh(taper([s * 0.65, 0.65, 0], [s * 0.95, 1.55, -0.05], 0.38, 0.03, 0, 10), m));
        head.add(mesh(taper([s * 0.66, 0.7, 0.18], [s * 0.93, 1.4, 0.1], 0.2, 0.02, 0, 8), glove));
    }
    g.add(head);
    return { group: g, head };
}

/** Replacement arm geometry for the cat: pivots at its top, hangs along -Y, scaled by the chapter. */
export const catArmGeometry = () => loft([[0, 0, 0], [0.08, -1.7, 0.04], [0, -3.4, 0]], (t) => [0.2 - t * 0.04, 0.2 - t * 0.04], { steps: 20, radial: 12 });
export const catGloveGeometry = () => blob(0.44, 0.48, 0.34);

// ---------------------------------------------------------------- Hound (day 5)

/** A starved hound: ribs, a hunched back, long digitigrade legs, a whip tail. Faces +X. Returns the head group separately. */
export function buildHound(m: THREE.Material, bone: THREE.Material) {
    const body = new THREE.Group();
    body.add(mesh(loft([[-1.3, 1.65, 0], [-0.2, 1.95, 0], [0.9, 1.75, 0], [1.4, 1.95, 0]],
        (t) => [0.45 + Math.sin(t * Math.PI) * 0.18 - t * 0.12, 0.38 + Math.sin(t * Math.PI) * 0.17], { steps: 32, radial: 18, wobble: 0.05, seed: 3 }), m));
    for (let i = 0; i < 6; i++) { // ribs
        const x = -0.1 + i * 0.22;
        const r = mesh(new THREE.TorusGeometry(0.5 - Math.abs(i - 2.5) * 0.03, 0.022, 5, 20, Math.PI * 1.15), bone, x, 1.7, 0);
        r.rotation.set(0, Math.PI / 2, Math.PI * 0.92);
        body.add(r);
    }
    for (let i = 0; i < 6; i++) body.add(mesh(taper([-1.1 + i * 0.4, 2.15 - Math.abs(i - 2.5) * 0.04, 0], [-1.1 + i * 0.4 + 0.05, 2.35 - Math.abs(i - 2.5) * 0.04, 0], 0.05, 0.005, 0, 6), bone));
    const leg = (x: number, z: number, front: boolean) => {
        const hip = front ? 1.8 : 1.7;
        body.add(mesh(loft([[x, hip, z], [x + (front ? 0.1 : -0.2), 1.0, z * 1.1], [x + (front ? -0.1 : 0.15), 0.45, z * 1.1], [x + 0.25, 0.04, z * 1.1]],
            (t) => [0.14 - t * 0.09, 0.12 - t * 0.08], { steps: 22, radial: 10, wobble: 0.03 }), m));
        for (const dx of [0, 0.1, 0.2]) body.add(mesh(taper([x + 0.25 + dx * 0.4, 0.05, z * 1.1], [x + 0.55 + dx * 0.3, 0.0, z * 1.1 + (dx - 0.1) * 0.5], 0.03, 0.006, 0, 5), bone));
    };
    leg(1.15, 0.28, true); leg(1.15, -0.28, true); leg(-1.0, 0.3, false); leg(-1.0, -0.3, false);
    body.add(mesh(loft([[-1.3, 1.75, 0], [-1.9, 1.6, 0.1], [-2.4, 1.0, 0.0], [-2.6, 0.5, -0.2]], (t) => [0.09 - t * 0.07, 0.09 - t * 0.07], { steps: 20, radial: 8 }), m));
    const head = new THREE.Group();
    head.position.set(1.7, 2.2, 0);
    head.add(mesh(blob(0.5, 0.42, 0.4), m));
    head.add(mesh(loft([[0.3, -0.05, 0], [0.85, -0.12, 0], [1.2, -0.14, 0]], (t) => [0.22 - t * 0.1, 0.2 - t * 0.09], { steps: 14, radial: 12 }), m));
    const jaw = mesh(loft([[0.2, -0.25, 0], [0.7, -0.4, 0], [1.1, -0.38, 0]], (t) => [0.08, 0.14 - t * 0.07], { steps: 10, radial: 8 }), bone);
    jaw.rotation.z = -0.15;
    head.add(jaw);
    for (const s of [-1, 1]) head.add(mesh(taper([-0.2, 0.3, s * 0.25], [-0.55, 0.85, s * 0.35], 0.14, 0.01, 0, 8), m));
    return { body, head };
}

// ---------------------------------------------------------------- Ink Man (day 5)

/** A melting tar figure, ~3.5 m: a puddle base, a slumped torso, a bulb of a head, long dripping arms. */
export function buildInkMan(m: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(blob(1.7, 0.12, 1.5, { wobble: 0.15, seed: 2 }), m, 0, 0.05, 0.15)); // puddle
    g.add(mesh(loft([[0, 0.1, 0], [0.05, 1.2, 0.05], [-0.05, 2.2, 0.1]], (t) => [1.15 - t * 0.5, 0.75 - t * 0.2], { steps: 28, radial: 22, wobble: 0.12, seed: 6 }), m));
    g.add(mesh(blob(0.6, 0.7, 0.58, { wobble: 0.05 }), m, 0, 2.85, 0.15));
    for (const s of [-1, 1]) {
        g.add(mesh(loft([[s * 0.85, 2.0, 0.1], [s * 1.15, 1.2, 0.3], [s * 1.2, 0.4, 0.5]], (t) => [0.2 - t * 0.08 + Math.sin(t * 12) * 0.02, 0.17 - t * 0.06], { steps: 24, radial: 10, wobble: 0.1, seed: 5 + s }), m));
        for (let i = 0; i < 3; i++) g.add(mesh(taper([s * 1.2 + (i - 1) * 0.05, 0.4, 0.5], [s * 1.2 + (i - 1) * 0.07, -0.0, 0.52], 0.035, 0.008, 0, 5), m));
    }
    return { group: g };
}
export const dripGeometry = () => blob(0.08, 0.3, 0.08);

// ---------------------------------------------------------------- Miss Merrily (day 6)

/** A stiff television hostess in a bell-skirted dress: bob haircut, one arm up in a frozen wave. Head centre y = 2.9, face toward +Z. */
export function buildHostess(dress: THREE.Material, skin: THREE.Material, hair: THREE.Material, trim: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0.02, 0], [0, 2.5, 0]], (t) => {
        const skirt = 0.84 - 0.46 * Math.pow(Math.min(t / 0.72, 1), 0.7);
        const sh = t > 0.8 ? 0.38 + Math.sin(((t - 0.8) / 0.2) * Math.PI * 0.5) * 0.14 - Math.max(0, (t - 0.96) * 5) : skirt;
        const r = Math.max(0.1, t > 0.8 ? sh : skirt);
        return [r, r * 0.78];
    }, { steps: 34, radial: 28 }), dress));
    g.add(rotated(mesh(new THREE.TorusGeometry(0.4, 0.04, 8, 28), trim, 0, 1.45, 0), 'x', Math.PI / 2)); // belt
    g.add(mesh(taper([0, 2.45, 0], [0, 2.66, 0], 0.13, 0.11, 0, 12), skin));
    g.add(rotated(mesh(new THREE.TorusGeometry(0.17, 0.035, 8, 20), trim, 0, 2.52, 0.02), 'x', Math.PI / 2)); // collar
    g.add(mesh(blob(0.48, 0.55, 0.48, { wobble: 0.01 }), skin, 0, 2.92, 0));
    g.add(mesh(blob(0.55, 0.52, 0.52, { wobble: 0.015, seed: 3 }), hair, 0, 3.08, -0.1)); // bob
    g.add(mesh(blob(0.5, 0.17, 0.3), hair, 0, 3.38, 0.2)); // fringe
    for (const s of [-1, 1]) {
        g.add(mesh(blob(0.14, 0.34, 0.2), hair, s * 0.52, 2.78, -0.02)); // the bob's wings
        g.add(mesh(blob(0.06, 0.1, 0.05), skin, s * 0.49, 2.9, 0.0));
    }
    // arms: one hanging, one in a rigid wave
    const sleeve = dress;
    g.add(mesh(taper([-0.5, 2.35, 0], [-0.72, 1.55, 0.18], 0.1, 0.085, 0, 10), sleeve));
    g.add(mesh(blob(0.07, 0.12, 0.05), skin, -0.74, 1.4, 0.2));
    g.add(mesh(taper([0.5, 2.35, 0], [0.98, 2.75, 0.2], 0.1, 0.085, 0, 10), sleeve));
    g.add(mesh(taper([0.98, 2.75, 0.2], [1.05, 3.2, 0.25], 0.085, 0.07, 0, 10), sleeve));
    g.add(mesh(blob(0.1, 0.17, 0.04), skin, 1.06, 3.38, 0.25));
    for (let i = 0; i < 4; i++) g.add(mesh(taper([1.0 + i * 0.045, 3.45, 0.25], [1.0 + i * 0.07 - 0.03, 3.68, 0.25], 0.017, 0.012, 0, 5), skin));
    return { group: g };
}

/** The frightened puppet: a woolly lamb with floppy ears and stubby felt limbs. Faces +Z. */
export function buildPuppetLamb(wool: THREE.Material, felt: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(blob(0.95, 0.95, 0.85, { wobble: 0.06, seed: 9 }), wool, 0, 1.1, 0));
    g.add(mesh(blob(0.58, 0.56, 0.52, { wobble: 0.04, seed: 5 }), wool, 0, 2.2, 0.05));
    g.add(mesh(blob(0.3, 0.26, 0.24), felt, 0, 2.08, 0.38)); // muzzle
    for (const s of [-1, 1]) {
        g.add(mesh(taper([s * 0.5, 2.35, 0], [s * 0.95, 2.1, 0.05], 0.14, 0.06, 0.1, 8), felt)); // ears
        g.add(mesh(taper([s * 0.85, 1.4, 0.3], [s * 1.0, 0.8, 0.5], 0.14, 0.1, 0, 8), wool)); // arms
        g.add(mesh(taper([s * 0.4, 0.3, 0.1], [s * 0.4, 0.0, 0.3], 0.18, 0.2, 0, 8), felt)); // feet
        g.add(mesh(blob(0.08, 0.08, 0.04), new THREE.MeshBasicMaterial({ color: 0x111111 }), s * 0.2, 2.3, 0.51)); // eyes
    }
    return { group: g };
}

// ---------------------------------------------------------------- Tall Smile (day 6)

/** A 6 m animatronic: ribbed spine, jointed collar rings, piston neck, dish ears, an antenna. Head sphere is centred y = 4.8, r = .8. */
export function buildTallSmile(metal: THREE.Material, dark: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0.2, 0], [0, 4.2, 0]], (t) => [0.7 - t * 0.22 + Math.sin(t * 60) * 0.025, 0.6 - t * 0.14 + Math.sin(t * 60) * 0.025], { steps: 120, radial: 18 }), metal));
    for (const y of [0.9, 2.0, 3.1, 4.05]) {
        const r = mesh(new THREE.TorusGeometry(0.66 - y * 0.05, 0.05, 8, 24), dark, 0, y, 0);
        r.rotation.x = Math.PI / 2;
        g.add(r);
    }
    for (const s of [-1, 1]) {
        g.add(mesh(taper([s * 0.16, 4.15, -0.05], [s * 0.16, 4.7, 0], 0.045, 0.04, 0, 6), dark)); // pistons
        g.add(rotated(mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.08, 20), metal, s * 0.9, 4.85, 0), 'z', Math.PI / 2)); // ears
        g.add(rotated(mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 16), dark, s * 0.94, 4.85, 0), 'z', Math.PI / 2));
        g.add(mesh(loft([[s * 0.5, 4.1, -0.4], [s * 0.9, 3.0, -0.6], [s * 0.7, 1.6, -0.5]], () => [0.03, 0.03], { steps: 24, radial: 6 }), dark)); // cables
    }
    g.add(mesh(blob(0.8, 0.82, 0.78, { wobble: 0.008 }), metal, 0, 4.8, 0));
    g.add(mesh(blob(0.72, 0.06, 0.7), dark, 0, 5.3, 0)); // a seam across the crown
    g.add(mesh(taper([0, 5.5, 0], [0.12, 6.3, 0], 0.035, 0.02, 0, 6), dark));
    g.add(mesh(blob(0.08, 0.08, 0.08), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xff3a20).multiplyScalar(2) }), 0.12, 6.35, 0));
    for (let i = 0; i < 6; i++) { // bolts around the faceplate
        const a = i * 1.05;
        g.add(mesh(blob(0.035, 0.035, 0.03), dark, Math.sin(a) * 0.62, 4.8 + Math.cos(a) * 0.55, 0.45 + Math.cos(a * 0.7) * 0.1));
    }
    return { group: g };
}

// ---------------------------------------------------------------- Splicemaster (day 7)

/** The projectionist's body: a hunched robe over a lens barrel, trailing strips of film. Local +Z is the front. */
export function buildSplicemasterBody(robe: THREE.Material, film: THREE.Material, metal: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0, 0], [0, 1.6, -0.12], [0, 2.8, 0.05], [0, 3.35, 0.25]], (t) => [0.95 - t * 0.5 + Math.sin(t * 9) * 0.05, 0.85 - t * 0.4], { steps: 40, radial: 22, wobble: 0.03, seed: 11 }), robe));
    g.add(mesh(blob(0.7, 0.45, 0.55, { wobble: 0.05, seed: 2 }), robe, 0, 3.0, -0.35)); // a hump
    const barrel = mesh(new THREE.CylinderGeometry(0.3, 0.38, 0.6, 20), metal, 0, 3.7, 0.4);
    barrel.rotation.x = Math.PI / 2;
    g.add(barrel);
    const rim = mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 24), metal, 0, 3.7, 0.72);
    g.add(rim);
    for (let i = 0; i < 14; i++) { // film ribbons hanging from the shoulders, each a slow curl
        const a = (i / 14) * Math.PI * 2, rr = 0.55 + (i % 3) * 0.12, len = 1.6 + (i % 4) * 0.5;
        const x = Math.cos(a) * rr, z = Math.sin(a) * rr * 0.8 - 0.1;
        const strip = mesh(loft([[x, 3.1, z], [x * 1.25, 3.1 - len * 0.5, z * 1.2], [x * 1.1 + Math.sin(i) * 0.3, 3.1 - len, z * 1.3 + 0.1]], () => [0.075, 0.006], { steps: 14, radial: 4 }), film);
        g.add(strip);
        for (let k = 0; k < 4; k++) g.add(mesh(blob(0.012, 0.012, 0.012), metal, x * (1 + k * 0.06), 3.0 - k * len * 0.22, z * (1 + k * 0.07) + 0.01));
    }
    return { group: g };
}

// ---------------------------------------------------------------- Burned Accomplice (day 5 / 3)

/** A charred crawler: a split torso behind the head and eight jointed legs. Legs are returned for the chapter's wiggle. */
export function buildBurnedCrawler(flesh: THREE.Material, char: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(blob(0.42, 0.26, 0.5, { wobble: 0.07, seed: 4 }), char, 0, 0.32, -0.38));
    g.add(mesh(blob(0.26, 0.15, 0.3, { wobble: 0.1, seed: 8 }), flesh, 0.1, 0.4, -0.5)); // raw patch
    for (let i = 0; i < 5; i++) g.add(mesh(taper([0, 0.5, -0.2 - i * 0.14], [0, 0.66 - Math.abs(i - 2) * 0.03, -0.2 - i * 0.14], 0.035, 0.005, 0, 5), char)); // spines
    const legs: THREE.Mesh[] = [];
    const legGeo = loft([[0, 0, 0], [0.3, 0.38, 0], [0.62, 0.22, 0], [0.82, -0.2, 0]], (t) => [0.045 - t * 0.03, 0.04 - t * 0.025], { steps: 18, radial: 6, wobble: 0.02 });
    for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const leg = mesh(legGeo, char, Math.cos(a) * 0.32, 0.3, Math.sin(a) * 0.32);
        leg.rotation.y = -a;
        g.add(leg);
        legs.push(leg);
    }
    return { group: g, legs };
}

// ---------------------------------------------------------------- Morrow Moppet (day 1)

/** Marionette body: draped teal robe, carved wooden head with a lantern jaw, asymmetric legs. Head centre y = 2.5, face toward +Z. */
export function buildMoppetBody(cloak: THREE.Material, wood: THREE.Material, porcelain: THREE.Material) {
    const g = new THREE.Group();
    const m = cloak.clone(); m.side = THREE.DoubleSide;
    g.add(mesh(loft([[0, 0.8, 0], [0, 2.3, 0]], (t) => { const r = 0.82 - t * 0.5 + Math.sin(t * 14) * 0.05 * (1 - t); return [r, r * 0.8]; }, { steps: 30, radial: 24, wobble: 0.05, seed: 5 }), m));
    g.add(mesh(blob(0.42, 0.26, 0.24, { wobble: 0.015 }), wood, 0, 2.52, 0)); // skull block, rounded
    g.add(mesh(blob(0.3, 0.22, 0.2), wood, 0, 2.28, 0.1)); // jaw
    g.add(mesh(taper([0, 2.45, 0.2], [0, 2.3, 0.3], 0.05, 0.015, 0, 6), wood)); // nose
    for (let i = 0; i < 7; i++) g.add(mesh(blob(0.036, 0.075, 0.04), porcelain, -0.29 + i * 0.097, 2.37, 0.26)); // teeth
    for (const [s, len] of [[-1, 0.9], [1, 1.35]] as const) {
        g.add(mesh(loft([[s * 0.23, 0.9, 0], [s * 0.3, 0.45, 0.04], [s * 0.23, 0.0, 0.0]], () => [0.07, 0.07], { steps: 12, radial: 8 }), wood));
        g.add(mesh(blob(0.1, 0.05, 0.16), wood, s * 0.23, 0.04, 0.06));
        g.add(mesh(blob(0.06, 0.06, 0.06), porcelain, s * 0.3, 0.5 * len, 0.04)); // knee joint
    }
    return { group: g };
}

/** One overlong marionette arm hanging from the shoulder pivot: wooden upper arm, a porcelain hand with long fingers. */
export function buildMoppetArm(wood: THREE.Material, porcelain: THREE.Material, side: number) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0, 0], [side * 0.1, -0.55, 0.02], [side * 0.1, -1.1, 0]], () => [0.065, 0.06], { steps: 12, radial: 8 }), wood));
    g.add(mesh(blob(0.075, 0.075, 0.075), porcelain, side * 0.1, -0.58, 0.02));
    g.add(mesh(blob(0.12, 0.14, 0.05), porcelain, side * 0.1, -1.2, 0.08));
    for (let i = 0; i < 4; i++) g.add(mesh(taper([side * (0.04 + i * 0.045), -1.28, 0.08], [side * (0.03 + i * 0.05), -1.8 - (i % 2) * 0.12, 0.1], 0.02, 0.008, 0, 5), porcelain));
    return g;
}

// ---------------------------------------------------------------- White figure (day 3 kitchen, day 5 ritual)

/** A tall woman in a floor-length dress, black hair hanging past the waist, arms slack. Head centre y = 2.46, face toward +Z. */
export function buildWhiteFigure(dress: THREE.Material, skin: THREE.Material, hair: THREE.Material, withArms = true) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0, 0], [0, 2.1, 0]], (t) => {
        const hem = 0.68 * Math.pow(1 - t, 1.6) + 0.17 + Math.sin(t * 21) * 0.015 * (1 - t);
        const r = t > 0.82 ? 0.17 + Math.sin(((t - 0.82) / 0.18) * Math.PI * 0.5) * 0.14 : hem;
        return [r, r * 0.72];
    }, { steps: 36, radial: 26, wobble: 0.02, seed: 7 }), dress));
    g.add(mesh(taper([0, 2.1, 0], [0, 2.3, 0.02], 0.065, 0.055, 0, 10), skin));
    g.add(mesh(blob(0.17, 0.225, 0.19, { wobble: 0.006 }), skin, 0, 2.46, 0));
    // hair: a cap, a long curtain behind, and two strands falling beside the face
    g.add(mesh(blob(0.2, 0.22, 0.2), hair, 0, 2.55, -0.04));
    g.add(mesh(loft([[0, 2.55, -0.14], [0, 1.6, -0.2], [0, 0.7, -0.17]], (t) => [0.2 - t * 0.04, 0.05], { steps: 20, radial: 14, wobble: 0.03, seed: 3 }), hair));
    for (const s of [-1, 1]) g.add(mesh(loft([[s * 0.15, 2.52, 0.08], [s * 0.2, 2.0, 0.1], [s * 0.2, 1.4, 0.08]], (t) => [0.045 - t * 0.02, 0.03], { steps: 14, radial: 8 }), hair));
    if (withArms) for (const s of [-1, 1]) {
        g.add(mesh(loft([[s * 0.24, 1.98, 0], [s * 0.34, 1.3, 0.04], [s * 0.33, 0.75, 0.12]], (t) => [0.055 - t * 0.015, 0.05 - t * 0.015], { steps: 16, radial: 8 }), skin));
        for (let i = 0; i < 4; i++) g.add(mesh(taper([s * (0.3 + i * 0.012), 0.74, 0.12], [s * (0.3 + i * 0.012), 0.42 - (i % 2) * 0.05, 0.14], 0.012, 0.006, 0, 5), skin));
    }
    return { group: g };
}

// ---------------------------------------------------------------- Ritual presence (day 5)

/** A hunched, hooded mass of shadow, ~3 m, trailing ragged strips. Eyes belong at about (0, 2.75, 0.32). */
export function buildRitualPresence(m: THREE.Material) {
    const g = new THREE.Group();
    g.add(mesh(loft([[0, 0, 0], [0, 1.2, -0.1], [0, 2.3, 0.05], [0, 2.95, 0.22]], (t) => [0.85 - t * 0.5 + Math.sin(t * 10) * 0.06, 0.7 - t * 0.35], { steps: 36, radial: 24, wobble: 0.08, seed: 13 }), m));
    g.add(mesh(blob(0.52, 0.55, 0.5, { wobble: 0.1, seed: 5 }), m, 0, 2.85, 0.15));
    g.add(mesh(blob(0.25, 0.3, 0.45), m, 0, 2.55, 0.45)); // hood lip
    for (const s of [-1, 1]) {
        g.add(mesh(loft([[s * 0.6, 2.4, 0], [s * 0.95, 1.4, 0.2], [s * 1.0, 0.5, 0.5], [s * 0.9, 0.05, 0.9]], (t) => [0.14 - t * 0.07, 0.12 - t * 0.05], { steps: 22, radial: 10, wobble: 0.05, seed: 8 }), m));
        for (let i = 0; i < 3; i++) g.add(mesh(taper([s * 0.9, 0.08, 0.9], [s * (0.9 + (i - 1) * 0.05), 0.0, 1.25 + i * 0.1], 0.03, 0.008, 0, 5), m));
    }
    for (let i = 0; i < 7; i++) { // ragged strips
        const a = (i / 7) * Math.PI * 2;
        g.add(mesh(loft([[Math.cos(a) * 0.6, 1.5, Math.sin(a) * 0.5], [Math.cos(a) * 0.9, 0.7, Math.sin(a) * 0.8], [Math.cos(a) * 1.0, 0.1, Math.sin(a) * 0.95]], (t) => [0.09 * (1 - t) + 0.01, 0.01], { steps: 10, radial: 4 }), m));
    }
    return { group: g };
}
