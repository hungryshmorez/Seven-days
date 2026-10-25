/**
 * THE MERGE. The last scene of SEVEN DAYS, and the only one that belongs to both games at once.
 *
 * Two rooms are rendered side by side: the found-footage living room with the VCR (the cinematic game) and the grey
 * tape room with the cassette player (the search game, drawn at PSX resolution). One input drives both walkers, who
 * start apart and drift together; they reach their televisions at the same moment and put the tape in together.
 * The picture tears, the two halves slide into one double exposure, a tornado of picture spins the camera, and the
 * view pulls back from a hospital bed: family around it, a steady tone, no heartbeat.
 */
import * as THREE from 'three';
import { companion } from '../search/companions.ts';
import { store } from '../state/store.ts';

type Phase = 'walk' | 'insert' | 'morph' | 'swirl' | 'hospital' | 'out' | 'done';

const ROOM_W = 2.5;      // half width of both rooms
const Z_START = 4.6;
const Z_TV_FRONT = -5.0;  // closest the walker can stand
const TV_Z = -6.35;
const USE_Z = -3.3;

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v));
const smooth = (a: number, b: number, v: number) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Tiny WebAudio kit: room hum, static, thumps, the whoosh of the tornado, sobbing, and the line that does not change. */
class Sound {
    ctx: AudioContext | null = null;
    master!: GainNode;
    private hum?: GainNode;
    private flat?: GainNode;
    private whoosh?: { g: GainNode; f: BiquadFilterNode };
    constructor() {
        try {
            const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
            this.ctx = new AC();
            this.master = this.ctx.createGain(); this.master.gain.value = 0.8; this.master.connect(this.ctx.destination);
        } catch { this.ctx = null; }
    }
    private noiseBuf(sec: number): AudioBuffer {
        const ctx = this.ctx!;
        const b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * sec), ctx.sampleRate);
        const d = b.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        return b;
    }
    startHum(): void {
        const c = this.ctx; if (!c) return;
        const g = c.createGain(); g.gain.value = 0.0; g.connect(this.master);
        for (const f of [50, 100.4, 151]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = c.createGain(); og.gain.value = f === 50 ? 0.5 : 0.18; o.connect(og).connect(g); o.start(); }
        g.gain.linearRampToValueAtTime(0.05, c.currentTime + 3);
        this.hum = g;
    }
    humTo(v: number, s: number): void { if (this.ctx && this.hum) this.hum.gain.linearRampToValueAtTime(v, this.ctx.currentTime + s); }
    tone(freq: number, dur: number, gain: number, type: OscillatorType = 'sine', endFreq?: number): void {
        const c = this.ctx; if (!c) return;
        const o = c.createOscillator(), g = c.createGain(), t = c.currentTime;
        o.type = type; o.frequency.setValueAtTime(freq, t);
        if (endFreq) o.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
        g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g).connect(this.master); o.start(t); o.stop(t + dur + 0.05);
    }
    noise(dur: number, freq: number, gain: number, kind: BiquadFilterType = 'bandpass', q = 1): void {
        const c = this.ctx; if (!c) return;
        const s = c.createBufferSource(); s.buffer = this.noiseBuf(dur);
        const f = c.createBiquadFilter(); f.type = kind; f.frequency.value = freq; f.Q.value = q;
        const g = c.createGain(), t = c.currentTime;
        g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f).connect(g).connect(this.master); s.start(t);
    }
    thump(freq = 60, gain = 0.5): void { this.tone(freq, 0.7, gain, 'sine', freq * 0.4); this.noise(0.15, 160, gain * 0.3, 'lowpass'); }
    click(): void { this.noise(0.05, 2400, 0.25, 'bandpass', 2); }
    staticBurst(dur = 0.8, gain = 0.3): void { this.noise(dur, 3800, gain, 'highpass'); }
    startWhoosh(): void {
        const c = this.ctx; if (!c || this.whoosh) return;
        const s = c.createBufferSource(); s.buffer = this.noiseBuf(4); s.loop = true;
        const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 200; f.Q.value = 2.5;
        const g = c.createGain(); g.gain.value = 0;
        s.connect(f).connect(g).connect(this.master); s.start();
        this.whoosh = { g, f };
    }
    whooshTo(freq: number, gain: number, s = 0.2): void {
        const w = this.whoosh, c = this.ctx; if (!w || !c) return;
        w.f.frequency.linearRampToValueAtTime(freq, c.currentTime + s);
        w.g.gain.linearRampToValueAtTime(gain, c.currentTime + s);
    }
    startFlatline(): void {
        const c = this.ctx; if (!c || this.flat) return;
        const g = c.createGain(); g.gain.value = 0;
        for (const f of [1000, 2003]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = c.createGain(); og.gain.value = f === 1000 ? 1 : 0.12; o.connect(og).connect(g); o.start(); }
        g.connect(this.master);
        g.gain.linearRampToValueAtTime(0.085, c.currentTime + 0.6);
        this.flat = g;
    }
    flatTo(v: number, s: number): void { if (this.ctx && this.flat) this.flat.gain.linearRampToValueAtTime(v, this.ctx.currentTime + s); }
    sob(): void {
        // a short, wet, descending breath, panned
        this.noise(0.5, 520 + Math.random() * 140, 0.09, 'bandpass', 4);
        this.tone(250 + Math.random() * 60, 0.45, 0.025, 'triangle', 170);
    }
    stop(): void {
        try { this.master.gain.linearRampToValueAtTime(0, (this.ctx?.currentTime ?? 0) + 0.3); } catch { /* ignore */ }
        window.setTimeout(() => { void this.ctx?.close(); }, 500);
    }
}

