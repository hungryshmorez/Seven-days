/**
 * The shared "look" layer. Chapters build their worlds from plain primitives and
 * flat colours; this module upgrades them without touching any chapter's
 * staging or timing:
 *
 *   - surface detail: every MeshStandardMaterial gets world-space (triplanar)
 *     grime, blotches, water streaks down walls, stains, roughness variation
 *     and a fine bump, from one small tileable noise texture generated at boot
 *   - shadows: solid meshes cast/receive shadows from the bodycam light
 *   - the bodycam light: a shoulder-mounted lamp that follows the view, so the
 *     dark chapters are dark but readable
 *   - dust: motes that only show inside that lamp's beam
 *
 * Anything that should stay flat (screens, signage, UI-ish meshes) can opt out
 * with `mesh.userData.look = 0` or `material.userData.look = 0` (0..1 strength).
 */
import * as THREE from 'three';

/** Per-chapter tuning. `exposure` scales the whole image before tone mapping. */
export interface ChapterLook {
    exposure: number;
    bloom: number;
    /** Bodycam lamp intensity (candela). 0 = no lamp. */
    lamp: number;
    lampColor?: number;
    /** Dust motes in the lamp beam, 0..1. */
    dust: number;
}

export const DEFAULT_LOOK: ChapterLook = { exposure: 1.5, bloom: 0.55, lamp: 40, dust: 0.6 };

/** Tuned against captured frames of every chapter (tests/capture). */
export const LOOKS: Record<string, Partial<ChapterLook>> = {
    prologue: {},
    day1: {},
    day2: { lampColor: 0xffe2c0 },
    day3: {},
    day4: {},
    day5: {},
    day6: { exposure: 1.0, bloom: 0.45, lamp: 0, dust: 0.2 },
    day7: {},
    hospital: { exposure: 1.2, lamp: 14, lampColor: 0xe8fff6 },
    hospitalFatal: { exposure: 1.2, lamp: 14, lampColor: 0xe8fff6 },
    pulse: { exposure: 1.2, lamp: 18 },
};

export function lookFor(id: string): ChapterLook {
    return { ...DEFAULT_LOOK, ...(LOOKS[id] ?? {}) };
}

// ---------------------------------------------------------------- noise texture

/** Periodic value noise on an n×n lattice, sampled at (x,y) in [0,1). */
function makeLattice(n: number, rnd: () => number) {
    const g = new Float32Array(n * n);
    for (let i = 0; i < g.length; i++) g[i] = rnd();
    return (x: number, y: number, fx: number, fy: number) => {
        const X = x * fx, Y = y * fy;
        const x0 = Math.floor(X), y0 = Math.floor(Y);
        const tx = X - x0, ty = Y - y0;
        const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
        const at = (i: number, j: number) => g[(((j % fy) + fy) % fy % n) * n + (((i % fx) + fx) % fx % n)];
        const a = at(x0, y0), b = at(x0 + 1, y0), c = at(x0, y0 + 1), d = at(x0 + 1, y0 + 1);
        return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
    };
}

let noiseTex: THREE.DataTexture | null = null;
/** 256² tileable RGBA: R large blotches, G fine grain, B vertical streaks, A stain spots. */
export function lookNoise(): THREE.DataTexture {
    if (noiseTex) return noiseTex;
    const N = 256;
    let seed = 1337;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const lat = makeLattice(256, rnd);
    const fbm = (x: number, y: number, f0: number, oct: number, fyMul = 1) => {
        let s = 0, a = 0.5, f = f0, norm = 0;
        for (let o = 0; o < oct; o++) { s += a * lat(x, y, f, f * fyMul); norm += a; a *= 0.5; f *= 2; }
        return s / norm;
    };
    const data = new Uint8Array(N * N * 4);
    for (let j = 0; j < N; j++) {
        for (let i = 0; i < N; i++) {
            const x = i / N, y = j / N;
            const r = fbm(x, y, 4, 5);
            const gr = fbm(x + 0.37, y + 0.11, 32, 3);
            // streaks: fine across, long down (v is height on walls)
            const st = fbm(x + 0.7, y, 48, 2, 1 / 12) * 0.7 + fbm(x, y + 0.5, 96, 1, 1 / 24) * 0.3;
            const sp = fbm(x + 0.21, y + 0.63, 8, 4);
            const k = (j * N + i) * 4;
            data[k] = r * 255; data[k + 1] = gr * 255; data[k + 2] = st * 255; data[k + 3] = sp * 255;
        }
    }
    noiseTex = new THREE.DataTexture(data, N, N, THREE.RGBAFormat);
    noiseTex.wrapS = noiseTex.wrapT = THREE.RepeatWrapping;
    noiseTex.magFilter = THREE.LinearFilter;
    noiseTex.minFilter = THREE.LinearMipmapLinearFilter;
    noiseTex.generateMipmaps = true;
    noiseTex.colorSpace = THREE.NoColorSpace;
    noiseTex.needsUpdate = true;
    return noiseTex;
}

