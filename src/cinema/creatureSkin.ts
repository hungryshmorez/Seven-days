/**
 * Creature skin: turns a chapter's primitive creature (cylinders, cones, spheres
 * in flat unlit colours) into something with a body, without touching its shape
 * hierarchy or scripted motion.
 *
 *   - geometry: low-segment primitives are rebuilt with enough segments to bend
 *     (keeping any translate the chapter applied to the geometry)
 *   - flesh: unlit dark materials become lit, wet, wrinkled skin with veins; a
 *     slow sub-surface writhe breaks up the silhouette; a cold rim light keeps the
 *     outline readable against black
 *   - features: bright unlit details (lamps, grins) are kept unlit but pushed into
 *     HDR so they bloom; neutral greys (blades) become worn metal
 *
 * Materials are cloned per creature mesh and re-synced from the original every
 * frame (colour, opacity, visibility), so chapter code that animates or swaps the
 * original material keeps working.
 */
import * as THREE from 'three';
import { lookNoise } from './look.ts';

const SKIN_KEY = '__creatureSkin';

const vertDecl = /* glsl */ `
uniform sampler2D tLookNoise;
uniform float uCTime, uCAmp, uCFreq;
varying vec3 vCPos;
varying vec3 vCNrm;
`;
const vertBody = /* glsl */ `
{
    vec3 cdir = normalize(position + vec3(1e-4));
    float cn = texture2D(tLookNoise, position.xy * uCFreq + vec2(uCTime * 0.035, 0.0)).r * 0.5
             + texture2D(tLookNoise, position.zy * uCFreq + vec2(0.0, uCTime * 0.025)).r * 0.5;
    transformed += cdir * (cn - 0.5) * uCAmp;
    vCPos = position;
    vCNrm = normal;
}
`;
const fragDecl = /* glsl */ `
uniform sampler2D tLookNoise;
uniform float uCFreq, uCRim, uCVein;
uniform vec3 uCRimColor;
varying vec3 vCPos;
varying vec3 vCNrm;
vec4 cTri(vec3 p) {
    vec3 w = pow(abs(normalize(vCNrm)), vec3(3.0));
    w /= (w.x + w.y + w.z);
    return texture2D(tLookNoise, p.zy) * w.x + texture2D(tLookNoise, p.xz + 0.37) * w.y + texture2D(tLookNoise, p.xy + 0.71) * w.z;
}
`;
const fragColor = /* glsl */ `
vec4 cw = cTri(vCPos * uCFreq * 0.55);
float cVein = (1.0 - smoothstep(0.0, 0.03, abs(cw.a - 0.5))) * uCVein;
diffuseColor.rgb *= 0.75 + 0.35 * cw.g + 0.25 * cw.r;
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.09, 0.012, 0.01), cVein * 0.6);
`;
const fragRough = /* glsl */ `
roughnessFactor = clamp(roughnessFactor * (0.6 + 0.5 * cw.r), 0.25, 1.0); // wet in the folds
`;
const fragBump = /* glsl */ `
{
    float ch = cw.g * 0.7 + cw.r * 0.3 + cVein * 0.4;
    vec3 dpdx = dFdx(-vViewPosition), dpdy = dFdy(-vViewPosition);
    float dhx = dFdx(ch) * 0.012, dhy = dFdy(ch) * 0.012;
    vec3 r1 = cross(dpdy, normal), r2 = cross(normal, dpdx);
    float det = dot(dpdx, r1);
    normal = normalize(abs(det) * normal - sign(det) * (dhx * r1 + dhy * r2));
}
`;
const fragRim = /* glsl */ `
{
    float fres = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 3.0);
    totalEmissiveRadiance += uCRimColor * fres * uCRim;
}
`;

/** Shared clock for every creature's writhe. */
const time = { value: 0 };
export function tickCreatureSkins(t: number) { time.value = t; }