function mat(color: number, rough = 0.9, emissive = 0x000000, intensity = 1): THREE.MeshStandardMaterial {
    return new THREE.MeshStandardMaterial({ color, roughness: rough, emissive, emissiveIntensity: intensity });
}
function lam(color: number, emissive = 0x000000): THREE.MeshLambertMaterial {
    return new THREE.MeshLambertMaterial({ color, emissive });
}
function bx(parent: THREE.Object3D, w: number, h: number, d: number, m: THREE.Material, x: number, y: number, z: number): THREE.Mesh {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
    mesh.position.set(x, y, z); parent.add(mesh); return mesh;
}

function tapeMesh(label: string): THREE.Group {
    const g = new THREE.Group();
    const c = document.createElement('canvas'); c.width = 256; c.height = 128;
    const x = c.getContext('2d')!;
    x.fillStyle = '#d9d2c0'; x.fillRect(0, 0, 256, 128);
    x.fillStyle = '#7a1010'; x.fillRect(0, 0, 256, 26);
    x.fillStyle = '#1a1a1a'; x.font = 'bold 40px monospace'; x.fillText(label, 24, 82);
    x.font = '18px monospace'; x.fillText('SEVEN DAYS', 24, 112);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace;
    const black = new THREE.MeshBasicMaterial({ color: 0x0c0c0c });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.19, 0.03, 0.105), [black, black, new THREE.MeshBasicMaterial({ map: tx }), black, black, black]);
    g.add(body);
    return g;
}

interface Room { scene: THREE.Scene; cam: THREE.PerspectiveCamera; screen: THREE.MeshBasicMaterial; lights: THREE.PointLight[]; tape: THREE.Group; update(t: number, glow: number): void }

/** The found-footage living room: warm lamp, couch, television on a stand, a VCR. */
function buildLivingRoom(): Room {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x07090c);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W * 2 + 0.6, 2.7, 14.4), mat(0x4a4036, 0.95)); (walls.material as THREE.Material).side = THREE.BackSide;
    walls.position.set(0, 1.35, -0.7); scene.add(walls);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2 + 0.6, 14.4), mat(0x2e2218, 0.7)); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.001, -0.7); scene.add(floor);
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 7), mat(0x5a2a22, 1)); rug.rotation.x = -Math.PI / 2; rug.position.set(0, 0.006, -0.4); scene.add(rug);
    // couch on the left wall, a second chair on the right, coffee table
    bx(scene, 0.95, 0.42, 2.2, mat(0x3b4a3a, 0.95), -ROOM_W + 0.2, 0.21, 1.6);
    bx(scene, 0.22, 0.6, 2.2, mat(0x34423a, 0.95), -ROOM_W - 0.2, 0.62, 1.6);
    bx(scene, 0.9, 0.4, 0.9, mat(0x5a3a2c, 0.95), ROOM_W - 0.4, 0.2, -0.6);
    bx(scene, 1.1, 0.06, 0.7, mat(0x5c4430, 0.6), -0.2, 0.44, 0.6);
    bx(scene, 0.8, 1.6, 0.3, mat(0x3a2d20, 0.8), -ROOM_W + 0.3, 0.8, -2.8); // bookshelf
    // television
    bx(scene, 1.5, 0.5, 0.55, mat(0x2a2a2e, 0.5), 0, 0.25, TV_Z + 0.2);
    bx(scene, 0.62, 0.1, 0.4, mat(0x18181a, 0.4), 0, 0.55, TV_Z + 0.22);
    bx(scene, 1.1, 0.85, 0.75, mat(0x1d1d20, 0.5), 0, 1.1, TV_Z);
    const screen = new THREE.MeshBasicMaterial({ color: 0x14202c });
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(0.86, 0.62), screen); sc.position.set(0, 1.1, TV_Z + 0.378); scene.add(sc);
    // lamp
    bx(scene, 0.04, 1.35, 0.04, mat(0x2a2018), ROOM_W - 0.3, 0.7, 2.6);
    const shade = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.28, 10, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd7a0).multiplyScalar(1.4), side: THREE.DoubleSide }));
    shade.position.set(ROOM_W - 0.3, 1.45, 2.6); scene.add(shade);
    const lamp = new THREE.PointLight(0xffc27a, 55, 11, 1.5); lamp.position.set(ROOM_W - 0.3, 1.35, 2.6); scene.add(lamp);
    const lamp2 = new THREE.PointLight(0xffc27a, 30, 9, 1.5); lamp2.position.set(-1.2, 2.2, -1.5); scene.add(lamp2);
    const glow = new THREE.PointLight(0x7fa8ff, 22, 8, 1.6); glow.position.set(0, 1.2, TV_Z + 1.1); scene.add(glow);
    scene.add(new THREE.HemisphereLight(0x9a9aaa, 0x30261c, 2.0));
    const lamp3 = new THREE.PointLight(0xffc27a, 26, 8, 1.5); lamp3.position.set(-1.2, 2.2, -4.2); scene.add(lamp3);
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 40);
    const tape = tapeMesh('TAPE 07'); tape.position.set(0.2, -0.2, -0.45); tape.rotation.set(0.5, 0.35, -0.2); cam.add(tape); scene.add(cam);
    return {
        scene, cam, screen, lights: [glow], tape,
        update(t, g) {
            if (g < 0.01) screen.color.setRGB(0.06 + 0.02 * Math.sin(t * 2.1) + Math.random() * 0.012, 0.11, 0.16);
            else screen.color.setRGB(0.3 + g * 0.7, 0.4 + g * 0.6, 0.55 + g * 0.45);
            glow.intensity = 22 + Math.sin(t * 9) * 2 + g * 34;
        },
    };
}

