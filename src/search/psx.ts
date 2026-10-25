import * as THREE from 'three';

export type Surface = 'tile' | 'paint' | 'wood' | 'carpet' | 'dirt' | 'block' | 'stone' | 'plaster';
const cache = new Map<string, THREE.CanvasTexture>();

function rng(seed: number): () => number {
    let a = seed;
    return () => { a = (a * 1664525 + 1013904223) | 0; return ((a >>> 8) & 0xffff) / 0xffff; };
}

/** Small, grimy, hard-edged textures (late-90s console horror look). Cached per surface. */
export function psxTexture(kind: Surface, repeatX = 1, repeatY = 1): THREE.CanvasTexture {
    const key = `${kind}:${repeatX}:${repeatY}`;
    const hit = cache.get(key);
    if (hit) return hit;
    const N = 64;
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const x = c.getContext('2d')!;
    const r = rng(kind.length * 977 + kind.charCodeAt(0));
    const base: Record<Surface, string> = { tile: '#9fb0aa', paint: '#c9d3c9', wood: '#6a4d33', carpet: '#8c7f5a', dirt: '#4d3d2e', block: '#7a7770', stone: '#8b887c', plaster: '#b9b09c' };
    x.fillStyle = base[kind];
    x.fillRect(0, 0, N, N);
    if (kind === 'tile') { x.strokeStyle = '#6b7a76'; x.lineWidth = 2; x.strokeRect(0, 0, N / 2, N / 2); x.strokeRect(N / 2, N / 2, N / 2, N / 2); }
    if (kind === 'wood') { for (let i = 0; i < N; i += 8) { x.fillStyle = i % 16 ? '#5d4229' : '#74553a'; x.fillRect(0, i, N, 7); x.fillStyle = '#2b1d12'; x.fillRect(0, i + 7, N, 1); } }
    if (kind === 'block') { x.strokeStyle = '#4f4d49'; x.lineWidth = 2; for (let row = 0; row < 4; row++) { x.strokeRect(row % 2 ? -16 : 0, row * 16, 32, 16); x.strokeRect(row % 2 ? 16 : 32, row * 16, 32, 16); } }
    if (kind === 'paint') { x.fillStyle = '#7d8f82'; x.fillRect(0, N * 0.62, N, N * 0.38); x.fillStyle = '#e6e8dc'; x.fillRect(0, N * 0.6, N, 2); }
    if (kind === 'carpet') { for (let i = 0; i < 90; i++) { x.fillStyle = r() > 0.5 ? '#6f6444' : '#9b8e66'; x.fillRect(r() * N, r() * N, 2, 2); } }
    // grit, then dark grime blotches
    for (let i = 0; i < 260; i++) { x.fillStyle = `rgba(0,0,0,${0.04 + r() * 0.1})`; x.fillRect(r() * N, r() * N, 1 + r() * 3, 1 + r() * 3); }
    for (let i = 0; i < 6; i++) { x.fillStyle = 'rgba(20,14,8,0.14)'; x.beginPath(); x.arc(r() * N, r() * N, 4 + r() * 9, 0, 7); x.fill(); }
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.minFilter = THREE.NearestMipmapNearestFilter;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeatX, repeatY);
    cache.set(key, t);
    return t;
}

/** A box whose texture repeats about once per 2m instead of stretching. */
export function psxBox(w: number, h: number, d: number, kind: Surface, tint = 0xffffff): THREE.Mesh {
    const big = [w, h, d].sort((a, b) => b - a);
    const m = new THREE.MeshStandardMaterial({ map: psxTexture(kind, Math.max(1, Math.round(big[0] / 2)), Math.max(1, Math.round(big[1] / 2))), color: tint, roughness: 1 });
    return new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
}
