import * as THREE from 'three';
import { companion } from './companions.ts';

/** Shared friend actor. The host owns its floor plan and story consequences. */
export interface SloppyHost {
    solid(c: number, r: number): boolean;
    canStand(x: number, z: number): boolean;
    columns: number;
    rows: number;
    los(ax: number, az: number, bx: number, bz: number): boolean;
    cellOf(x: number, z: number): [number, number];
    cx(c: number): number;
    cz(r: number): number;
    player(): { x: number; y: number; z: number };
    caught(): void;
    spotted(): void;
    stateChanged(state: string): void;
}

const SPEED_PATROL = 1.4;
const SPEED_CHASE = 2.8; // Slower than the player's ordinary walking pace.
const SEE_RANGE = 22;
const CATCH_RANGE = 1.15;
type State = 'PATROL' | 'CHASE' | 'SEARCH';

export class Sloppy {
    group = new THREE.Group();
    private x = 0;
    private z = 0;
    private yaw = 0;
    private phase = 0;
    private state: State = 'PATROL';
    private routeI = 0;
    private lastSeen: [number, number] = [0, 0];
    private searchT = 0;
    private alert = false;
    private caught = false;
    private path: [number, number][] = [];
    private pathTarget = '';
    private repathT = 0;
    private colors: { material: THREE.MeshStandardMaterial; original: THREE.Color }[] = [];
    mode: 'help' | 'hunt' = 'help';
    private helpPoint: [number, number] = [0, 0];

    constructor(private host: SloppyHost, private route: [number, number][], companionIndex = 1) {
        const model = companion(companionIndex);
        model.traverse((o) => {
            if (o instanceof THREE.Mesh) {
                const material = o.material as THREE.MeshStandardMaterial;
                this.colors.push({ material, original: material.color.clone() });
            }
        });
        this.group.add(model);
        this.group.visible = false;
    }

    /** Helpers start at their waiting spot, never walk through walls to get there. */
    spawn(): void {
        if (!this.route.length) return;
        const [c, r] = this.route[0];
        const [x, z] = this.mode === 'help' ? this.helpPoint : [this.host.cx(c), this.host.cz(r)];
        if (!this.host.canStand(x, z)) return;
        this.x = x; this.z = z;
        this.routeI = 0; this.state = 'PATROL'; this.alert = false; this.caught = false;
        this.phase = 0; this.searchT = 0; this.path = []; this.pathTarget = ''; this.repathT = 0;
        this.lastSeen = [x, z];
        this.colors.forEach(({ material, original }) => material.color.copy(original).multiplyScalar(this.mode === 'hunt' ? 0.55 : 1));
        this.group.position.set(x, 0, z);
        this.group.visible = true;
        this.host.stateChanged(this.mode === 'help' ? 'HELP' : 'PATROL');
    }

    hide(): void { this.group.visible = false; this.path = []; }
    isActive(): boolean { return this.group.visible; }
    setHelpPoint(c: number, r: number): void { this.helpPoint = [this.host.cx(c), this.host.cz(r)]; }

    private transition(state: State): void {
        if (this.state === state) return;
        this.state = state; this.path = []; this.repathT = 0;
        this.host.stateChanged(state);
    }