/** The search game's tape room: concrete, tile, one cold fluorescent, a table with a lamp, a television on a stack. */
function buildTapeRoom(): Room {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    scene.fog = new THREE.Fog(0x05060a, 6, 17);
    const shell = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W * 2 + 0.6, 3.2, 14.4), lam(0x6d7070)); (shell.material as THREE.Material).side = THREE.BackSide;
    shell.position.set(0, 1.6, -0.7); scene.add(shell);
    // checker tile floor
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const x = c.getContext('2d')!; x.fillStyle = '#8c9694'; x.fillRect(0, 0, 64, 64); x.fillStyle = '#6a7472'; x.fillRect(0, 0, 32, 32); x.fillRect(32, 32, 32, 32);
    const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; tx.wrapS = tx.wrapT = THREE.RepeatWrapping; tx.repeat.set(8, 26); tx.magFilter = THREE.NearestFilter;
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W * 2 + 0.6, 14.4), new THREE.MeshLambertMaterial({ map: tx })); floor.rotation.x = -Math.PI / 2; floor.position.set(0, 0.002, -0.7); scene.add(floor);
    // metal shelving along the right wall, crates, a table with a lamp
    for (let i = 0; i < 3; i++) bx(scene, 0.5, 1.9, 1.4, lam(0x2f3433), ROOM_W - 0.1, 0.95, 3.6 - i * 2.8);
    bx(scene, 1.4, 0.8, 0.9, lam(0x4a3a2c), -ROOM_W + 0.7, 0.4, 0.6);
    bx(scene, 3, 0.1, 1.3, lam(0x6a4d33), -1.0, 0.9, 2.2);
    bx(scene, 0.12, 0.85, 0.12, lam(0x2a2018), -2.2, 0.42, 2.2); bx(scene, 0.12, 0.85, 0.12, lam(0x2a2018), 0.2, 0.42, 2.2);
    bx(scene, 0.3, 0.05, 0.19, lam(0x111111), -1.2, 0.98, 2.2);
    // television on a stack
    bx(scene, 2.2, 0.7, 1.1, lam(0x2a2a2e), 0, 0.35, TV_Z + 0.2);
    bx(scene, 1.5, 1.1, 0.95, lam(0x2d2d30), 0, 1.25, TV_Z);
    bx(scene, 1.0, 0.12, 0.05, new THREE.MeshBasicMaterial({ color: 0x050505 }), 0, 0.55, TV_Z + 0.55);
    const screen = new THREE.MeshBasicMaterial({ color: 0x0b0d10 });
    const sc = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.86), screen); sc.position.set(0, 1.28, TV_Z + 0.485); scene.add(sc);
    // lights
    scene.add(new THREE.HemisphereLight(0x9aa6b8, 0x1c1c20, 1.2));
    const tube = new THREE.PointLight(0xcfe0ff, 42, 15, 1.4); tube.position.set(0, 3.0, 0.2); scene.add(tube);
    const lamp = new THREE.PointLight(0xffc98a, 30, 9, 1.6); lamp.position.set(-1.0, 1.9, 2.2); scene.add(lamp);
    const glow = new THREE.PointLight(0x8fb4ff, 14, 8, 1.8); glow.position.set(0, 1.3, TV_Z + 1.6); scene.add(glow);
    const cam = new THREE.PerspectiveCamera(70, 16 / 9, 0.05, 40);
    const tape = tapeMesh('TAPE 07'); tape.position.set(0.2, -0.2, -0.45); tape.rotation.set(0.5, 0.35, -0.2); cam.add(tape); scene.add(cam);
    return {
        scene, cam, screen, lights: [tube, glow], tape,
        update(t, g) {
            tube.intensity = 42 + (Math.random() < 0.03 ? -22 : 0) + g * 20;
            if (g < 0.01) { const v = 0.05 + Math.random() * 0.03; screen.color.setRGB(v, v * 1.1, v * 1.2); }
            else screen.color.setRGB(0.3 + g * 0.7, 0.4 + g * 0.6, 0.55 + g * 0.45);
            glow.intensity = 14 + g * 30 + Math.sin(t * 11) * 1.5;
        },
    };
}

interface Hospital { scene: THREE.Scene; cam: THREE.PerspectiveCamera; update(t: number): void; family: THREE.Group[] }

