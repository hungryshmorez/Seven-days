import * as THREE from 'three';
import type { D1Ctx, D1Interact } from './day1.ts';
import { companion, COMPANIONS } from './companions.ts';
import { buildMoppet } from './moppet.ts';
import { psxBox, type Surface } from './psx.ts';

export type PassageKind = 'home3' | 'hospital_echo' | 'hospital_death' | 'hospital_wake' | 'hall' | 'tape';
export interface TapeHooks { found(n: number): void; play(n: number, done: () => void): void; finished(n: number): void }
export interface MonsterEcho { name: string; model: THREE.Group }
const X = 4700, HOME = X + 80, HALL = X + 200, TAPE = X + 400;

/** Authored interludes, the final hospital, and a genuinely endless, player-controlled walk. */
export class Passages {
    group = new THREE.Group();
    interactables: D1Interact[] = [];
    private hospital = new THREE.Group();
    private home = new THREE.Group();
    private hall = new THREE.Group();
    private cast: MonsterEcho[] = [];
    private galleries: { root: THREE.Group; models: THREE.Group[]; z: number; id: number }[] = [];
    private platforms: THREE.Mesh[] = [];
    private light!: THREE.Mesh;
    private family: THREE.Group[] = [];
    private staff: THREE.Group[] = [];
    private companions: THREE.Group[] = [];
    private child!: THREE.Group;
    private witness = buildMoppet().group;
    private kind: PassageKind = 'home3';
    private t = 0;
    private laughT = 4;
    private distance = 0;
    private previousZ = 0;
    private rotation = 0;
    private homeBusy = false;
    private homeReady = false;
    private patient!: THREE.Group;
    private tapeRoom = new THREE.Group();
    private tapeN = 1;
    private tapeHeld = false;
    private tapePlaying = false;
    private tapeStaticT = 0;
    private cassette!: THREE.Mesh;
    private cassetteCv = document.createElement('canvas');
    private cassetteTx: THREE.CanvasTexture;
    private tvCv = document.createElement('canvas');
    private tvTx: THREE.CanvasTexture;

