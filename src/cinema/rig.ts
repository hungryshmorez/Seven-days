/**
 * BodycamRig: a physical-feeling first-person camera.
 * Scenes steer the "base" pose (position, yaw, pitch) along rails; the rig adds
 * breathing, footstep bob, shake, inertia and free look from the viewer's drag.
 */
import * as THREE from 'three';

export class BodycamRig {
    camera: THREE.PerspectiveCamera;
    pos = new THREE.Vector3();
    yaw = 0;
    pitch = 0;
    /** 0 = standing still, 1 = walking (footstep bob + step sounds) */
    walk = 0;
    shake = 0;
    roll = 0;
    fovKick = 0;
    /** How far the viewer may drag-look away from the rail direction. */
    lookFreedom = 0.6;
    onStep: (() => void) | null = null;

    private userYaw = 0;
    private userPitch = 0;
    private userRoll = 0;
    private camYaw = 0;
    private camPitch = 0;
    private smoothedYaw = 0;
    private smoothedPitch = 0;
    /** smoothed shake phase */
    private t = 0;

    constructor(aspect: number) {
        this.camera = new THREE.PerspectiveCamera(this.baseFov, aspect, 0.1, 400);
    }
    baseFov = 68;

    // --- input (called by engine from pointer events) ---
    drag(dx: number, dy: number, reducedMotion = false) {
        const f = reducedMotion ? this.lookFreedom * 0.35 : this.lookFreedom;
        this.userYaw = THREE.MathUtils.clamp(this.userYaw - dx * 0.004, -1.1 * f, 1.1 * f);
        this.userPitch = THREE.MathUtils.clamp(this.userPitch - dy * 0.004, -0.6 * f, 0.6 * f);
        this.userRoll = THREE.MathUtils.clamp(dx * 0.00022, -0.02, 0.02);
    }

    /** Pointer-down / pointer-up hooks called by the engine. Free-look decay behaviour is unchanged. */
    dragStart() { /* no-op: look offset already decays gently in update() */ }
    dragEnd() { /* no-op */ }

    update(dt: number, reducedMotion = false) {
        this.t += dt;
        const t = this.t;
        const motion = reducedMotion ? 0.25 : 1;
        const w = this.walk;
        const phaseSpeed = reducedMotion ? 5 : 7.2;
        const prevPhase = this.phase;
        this.phase += dt * phaseSpeed * w;
        if (this.onStep && Math.floor(this.phase / Math.PI) > Math.floor(prevPhase / Math.PI)) this.onStep();
        const bobY = Math.abs(Math.sin(this.phase)) * 0.055 * w * motion;
        const sway = Math.sin(this.phase * 0.5) * 0.02 * w * motion;
        // camera target = scene pose + free-look offset (decays gently toward centre)
        this.userYaw *= Math.pow(0.25, dt * 0.35);
        this.userPitch *= Math.pow(0.25, dt * 0.35);
        this.userRoll *= Math.pow(0.001, dt * 2);
        // smooth toward the scripted yaw/pitch — never snap
        const k = 1 - Math.pow(0.0001, dt);
        this.smoothedYaw += (this.yaw - this.smoothedYaw) * k;
        this.smoothedPitch += (this.pitch - this.smoothedPitch) * k;
        this.camYaw = this.smoothedYaw + this.userYaw;
        this.camPitch = this.smoothedPitch + this.userPitch;
        // smoothed handheld noise
        const nx = (Math.sin(t * 1.9) + Math.sin(t * 3.7) * 0.5) * 0.006 * motion;
        const ny = (Math.cos(t * 1.6) + Math.sin(t * 2.9) * 0.5) * 0.005 * motion;
        const shX = (Math.random() - 0.5) * 0.02 * this.shake * motion;
        const shY = (Math.random() - 0.5) * 0.02 * this.shake * motion;
        this.camera.position.set(
            this.pos.x + nx * 8,
            this.pos.y - bobY + ny * 8 + shY,
            this.pos.z
        );
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.set(
            this.camPitch + ny + Math.sin(t * 1.6) * 0.002 * motion - bobY * 0.15,
            this.camYaw + nx + sway * 0.1,
            (this.roll + Math.sin(this.phase) * 0.01 * w + nx * 2) * motion
        );
        this.camera.rotation.z += shX + this.userRoll * motion;
        this.camera.fov = this.baseFov + this.fovKick + Math.sin(this.phase) * 0.7 * w * motion;
        this.camera.updateProjectionMatrix();
    }
    private phase = 0;
}