/** The room at the end of everything. */
function buildHospital(): Hospital {
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0d0e);
    scene.fog = new THREE.Fog(0x0a0d0e, 10, 26);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mat(0x7f908b, 0.95)); floor.rotation.x = -Math.PI / 2; scene.add(floor);
    const walls = new THREE.Mesh(new THREE.BoxGeometry(14, 4.4, 14), mat(0xcfd9d3, 0.95)); (walls.material as THREE.Material).side = THREE.BackSide; walls.position.y = 2.2; scene.add(walls);
    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), mat(0xaab6b1, 1)); ceil.rotation.x = Math.PI / 2; ceil.position.y = 4.4; scene.add(ceil);
    // window with night outside
    bx(scene, 3.2, 1.6, 0.05, new THREE.MeshBasicMaterial({ color: 0x0b1a2e }), -3.2, 2.2, -6.9);
    // bed: frame, mattress, pillow, blanket, patient
    const bed = new THREE.Group(); scene.add(bed);
    bx(bed, 1.15, 0.28, 2.3, mat(0xc9d4d2, 0.5), 0, 0.7, 0);
    bx(bed, 1.05, 0.22, 2.2, mat(0xf3ede0, 0.95), 0, 0.95, 0);
    bx(bed, 0.7, 0.14, 0.45, mat(0xffffff, 0.95), 0, 1.1, 0.8);
    bx(bed, 1.08, 0.2, 1.4, mat(0xdde8e6, 0.95), 0, 1.12, -0.4);          // blanket
    for (const s of [-1, 1]) bx(bed, 0.05, 0.5, 2.3, mat(0x798d8c, 0.4), s * 0.6, 1.1, 0);
    const skin = mat(0xb58a74, 0.9);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), skin); head.position.set(0, 1.28, 0.78); bed.add(head);
    const hair = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(0x3a2e24)); hair.position.set(0, 1.3, 0.8); hair.rotation.x = -0.5; bed.add(hair);
    bx(bed, 0.5, 0.2, 0.55, mat(0xb9d9d2, 0.95), 0, 1.26, 0.3);          // gown shoulders
    for (const s of [-1, 1]) bx(bed, 0.12, 0.1, 0.6, skin, s * 0.34, 1.26, 0.1);
    // monitor + drip
    bx(scene, 0.9, 0.7, 0.35, mat(0x253d3d, 0.6), -1.3, 1.9, 1.0);
    const mScreen = new THREE.MeshBasicMaterial({ color: 0x07110f });
    const ms = new THREE.Mesh(new THREE.PlaneGeometry(0.76, 0.5), mScreen); ms.position.set(-1.3, 1.9, 1.18); ms.rotation.y = 0; scene.add(ms);
    const line = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.012, 0.01), new THREE.MeshBasicMaterial({ color: 0x7ae6a0 })); line.position.set(-1.3, 1.9, 1.19); scene.add(line);
    bx(scene, 0.06, 1.6, 0.06, mat(0x8a9899, 0.3), -1.3, 0.8, 1.0);
    bx(scene, 0.04, 2.6, 0.04, mat(0xa4b4b5, 0.4), 1.2, 1.3, 0.2); bx(scene, 0.28, 0.45, 0.1, mat(0xc7ddd7, 0.4), 1.2, 2.3, 0.2);
    // lights
    scene.add(new THREE.HemisphereLight(0x9fb6b4, 0x141c1c, 0.32));
    const above = new THREE.PointLight(0xdff2ea, 38, 12, 1.5); above.position.set(0, 3.9, 0.5); scene.add(above);
    const green = new THREE.PointLight(0x5fe08c, 6, 4, 1.6); green.position.set(-1.1, 1.9, 1.5); scene.add(green);
    // family: four who searched, and a child, bent over the bed
    const family: THREE.Group[] = [];
    const spots: [number, number, number][] = [[-1.55, 0.5, 1], [-1.55, -0.6, 3], [1.55, 0.7, 0], [1.55, -0.5, 2]];
    spots.forEach(([x, z, idx], i) => {
        const p = new THREE.Group(); const m = companion(idx % 4); m.scale.setScalar(0.95); p.add(m);
        p.position.set(x, 0, z); p.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2; p.userData.base = z; p.userData.i = i;
        family.push(p); scene.add(p);
    });
    const kid = new THREE.Group(); { const m = companion(2); m.scale.setScalar(0.55); kid.add(m); }
    kid.position.set(0.75, 0, 1.45); kid.rotation.y = -Math.PI / 2 - 0.4; family.push(kid); scene.add(kid);
    const nurse = new THREE.Group(); { const m = companion(3); nurse.add(m); m.traverse((o) => { if ((o as THREE.Mesh).isMesh) { const mm = ((o as THREE.Mesh).material as THREE.MeshStandardMaterial).clone(); mm.color.setHex(0xb9d9d2); (o as THREE.Mesh).material = mm; } }); }
    nurse.position.set(0.4, 0, -2.5); nurse.rotation.y = 0.1; scene.add(nurse);
    const cam = new THREE.PerspectiveCamera(60, 16 / 9, 0.05, 40);
    return {
        scene, cam, family,
        update(t) {
            family.forEach((p, i) => {
                const k = i === family.length - 1 ? 0.5 : 1;
                p.rotation.x = (0.28 + Math.sin(t * 6.3 + i * 1.7) * 0.05) * k;       // bent over, shoulders shaking
                p.position.y = Math.abs(Math.sin(t * 6.3 + i * 1.7)) * 0.012;
            });
            nurse.rotation.x = 0.12;
            green.intensity = 6 + Math.sin(t * 3) * 0.4;
        },
    };
}

