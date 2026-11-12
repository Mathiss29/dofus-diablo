/** Fil à part (maquette « Fluidité : » 1A) : lit la transparence d'une planche de décor, réduite PAS fois, sans bloquer le jeu.
 *  Reçoit { cle, src (Blob ou adresse), pas }, renvoie { cle, w, h, a } (a = alpha de chaque point, Uint8Array transférée). */
type Demande = { cle: string; src: Blob | string; pas: number };
const ctx = self as unknown as { onmessage: ((e: MessageEvent<Demande>) => void) | null; postMessage(m: unknown, t?: Transferable[]): void };
ctx.onmessage = async e => {
  const { cle, src, pas } = e.data;
  try {
    const blob = typeof src === 'string' ? await fetch(src).then(r => { if (!r.ok) throw new Error(src); return r.blob(); }) : src;
    const img = await createImageBitmap(blob);
    const w = Math.max(1, Math.ceil(img.width / pas)), h = Math.max(1, Math.ceil(img.height / pas));
    const c = new OffscreenCanvas(w, h).getContext('2d', { willReadFrequently: true })!;
    c.imageSmoothingEnabled = true;
    c.drawImage(img, 0, 0, img.width / pas, img.height / pas);
    img.close();
    const d = c.getImageData(0, 0, w, h).data, a = new Uint8Array(w * h);
    for (let i = 0; i < a.length; i++) a[i] = d[i * 4 + 3];
    ctx.postMessage({ cle, w, h, a }, [a.buffer]);
  } catch {
    ctx.postMessage({ cle, w: 0, h: 0, a: null });
  }
};