// ---------------------------------------------------------------- material patch

const PATCHED = '__lookPatched';

const vertDecl = /* glsl */ `
varying vec3 vLookPos;
varying vec3 vLookN;
`;
const vertBody = /* glsl */ `
{
    vec4 lookWP = vec4(transformed, 1.0);
    vec3 lookN = objectNormal;
    #ifdef USE_INSTANCING
        lookWP = instanceMatrix * lookWP;
        lookN = mat3(instanceMatrix) * lookN;
    #endif
    vLookPos = (modelMatrix * lookWP).xyz;
    vLookN = normalize(mat3(modelMatrix) * lookN);
}
`;
const fragDecl = /* glsl */ `
uniform sampler2D tLookNoise;
uniform float uLookAmt;
varying vec3 vLookPos;
varying vec3 vLookN;
vec4 lookTri(float s, vec3 w) {
    vec3 p = vLookPos * s;
    return texture2D(tLookNoise, vec2(p.z, p.y)) * w.x
         + texture2D(tLookNoise, p.xz) * w.y
         + texture2D(tLookNoise, vec2(p.x, p.y)) * w.z;
}
`;
const fragColor = /* glsl */ `
// Chapters authored very dark albedos to fake darkness; real night footage is dim *light* on
// ordinary surfaces. Lift the darkest albedos so lamps and moonlight have something to reveal.
diffuseColor.rgb = pow(max(diffuseColor.rgb, vec3(0.0)), vec3(0.8));
vec3 lookNn = normalize(vLookN);
vec3 lookW = pow(abs(lookNn), vec3(4.0));
lookW /= (lookW.x + lookW.y + lookW.z);
#if LOOK_KIND == 4
vec4 lookA = lookTri(0.09, lookW);
#else
vec4 lookA = lookTri(0.21, lookW);
#endif
vec4 lookB = lookTri(1.07, lookW);
float lookVert = 1.0 - abs(lookNn.y);
float lookStreak = smoothstep(0.52, 0.82, lookB.b) * lookVert * smoothstep(0.35, 0.7, lookA.g);
float lookStain = smoothstep(0.6, 0.78, lookA.a);
float lookH = lookA.r * 0.55 + lookB.g * 0.45 - lookStain * 0.25 + lookStreak * 0.15;
float lookBumpK = 0.02;
float lookRoughK = 1.0;
vec3 lookCol = diffuseColor.rgb * (0.7 + 0.55 * lookA.r) * (0.86 + 0.28 * lookB.g) * (1.0 - 0.38 * lookStreak - 0.3 * lookStain);
#if LOOK_KIND == 1
{   // wood: boards (horizontal on walls, along x on floors), per-board tone, grain, dark grooves
    float coord = lookVert > 0.5 ? vLookPos.y : (lookW.x > lookW.z ? vLookPos.z : vLookPos.x) ;
    float along = lookVert > 0.5 ? (lookW.x > lookW.z ? vLookPos.z : vLookPos.x) : (lookW.x > lookW.z ? vLookPos.x : vLookPos.z);
    float bd = coord * 4.0;
    float board = fract(bd);
    float id = floor(bd);
    float tone = fract(sin(id * 91.7) * 4375.85);
    float groove = 1.0 - smoothstep(0.0, 0.06, board) * smoothstep(1.0, 0.94, board);
    float grain = sin((board * 9.0 + lookA.r * 3.0 + along * 0.15) * 6.2831) * 0.5 + 0.5;
    lookCol = diffuseColor.rgb * (0.75 + 0.4 * tone) * (0.85 + 0.2 * grain) * (1.0 - 0.65 * groove) * (0.85 + 0.3 * lookA.r) * (1.0 - 0.35 * lookStain);
    lookH = grain * 0.15 - groove * 1.2 + lookB.g * 0.2;
    lookBumpK = 0.035;
}
#elif LOOK_KIND == 2
{   // foliage: clumpy light/dark masses, hue drift, deep bump
    float clump = lookB.g * 0.65 + lookA.r * 0.35;
    lookCol = diffuseColor.rgb * (0.45 + 1.1 * clump) * mix(vec3(1.0), vec3(1.15, 1.1, 0.75), lookA.g * 0.6);
    lookH = clump;
    lookBumpK = 0.06;
}
#elif LOOK_KIND == 3
{   // metal: rust blooms and streaks, scratches
    float rust = smoothstep(0.5, 0.72, lookA.a * 0.7 + lookB.g * 0.3 + lookStreak * 0.4);
    vec3 rustCol = vec3(0.22, 0.075, 0.025) * (0.6 + 0.8 * lookB.g);
    lookCol = mix(diffuseColor.rgb * (0.8 + 0.35 * lookA.r), rustCol, rust * 0.85);
    lookRoughK = 1.0 + rust * 1.5;
    lookH = rust * 0.6 + lookB.g * 0.2;
    lookBumpK = 0.025;
}
#elif LOOK_KIND == 4
{   // ground: dirt tone, grit, and damp patches that catch the lamp
    float wet = smoothstep(0.66, 0.8, lookA.a);
    lookCol = diffuseColor.rgb * (0.55 + 0.8 * lookA.r) * (0.75 + 0.5 * lookB.g) * (1.0 - 0.35 * wet);
    lookRoughK = 1.0 - wet * 0.7;
    lookH = lookB.g * 0.7 + lookA.r * 0.3 - wet * 0.4;
    lookBumpK = 0.04;
}
#endif
diffuseColor.rgb = mix(diffuseColor.rgb, lookCol, uLookAmt);
`;
const fragRough = /* glsl */ `
roughnessFactor = clamp(mix(roughnessFactor, roughnessFactor * lookRoughK * (0.72 + 0.56 * lookB.g) - 0.28 * lookStain, uLookAmt), 0.04, 1.0);
`;
const fragBump = /* glsl */ `
{
    vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
    float dhx = dFdx(lookH) * lookBumpK * uLookAmt, dhy = dFdy(lookH) * lookBumpK * uLookAmt;
    vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
    float det = dot(dpdx, r1);
    vec3 grad = sign(det) * (dhx * r1 + dhy * r2);
    normal = normalize(abs(det) * normal - grad);
}
`;