    constructor(private c: D1Ctx, private tapeHooks: TapeHooks) {
        this.cassetteCv.width = 64; this.cassetteCv.height = 40;
        this.cassetteTx = new THREE.CanvasTexture(this.cassetteCv); this.cassetteTx.magFilter = THREE.NearestFilter;
        this.tvCv.width = 64; this.tvCv.height = 48;
        this.tvTx = new THREE.CanvasTexture(this.tvCv); this.tvTx.magFilter = THREE.NearestFilter;
        this.group.add(this.hospital, this.home, this.hall, this.tapeRoom);
        const box = (g: THREE.Group, w: number, h: number, d: number, col: number, x: number, y: number, z: number, surface?: Surface) => {
            const m = surface ? psxBox(w, h, d, surface) : new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color: col, roughness: 0.85 }));
            m.position.set(x, y, z); g.add(m); return m;
        };
        box(this.hospital, 16, 0.2, 16, 0xa8bab5, X, -0.1, 0, 'tile');
        box(this.hospital, 16, 5, 0.25, 0xdce6df, X, 2.5, -7, 'paint');
        box(this.hospital, 0.25, 5, 16, 0xdce6df, X - 7.5, 2.5, 0, 'paint');
        box(this.hospital, 0.25, 5, 16, 0xdce6df, X + 7.5, 2.5, 0, 'paint');
        // Bed, pillow, patient, monitor and drip stand.
        box(this.hospital, 2, 0.25, 3.7, 0xc9d4d2, X, 0.65, 0);
        box(this.hospital, 1.85, 0.22, 3.5, 0xf3ede0, X, 0.9, 0);
        box(this.hospital, 1.4, 0.15, 0.75, 0xffffff, X, 1.08, -1.1);
        for (const s of [-1, 1]) box(this.hospital, 0.08, 0.5, 3.8, 0x798d8c, X + s * 1.04, 1.08, 0);
        this.patient = companion(0); this.patient.rotation.x = -Math.PI / 2; this.patient.position.set(X, 1.15, 0.7); this.patient.scale.setScalar(0.85); this.hospital.add(this.patient);
        box(this.hospital, 1, 0.8, 0.3, 0x253d3d, X - 2.1, 1.65, -1.4);
        const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.8, 0.48), new THREE.MeshBasicMaterial({ color: 0x0b1817 }));
        screen.position.set(X - 2.1, 1.65, -1.23); this.hospital.add(screen);
        const line = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.014, 0.01), new THREE.MeshBasicMaterial({ color: 0x7ae6a0 }));
        line.position.set(X - 2.1, 1.65, -1.215); this.hospital.add(line);
        box(this.hospital, 0.04, 2.6, 0.04, 0xa4b4b5, X + 1.5, 1.3, -1);
        box(this.hospital, 0.28, 0.45, 0.1, 0xc7ddd7, X + 1.35, 2.25, -1);
        for (let i = 0; i < 4; i++) {
            const s = i < 2 ? -1 : 1, z = i % 2 * 2 - 0.7;
            box(this.hospital, 0.8, 0.45, 0.8, 0x66787b, X + s * 2.7, 0.225, z);
            box(this.hospital, 0.8, 0.8, 0.15, 0x66787b, X + s * 3.05, 0.8, z).rotation.y = Math.PI / 2;
            const person = companion(i); person.scale.setScalar(0.85); person.position.set(X + s * 2.7, 0.03, z); person.rotation.y = s * Math.PI / 2;
            person.children.forEach((part) => { if (part.position.y < 0.8 && part.position.y > 0.1) { part.rotation.x = -Math.PI / 2; part.position.y = 0.5; part.position.z = -0.3; } });
            this.hospital.add(person); this.family.push(person);
        }
        for (let i = 0; i < 2; i++) {
            const staff = companion(3); staff.position.set(X + (i ? 1.2 : -1.2), 0, 2.3); staff.rotation.y = i ? 0.4 : -0.4;
            staff.traverse((o) => { if (o instanceof THREE.Mesh) { const mat = (o.material as THREE.MeshStandardMaterial).clone(); mat.color.setHex(0xb9d9d2); o.material = mat; } });
            this.staff.push(staff); this.hospital.add(staff);
        }
        const hl = new THREE.PointLight(0xd8eee4, 95, 32, 1.2); hl.position.set(X, 4, 1); this.hospital.add(hl);

        box(this.home, 12, 0.2, 14, 0x796044, HOME, -0.1, 0, 'wood');
        box(this.home, 12, 4, 0.25, 0xbbb09b, HOME, 2, -7, 'plaster');
        for (const s of [-1, 1]) box(this.home, 0.25, 4, 14, 0xaaa28f, HOME + s * 6, 2, 0, 'plaster');
        box(this.home, 3.5, 0.8, 1.2, 0x4e625f, HOME + 3, 0.4, 2);
        box(this.home, 1.5, 0.6, 1.3, 0x60442d, HOME, 0.3, 2);
        const homel = new THREE.PointLight(0xffd29b, 55, 25, 1.3); homel.position.set(HOME, 3.6, 0); this.home.add(homel);
        for (let i = 0; i < 4; i++) { const person = companion(i); person.position.set(HOME - 3 + i * 2, 0, -3.8); this.companions.push(person); this.home.add(person); }
        this.child = companion(2); this.child.scale.setScalar(0.58); this.child.position.set(HOME - 2.5, 0, -0.8); this.home.add(this.child);
        this.witness.position.set(HOME, 0, -5.5); this.witness.scale.setScalar(0.65); this.home.add(this.witness);
        this.interactables.push({ id: 'home_child', label: 'Listen to the child', pos: new THREE.Vector3(HOME - 2.5, 0.9, -0.8), range: 2.8,
            enabled: () => this.kind === 'home3' && this.homeReady && !this.homeBusy,
            run: () => this.childRitual() });

        // A continuous corridor, not an unbounded allocation of new rooms.
        box(this.hall, 7, 0.2, 144, 0xc5c1ae, HALL, -0.1, -40, 'carpet');
        for (const s of [-1, 1]) box(this.hall, 0.2, 7, 144, 0x818a8d, HALL + s * 7, 3.5, -40, 'paint');
        const hallLight = new THREE.HemisphereLight(0xfff0cd, 0x69737d, 1.4); this.hall.add(hallLight);
        for (let i = 0; i < 9; i++) {
            const p = new THREE.Mesh(new THREE.BoxGeometry(7, 0.1, 4), new THREE.MeshBasicMaterial({ color: 0xfff3c9, transparent: true, opacity: 0.4 }));
            p.position.set(HALL, 0.05, 8 - i * 16); this.platforms.push(p); this.hall.add(p);
        }
        this.light = new THREE.Mesh(new THREE.CircleGeometry(5, 40), new THREE.MeshBasicMaterial({ color: 0xfff5cc, fog: false, transparent: true, opacity: 0.65 }));
        this.hall.add(this.light);
        for (let i = 0; i < 12; i++) {
            const root = new THREE.Group(); const z = 8 - Math.floor(i / 2) * 16;
            root.position.set(HALL + (i % 2 ? 4.8 : -4.8), 0, z); this.hall.add(root);
            this.galleries.push({ root, models: [], z, id: i });
        }
        // The tape room: a dim bunker-like room with a table, a cassette and a television with a tape deck.
        box(this.tapeRoom, 10, 0.2, 10, 0x777777, TAPE, -0.1, 0, 'tile');
        box(this.tapeRoom, 10, 3.2, 0.3, 0x777777, TAPE, 1.6, -5, 'block');
        box(this.tapeRoom, 10, 3.2, 0.3, 0x777777, TAPE, 1.6, 5, 'block');
        for (const s of [-1, 1]) box(this.tapeRoom, 0.3, 3.2, 10, 0x777777, TAPE + s * 5, 1.6, 0, 'block');
        box(this.tapeRoom, 10, 0.2, 10, 0x555555, TAPE, 3.3, 0, 'block');
        box(this.tapeRoom, 3, 0.1, 1.3, 0x6a4d33, TAPE - 1.6, 0.9, -3.6, 'wood');
        for (const sx of [-1.3, 1.3]) box(this.tapeRoom, 0.12, 0.85, 0.12, 0x2a2018, TAPE - 1.6 + sx, 0.42, -3.6);
        this.cassette = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.05, 0.19), [0x111111, 0x111111, new THREE.MeshBasicMaterial({ map: this.cassetteTx }), 0x111111, 0x111111, 0x111111].map((m) => (typeof m === 'number' ? new THREE.MeshStandardMaterial({ color: m, roughness: 0.7 }) : m)));
        this.cassette.position.set(TAPE - 1.6, 0.98, -3.6);
        this.tapeRoom.add(this.cassette);
        box(this.tapeRoom, 2.2, 0.7, 1.1, 0x2a2a2e, TAPE + 2.6, 0.35, -4.2);
        box(this.tapeRoom, 1.5, 1.1, 0.95, 0x2d2d30, TAPE + 2.6, 1.25, -4.2);
        box(this.tapeRoom, 1.0, 0.12, 0.05, 0x050505, TAPE + 2.6, 0.55, -3.68);
        const tvScreen = new THREE.Mesh(new THREE.PlaneGeometry(1.15, 0.86), new THREE.MeshBasicMaterial({ map: this.tvTx }));
        tvScreen.position.set(TAPE + 2.6, 1.28, -3.72); this.tapeRoom.add(tvScreen);
        const lamp = new THREE.PointLight(0xffc98a, 38, 14, 1.6); lamp.position.set(TAPE - 1.6, 2.4, -3); this.tapeRoom.add(lamp);
        const glow = new THREE.PointLight(0x8fb4ff, 10, 8, 1.8); glow.position.set(TAPE + 2.6, 1.3, -2.5); this.tapeRoom.add(glow);
        this.interactables.push({ id: 'tape_pickup', label: 'Pick up the cassette', pos: new THREE.Vector3(TAPE - 1.6, 1.0, -3.6), range: 3,
            enabled: () => this.kind === 'tape' && !this.tapeHeld && !this.tapePlaying, run: () => this.pickUpTape() });
        this.interactables.push({ id: 'tape_insert', label: 'Put the cassette in the player', pos: new THREE.Vector3(TAPE + 2.6, 1.0, -3.6), range: 3.2,
            enabled: () => this.kind === 'tape' && this.tapeHeld && !this.tapePlaying, run: () => this.insertTape() });
        this.group.visible = false;
    }

    private drawCassette(): void {
        const x = this.cassetteCv.getContext('2d')!;
        x.fillStyle = '#d8d0b8'; x.fillRect(0, 0, 64, 40);
        x.fillStyle = '#222'; x.font = 'bold 11px monospace'; x.fillText('SEVEN DAYS', 5, 14);
        x.font = 'bold 14px monospace'; x.fillText('TAPE ' + String(this.tapeN).padStart(2, '0'), 5, 30);
        this.cassetteTx.needsUpdate = true;
    }

    private drawTv(on: boolean): void {
        const x = this.tvCv.getContext('2d')!;
        if (!on) { x.fillStyle = '#050607'; x.fillRect(0, 0, 64, 48); } else {
            for (let i = 0; i < 70; i++) { const v = Math.random() * 200 | 0; x.fillStyle = `rgb(${v},${v},${v})`; x.fillRect(Math.random() * 64, Math.random() * 48, 10 + Math.random() * 20, 2); }
        }
        this.tvTx.needsUpdate = true;
    }

    private pickUpTape(): void {
        const c = this.c;
        this.tapeHeld = true; this.cassette.visible = false;
        c.sfx.click(0.5);
        this.tapeHooks.found(this.tapeN);
        c.track('tape_found', { tape: this.tapeN });
        const lines = ['A cassette. A handwritten label. Somebody was here. Somebody left this for me.', 'Another one. They kept recording. They wanted me to find them.', 'The label is shaking, like the hand that wrote it was.', 'Another tape. Whoever made these did not stop.', 'It is warm. Like it was just in a machine.', 'My name is not on it. But it is meant for me.', 'The last one. Whatever is on it, they wanted me to see it.'];
        c.say('PROTAGONIST', lines[(this.tapeN - 1) % lines.length], 5);
        c.objective('Put the cassette in the player.');
    }

    private insertTape(): void {
        const c = this.c;
        this.tapePlaying = true;
        c.lock(true); c.objective('');
        c.sfx.click(0.6); c.sfx.tone(120, 0.5, 0.1, 0, 'sawtooth');
        c.track('tape_inserted', { tape: this.tapeN });
        this.drawTv(true);
        c.after(1.2, () => {
            c.fadeColor('#000'); c.fadeTo(1, 0.8);
            c.after(0.9, () => this.tapeHooks.play(this.tapeN, () => {
                c.fadeTo(1, 0.01);
                c.after(0.4, () => this.tapeHooks.finished(this.tapeN));
            }));
        });
    }

    private updateTape(dt: number): void {
        this.tapeStaticT -= dt;
        if (this.tapeStaticT <= 0 && this.tapePlaying) { this.tapeStaticT = 0.09; this.drawTv(true); }
    }

    setCast(cast: MonsterEcho[]): void {
        this.cast = [...cast, { name: 'Cinder Witness', model: this.witness }];
        this.galleries.forEach((slot) => {
            slot.root.clear(); slot.models = this.cast.map(({ model }) => {
                const copy = model.clone(true); copy.position.set(0, 0, 0); copy.rotation.set(0, 0, 0); copy.scale.setScalar(1); copy.visible = true;
                const bounds = new THREE.Box3().setFromObject(copy); const height = bounds.max.y - bounds.min.y;
                copy.scale.setScalar(Math.min(1, 4.5 / Math.max(1, height)));
                copy.position.y = -bounds.min.y * copy.scale.x;
                const wrapper = new THREE.Group(); wrapper.add(copy); wrapper.visible = false; slot.root.add(wrapper); return wrapper;
            });
        });
        this.showRotation();
    }
    private showRotation(): void {
        this.galleries.forEach((s) => s.models.forEach((m, i) => { m.visible = i === (s.id + this.rotation) % this.cast.length; }));
    }
    begin(kind: PassageKind, tape?: number): void {
        const c = this.c; this.kind = kind;
        // Empty chairs remain, but lost friends cannot reappear in either passage.
        this.companions.forEach((person, i) => { person.visible = c.isFriendAlive(i === 2 ? 'Mitzi' : COMPANIONS[i].name); });
        this.family.forEach((person, i) => { person.visible = c.isFriendAlive(i === 2 ? 'Mitzi' : COMPANIONS[i].name); });
        if (tape) this.tapeN = tape; this.t = 0; this.homeBusy = false; this.homeReady = false;
        this.hospital.visible = kind.startsWith('hospital'); this.home.visible = kind === 'home3'; this.hall.visible = kind === 'hall'; this.tapeRoom.visible = kind === 'tape';
        c.finaleClear(); c.finaleButton(null); c.setForceCrouch(false); c.setSpeedMul(1); c.setHead(null); c.vel.set(0, 0); c.hint(null); c.objective('');
        c.showHands(kind === 'home3' || kind === 'hall' || kind === 'tape'); c.setDrone(0); c.setAmbient(kind === 'hall' ? 1.15 : 0.7); c.mute(false);
        c.fadeColor(kind === 'hospital_wake' ? '#fff' : '#000'); c.fadeTo(0, kind === 'hospital_wake' ? 3.2 : 1.8); c.setYaw(0); c.setPitch(0);
        this.group.visible = true; c.lock(kind !== 'hall' && kind !== 'tape');
        if (kind === 'hall') {
            this.distance = 0; this.rotation = 0; this.laughT = 3; this.showRotation();
            c.p.set(HALL, 0, 4); this.previousZ = c.p.z;
        } else if (kind === 'home3') {
            c.p.set(HOME, 0, 5); this.witness.visible = false;
            const rollCall: [string, string, string, number][] = [
                ['Alan', 'ALAN', "I'm Alan. I direct films. That camera is recording things none of us can see.", 5],
                ['Sloppy', 'SLOPPY', 'Sloppy. Rodeo clown. Yes, I wore the windbreaker on purpose.', 4.5],
                ['Mitzi', 'MITZI GOINS', "Mitzi Goins. Runner. I'll find us a way through.", 4],
                ['Oliver', 'OLIVER', "Oliver. Their elder. A priest. And I've learned where this place breaks.", 5],
            ];
            let rollTime = 1.5;
            for (const [name, speaker, line, duration] of rollCall) {
                if (!c.isFriendAlive(name)) continue;
                c.after(rollTime, () => { c.say(speaker, line, duration); c.track('story_friend_spoke', { friend: name, scene: 'home' }); });
                rollTime += duration + 0.5;
            }
            const absent = rollCall.filter(([name]) => !c.isFriendAlive(name)).map(([name]) => name === 'Mitzi' ? 'Mitzi Goins' : name);
            if (absent.length) c.after(rollTime, () => {
                c.say('PROTAGONIST', absent.join('. ') + '. Empty spaces where they should be. I have to keep looking.', 5);
                c.track('story_absences_noticed', { scene: 'home', missing: absent.join(',') });
            });
            c.after(22, () => { c.sfx.tone(620, 3, 0.055, -0.7, 'sine', 920); c.sfx.tone(920, 3, 0.04, 0.7, 'sine', 620); c.say('CHILD', 'You heard the siren too?', 4); c.track('story_home_siren'); });
            c.after(26.5, () => { this.homeReady = true; c.lock(false); c.objective('Listen to the child.'); });
        } else if (kind === 'tape') {
            this.tapeHeld = false; this.tapePlaying = false; this.cassette.visible = true;
            this.drawCassette(); this.drawTv(false);
            c.p.set(TAPE, 0, 3.4); c.setYaw(0); c.setPitch(0);
            c.after(2, () => c.say('PROTAGONIST', this.tapeN === 1 ? 'They were here. I know it. They left something.' : 'There is another one.', 4));
            c.after(3, () => c.objective('Find the cassette.'));
        } else {
            c.p.set(X, 0, 1); c.setHead(1.2);
        this.patient.visible = kind !== 'hospital_wake';
            const hasFamily = this.family.some((person) => person.visible);
            const bedsideSpeaker = hasFamily ? 'FAMILY' : 'MEDIC';
            if (kind === 'hospital_wake') {
                // You open your eyes on the bed. The monitor keeps a steady, living time.
                this.staff.forEach((m, i) => { m.visible = i === 0; });
                this.family.forEach((person) => { person.visible = true; });
                for (let i = 0; i < 28; i++) c.after(0.6 + i * 0.85, () => c.sfx.tone(1040, 0.1, 0.06, -0.3));
                c.after(2.6, () => { c.say('FAMILY', 'He moved. Did he move?', 3); });
                c.after(5.2, () => { c.say('FAMILY', 'Oh my God. He is awake.', 3.5); });
                c.after(8, () => { c.say('FAMILY', 'Somebody get the doctor! He is awake!', 4); });
                c.after(11.5, () => { c.say('MEDIC', 'Easy. Easy. Welcome back.', 3.5); });
                c.after(15, () => { c.say('FAMILY', 'It is a miracle. It is a miracle.', 4.5); });
                c.after(19.5, () => { c.say('PROTAGONIST', 'Where is the dog? He was just here.', 4); });
                c.after(24, () => { c.say('FAMILY', 'Seven days. You were gone for seven days.', 5); });
                c.after(30, () => { c.fadeColor('#fff'); c.fadeTo(1, 3); c.track('ending_wake_hospital_completed'); });
                c.after(33.5, () => c.wake());
            } else if (kind === 'hospital_echo') {
                this.staff.forEach((m, i) => { m.visible = !hasFamily && i === 0; });
                c.after(1, () => {
                    c.sfx.tone(800, 0.15, 0.04); c.say(bedsideSpeaker, "Stay with us. We're here.", 4);
                    c.track('story_bedside_voice', { speaker: bedsideSpeaker, scene: kind });
                });
                c.after(6, () => { c.fadeTo(1, 1.2); });
                c.after(7.5, () => c.nextChapter('d7_core_return'));
            } else {
                this.staff.forEach((m) => { m.visible = true; });
                c.after(1.8, () => { c.sfx.flatline(15); c.track('ending_flatline_started'); });
                c.after(3, () => {
                    c.say(bedsideSpeaker, hasFamily ? 'Please. Please do something.' : 'Stay with us. We are not stopping.', 4);
                    c.track('story_bedside_voice', { speaker: bedsideSpeaker, scene: kind });
                });
                c.after(7.4, () => { c.sfx.noise(1.3, 700, 0.6, 0.045); c.say('MEDIC', 'No pulse. Keep compressions going.', 4); });
                c.after(11.8, () => {
                    c.say(bedsideSpeaker, "We're right here. Please come back.", 4);
                    c.track('story_bedside_voice', { speaker: bedsideSpeaker, scene: kind });
                });
                c.after(17.5, () => { c.fadeTo(1, 2.5); c.track('ending_hospital_completed'); });
                c.after(20.5, () => { c.finaleLine('SEVEN DAYS'); c.finaleLine('END'); c.finaleButton('MAIN MENU', () => { c.track('ending_menu_clicked'); c.exitToMenu(); }); });
            }
        }
        c.checkpoint('passage_' + kind); c.track('story_passage_entered', { scene: kind });
    }
    private childRitual(): void {
        const c = this.c; this.homeBusy = true; c.lock(true); c.track('story_child_listened');
        c.say('CHILD', 'He is still waiting under the house.', 4);
        c.after(4.5, () => { this.witness.visible = true; c.say('CINDER WITNESS', 'The old ritual did not free me. Do not repeat its harm.', 5); c.track('story_witness_appeared'); });
        c.after(10, () => {
            const oliverHere = c.isFriendAlive('Oliver');
            c.say(oliverHere ? 'OLIVER' : 'PROTAGONIST', 'Then we change the ritual. A name, a breath, and a light. Nothing burns.', 5);
            c.track('story_ritual_reframed', { speaker: oliverHere ? 'Oliver' : 'Protagonist' });
        });
        c.after(15.5, () => { c.sfx.tone(196, 2.5, 0.06); c.say('PROTAGONIST', 'I remember you. You are not an offering.', 4); c.track('story_witness_ritual_completed'); });
        c.after(20, () => { this.witness.visible = false; c.fadeTo(1, 1.4); });
        c.after(22, () => { c.track('story_day3_home_completed'); c.nextChapter('d4'); });
    }
    respawn(id: string, tape?: number): void {
        const kind = id.slice('passage_'.length) as PassageKind;
        this.begin(['home3', 'hospital_echo', 'hospital_death', 'hospital_wake', 'hall', 'tape'].includes(kind) ? kind : 'hall', tape);
    }
    save(): { kind: PassageKind } { return { kind: this.kind }; }
    objectiveText(): string {
        if (this.kind === 'tape') return this.tapeHeld ? 'Put the cassette in the player.' : 'Find the cassette.';
        return this.kind === 'home3' && this.homeReady ? 'Listen to the child.' : '';
    }
    collide(p: THREE.Vector3): void {
        const center = this.kind === 'hall' ? HALL : this.kind === 'home3' ? HOME : this.kind === 'tape' ? TAPE : X;
        p.x = THREE.MathUtils.clamp(p.x, center - (this.kind === 'hall' ? 3 : 5.3), center + (this.kind === 'hall' ? 3 : 5.3));
        if (this.kind === 'home3') p.z = THREE.MathUtils.clamp(p.z, -6.5, 6.5);
        if (this.kind === 'tape') p.z = THREE.MathUtils.clamp(p.z, -4.2, 4.5);
        if (this.kind === 'hall') p.z = Math.min(10, p.z);
    }
    groundAt(z: number): number {
        if (this.kind !== 'hall') return 0;
        // Wide luminous platforms rise gently every sixteen metres, never conventional stairs.
        const phase = ((-z % 16) + 16) % 16;
        return phase < 4 ? Math.sin(phase / 4 * Math.PI) * 0.45 : 0;
    }
    update(dt: number): void {
        this.t += dt;
        if (this.kind === 'tape') this.updateTape(dt);
        if (this.kind !== 'hall') {
            if (this.kind === 'hospital_death') {
                this.staff.forEach((m, i) => { m.rotation.x = Math.sin(this.t * 5 + i) * 0.045; });
                this.family.forEach((m, i) => { m.rotation.z = Math.sin(this.t * 0.8 + i) * 0.025; });
            }
            return;
        }
        const c = this.c;
        this.distance += Math.abs(c.p.z - this.previousZ);
        if (c.p.z < -84) { c.p.z += 64; c.track('hallway_segment_recycled'); }
        this.previousZ = c.p.z;
        const rotation = Math.floor(this.distance / 24);
        if (rotation !== this.rotation) {
            this.rotation = rotation; this.showRotation();
            const scene = this.group.parent as THREE.Scene;
            const colors = [0xb3a982, 0x999782, 0x8c9f9b, 0x6f897c, 0xb6b2a6, 0xd6c6a0, 0x8e9da9];
            (scene.background as THREE.Color).setHex(colors[rotation % 7]);
            if (scene.fog instanceof THREE.FogExp2) scene.fog.color.setHex(colors[rotation % 7]);
            c.track('hallway_day_rotated', { day: rotation % 7 + 1 });
        }
        this.platforms.forEach((p) => { p.position.y = 0.12 + Math.sin(this.t * 0.65 + p.position.z * 0.1) * 0.1; });
        this.light.position.set(HALL, 4.5, c.p.z - 75);
        this.galleries.forEach((slot, i) => {
            // Recycle a gallery only well behind the walker, keeping monsters beside the path.
            while (slot.root.position.z > c.p.z + 22) slot.root.position.z -= 96;
            while (slot.root.position.z < c.p.z - 82) slot.root.position.z += 96;
            slot.root.rotation.y = Math.atan2(-(c.p.x - slot.root.position.x), -(c.p.z - slot.root.position.z));
            slot.root.rotation.z = Math.sin(this.t * 2.7 + i) * 0.025;
            slot.root.position.y = Math.abs(Math.sin(this.t * 2.7 + i)) * 0.07;
        });
        this.laughT -= dt;
        if (this.laughT <= 0) {
            this.laughT = 3.7 + Math.random() * 2.2;
            const near = [...this.galleries].sort((a, b) => Math.abs(a.root.position.z - c.p.z) - Math.abs(b.root.position.z - c.p.z))[0];
            const index = (near.id + this.rotation) % this.cast.length;
            c.sfx.laugh(near.root.position.x < HALL ? -0.7 : 0.7, 66 + index * 9);
            c.track('hallway_monster_laughed', { monster: this.cast[index]?.name });
        }
    }
    camera(): void {
        if (this.kind === 'hospital_wake') {
            // lying in the bed: eyes drift open, the room wheels slowly from face to face
            const k = THREE.MathUtils.smoothstep(this.t, 0, 4);
            const rise = THREE.MathUtils.smoothstep(this.t, 2, 9);
            this.c.camera.position.set(X, 1.35 + rise * 0.55, -1.0);
            const sweep = Math.sin(this.t * 0.28) * 2.7;
            this.c.camera.lookAt(X + sweep, 1.3 - 0.25 * rise + 0.5 * (1 - k), 1.3);
            this.c.camera.rotation.z += Math.sin(this.t * 0.9) * 0.015 * (1 - k * 0.6);
            return;
        }
        if (!this.kind.startsWith('hospital')) return;
        const k = THREE.MathUtils.smoothstep(this.t, 0.5, this.kind === 'hospital_death' ? 15 : 5.5);
        this.c.camera.position.set(X + 0.2 + 6.2 * k, 1.5 + k * 3.7, 1.3 + k * 5.7);
        this.c.camera.lookAt(X, 1.05, -0.3);
    }
}
