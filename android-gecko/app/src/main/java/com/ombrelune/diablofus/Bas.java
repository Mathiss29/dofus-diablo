package com.ombrelune.diablofus;

import android.app.Activity;
import android.app.Presentation;
import android.os.Bundle;
import android.view.Display;
import android.view.KeyEvent;
import android.view.MotionEvent;

/** L'écran du bas (diablofus.com/#compagnon) en « présentation » sur le second écran de la Thor. */
final class Bas extends Presentation {
  private final Activity activite;
  private final Page.SurPerte perte;
  Page page;

  Bas(Activity activite, Display d, Page.SurPerte perte) { super(activite, d); this.activite = activite; this.perte = perte; }

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    setCancelable(false);
    Plein.appliquer(getWindow());
    page = new Page(getContext(), activite, getWindow(), Page.BAS, perte, null);
    setContentView(page.vue);
  }

  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    if (Manette.cle(e)) { Moteur.manette(); return true; }
    if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) { if (e.getAction() == KeyEvent.ACTION_UP && page != null) page.retour(); return true; }
    return super.dispatchKeyEvent(e);
  }

  @Override public boolean dispatchGenericMotionEvent(MotionEvent e) {
    if (Manette.mouvement(e)) { Moteur.manette(); return true; }
    return super.dispatchGenericMotionEvent(e);
  }

  void fermer() {
    if (page != null) { page.fermer(); page = null; }
    try { dismiss(); } catch (Exception e) { /* déjà fermé */ }
  }
}