/** Surface family, guessed from colour, metalness and shape. Override with userData.lookKind. */
export enum LookKind { Generic = 0, Wood = 1, Foliage = 2, Metal = 3, Ground = 4 }
const hsl = { h: 0, s: 0, l: 0 };
const up = new THREE.Vector3();
function kindFor(mesh: THREE.Mesh, m: THREE.MeshStandardMaterial): LookKind {
    const own = (m.userData.lookKind ?? mesh.userData.lookKind) as LookKind | undefined;
    if (own !== undefined) return own;
    if (m.metalness >= 0.45) return LookKind.Metal;
    const type = (mesh.geometry as { type?: string }).type ?? '';
    m.color.getHSL(hsl);
    if (type === 'PlaneGeometry' || type === 'CircleGeometry') {
        const n = mesh.geometry.getAttribute('normal');
        mesh.updateWorldMatrix(true, false);
        if (n) up.fromBufferAttribute(n as THREE.BufferAttribute, 0).transformDirection(mesh.matrixWorld);
        mesh.geometry.computeBoundingSphere();
        const size = (mesh.geometry.boundingSphere?.radius ?? 0) * mesh.matrixWorld.getMaxScaleOnAxis();
        if (n && up.y > 0.8 && size > 5) return LookKind.Ground;
    }
    if (hsl.h > 0.2 && hsl.h < 0.5 && hsl.s > 0.12 && /Cone|Sphere|Dodecahedron|Icosahedron/.test(type)) return LookKind.Foliage;
    if (hsl.h > 0.02 && hsl.h < 0.13 && hsl.s > 0.18 && hsl.l < 0.5 && /Box|Cylinder/.test(type)) return LookKind.Wood;
    return LookKind.Generic;
}

