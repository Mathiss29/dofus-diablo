import { describe, expect, it } from 'vitest';
import * as T from '../src/render/touches';

const ev = (code: string, mods: Partial<KeyboardEvent> = {}) => ({ code, key: '', ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...mods }) as KeyboardEvent;

describe('touches (Réglages 3A + 3C)', () => {
  it('touches par défaut : les lettres suivent le clavier, les chiffres restent à leur place', () => {
    T.appliquer({});
    T.regler('azerty');
    expect(T.touche('invoc1')).toBe('KeyQ');   // le A d'un AZERTY
    expect(T.touche('carte')).toBe('Semicolon');
    expect(T.nomAction('sort1')).toBe('&');
    expect(T.nomAction('invoc1')).toBe('A');
    T.regler('qwerty');
    expect(T.touche('invoc1')).toBe('KeyA');
    expect(T.nomAction('sort1')).toBe('1');
    expect(T.nomAction('muet')).toBe('Ctrl M');
  });
  it('Fluidité 6A : « Attaquer vers la souris » sur Q, sans doublon, en AZERTY comme en QWERTY', () => {
    T.appliquer({});
    T.regler('azerty');
    expect(T.touche('attaqueSouris')).toBe('KeyA');   // le Q d'un AZERTY
    expect(T.actionDe(ev('KeyA'))).toBe('attaqueSouris');
    expect(T.actionDe(ev('KeyA', { shiftKey: true }))).toBe('attaqueSouris');
    expect(T.doublons().size).toBe(0);
    T.regler('qwerty');
    expect(T.actionDe(ev('KeyQ'))).toBe('attaqueSouris');
    expect(T.doublons().size).toBe(0);
  });
  it('une touche choisie remplace celle par défaut, Alt et Ctrl en plus si besoin', () => {
    T.regler('azerty'); T.appliquer({ sort1: 'KeyQ', potion: 'Alt+Digit1' });
    expect(T.actionDe(ev('KeyQ'))).toBe('sort1');
    expect(T.actionDe(ev('Digit1'))).toBeNull();   // plus de touche pour le sort 1 ici
    expect(T.actionDe(ev('Digit1', { altKey: true }))).toBe('potion');
    // Alt maintenu (aperçu) sur une touche sans Alt : l'action sans Alt
    expect(T.actionDe(ev('Digit2', { altKey: true }))).toBe('sort2');
    // Maj ne change rien (elle sert à attaquer sur place)
    expect(T.actionDe(ev('Digit2', { shiftKey: true }))).toBe('sort2');
    expect(T.actionDe(ev('ShiftLeft'))).toBeNull();
    T.appliquer({});
  });
  it('les doublons sont signalés', () => {
    T.regler('azerty'); T.appliquer({ sort1: 'KeyE' });
    expect([...T.doublons()].sort()).toEqual(['potion', 'sort1']);
    T.appliquer({});
    expect(T.doublons().size).toBe(0);
  });
});
