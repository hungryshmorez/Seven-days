/**
 * Camera pipeline. The scene renders into an HDR target (half-float where the
 * device supports it, so dark gradients don't band), a cheap quarter-res bloom
 * picks out lamps, eyes and screens, and a final full-screen shader applies
 * exposure, filmic tone mapping, a cold-shadow / warm-highlight grade and then
 * the VHS damage: chromatic separation, tracking bands, tearing, tape dropout,
 * luminance bleed, scanlines, grain and fades. All driven by story "corruption".
 */
import * as THREE from 'three';
import type { Fx } from './director.ts';

const vert = 'varying vec2 vUv; void main(){ vUv=uv; gl_Position=vec4(position.xy,0.0,1.0); }';

/** Bright-pass + 4-tap downsample into the bloom target. */
const brightFrag = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uTexel; uniform float uThreshold, uExposure;
varying vec2 vUv;
void main(){
    vec3 c = texture2D(tSrc, vUv + uTexel*vec2(-1.0,-1.0)).rgb + texture2D(tSrc, vUv + uTexel*vec2(1.0,-1.0)).rgb
           + texture2D(tSrc, vUv + uTexel*vec2(-1.0, 1.0)).rgb + texture2D(tSrc, vUv + uTexel*vec2(1.0, 1.0)).rgb;
    c *= 0.25 * uExposure;
    float l = max(c.r, max(c.g, c.b));
    float k = max(l - uThreshold, 0.0) / max(l, 1e-4);
    gl_FragColor = vec4(c * k, 1.0);
}`;

/** 9-tap separable gaussian (linear-sampled), run horizontally then vertically. */
const blurFrag = /* glsl */ `
uniform sampler2D tSrc; uniform vec2 uDir;
varying vec2 vUv;
void main(){
    vec3 c = texture2D(tSrc, vUv).rgb * 0.227;
    c += (texture2D(tSrc, vUv + uDir*1.385).rgb + texture2D(tSrc, vUv - uDir*1.385).rgb) * 0.316;
    c += (texture2D(tSrc, vUv + uDir*3.231).rgb + texture2D(tSrc, vUv - uDir*3.231).rgb) * 0.070;
    gl_FragColor = vec4(c, 1.0);
}`;

const frag = /* glsl */ `
uniform sampler2D tDiffuse, tBloom;
uniform float uTime, uCorr, uTear, uFade, uExposure, uBloom;
uniform vec2 uRes;
varying vec2 vUv;
float h(float n){ return fract(sin(n*12.9898)*43758.5453); }
// Tone curve: exactly linear through the shadows and mids (night footage must not be crushed),
// then a soft exponential shoulder so lamps, eyes and screens roll off instead of clipping.
vec3 filmic(vec3 x){
    x = max(x, 0.0);
    const float k = 0.62;
    vec3 sh = k + (1.0 - k) * (1.0 - exp(-(x - k) / (1.0 - k)));
    return mix(x, sh, step(k, x));
}
vec3 sampleHdr(vec2 uv){ return texture2D(tDiffuse, uv).rgb; }
void main(){
    vec2 uv = vUv;
    float c = uCorr;
    // tracking band rolling up the picture (always visible, stronger at high corruption)
    float bp = fract(uTime*0.11);
    float d = abs(uv.y - bp);
    uv.x += exp(-d*90.0) * (0.0025 + c*0.05) * sin(uv.y*220.0 + uTime*30.0);
    uv.x += sin(uv.y*9.0 + uTime*1.7) * 0.0004;
    // horizontal tearing
    float row = floor(uv.y*38.0);
    float tt = floor(uTime*24.0);
    float tearOn = step(0.55, h(row + tt));
    uv.x += (h(row*1.7 + tt) - 0.5) * (uTear*0.35 + c*c*0.12) * tearOn;
    // frame freeze / ghost at very high corruption
    float ghost = step(0.9, c) * step(0.6, h(tt*0.37));
    uv.y = mix(uv.y, fract(uv.y + 0.02*sin(uTime*3.0)), ghost);
    // chromatic separation
    float off = 0.0012 + c*0.007 + uTear*0.02;
    vec3 col;
    col.r = sampleHdr(uv + vec2(off,0.0)).r;
    col.g = sampleHdr(uv).g;
    col.b = sampleHdr(uv - vec2(off,0.0)).b;
    // luminance bleed (smear to the right)
    vec3 sm = sampleHdr(uv - vec2(0.006,0.0)) + sampleHdr(uv - vec2(0.012,0.0));
    col = mix(col, sm*0.5, 0.10 + c*0.18);
    // exposure, then bloom (tape bloom smears sideways a little, like an old CCD)
    col *= uExposure;
    vec3 bl = texture2D(tBloom, uv).rgb + texture2D(tBloom, uv + vec2(0.004, 0.0)).rgb * 0.5;
    col += bl * uBloom * (1.0 + c*0.6);
    col = filmic(col);
    // grade: cool, slightly green shadows; warm highlights; corruption drains colour
    float lum = dot(col, vec3(0.2126,0.7152,0.0722));
    vec3 shadowTint = vec3(0.90, 1.0, 1.08), highTint = vec3(1.06, 1.0, 0.92);
    col *= mix(shadowTint, highTint, smoothstep(0.05, 0.7, lum));
    col = mix(vec3(lum), col, 0.9 - c*0.4);
    // scanlines
    col *= 1.0 - 0.03*sin(uv.y*uRes.y*1.1);
    // the rolling scan line: a soft bright band you can see but read through
    col += exp(-d*160.0) * 0.035;
    // grain: stronger in the shadows, like a real sensor pushed in the dark
    float g = h(uv.x*91.0 + uv.y*317.0 + uTime) - 0.5;
    col += g * (0.014 + 0.016*(1.0 - smoothstep(0.0, 0.25, lum)) + 0.10*c*c);
    // tape dropout streaks
    float dr = floor(uv.y*140.0);
    float drop = step(0.9985 - c*0.012, h(dr + floor(uTime*7.0))) * step(0.3, h(uv.x*6.0 + dr));
    col = mix(col, vec3(0.85), drop*(0.25 + c*0.35));
    // lens vignette
    vec2 q = vUv - 0.5;
    col *= 1.0 - dot(q,q)*0.85;
    col *= 1.0 - uFade;
    col = pow(max(col, 0.0), vec3(1.0/2.2));
    gl_FragColor = vec4(col, 1.0);
}`;

/** Per-chapter look: overall exposure and bloom strength. Scenes may change fx.exposure live. */
export interface LookTarget { exposure: number; bloom: number }

export class VhsPass {
    private rt: THREE.WebGLRenderTarget;
    private bloomA: THREE.WebGLRenderTarget;
    private bloomB: THREE.WebGLRenderTarget;
    private quadScene = new THREE.Scene();
    private quadCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private mat: THREE.ShaderMaterial;
    private bright: THREE.ShaderMaterial;
    private blur: THREE.ShaderMaterial;
    private quad: THREE.Mesh;
    /** True when the device rendered into a half-float target (no banding in the dark). */
    readonly hdr: boolean;

    constructor(renderer: THREE.WebGLRenderer, w: number, h: number) {
        const ext = renderer.extensions;
        this.hdr = renderer.capabilities.isWebGL2 !== false && (ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float'));
        const type = this.hdr ? THREE.HalfFloatType : THREE.UnsignedByteType;
        this.rt = new THREE.WebGLRenderTarget(w, h, { type, depthBuffer: true });
        const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
        this.bloomA = new THREE.WebGLRenderTarget(bw, bh, { type, depthBuffer: false });
        this.bloomB = new THREE.WebGLRenderTarget(bw, bh, { type, depthBuffer: false });
        this.mat = new THREE.ShaderMaterial({
            uniforms: {
                tDiffuse: { value: this.rt.texture },
                tBloom: { value: this.bloomA.texture },
                uTime: { value: 0 },
                uCorr: { value: 0 },
                uTear: { value: 0 },
                uFade: { value: 0 },
                uExposure: { value: 1 },
                uBloom: { value: 0.6 },
                uRes: { value: new THREE.Vector2(w, h) },
            },
            vertexShader: vert, fragmentShader: frag, depthTest: false, depthWrite: false,
        });
        this.bright = new THREE.ShaderMaterial({
            uniforms: { tSrc: { value: this.rt.texture }, uTexel: { value: new THREE.Vector2(1 / w, 1 / h) }, uThreshold: { value: 0.85 }, uExposure: { value: 1 } },
            vertexShader: vert, fragmentShader: brightFrag, depthTest: false, depthWrite: false,
        });
        this.blur = new THREE.ShaderMaterial({
            uniforms: { tSrc: { value: null }, uDir: { value: new THREE.Vector2() } },
            vertexShader: vert, fragmentShader: blurFrag, depthTest: false, depthWrite: false,
        });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat);
        this.quad.frustumCulled = false;
        this.quadScene.add(this.quad);
    }

    setSize(w: number, h: number) {
        this.rt.setSize(w, h);
        const bw = Math.max(1, w >> 2), bh = Math.max(1, h >> 2);
        this.bloomA.setSize(bw, bh);
        this.bloomB.setSize(bw, bh);
        this.mat.uniforms.uRes.value.set(w, h);
        this.bright.uniforms.uTexel.value.set(1 / w, 1 / h);
    }

    private pass(r: THREE.WebGLRenderer, m: THREE.Material, target: THREE.WebGLRenderTarget | null) {
        this.quad.material = m;
        r.setRenderTarget(target);
        r.render(this.quadScene, this.quadCam);
    }

    render(r: THREE.WebGLRenderer, scene: THREE.Scene, cam: THREE.Camera, time: number, fx: Fx, look: LookTarget) {
        r.setRenderTarget(this.rt);
        r.render(scene, cam);
        const exposure = look.exposure * (fx.exposure ?? 1);
        // bloom: bright-pass at quarter res, then a horizontal and a vertical blur
        this.bright.uniforms.uExposure.value = exposure;
        this.pass(r, this.bright, this.bloomA);
        const bw = this.bloomA.width, bh = this.bloomA.height;
        this.blur.uniforms.tSrc.value = this.bloomA.texture;
        this.blur.uniforms.uDir.value.set(1 / bw, 0);
        this.pass(r, this.blur, this.bloomB);
        this.blur.uniforms.tSrc.value = this.bloomB.texture;
        this.blur.uniforms.uDir.value.set(0, 1 / bh);
        this.pass(r, this.blur, this.bloomA);
        const u = this.mat.uniforms;
        u.uTime.value = time;
        u.uCorr.value = fx.corr;
        u.uTear.value = fx.tear;
        u.uFade.value = fx.fade;
        u.uExposure.value = exposure;
        u.uBloom.value = look.bloom;
        this.pass(r, this.mat, null);
    }

    dispose() {
        this.rt.dispose();
        this.bloomA.dispose();
        this.bloomB.dispose();
        this.mat.dispose();
        this.bright.dispose();
        this.blur.dispose();
        this.quad.geometry.dispose();
    }
}