function strengthFor(mesh: THREE.Mesh, m: THREE.MeshStandardMaterial): number {
    const own = (m.userData.look ?? mesh.userData.look) as number | undefined;
    if (typeof own === 'number') return own;
    let s = 1;
    if (m.map) s *= 0.35;               // signage, posters, painted textures: keep them legible
    if (m.transparent && m.opacity < 0.6) s *= 0.3;
    const e = m.emissive;
    if (e && m.emissiveIntensity * Math.max(e.r, e.g, e.b) > 0.3) s *= 0.4; // glowing panels
    return s;
}

/** Add the surface-detail layer to one material (idempotent). */
export function patchMaterial(m: THREE.MeshStandardMaterial, amount: number, kind: LookKind = LookKind.Generic) {
    if ((m as any)[PATCHED]) return;
    (m as any)[PATCHED] = true;
    const uAmt = { value: amount };
    m.userData.lookAmt = uAmt;
    const prev = m.onBeforeCompile;
    m.onBeforeCompile = (shader, renderer) => {
        prev?.call(m, shader, renderer);
        shader.uniforms.tLookNoise = { value: lookNoise() };
        shader.uniforms.uLookAmt = uAmt;
        shader.defines = { ...(shader.defines ?? {}), LOOK_KIND: kind };
        shader.vertexShader = vertDecl + shader.vertexShader.replace('#include <project_vertex>', '#include <project_vertex>\n' + vertBody);
        shader.fragmentShader = fragDecl + shader.fragmentShader
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + fragColor)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + fragRough)
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + fragBump);
    };
    const prevKey = m.customProgramCacheKey.bind(m);
    m.customProgramCacheKey = () => prevKey() + '|look2.' + kind;
    m.needsUpdate = true;
}

/** Big flat ground/sky planes cast nothing useful; everything else solid does. */
function castsShadow(mesh: THREE.Mesh, m: THREE.Material): boolean {
    if (m.transparent || (m as THREE.MeshStandardMaterial).isMeshStandardMaterial !== true) return false;
    const g = mesh.geometry as THREE.BufferGeometry & { type: string };
    return g.type !== 'PlaneGeometry' && g.type !== 'CircleGeometry' && g.type !== 'RingGeometry';
}

// ---------------------------------------------------------------- dust in the beam

const dustVert = /* glsl */ `
uniform float uTime, uSize;
uniform vec3 uCam;
attribute float aSeed;
varying float vA;
uniform vec3 uFwd;
void main() {
    // wrap each mote into a 10m box around the camera, drifting slowly
    vec3 p = position + vec3(sin(uTime*0.13 + aSeed*6.0)*0.6, -uTime*0.05*(0.4+aSeed), cos(uTime*0.11 + aSeed*4.0)*0.6);
    p = uCam + mod(p - uCam + 5.0, 10.0) - 5.0;
    vec3 d = p - uCam;
    float dist = length(d);
    float inBeam = smoothstep(0.82, 0.97, dot(d / max(dist, 1e-3), uFwd));
    vA = inBeam * smoothstep(0.3, 1.0, dist) * (1.0 - smoothstep(3.5, 8.0, dist)) * (0.5 + 0.5*sin(uTime*2.0 + aSeed*30.0));
    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = uSize * (0.5 + aSeed) / -mv.z;
}`;
const dustFrag = /* glsl */ `
uniform vec3 uColor;
uniform float uAmt;
varying float vA;
void main() {
    vec2 q = gl_PointCoord - 0.5;
    float a = smoothstep(0.5, 0.0, length(q)) * vA * uAmt * 0.35;
    if (a < 0.003) discard;
    gl_FragColor = vec4(uColor * a, 1.0);
}`;

