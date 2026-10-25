/**
 * Director: a data-driven timeline. Scenes just declare "at 4.1s do X" and
 * "from 6s for 3s tween Y". Time freezes while paused (engine stops calling update).
 */
import type * as THREE from 'three';
import RundotGameAPI from '@series-inc/rundot-game-sdk/api';
import type { CinemaAudio } from './audio.ts';
import type { BodycamRig } from './rig.ts';

export class Director {
time = 0;
/** Playback speed for the whole timeline. Cues, tweens, subtitles and titles all share this clock. */
speed = 1;
/** Added to every cue/tween start time while building a later act. */
offset = 0;
private cues: { t: number; fn: () => void; done: boolean }[] = [];
private tweens: { t: number; d: number; fn: (p: number) => void; done: boolean }[] = [];
at(t: number, fn: () => void) {
    this.cues.push({ t: t + this.offset, fn, done: false });
}
/** Absolute clock cues (subtitle/title expiry) must not inherit a build offset. */
atAbsolute(t: number, fn: () => void) {
    this.cues.push({ t, fn, done: false });
}
tween(t: number, d: number, fn: (p: number) => void) {
    this.tweens.push({ t: t + this.offset, d: Math.max(0.001, d), fn, done: false });
}
clear() { this.cues = []; this.tweens = []; }
update(dt: number) {
    this.time += dt * this.speed;
    // Source files can append earlier cues later. Fire by authored time, not insertion order.
    const due = this.cues.filter((c) => !c.done && this.time >= c.t).sort((a, b) => a.t - b.t);
    for (const c of due) {
        c.done = true;
        c.fn();
    }
    this.cues = this.cues.filter((c) => !c.done);
    for (const tw of this.tweens) {
        if (tw.done || this.time < tw.t) continue;
        const p = Math.min(1, (this.time - tw.t) / tw.d);
        tw.fn(p);
        if (p >= 1) tw.done = true;
    }
}
}

/** Corruption / VHS state the director drives and the post-process reads. */
export interface Fx {
corr: number; // 0..1 overall VHS corruption
tear: number; // 0..1 horizontal tear burst
fade: number; // 0..1 fade to black
fovKick: number; // extra FOV degrees (reality distortion)
exposure?: number; // multiplier on the chapter's base exposure (1 = as tuned)
}

/** Everything a scene needs to direct itself. */
export interface Env {
scene: THREE.Scene;
rig: BodycamRig;
audio: CinemaAudio;
dir: Director;
fx: Fx;
/** per-frame callbacks (environment animation) */
onFrame: ((dt: number, t: number) => void)[];
say(who: string, line: string, opts?: { pitch?: number; rate?: number; volume?: number }): void;
title(text: string, secs?: number): void;
/** Free-exploration controls, owned by the engine. */
explore: {
    active: boolean;
    speed: number;
    radius: number;
    bounds: null | { minX: number; maxX: number; minZ: number; maxZ: number };
    collide: null | ((x: number, z: number) => boolean);
    onUse: null | (() => void);
};
/** Seconds since the last press, drag or key (drives the hidden idle ending). */
idleSeconds: () => number;
/** Burst a tear for `secs` seconds then settle */
glitch(strength: number, secs?: number): void;
finish(): void;
}

/**
 * Runs a later act's build inside the same episode. Every cue the act schedules
 * is shifted by `startAt` seconds, and its own finish() is silenced so only
 * the outer episode ends the chapter.
 */
export function runAct(env: Env, startAt: number, build: (actEnv: Env) => void): void {
    const savedOffset = env.dir.offset;
    const actEnv: Env = {
        ...env,
        finish: () => { /* suppressed: the parent episode finishes */ },
    };
    env.dir.offset = savedOffset + startAt;
    try {
        build(actEnv);
    } finally {
        env.dir.offset = savedOffset;
    }
}

/** Later rooms must not be constructed visibly over the opening recording.
 * Build at the entry cue, isolate its scenery, and optionally return to the parent.
 * Existing runAct stays unchanged for the Prologue crash's immediate setup.
 */
export function stageAct(env: Env, startAt: number, build: (actEnv: Env) => void,
    duration?: number, completesEpisode = false): void {
    const start = env.dir.offset + startAt;
    env.dir.atAbsolute(start, () => {
        const previousNodes = env.scene.children.map(node => ({ node, visible: node.visible }));
        const previousSet = new Set(previousNodes.map(entry => entry.node));
        const background = env.scene.background, fog = env.scene.fog;
        const rig = env.rig;
        const pose = { pos: rig.pos.clone(), yaw: rig.yaw, pitch: rig.pitch, roll: rig.roll,
            walk: rig.walk, shake: rig.shake, fovKick: rig.fovKick, lookFreedom: rig.lookFreedom,
            onStep: rig.onStep };
        const oldFx = { ...env.fx };
        previousNodes.forEach(({ node }) => { node.visible = false; });
        const offset = env.dir.offset;
        env.dir.offset = start;
        try {
            build({ ...env, finish: completesEpisode ? env.finish : () => {} });
        } finally { env.dir.offset = offset; }
        RundotGameAPI.analytics.recordCustomEvent('story_act_entered', { act: build.name, timeline: start });
        if (duration !== undefined) {
            const actNodes = env.scene.children.filter(node => !previousSet.has(node));
            // Restore just before the parent's same-time entry cues, never after them.
            env.dir.atAbsolute(start + duration - 0.001, () => {
                actNodes.forEach(node => { node.visible = false; });
                previousNodes.forEach(({ node, visible }) => { node.visible = visible; });
                env.scene.background = background; env.scene.fog = fog;
                rig.pos.copy(pose.pos);
                rig.yaw = pose.yaw; rig.pitch = pose.pitch; rig.roll = pose.roll;
                rig.walk = pose.walk; rig.shake = pose.shake; rig.fovKick = pose.fovKick;
                rig.lookFreedom = pose.lookFreedom; rig.onStep = pose.onStep;
                Object.assign(env.fx, oldFx);
                RundotGameAPI.analytics.recordCustomEvent('story_act_returned', { act: build.name });
            });
        }
    });
}

export const smooth = (p: number) => p * p * (3 - 2 * p);
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