    /** Sweep the whole movement segment with body clearance, not just its end. */
    private clear(ax: number, az: number, bx: number, bz: number): boolean {
        const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 0.2));
        for (let i = 1; i <= steps; i++) {
            const k = i / steps;
            if (!this.host.canStand(ax + (bx - ax) * k, az + (bz - az) * k)) return false;
        }
        return true;
    }

    private step(tx: number, tz: number, speed: number, dt: number): boolean {
        const dx = tx - this.x, dz = tz - this.z, distance = Math.hypot(dx, dz);
        if (distance < 0.08) return true;
        const amount = Math.min(speed * dt, distance);
        const nx = this.x + dx / distance * amount, nz = this.z + dz / distance * amount;
        if (!this.clear(this.x, this.z, nx, nz)) { this.path = []; this.repathT = 0; return false; }
        this.x = nx; this.z = nz; this.yaw = Math.atan2(-dx, -dz);
        return amount >= distance;
    }

    /** Four-way paths cannot cut diagonally across a rack or room corner. */
    private buildPath(tc: number, tr: number): void {
        const h = this.host, w = h.columns, size = w * h.rows;
        const [sc, sr] = h.cellOf(this.x, this.z);
        this.path = [];
        if (h.solid(sc, sr) || h.solid(tc, tr)) return;
        const start = sr * w + sc, goal = tr * w + tc;
        const previous = new Int32Array(size); previous.fill(-1);
        const queue = new Int32Array(size); let tail = 1;
        queue[0] = start; previous[start] = start;
        for (let head = 0; head < tail && previous[goal] < 0; head++) {
            const here = queue[head], c = here % w, r = Math.floor(here / w);
            for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                const nc = c + dc, nr = r + dr;
                if (nc < 0 || nc >= w || nr < 0 || nr >= h.rows || h.solid(nc, nr)) continue;
                const next = nr * w + nc;
                if (previous[next] >= 0 || !this.clear(h.cx(c), h.cz(r), h.cx(nc), h.cz(nr))) continue;
                previous[next] = here; queue[tail++] = next;
            }
        }
        if (previous[goal] < 0) return;
        const cells: number[] = [];
        for (let at = goal; at !== start; at = previous[at]) cells.push(at);
        cells.push(start); cells.reverse();
        if (cells.length > 1 && this.clear(this.x, this.z, h.cx(cells[1] % w), h.cz(Math.floor(cells[1] / w)))) cells.shift();
        this.path = cells.map((at) => [h.cx(at % w), h.cz(Math.floor(at / w))]);
    }

    private navigate(tx: number, tz: number, speed: number, dt: number): boolean {
        if (Math.hypot(tx - this.x, tz - this.z) < 0.08) return true;
        if (this.clear(this.x, this.z, tx, tz)) {
            this.path = []; return this.step(tx, tz, speed, dt);
        }
        const [tc, tr] = this.host.cellOf(tx, tz), key = tc + ',' + tr;
        this.repathT -= dt;
        if (key !== this.pathTarget || (this.repathT <= 0 && !this.path.length)) {
            this.pathTarget = key; this.repathT = 0.8; this.buildPath(tc, tr);
        }
        while (this.path.length && Math.hypot(this.path[0][0] - this.x, this.path[0][1] - this.z) < 0.08) this.path.shift();
        const next = this.path[0];
        if (next) this.step(next[0], next[1], speed, dt);
        return false;
    }

    update(dt: number): void {
        if (!this.group.visible || this.caught) return;
        const p = this.host.player();
        let speed = 0;
        if (this.mode === 'help') {
            this.yaw = Math.atan2(-(p.x - this.x), -(p.z - this.z));
        } else {
            const distance = Math.hypot(p.x - this.x, p.z - this.z);
            const seeing = Math.abs(p.y) < 2.2 && distance < SEE_RANGE && this.host.los(this.x, this.z, p.x, p.z);
            if (seeing) {
                this.lastSeen = [p.x, p.z]; this.searchT = 0;
                this.transition('CHASE');
                if (!this.alert) { this.alert = true; this.host.spotted(); }
            }
            if (this.state === 'PATROL') {
                const [c, r] = this.route[this.routeI];
                speed = SPEED_PATROL;
                if (this.navigate(this.host.cx(c), this.host.cz(r), speed, dt)) this.routeI = (this.routeI + 1) % this.route.length;
            } else if (this.state === 'CHASE') {
                if (!seeing) this.searchT += dt;
                speed = SPEED_CHASE;
                this.navigate(this.lastSeen[0], this.lastSeen[1], speed, dt);
                if (!seeing && this.searchT > 2.5) { this.searchT = 0; this.transition('SEARCH'); }
            } else {
                this.searchT += dt; speed = SPEED_PATROL;
                this.navigate(this.lastSeen[0], this.lastSeen[1], speed, dt);
                if (this.searchT > 7) { this.transition('PATROL'); this.alert = false; }
            }
            const now = Math.hypot(p.x - this.x, p.z - this.z);
            if (this.state === 'CHASE' && now < CATCH_RANGE && Math.abs(p.y) < 1.1 && this.host.los(this.x, this.z, p.x, p.z) && this.clear(this.x, this.z, p.x, p.z)) {
                this.caught = true; this.host.caught();
            }
        }
        this.phase += dt * speed * 1.6;
        this.group.position.set(this.x, Math.abs(Math.sin(this.phase)) * (speed > 0 ? 0.06 : 0), this.z);
        let difference = this.yaw - this.group.rotation.y;
        while (difference > Math.PI) difference -= Math.PI * 2;
        while (difference < -Math.PI) difference += Math.PI * 2;
        this.group.rotation.y += difference * Math.min(1, dt * 5);
    }
}