// ---------------------------------------------------------------- sky dome

const skyVert = /* glsl */ `
varying vec3 vDir;
void main() {
    vDir = normalize(position);
    vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    gl_Position = p.xyww; // pinned to the far plane
}`;
const skyFrag = /* glsl */ `
uniform vec3 uHorizon, uZenith, uGlowDir, uGlowCol;
uniform float uTime;
uniform sampler2D tNoise;
varying vec3 vDir;
void main() {
    vec3 d = normalize(vDir);
    float h = clamp(d.y, -1.0, 1.0);
    vec3 col = mix(uHorizon, uZenith, smoothstep(0.0, 0.55, h));
    col = mix(col, uHorizon * 0.8, smoothstep(0.0, -0.2, h));   // below the horizon: ground haze
    // thin, slow cloud banks lit faintly from the moon side
    vec2 cp = d.xz / max(h + 0.25, 0.08) * 0.35 + vec2(uTime * 0.004, 0.0);
    float cl = texture2D(tNoise, cp).r * 0.7 + texture2D(tNoise, cp * 3.1).g * 0.3;
    float cloud = smoothstep(0.45, 0.75, cl) * smoothstep(0.0, 0.25, h) * (1.0 - smoothstep(0.6, 1.0, h));
    float g = max(dot(d, uGlowDir), 0.0);
    col += uGlowCol * (pow(g, 24.0) * 0.6 + pow(g, 4.0) * 0.12);
    col = mix(col, uHorizon * 1.6 + uGlowCol * pow(g, 3.0) * 0.4, cloud * 0.55);
    gl_FragColor = vec4(col, 1.0);
}`;

// ---------------------------------------------------------------- the layer

export class LookLayer {
    readonly look: ChapterLook;
    readonly lamp: THREE.SpotLight | null = null;
    private seen = new WeakSet<THREE.Object3D>();
    private scanT = 0;
    private dust: THREE.Points | null = null;
    private dustMat: THREE.ShaderMaterial | null = null;
    private fwd = new THREE.Vector3();
    private sky: THREE.Mesh | null = null;
    private skyMat: THREE.ShaderMaterial | null = null;
    private litFogs = new WeakSet<object>();
    private ray = new THREE.Raycaster();
    private rayT = 0;
    private iris = 1;
    private irisTarget = 1;
    lastHits = 0;
    /** Chest/shoulder mount, offset from the lens so shadows read. */
    private static LAMP_AT = new THREE.Vector3(0.28, -0.18, 0.05);
    private static LAMP_AIM = new THREE.Vector3(0.05, -0.05, -4);