const VERT = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`;
const FRAG = `
precision highp float;
varying vec2 vUv;
uniform sampler2D tA; uniform sampler2D tB; uniform sampler2D tC;
uniform float morph, swirl, spin, pull, mixC, fade, time, flash, aspect, ca, expA, grain, divider;
uniform float swirlC;
vec2 twist(vec2 uv, float amt, float rot, float pl){
    vec2 d = uv - 0.5; d.x *= aspect;
    float r = length(d);
    float a = amt * exp(-r * 2.4) + rot;
    float s = sin(a), c = cos(a);
    d = mat2(c, -s, s, c) * d;
    d *= 1.0 / (1.0 + pl * exp(-r * 3.2));
    d.x /= aspect;
    return d + 0.5;
}
float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
void main(){
    vec2 uv = twist(vUv, swirl, spin, pull);
    // the two pictures, each cropped to its own half while apart, un-cropping as they merge
    float un = 0.25 * (1.0 - morph);
    float edge = 0.5 + sin(uv.y * 22.0 + time * 4.0) * 0.003 * (0.3 + morph * 14.0) * (1.0 - smoothstep(0.85, 1.0, morph));
    vec2 uA = vec2(uv.x + un, uv.y), uB = vec2(uv.x - un, uv.y);
    vec3 a1 = vec3(texture2D(tA, uA + vec2(ca, 0.0)).r, texture2D(tA, uA).g, texture2D(tA, uA - vec2(ca, 0.0)).b) * expA;
    vec3 b1 = vec3(texture2D(tB, uB - vec2(ca, 0.0)).r, texture2D(tB, uB).g, texture2D(tB, uB + vec2(ca, 0.0)).b);
    vec3 sp = uv.x < edge ? a1 : b1;
    float line = (1.0 - smoothstep(0.0, 0.0035, abs(uv.x - edge))) * divider;
    sp = mix(sp, vec3(0.92, 0.93, 0.95), line);
    // merged: full frame double exposure that breathes between the two
    vec3 mA = vec3(texture2D(tA, uv + vec2(ca, 0.0)).r, texture2D(tA, uv).g, texture2D(tA, uv - vec2(ca, 0.0)).b) * expA;
    vec3 mB = texture2D(tB, uv).rgb;
    float k = 0.5 + 0.18 * sin(time * 3.1 + uv.y * 6.0);
    vec3 merged = mix(mA, mB, k) + 0.25 * abs(mA - mB) * smoothstep(0.4, 1.0, morph);
    // rows from alternating pictures while they're tearing together
    float row = step(0.5, fract(vUv.y * 90.0));
    float tear = smoothstep(0.25, 0.55, morph) * (1.0 - smoothstep(0.55, 0.85, morph));
    merged = mix(merged, mix(mA, mB, row), tear * 0.8);
    vec3 col = mix(sp, merged, smoothstep(0.35, 1.0, morph));
    // the hospital
    if (mixC > 0.0) {
        vec2 uc = twist(vUv, swirlC, swirlC * 0.35, swirlC * 0.6);
        col = mix(col, texture2D(tC, uc).rgb, mixC);
    }
    // tornado darkens toward its throat
    float r = length((vUv - 0.5) * vec2(aspect, 1.0));
    col *= 1.0 - 0.55 * smoothstep(0.0, 1.0, abs(swirl) / 11.0) * exp(-r * 4.0);
    col += (hash(vUv * 713.0 + time) - 0.5) * grain;
    col *= 1.0 - 0.38 * smoothstep(0.35, 1.0, r);
    col = mix(col, vec3(1.0), flash);
    col *= fade;
    gl_FragColor = vec4(max(col, 0.0), 1.0);
    #include <colorspace_fragment>
}`;

const LINES = {
    A: 'rgba(255,214,150,0.95)',
    B: 'rgba(170,205,255,0.95)',
};

export class MergeScene {
    private root: HTMLDivElement;
    private renderer: THREE.WebGLRenderer;
    private rtA!: THREE.WebGLRenderTarget; private rtB!: THREE.WebGLRenderTarget; private rtC!: THREE.WebGLRenderTarget;
    private quad: THREE.Mesh; private qCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    private qScene = new THREE.Scene();
    private uni: Record<string, { value: number | THREE.Texture }>;
    private roomA = buildLivingRoom(); private roomB = buildTapeRoom(); private hosp = buildHospital();
    private snd = new Sound();
    private raf = 0; private last = 0; private t = 0;
    private phase: Phase = 'walk'; private pt = 0;
    private pos = new THREE.Vector3(0, 1.6, Z_START);
    private yaw = 0; private pitch = 0;
    private keys = new Set<string>();
    private drag: { x: number; y: number; id: number } | null = null;
    private sub: HTMLDivElement; private prompt: HTMLDivElement; private tagA: HTMLDivElement; private tagB: HTMLDivElement; private note: HTMLDivElement;
    private subT = 0; private events: { at: number; fn: () => void }[] = [];
    private cleanup: (() => void)[] = [];
    private disposed = false;
    private near = false;
    private bob = 0;
    private flatStarted = false;
    private sobT = 0;
    private reduceFlash = false;

    constructor(private container: HTMLElement, private onDone: () => void) {
        this.root = document.createElement('div');
        this.root.style.cssText = 'position:absolute;inset:0;background:#000;overflow:hidden;font-family:ui-monospace,Menlo,monospace;color:#fff;touch-action:none;user-select:none';
        container.appendChild(this.root);
        this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
        this.renderer.setPixelRatio(1);
        this.renderer.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;display:block';
        this.root.appendChild(this.renderer.domElement);
        const half = !(window as unknown as { __mergeLDR?: boolean }).__mergeLDR && (this.renderer.extensions.has('EXT_color_buffer_half_float') || this.renderer.extensions.has('EXT_color_buffer_float'));
        const mk = (min: THREE.MinificationTextureFilter, mag: THREE.MagnificationTextureFilter) => {
            const rt = new THREE.WebGLRenderTarget(16, 16, { type: half ? THREE.HalfFloatType : THREE.UnsignedByteType, minFilter: min, magFilter: mag, depthBuffer: true });
            rt.texture.wrapS = rt.texture.wrapT = THREE.MirroredRepeatWrapping;
            return rt;
        };
        this.rtA = mk(THREE.LinearFilter, THREE.LinearFilter);
        this.rtB = mk(THREE.NearestFilter, THREE.NearestFilter);   // the search game is drawn at PSX resolution
        this.rtC = mk(THREE.LinearFilter, THREE.LinearFilter);
        this.uni = {
            tA: { value: this.rtA.texture }, tB: { value: this.rtB.texture }, tC: { value: this.rtC.texture },
            morph: { value: 0 }, swirl: { value: 0 }, spin: { value: 0 }, pull: { value: 0 }, mixC: { value: 0 }, fade: { value: 0 }, time: { value: 0 },
            flash: { value: 0 }, aspect: { value: 16 / 9 }, ca: { value: 0 }, expA: { value: 1.25 }, grain: { value: 0.05 }, divider: { value: 1 }, swirlC: { value: 0 },
        };
        const m = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uni, depthTest: false, depthWrite: false, toneMapped: false });
        this.quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), m);
        this.quad.frustumCulled = false;
        this.qScene.add(this.quad);

        const css = (s: string) => { const d = document.createElement('div'); d.style.cssText = s; this.root.appendChild(d); return d; };
        this.sub = css('position:absolute;left:50%;bottom:11%;transform:translateX(-50%);width:min(92%,760px);text-align:center;font-size:clamp(13px,2.3vw,20px);line-height:1.35;text-shadow:0 0 4px #000,0 0 8px #000;pointer-events:none');
        this.prompt = css('position:absolute;left:50%;top:62%;transform:translateX(-50%);padding:6px 14px;background:rgba(0,0,0,0.55);border:1px solid rgba(255,255,255,0.4);border-radius:6px;font-size:clamp(12px,2vw,16px);display:none;pointer-events:none;white-space:nowrap');
        this.tagA = css('position:absolute;top:12px;left:14px;font-size:clamp(11px,1.8vw,15px);color:#ff4040;text-shadow:0 0 6px #000;pointer-events:none;letter-spacing:2px');
        this.tagB = css('position:absolute;top:12px;right:14px;font-size:clamp(11px,1.8vw,15px);color:#cfe3ff;text-shadow:0 0 6px #000;pointer-events:none;letter-spacing:2px');
        this.note = css('position:absolute;left:50%;top:16%;transform:translateX(-50%);font-size:clamp(11px,1.9vw,15px);letter-spacing:3px;color:rgba(255,255,255,0.8);text-shadow:0 0 6px #000;pointer-events:none;text-align:center;transition:opacity 1s');
        this.tagA.textContent = '● REC'; this.tagB.textContent = '▶ PLAY';
        this.note.textContent = 'WALK TO THE TELEVISION';

        this.resize();
        const on = <K extends keyof WindowEventMap>(t: Window | HTMLElement, ev: K | string, fn: (e: never) => void, o?: AddEventListenerOptions) => {
            (t as EventTarget).addEventListener(ev as string, fn as EventListener, o);
            this.cleanup.push(() => (t as EventTarget).removeEventListener(ev as string, fn as EventListener));
        };
        on(window, 'resize', () => this.resize());
        on(window, 'keydown', ((e: KeyboardEvent) => {
            this.keys.add(e.code);
            if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); this.use(); }
        }) as never);
        on(window, 'keyup', ((e: KeyboardEvent) => { this.keys.delete(e.code); }) as never);
        on(window, 'sd-use', (() => this.use()) as never);
        on(this.renderer.domElement, 'pointerdown', ((e: PointerEvent) => { this.drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; }) as never);
        on(window, 'pointermove', ((e: PointerEvent) => {
            if (!this.drag || this.drag.id !== e.pointerId || this.phase !== 'walk') return;
            this.yaw -= (e.clientX - this.drag.x) * 0.006; this.pitch = clamp(this.pitch - (e.clientY - this.drag.y) * 0.004, -0.5, 0.5);
            this.drag.x = e.clientX; this.drag.y = e.clientY;
        }) as never);
        on(window, 'pointerup', (() => { this.drag = null; }) as never);
        this.yaw = 0;

        (window as unknown as { __merge?: unknown }).__merge = this;
        store.patch({ roam: true, useLabel: '' });
        this.snd.startHum();
        this.at(1.2, () => this.say('YOU', 'The same tape.', 3, 'A'));
        this.at(3.4, () => this.say('YOU', 'The same hands.', 3, 'B'));
        this.fadeIn();
        this.last = performance.now();
        this.raf = requestAnimationFrame(this.loop);
    }

    // ───────────────────────── plumbing ─────────────────────────
    private at(secs: number, fn: () => void): void { this.events.push({ at: this.t + secs, fn }); }
    private say(who: string, text: string, dur: number, side: 'A' | 'B' | 'AB' = 'AB'): void {
        const col = side === 'A' ? LINES.A : side === 'B' ? LINES.B : '#fff';
        this.sub.innerHTML = `<span style="color:${col};letter-spacing:2px">${who}</span>&nbsp; ${text}`;
        this.subT = dur;
    }
    private fadeIn(): void { this.uni.fade.value = 0; this.fadeDir = 1; }
    private fadeDir = 0;

    private resize(): void {
        const w = Math.max(2, this.container.clientWidth || window.innerWidth), h = Math.max(2, this.container.clientHeight || window.innerHeight);
        this.renderer.setSize(w, h, false);
        const aspect = w / h;
        this.uni.aspect.value = aspect;
        const wA = Math.min(1280, w), hA = Math.round(wA / aspect);
        this.rtA.setSize(wA, hA);
        const wB = Math.max(256, Math.round(Math.min(w, 1280) / 3)), hB = Math.round(wB / aspect);
        this.rtB.setSize(wB, hB);
        this.rtC.setSize(wA, hA);
        for (const c of [this.roomA.cam, this.roomB.cam, this.hosp.cam]) { c.aspect = aspect; c.updateProjectionMatrix(); }
    }

    /** Test / debug: jump to a phase. */
    skipTo(p: Phase): void {
        if (p === 'insert') { this.pos.set(0, 1.6, USE_Z - 0.2); this.yaw = 0; this.use(); }
        else if (p === 'hospital') { this.enter('hospital'); }
        else this.enter(p);
    }
    getPhase(): Phase { return this.phase; }

    private enter(p: Phase): void {
        this.phase = p; this.pt = 0;
        this.events = this.events.filter((e) => e.at <= this.t);
        if (p === 'insert') {
            this.note.style.opacity = '0'; store.patch({ useLabel: '' });
            this.snd.click(); this.snd.thump(52, 0.6); this.snd.humTo(0.0, 2);
            this.at(0.2, () => this.say('YOU', 'If I put this in, I go back in.', 2.6, 'A'));
            this.at(1.5, () => this.say('YOU', 'I know. I never left.', 2.6, 'B'));
            this.at(1.9, () => this.snd.staticBurst(1.4, 0.35));
        } else if (p === 'morph') {
            this.snd.thump(44, 0.7); this.snd.staticBurst(1.6, 0.3); this.snd.startWhoosh(); this.snd.whooshTo(300, 0.05, 2);
            this.at(0.6, () => this.say('YOU', 'It was one tape.', 2.8));
            this.at(2.9, () => this.say('YOU', 'One man, looking for himself.', 2.8));
        } else if (p === 'swirl') {
            this.snd.startWhoosh(); this.snd.whooshTo(900, 0.22, 4.5);
            this.snd.tone(70, 5, 0.12, 'sawtooth', 460);
            this.sub.innerHTML = '';
        } else if (p === 'hospital') {
            this.tagA.style.opacity = '0'; this.tagB.style.opacity = '0';
            this.sub.innerHTML = '';
            this.snd.whooshTo(100, 0, 1.2);
            this.snd.startFlatline(); this.flatStarted = true;
            this.snd.humTo(0.0, 0.1);
            this.at(2.2, () => this.say('MOTHER', 'No.', 2.2));
            this.at(4.6, () => this.say('FATHER', 'No, no, no. Please. Not him.', 3.2));
            this.at(7.8, () => this.say('FAMILY', 'Come back. Please come back.', 3.4));
            this.at(11.6, () => this.say('', '', 0.1));
        } else if (p === 'out') {
            this.snd.flatTo(0.0, 3.6);
        }
    }

    private use(): void {
        if (this.phase !== 'walk') return;
        if (this.pos.z > USE_Z) { this.say('YOU', this.pos.z > 0 ? 'The television. Over there.' : 'Closer.', 2, 'AB'); return; }
        this.enter('insert');
    }

    // ───────────────────────── frame ─────────────────────────
    private loop = (now: number): void => {
        if (this.disposed) return;
        this.raf = requestAnimationFrame(this.loop);
        const dt = Math.min(0.05, (now - this.last) / 1000); this.last = now;
        this.step(dt);
        this.draw();
    };

    /** Advance the scene by dt seconds. Exposed for tests. */
    step(dt: number): void {
        this.t += dt; this.pt += dt;
        for (let i = this.events.length - 1; i >= 0; i--) { const e = this.events[i]; if (this.t >= e.at) { this.events.splice(i, 1); e.fn(); } }
        if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.sub.innerHTML = ''; }
        const u = this.uni;
        u.time.value = this.t;
        if (this.fadeDir === 1) { u.fade.value = Math.min(1, (u.fade.value as number) + dt * 0.8); if (u.fade.value === 1) this.fadeDir = 0; }

        // shared input -> one pair of walkers
        let mx = 0, mz = 0;
        if (this.phase === 'walk') {
            const k = this.keys;
            if (k.has('KeyW') || k.has('ArrowUp')) mz -= 1;
            if (k.has('KeyS') || k.has('ArrowDown')) mz += 1;
            if (k.has('KeyA') || k.has('ArrowLeft')) mx -= 1;
            if (k.has('KeyD') || k.has('ArrowRight')) mx += 1;
            const st = store.get().moveStick;
            if (st) { mx += st.x; mz += st.y; }
            const l = Math.hypot(mx, mz); if (l > 1) { mx /= l; mz /= l; }
            const speed = (k.has('ShiftLeft') || k.has('ShiftRight') ? 4.2 : 2.5);
            const s = Math.sin(this.yaw), c = Math.cos(this.yaw);
            this.pos.x += (mx * c + mz * s) * speed * dt;
            this.pos.z += (-mx * s + mz * c) * speed * dt;
            this.pos.x = clamp(this.pos.x, -ROOM_W + 0.5, ROOM_W - 0.5);
            this.pos.z = clamp(this.pos.z, Z_TV_FRONT, Z_START + 0.4);
            this.bob += Math.hypot(mx, mz) * speed * dt;
            // a little gravity toward the television so neither walker can miss it
            const toTv = Math.atan2(-(0 - this.pos.x), -(TV_Z - this.pos.z));
            if (this.pos.z < 0.5) { let d = toTv - this.yaw; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; if (Math.hypot(mx, mz) > 0.1) this.yaw += d * Math.min(1, dt * 0.6); }
            const near = this.pos.z <= USE_Z;
            if (near !== this.near) {
                this.near = near;
                store.patch({ useLabel: near ? 'Put the tape in. Together.' : '' });
                if (near) this.note.style.opacity = '0';
            }
        }
        // progress toward the televisions drives how far apart the two walkers are
        const prog = this.phase === 'walk' ? smooth(Z_START, USE_Z, this.pos.z + (Z_START - USE_Z) * 0) : 1;
        const apart = this.phase === 'walk' ? 1 - smooth(0, 1, (Z_START - this.pos.z) / (Z_START - USE_Z)) : 0;
        void prog;

        // phase logic
        let glow = 0, morph = 0, swirl = 0, spin = 0, pull = 0, ca = 0, flash = 0, mixC = 0, swirlC = 0, divider = 1;
        const camA = this.roomA.cam, camB = this.roomB.cam;
        let walkZ = this.pos.z, walkYaw = this.yaw, rollA = 0, rollB = 0;
        if (this.phase === 'insert') {
            const k = smooth(0, 2.4, this.pt);
            walkZ = lerp(this.pos.z, -4.0, k); walkYaw = lerp(this.yaw, 0, k);
            glow = smooth(1.5, 2.4, this.pt);
            if (this.pt > 2.4) this.enter('morph');
        } else if (this.phase === 'morph') {
            const k = clamp(this.pt / 4.6, 0, 1);
            morph = smooth(0, 1, k);
            walkZ = lerp(-4.0, -4.5, smooth(0, 1, k)); walkYaw = 0;
            glow = 1; ca = 0.004 * Math.sin(this.pt * 7) * morph + 0.002;
            divider = 1 - smooth(0.5, 0.9, k);
            this.snd.whooshTo(300 + 500 * k, 0.05 + 0.1 * k, 0.1);
            this.tagA.style.opacity = this.tagB.style.opacity = String(1 - smooth(0.5, 0.9, k));
            if (this.pt > 4.6) this.enter('swirl');
        } else if (this.phase === 'swirl') {
            const k = clamp(this.pt / 5.2, 0, 1);
            const e = k * k;
            morph = 1; glow = 1 - 0.55 * smooth(0, 0.6, k);
            swirl = 11 * Math.pow(k, 1.5);
            spin = (k * k) * 9;
            pull = 0.45 * k * k;
            ca = 0.004 + 0.016 * k;
            walkZ = -4.5; walkYaw = 0;
            rollA = k * 1.8 + e * 2; rollB = -k * 1.5 - e * 2;
            flash = smooth(0.86, 1.0, k) * (this.reduceFlash ? 0.5 : 1);
            this.snd.whooshTo(500 + 1700 * k, 0.22 + 0.3 * k, 0.1);
            if (this.pt > 5.2) this.enter('hospital');
        } else if (this.phase === 'hospital') {
            const k = this.pt;
            morph = 1; mixC = 1; swirlC = 9 * Math.pow(1 - smooth(0, 3.2, k), 2);
            flash = 1 - smooth(0, 0.9, k);
            ca = 0.012 * (1 - smooth(0, 2.5, k));
            if (k > 1) this.snd.whooshTo(100, 0, 1);
            this.sobT -= dt; if (this.sobT <= 0 && k > 2) { this.sobT = 1.6 + Math.random() * 1.6; this.snd.sob(); }
            const run = 13.5;
            if (this.pt > run) this.enter('out');
        } else if (this.phase === 'out') {
            morph = 1; mixC = 1;
            u.fade.value = 1 - smooth(0, 3.2, this.pt);
            if (this.pt > 6.2 && !this.disposed) { this.phase = 'done'; this.finish(); }
        }

        // cameras: both start apart and drift together, ending in exactly the same place
        const drift = apart;
        const sway = (a: number, b: number) => Math.sin(this.t * a) * b * drift;
        camA.position.set(this.pos.x + 0, 1.6 + Math.sin(this.bob * 4.2) * 0.03, walkZ);
        camB.position.set(this.pos.x + sway(0.8, 0.9) + (drift > 0 ? 0.2 * drift : 0), 1.6 + Math.sin(this.bob * 4.2 + 1.2) * 0.03, walkZ + sway(0.55, 0.7));
        if (this.phase !== 'walk') { camB.position.x = camA.position.x; camB.position.z = camA.position.z; }
        camA.rotation.set(this.pitch, walkYaw, 0, 'YXZ');
        camB.rotation.set(this.pitch + sway(0.9, 0.05), walkYaw + sway(0.5, 0.3), 0, 'YXZ');
        camA.rotation.z = rollA; camB.rotation.z = rollB;
        camA.fov = 70 - 6 * morph; camB.fov = 70 - 6 * morph; camA.updateProjectionMatrix(); camB.updateProjectionMatrix();
        this.roomA.update(this.t, glow); this.roomB.update(this.t, glow);
        this.roomA.tape.visible = this.roomB.tape.visible = this.phase === 'walk' || (this.phase === 'insert' && this.pt < 1.2);
        if (this.phase === 'insert' && this.pt > 1.0) { this.roomA.tape.visible = this.roomB.tape.visible = false; }

        // the hospital pull-back: from the face, out and up
        if (this.phase === 'hospital' || this.phase === 'out') {
            const run = 13.5, k = clamp(this.pt / run, 0, 1) + (this.phase === 'out' ? 1 : 0);
            const kk = this.phase === 'out' ? 1 : smooth(0, 1, k);
            const c = this.hosp.cam;
            c.position.set(lerp(0.15, 5.4, kk), lerp(1.75, 4.6, kk), lerp(1.55, 6.2, kk));
            c.lookAt(lerp(0, 0, kk), lerp(1.2, 1.1, kk), lerp(0.95, 0.1, kk));
            c.rotation.z += (1 - kk) * 0.12;
            this.hosp.update(this.t);
        }

        u.morph.value = morph; u.swirl.value = swirl; u.spin.value = spin; u.pull.value = pull; u.ca.value = ca; u.flash.value = flash;
        u.mixC.value = mixC; u.swirlC.value = swirlC; u.divider.value = divider;
        u.grain.value = this.phase === 'hospital' || this.phase === 'out' ? 0.03 : 0.04 + morph * 0.025;
        this.tagA.style.opacity = this.phase === 'walk' || this.phase === 'insert' ? '1' : this.tagA.style.opacity;
    }

    private draw(): void {
        const r = this.renderer;
        r.setRenderTarget(this.rtA); r.render(this.roomA.scene, this.roomA.cam);
        r.setRenderTarget(this.rtB); r.render(this.roomB.scene, this.roomB.cam);
        if (this.phase === 'hospital' || this.phase === 'out') { r.setRenderTarget(this.rtC); r.render(this.hosp.scene, this.hosp.cam); }
        r.setRenderTarget(null);
        r.render(this.qScene, this.qCam);
    }

    private finish(): void {
        store.patch({ roam: false, useLabel: '' });
        this.onDone();
    }

    dispose(): void {
        this.disposed = true;
        cancelAnimationFrame(this.raf);
        this.cleanup.forEach((f) => f());
        store.patch({ roam: false, useLabel: '', moveStick: undefined });
        this.snd.stop();
        for (const rt of [this.rtA, this.rtB, this.rtC]) rt.dispose();
        for (const sc of [this.roomA.scene, this.roomB.scene, this.hosp.scene]) sc.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
        this.renderer.dispose();
        this.root.remove();
        if ((window as unknown as { __merge?: unknown }).__merge === this) delete (window as unknown as { __merge?: unknown }).__merge;
    }
}
