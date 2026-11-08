import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

/** Faux navigateur : balises <audio> et Web Audio réduits à ce que lit render/son.ts. */
class FauxAudio {
  src = ''; loop = false; preload = ''; crossOrigin = ''; paused = true; ended = false; currentTime = 0; duration = NaN;
  play() { this.paused = false; return Promise.resolve(); }
  pause() { this.paused = true; }
  removeAttribute() { this.src = ''; }
  load() {}
}
const param = (value = 0) => ({ value, cancelScheduledValues() {}, setValueAtTime() {}, linearRampToValueAtTime(v: number) { this.value = v; }, setTargetAtTime(v: number) { this.value = v; } });
const noeud = () => ({ connect: (x: unknown) => x, disconnect() {} });
class FauxCtx {
  currentTime = 0; state = 'running'; destination = {};
  createGain() { return { ...noeud(), gain: param(1) }; }
  createMediaElementSource(el: FauxAudio) { return { ...noeud(), el }; }
  createDynamicsCompressor() { return { ...noeud(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }; }
  resume() { return Promise.resolve(); }
}

type F = { el: FauxAudio; gain: { gain: { value: number } } };
type Etat = { k: string; f?: F; calme?: F; boucle?: F | null };

describe('Musique des boss (maquette « Musique élites », 2026-11-08)', () => {
  const g = globalThis as Record<string, unknown>;
  beforeAll(() => {
    vi.useFakeTimers();
    g.window = { AudioContext: FauxCtx, addEventListener() {} };
    g.document = { addEventListener() {}, hidden: false };
    g.Audio = FauxAudio; g.AudioContext = FauxCtx;
  });
  afterAll(() => { vi.useRealTimers(); delete g.window; delete g.document; delete g.Audio; delete g.AudioContext; });

  it('fondu croisé, boucle collée à l\'intro, jingle puis reprise du morceau là où il en était', async () => {
    const { Son } = await import('../src/render/son');
    const etat = () => (Son as unknown as { etat: Etat }).etat;
    Son.demarrer();
    Son.zone(['incarnam1']);
    Son.update(0.016); Son.update(2);
    expect(etat().k).toBe('explo');
    const calme = etat().calme!;
    calme.el.currentTime = 42;

    // un boss arrive : le combat monte pendant que l'exploration descend puis se met en pause (pas arrêtée)
    Son.setCombat(true); Son.update(0.016);
    const intro = etat().f!, boucle = etat().boucle!;
    expect(etat().k).toBe('combat');
    expect(intro.el.src).toContain('combat_intro');
    expect(intro.el.paused).toBe(false);
    expect(boucle.el.paused).toBe(true);
    expect(calme.gain.gain.value).toBe(0);
    vi.advanceTimersByTime(1700);
    expect(calme.el.paused).toBe(true);
    expect(calme.el.src).not.toBe('');

    // fin de l'intro : la boucle déjà chargée démarre juste avant, puis prend la place
    intro.el.duration = 34.8; intro.el.currentTime = 34.7;
    Son.update(0.016);
    vi.advanceTimersByTime(100);
    expect(boucle.el.paused).toBe(false);
    intro.el.ended = true; Son.update(0.016);
    expect(etat().f).toBe(boucle);

    // boss tué : jingle, puis le même morceau reprend à 42 s
    Son.finCombat(true);
    expect(etat().k).toBe('jingle');
    etat().f!.el.ended = true; Son.update(0.016);
    expect(etat().k).toBe('explo');
    expect(etat().calme).toBe(calme);
    expect(calme.el.paused).toBe(false);
    expect(calme.el.currentTime).toBe(42);

    // boss perdu de vue : pas de silence, le morceau revient tout de suite
    Son.setCombat(true); Son.update(0.016);
    Son.setCombat(false); Son.update(0.016);
    expect(etat().k).toBe('explo');
    expect(etat().calme).toBe(calme);
  });
});
