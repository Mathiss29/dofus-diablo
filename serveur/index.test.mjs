import { test } from 'node:test';
import assert from 'node:assert/strict';
import WebSocket from 'ws';
import { creerServeur } from './index.mjs';

test('santé et ping', async () => {
  const s = creerServeur();
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const port = s.address().port;
  const r = await fetch(`http://127.0.0.1:${port}/sante`);
  assert.equal((await r.json()).ok, true);
  const ws = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'https://diablofus.com' });
  const pong = await new Promise((ok, ko) => { ws.on('open', () => ws.send(JSON.stringify({ k: 'ping', t: 1 }))); ws.on('message', d => ok(JSON.parse(String(d)))); ws.on('error', ko); });
  assert.equal(pong.k, 'pong');
  ws.close();
  const refus = new WebSocket(`ws://127.0.0.1:${port}/ws`, { origin: 'https://autre-site.example' });
  await new Promise(ok => refus.on('error', ok));
  await new Promise(r => s.close(r));
});

test('salon de coop : code, relais hôte ↔ invité, fin quand l’hôte part', async () => {
  const s = creerServeur();
  await new Promise(r => s.listen(0, '127.0.0.1', r));
  const url = `ws://127.0.0.1:${s.address().port}/ws`;
  const client = async () => {
    const ws = new WebSocket(url, { origin: 'https://diablofus.com' }), file = [], attente = [];
    ws.on('message', d => { const m = JSON.parse(String(d)); const a = attente.shift(); if (a) a(m); else file.push(m); });
    await new Promise(ok => ws.on('open', ok));
    return { ws, envoi: m => ws.send(JSON.stringify(m)), lire: () => file.length ? Promise.resolve(file.shift()) : new Promise(ok => attente.push(ok)) };
  };
  const h = await client(), i = await client();
  h.envoi({ k: 'creer' });
  const salon = await h.lire();
  assert.equal(salon.hote, true);
  assert.match(salon.code, /^[A-Z2-9]{5}$/);
  i.envoi({ k: 'rejoindre', code: 'ZZZZZ' });
  assert.equal((await i.lire()).k, 'refus');
  i.envoi({ k: 'rejoindre', code: salon.code.toLowerCase() });
  const moi = await i.lire();
  assert.deepEqual([moi.hote, moi.id], [false, 2]);
  assert.deepEqual(await h.lire(), { k: 'arrivee', id: 2 });
  i.envoi({ k: 'envoi', d: { k: 'entree', x: 1 } });
  assert.deepEqual(await h.lire(), { k: 'recu', de: 2, d: { k: 'entree', x: 1 } });
  h.envoi({ k: 'envoi', a: 2, d: { k: 'instantane', n: 1 } });
  assert.deepEqual(await i.lire(), { k: 'recu', de: 1, d: { k: 'instantane', n: 1 } });
  h.ws.close();
  assert.deepEqual(await i.lire(), { k: 'fin', raison: 'hote' });
  i.ws.close();
  await new Promise(r => s.close(r));
});
