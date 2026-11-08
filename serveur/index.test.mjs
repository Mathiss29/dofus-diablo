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
