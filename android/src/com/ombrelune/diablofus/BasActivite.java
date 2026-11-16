package com.ombrelune.diablofus;

import android.app.Activity;
import android.os.Bundle;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.webkit.WebView;

/** Secours : l'écran du bas en activité sur le second écran (si la présentation y est refusée). */
public final class BasActivite extends Activity {
  static BasActivite ouverte;
  private WebView vue;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    ouverte = this;
    Plein.appliquer(getWindow());
    vue = Toile.creer(this, new Pont(this, this, getWindow()), Toile.BAS, null);
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

  @Override protected void onDestroy() {
    if (ouverte == this) ouverte = null;
    if (vue != null) { vue.destroy(); vue = null; }
    super.onDestroy();
  }
}
