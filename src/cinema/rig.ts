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

    /** 'tape' = someone else's handheld camera (pass 1); 'body' = your own walk, tuned to match the interactive game (pass 2). */
    style: 'tape' | 'body' = 'tape';
    /** Look follows the pointer exactly (no easing toward the scripted yaw). Used while the player is the one steering. */
    directLook = false;
    /** Crouch: how far the eyes are lowered below the scene's eye height, in metres (<= 0). */
    eyeDrop = 0;

    private lastPos = new THREE.Vector3(NaN, 0, 0);
    private speed = 0;
    private flagAmp = 0;
    private amp = 0;

    update(dt: number, reducedMotion = false) {
        this.t += dt;
        const t = this.t;
        const motion = reducedMotion ? 0.25 : 1;
        // Measured ground speed: rails, free roam and explore all just move rig.pos, so the walk cycle follows the real motion.
        if (!Number.isNaN(this.lastPos.x) && dt > 0) {
            const v = Math.hypot(this.pos.x - this.lastPos.x, this.pos.z - this.lastPos.z) / dt;
            const inst = v < 12 ? v : this.speed; // a cut or teleport is not a run
            this.speed += (inst - this.speed) * (1 - Math.exp(-9 * dt));
        }
        this.lastPos.copy(this.pos);
        // scenes switch `walk` on and off like a lamp: ease it so the bob never snaps
        this.flagAmp += (this.walk - this.flagAmp) * (1 - Math.exp(-6 * dt));
        const measured = Math.min(1.4, this.speed / 3);
        const target = Math.max(measured, this.speed < 0.2 ? this.flagAmp * 0.6 : 0);
        this.amp += (target - this.amp) * (1 - Math.exp(-8 * dt));
        const w = this.amp;
        // stride phase advances with distance walked (one step every 1.35 m), like the interactive game
        const rate = this.speed > 0.25 ? this.speed * Math.PI / 1.35 : this.flagAmp * (reducedMotion ? 5 : 6);
        const prevPhase = this.phase;
        this.phase += dt * rate;
        if (this.onStep && Math.floor(this.phase / Math.PI) > Math.floor(prevPhase / Math.PI)) this.onStep();
        const body = this.style === 'body';
        const bobY = -Math.cos(this.phase * 2) * (body ? 0.034 : 0.05) * w * motion;
        const sway = Math.sin(this.phase);
        // camera target = scene pose + free-look offset (decays gently toward centre)
        this.userYaw *= Math.pow(0.25, dt * 0.35);
        this.userPitch *= Math.pow(0.25, dt * 0.35);
        this.userRoll *= Math.pow(0.001, dt * 2);
        // smooth toward the scripted yaw/pitch — never snap (unless the player is steering)
        const k = this.directLook ? 1 : 1 - Math.pow(0.0001, dt);
        this.smoothedYaw += (this.yaw - this.smoothedYaw) * k;
        this.smoothedPitch += (this.pitch - this.smoothedPitch) * k;
        this.camYaw = this.smoothedYaw + this.userYaw;
        this.camPitch = this.smoothedPitch + this.userPitch;
        // handheld noise: a camera operator's hands in 'tape', just a living tremor in 'body'
        const hh = body ? 0.35 : 1;
        const nx = (Math.sin(t * 1.9) + Math.sin(t * 3.7) * 0.5) * 0.006 * motion * hh;
        const ny = (Math.cos(t * 1.6) + Math.sin(t * 2.9) * 0.5) * 0.005 * motion * hh;
        const shX = (Math.random() - 0.5) * 0.02 * this.shake * motion;
        const shY = (Math.random() - 0.5) * 0.02 * this.shake * motion;
        this.camera.position.set(
            this.pos.x + nx * 8,
            this.pos.y + this.eyeDrop + bobY + ny * 8 + shY,
            this.pos.z
        );
        this.camera.rotation.order = 'YXZ';
        this.camera.rotation.set(
            this.camPitch + ny + Math.sin(t * 1.6) * 0.002 * motion + bobY * 0.15,
            this.camYaw + nx + sway * 0.004 * w * motion,
            (this.roll + sway * 0.008 * w + nx * 2) * motion
        );
        this.camera.rotation.z += shX + this.userRoll * motion;
        this.camera.fov = this.baseFov + this.fovKick + Math.sin(this.phase) * 0.25 * w * motion;
        this.camera.updateProjectionMatrix();
    }
    private phase = 0;
}