export function makeFleshMaterial(color: THREE.ColorRepresentation, opts: { roughness?: number; metalness?: number; amp?: number; rim?: number; veins?: number } = {}) {
    const m = new THREE.MeshStandardMaterial({ color, roughness: opts.roughness ?? 0.6, metalness: opts.metalness ?? 0 });
    fleshify(m, opts.amp ?? 0.03, opts.rim ?? 1, opts.veins ?? 1);
    return m;
}

function fleshify(m: THREE.MeshStandardMaterial, amp: number, rim: number, veins: number) {
    const u = {
        uCAmp: { value: amp }, uCFreq: { value: 0.9 }, uCRim: { value: 0.07 * rim }, uCVein: { value: veins },
        uCRimColor: { value: new THREE.Color(0x9fb4d8) },
    };
    m.userData[SKIN_KEY] = u;
    m.userData.look = 0; // the world-surface layer must not also grime creature skin
    m.onBeforeCompile = (shader) => {
        Object.assign(shader.uniforms, u, { tLookNoise: { value: lookNoise() }, uCTime: time });
        shader.vertexShader = vertDecl + shader.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + vertBody);
        shader.fragmentShader = fragDecl + shader.fragmentShader
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + fragColor)
            .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\n' + fragRough)
            .replace('#include <normal_fragment_maps>', '#include <normal_fragment_maps>\n' + fragBump)
            .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\n' + fragRim);
    };
    m.customProgramCacheKey = () => 'creatureSkin1';
    m.needsUpdate = true;
}

// ---------------------------------------------------------------- geometry

const bbA = new THREE.Box3(), bbB = new THREE.Box3();
const sizeA = new THREE.Vector3(), sizeB = new THREE.Vector3(), cA = new THREE.Vector3(), cB = new THREE.Vector3();

/** Same primitive, more segments. Returns null when it can't be rebuilt faithfully. */
export function smoother(g: THREE.BufferGeometry): THREE.BufferGeometry | null {
    const p = (g as unknown as { parameters?: Record<string, number & boolean> }).parameters;
    if (!p) return null;
    let n: THREE.BufferGeometry | null = null;
    const along = (h: number, r: number) => Math.min(24, Math.max(p.heightSegments ?? 1, Math.ceil(h / Math.max(0.05, r * 0.7))));
    switch (g.type) {
        case 'CylinderGeometry':
            n = new THREE.CylinderGeometry(p.radiusTop, p.radiusBottom, p.height, Math.max(p.radialSegments, 18),
                along(p.height, Math.max(p.radiusTop, p.radiusBottom)), p.openEnded, p.thetaStart, p.thetaLength);
            break;
        case 'ConeGeometry':
            n = new THREE.ConeGeometry(p.radius, p.height, Math.max(p.radialSegments, 18), along(p.height, p.radius), p.openEnded, p.thetaStart, p.thetaLength);
            break;
        case 'SphereGeometry':
            n = new THREE.SphereGeometry(p.radius, Math.max(p.widthSegments, 28), Math.max(p.heightSegments, 18), p.phiStart, p.phiLength, p.thetaStart, p.thetaLength);
            break;
        case 'CapsuleGeometry':
            n = new THREE.CapsuleGeometry(p.radius, p.height ?? p.length, Math.max(p.capSegments, 6), Math.max(p.radialSegments, 18), Math.max(p.heightSegments ?? 1, 8));
            break;
        case 'TorusGeometry':
            n = new THREE.TorusGeometry(p.radius, p.tube, Math.max(p.radialSegments, 10), Math.max(p.tubularSegments, 40), p.arc);
            break;
        default:
            return null;
    }
    g.computeBoundingBox(); n.computeBoundingBox();
    bbA.copy(g.boundingBox!); bbB.copy(n.boundingBox!);
    bbA.getSize(sizeA); bbB.getSize(sizeB);
    // A rotated or scaled geometry no longer matches its parameters: leave it alone.
    if (sizeA.distanceTo(sizeB) > 1e-3 * Math.max(1, sizeA.length())) { n.dispose(); return null; }
    bbA.getCenter(cA); bbB.getCenter(cB);
    n.translate(cA.x - cB.x, cA.y - cB.y, cA.z - cB.z);
    return n;
}