    constructor(private scene: THREE.Scene, private camera: THREE.PerspectiveCamera, episodeId: string, private renderer: THREE.WebGLRenderer) {
        this.look = lookFor(episodeId);
        if (this.look.lamp > 0) {
            const lamp = new THREE.SpotLight(this.look.lampColor ?? 0xfff1dc, this.look.lamp, 22, 0.62, 0.75, 2);
            lamp.castShadow = true;
            lamp.shadow.mapSize.set(512, 512);
            lamp.shadow.bias = -0.0015;
            lamp.shadow.normalBias = 0.06;
            lamp.shadow.radius = 3;
            lamp.shadow.camera.near = 0.2;
            lamp.shadow.camera.far = 22;
            // Lives in the scene (not under the camera) and is re-posed every frame; chapters that
            // hide all scene children for a cut can't switch it off by accident.
            lamp.userData.look = 0;
            scene.add(lamp, lamp.target);
            (this as { lamp: THREE.SpotLight | null }).lamp = lamp;
            renderer.shadowMap.enabled = true;
            renderer.shadowMap.type = THREE.PCFShadowMap;
        }
        if (this.look.dust > 0 && this.look.lamp > 0) {
            const n = 420;
            const pos = new Float32Array(n * 3), seed = new Float32Array(n);
            for (let i = 0; i < n; i++) {
                pos[i * 3] = Math.random() * 10; pos[i * 3 + 1] = Math.random() * 10; pos[i * 3 + 2] = Math.random() * 10;
                seed[i] = Math.random();
            }
            const g = new THREE.BufferGeometry();
            g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
            g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
            this.dustMat = new THREE.ShaderMaterial({
                uniforms: { uTime: { value: 0 }, uSize: { value: 9 }, uCam: { value: new THREE.Vector3() }, uFwd: { value: new THREE.Vector3(0, 0, -1) },
                    uColor: { value: new THREE.Color(this.look.lampColor ?? 0xfff1dc).multiplyScalar(0.9) }, uAmt: { value: this.look.dust } },
                vertexShader: dustVert, fragmentShader: dustFrag,
                transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
            });
            this.dust = new THREE.Points(g, this.dustMat);
            this.dust.frustumCulled = false;
            this.dust.userData.look = 0;
            scene.add(this.dust);
        }
        this.skyMat = new THREE.ShaderMaterial({
            uniforms: { uHorizon: { value: new THREE.Color() }, uZenith: { value: new THREE.Color() }, uGlowDir: { value: new THREE.Vector3(0, 1, 0) },
                uGlowCol: { value: new THREE.Color(0, 0, 0) }, uTime: { value: 0 }, tNoise: { value: lookNoise() } },
            vertexShader: skyVert, fragmentShader: skyFrag, side: THREE.BackSide, depthWrite: false, fog: false,
        });
        this.sky = new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), this.skyMat);
        this.sky.frustumCulled = false;
        this.sky.renderOrder = -1000;
        this.sky.userData.look = 0;
        scene.add(this.sky);
        this.scan();
    }

    /**
     * Auto-iris for the lamp: a fixed-power light blows a seat back 40 cm away to white. A few times a
     * second, find the nearest visible surface ahead and scale the lamp so near surfaces sit in range.
     */
    private updateIris(dt: number) {
        this.rayT -= dt;
        if (this.rayT <= 0) {
            this.rayT = 0.2;
            this.camera.getWorldPosition(this.ray.ray.origin);
            this.camera.getWorldDirection(this.ray.ray.direction);
            this.ray.far = 8;
            let d = 8, albedo = 0.1;
            this.lastHits = 0;
            for (const hit of this.ray.intersectObjects(this.scene.children, true)) {
                this.lastHits++;
                const o = hit.object as THREE.Mesh;
                if (!o.isMesh || o === this.sky || (o.material as THREE.Material).transparent) continue;
                let shown = true;
                for (let p: THREE.Object3D | null = o; p && shown; p = p.parent) shown = p.visible;
                if (!shown) continue;
                d = hit.distance;
                const m = (Array.isArray(o.material) ? o.material[0] : o.material) as THREE.MeshStandardMaterial;
                if (m.color) albedo = Math.pow(Math.max(0.005, m.color.r * 0.2126 + m.color.g * 0.7152 + m.color.b * 0.0722), 0.8);
                break;
            }
            // Pick the lamp power that puts the surface it's pointed at around mid-grey on the tape:
            // radiance ≈ I/d² · albedo/π · exposure. Dark surfaces get the full lamp, a cream wall a metre
            // away gets a fraction of it.
            const wanted = (0.45 * Math.PI * d * d) / (this.look.lamp * albedo * this.look.exposure);
            this.irisTarget = THREE.MathUtils.clamp(wanted, 0.004, 1);
        }
        // like a camera's auto-iris: clamp down at once when something fills the frame, open up gently
        this.iris = this.irisTarget < this.iris ? this.irisTarget : this.iris + (this.irisTarget - this.iris) * Math.min(1, dt * 2);
    }

    /**
     * A flat background colour reads as a wall at night. Replace it with a dome: fog-coloured haze at the
     * horizon (so the treeline silhouettes against it), darker overhead, a moon glow toward the scene's key
     * directional light, and faint cloud banks. Fog itself is lifted a touch the first time it's seen, so
     * distance reads as atmosphere rather than as a black void. Indoors the walls simply hide the dome.
     */
    private updateSky(t: number) {
        const sky = this.sky!, u = this.skyMat!.uniforms;
        const bg = this.scene.background as THREE.Color | null;
        sky.visible = !!bg && (bg as THREE.Color).isColor === true;
        if (!sky.visible) return;
        const fog = this.scene.fog as THREE.FogExp2 | THREE.Fog | null;
        if (fog && !this.litFogs.has(fog)) {
            this.litFogs.add(fog);
            const c = fog.color;
            c.setRGB(c.r * 1.35 + 0.002, c.g * 1.35 + 0.002, c.b * 1.35 + 0.003);
        }
        u.uHorizon.value.copy(fog ? fog.color : bg!);
        u.uZenith.value.copy(bg!).multiplyScalar(0.45);
        u.uTime.value = t;
        let key: THREE.DirectionalLight | null = null;
        this.scene.traverseVisible((o) => { if (!key && (o as THREE.DirectionalLight).isDirectionalLight) key = o as THREE.DirectionalLight; });
        const k = key as THREE.DirectionalLight | null;
        if (k) {
            u.uGlowDir.value.copy(k.position).sub(k.target.position).normalize();
            u.uGlowCol.value.copy(k.color).multiplyScalar(Math.min(1, k.intensity) * 0.35);
        } else u.uGlowCol.value.setRGB(0, 0, 0);
        this.camera.getWorldPosition(sky.position);
    }

    /** Upgrade anything the chapter has added since the last scan. Cheap: each object is visited once. */
    scan() {
        this.scene.traverse((o) => {
            const mesh = o as THREE.Mesh;
            if (!mesh.isMesh) {
                this.seen.add(o);
                return;
            }
            // Re-check a mesh whenever the chapter swaps its material.
            if (this.seen.has(o) && mesh.userData.__lookMat === mesh.material) return;
            this.seen.add(o);
            mesh.userData.__lookMat = mesh.material;
            const mats = ([] as THREE.Material[]).concat(mesh.material as THREE.Material | THREE.Material[]);
            let solid = false;
            for (const m of mats) {
                const sm = m as THREE.MeshStandardMaterial;
                if (!sm.isMeshStandardMaterial) continue;
                const amt = strengthFor(mesh, sm);
                if (amt > 0) patchMaterial(sm, amt, kindFor(mesh, sm));
                if (castsShadow(mesh, sm)) solid = true;
            }
            if (mats.some((m) => (m as THREE.MeshStandardMaterial).isMeshStandardMaterial)) mesh.receiveShadow = true;
            if (solid && mesh.userData.castShadow !== false) mesh.castShadow = true;
        });
    }

    update(dt: number, t: number) {
        this.camera.updateMatrixWorld();
        if (this.lamp) {
            this.updateIris(dt);
            this.lamp.intensity = this.look.lamp * this.iris;
            this.lamp.visible = true;
            this.lamp.position.copy(LookLayer.LAMP_AT).applyMatrix4(this.camera.matrixWorld);
            this.lamp.target.position.copy(LookLayer.LAMP_AIM).applyMatrix4(this.camera.matrixWorld);
            this.lamp.target.updateMatrixWorld();
        }
        if (this.dust) this.dust.visible = true;
        this.updateSky(t);
        this.scanT -= dt;
        if (this.scanT <= 0) { this.scanT = 0.5; this.scan(); }
        if (this.dustMat) {
            const u = this.dustMat.uniforms;
            u.uTime.value = t;
            this.camera.getWorldPosition(u.uCam.value);
            this.camera.getWorldDirection(this.fwd);
            u.uFwd.value.copy(this.fwd);
            u.uSize.value = 9 * this.renderer.getPixelRatio();
        }
    }

    dispose() {
        this.dust?.geometry.dispose();
        this.dustMat?.dispose();
        this.lamp?.dispose();
        this.sky?.geometry.dispose();
        this.skyMat?.dispose();
    }
}
