package com.ombrelune.diablofus;

import android.app.Activity;
import android.app.Presentation;
import android.os.Bundle;
import android.view.Display;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;

/** L'écran du bas (diablofus.com/#compagnon) en « présentation » sur le second écran de la Thor. */
final class Bas extends Presentation {
  private final Activity activite;
  WebView vue;

  private final Toile.SurPerte perte;
  Bas(Activity activite, Display d, Toile.SurPerte perte) { super(activite, d); this.activite = activite; this.perte = perte; }

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    setCancelable(false);
    Plein.appliquer(getWindow());
    vue = Toile.creer(getContext(), new Pont(getContext(), activite, getWindow()), Toile.BAS, perte);
    setContentView(vue);
  }

  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    if (Manette.cle(e)) return true;
    if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) { if (e.getAction() == KeyEvent.ACTION_UP && vue != null) Toile.retour(vue); return true; }
    return super.dispatchKeyEvent(e);
  }

  @Override public boolean dispatchGenericMotionEvent(MotionEvent e) {
    return Manette.mouvement(e) || super.dispatchGenericMotionEvent(e);
  }

  void fermer() {
    if (vue != null) { vue.destroy(); vue = null; }
    try { dismiss(); } catch (Exception e) { /* déjà fermé */ }
  }
}
