package com.ombrelune.diablofus;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;

/** Secours : l'écran du bas en activité sur le second écran (si la présentation y est refusée). */
public final class BasActivite extends Activity {
  static BasActivite ouverte;
  private Page page;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    ouverte = this;
    Plein.appliquer(getWindow());
    page = new Page(this, this, getWindow(), Page.BAS, null, null);
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

  @Override protected void onDestroy() {
    if (ouverte == this) ouverte = null;
    if (page != null) { page.fermer(); page = null; }
    super.onDestroy();
  }
}