// ---------------------------------------------------------------- skin a creature

interface Skinned { mesh: THREE.Mesh; orig: THREE.Material; clone: THREE.Material; kind: 'flesh' | 'feature' | 'metal' | 'none' }

const lum = (c: THREE.Color) => c.r * 0.2126 + c.g * 0.7152 + c.b * 0.0722;

function makeClone(orig: THREE.Material, mesh: THREE.Mesh): Skinned | null {
    const basic = orig as THREE.MeshBasicMaterial, std = orig as THREE.MeshStandardMaterial;
    const radius = (mesh.geometry.computeBoundingSphere(), mesh.geometry.boundingSphere?.radius ?? 0.5);
    const amp = Math.min(0.08, radius * 0.07);
    if (basic.isMeshBasicMaterial) {
        const c = basic.color;
        const l = lum(c);
        const hsl = c.getHSL({ h: 0, s: 0, l: 0 });
        if (basic.fog === false || l > 0.45) {
            // glowing detail: stays unlit, pushed past white so the bloom catches it
            const f = basic.clone();
            f.color.copy(c).multiplyScalar(2.2);
            return { mesh, orig, clone: f, kind: 'feature' };
        }
        if (hsl.s < 0.12 && l > 0.15) {
            const m = new THREE.MeshStandardMaterial({ color: c.clone(), metalness: 0.75, roughness: 0.38 });
            m.userData.lookKind = 3; // the world layer treats it as metal (rust, scratches)
            return { mesh, orig, clone: m, kind: 'metal' };
        }
        const m = makeFleshMaterial(c.clone().addScalar(0.006), { amp, roughness: 0.55 });
        m.transparent = basic.transparent; m.opacity = basic.opacity; m.side = basic.side;
        return { mesh, orig, clone: m, kind: 'flesh' };
    }
    if (std.isMeshStandardMaterial) {
        if (std.metalness >= 0.45) return null; // metal parts get the world layer's rust
        const m = std.clone();
        fleshify(m, amp, 1, (std.userData.creatureVeins as number | undefined) ?? 0.7);
        return { mesh, orig, clone: m, kind: 'flesh' };
    }
    return null;
}

function sync(s: Skinned) {
    const o = s.orig as THREE.MeshBasicMaterial, c = s.clone as THREE.MeshBasicMaterial;
    if (s.kind === 'feature') c.color.copy(o.color).multiplyScalar(2.2);
    else if (s.kind === 'flesh' && (o as THREE.MeshBasicMaterial).isMeshBasicMaterial) c.color.copy(o.color).addScalar(0.006);
    else c.color.copy(o.color);
    c.opacity = o.opacity;
    c.transparent = o.transparent;
    c.visible = o.visible;
}

/**
 * Upgrade every mesh in a creature. Meshes marked `userData.creaturePart` (eyes, teeth, limbs
 * the horror pass built itself) are skipped. Returns a per-frame sync function.
 */
export function skinCreature(root: THREE.Object3D): () => void {
    const skinned: Skinned[] = [];
    const visit = (o: THREE.Object3D) => {
        const mesh = o as THREE.Mesh;
        if (!mesh.isMesh || mesh.userData.creaturePart) return;
        const g = smoother(mesh.geometry);
        if (g) mesh.geometry = g;
        if (Array.isArray(mesh.material)) return;
        const s = makeClone(mesh.material, mesh);
        if (!s) return;
        mesh.material = s.clone;
        mesh.castShadow = true;
        skinned.push(s);
    };
    root.traverse(visit);
    return () => {
        for (const s of skinned) {
            if (s.mesh.material !== s.clone) {
                // the chapter swapped this material: adopt the new one
                const mat = s.mesh.material as THREE.Material;
                const next = makeClone(mat, s.mesh);
                if (next) { s.orig = next.orig; s.clone = next.clone; s.kind = next.kind; s.mesh.material = s.clone; }
                else { s.orig = s.clone = mat; s.kind = 'none'; }
            }
            if (s.kind !== 'none') sync(s);
        }
    };
}
