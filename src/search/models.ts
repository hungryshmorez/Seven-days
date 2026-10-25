import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

/**
 * Loads a .glb, scales it so its widest side equals `targetSize` metres, sits it on the ground
 * and adds it to `parent`. Fails quietly: the game plays fine without the model.
 */
export function placeModel(parent: THREE.Object3D, url: string, x: number, z: number, targetSize: number, yaw = 0): void {
    new GLTFLoader().load(
        url,
        (gltf) => {
            const model = gltf.scene;
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const widest = Math.max(size.x, size.z, 0.001);
            const s = targetSize / widest;
            model.scale.setScalar(s);
            const fitted = new THREE.Box3().setFromObject(model);
            const centre = fitted.getCenter(new THREE.Vector3());
            model.position.set(x - centre.x, -fitted.min.y, z - centre.z);
            model.rotation.y = yaw;
            model.traverse((o) => {
                const mesh = o as THREE.Mesh;
                if (!mesh.isMesh) return;
                mesh.frustumCulled = true;
                const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
                for (const m of mats) {
                    const tex = (m as THREE.MeshStandardMaterial).map;
                    if (tex) { tex.magFilter = THREE.NearestFilter; tex.minFilter = THREE.NearestMipmapLinearFilter; }
                }
            });
            parent.add(model);
        },
        undefined,
        () => { /* model unavailable: skip */ },
    );
}
