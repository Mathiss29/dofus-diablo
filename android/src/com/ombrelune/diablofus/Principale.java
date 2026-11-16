package com.ombrelune.diablofus;

import android.app.Activity;
import android.app.ActivityOptions;
import android.content.Intent;
import android.hardware.display.DisplayManager;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.view.Display;
import android.view.KeyEvent;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.webkit.WebView;

/**
 * Diablofus sur l'AYN Thor (maquette « Confort 2 : » 1A, 2026-11-16) : le jeu sur l'écran du haut, l'écran du bas
 * (diablofus.com/#compagnon) sur le second écran, sans Chrome. Les pages viennent du site : l'appli n'a presque jamais
 * besoin d'être mise à jour. Plein écran, écran toujours allumé, manette lue ici et passée aux deux pages.
 */
public final class Principale extends Activity {
  private WebView vue;
  private Bas bas;
  private DisplayManager ecrans;
  private final Handler main = new Handler(Looper.getMainLooper());
  private final Suivi suivi = new Suivi();
  /** Second écran branché ou retiré. */
  private final class Suivi implements DisplayManager.DisplayListener {
    @Override public void onDisplayAdded(int id) { ouvrirBas(); }
    @Override public void onDisplayRemoved(int id) { if (bas != null && bas.getDisplay().getDisplayId() == id) { bas.fermer(); bas = null; } }
    @Override public void onDisplayChanged(int id) { }
  }

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    WebView.setWebContentsDebuggingEnabled(true);   // chrome://inspect depuis un PC, pour les rapports de bug
    Plein.appliquer(getWindow());
    vue = Toile.creer(this, new Pont(this, this, getWindow()), Toile.JEU);
    setContentView(vue);
    ecrans = (DisplayManager) getSystemService(DISPLAY_SERVICE);
  }

  @Override protected void onStart() {
    super.onStart();
    ecrans.registerDisplayListener(suivi, main);
    ouvrirBas();
  }

  @Override protected void onResume() { super.onResume(); vue.onResume(); vue.resumeTimers(); Plein.appliquer(getWindow()); if (bas != null && bas.vue != null) bas.vue.onResume(); }

  @Override protected void onPause() { Manette.lacher(); vue.onPause(); if (bas != null && bas.vue != null) bas.vue.onPause(); super.onPause(); }

  @Override protected void onStop() {
    ecrans.unregisterDisplayListener(suivi);
    if (bas != null) { bas.fermer(); bas = null; }   // appli cachée : l'écran du bas se ferme aussi (batterie)
    super.onStop();
  }

  @Override protected void onDestroy() {
    if (bas != null) { bas.fermer(); bas = null; }
    if (BasActivite.ouverte != null) BasActivite.ouverte.finish();
    if (vue != null) { vue.destroy(); vue = null; }
    super.onDestroy();
  }

  @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f) Plein.appliquer(getWindow()); }

  /** Le second écran : celui qui accepte une présentation, sinon le premier qui n'est pas l'écran du jeu. */
  private Display secondEcran() {
    Display[] p = ecrans.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
    int ici = getDisplay() != null ? getDisplay().getDisplayId() : Display.DEFAULT_DISPLAY;
    for (Display d : p) if (d.getDisplayId() != ici) return d;
    for (Display d : ecrans.getDisplays()) if (d.getDisplayId() != ici && d.getState() != Display.STATE_OFF) return d;
    return null;
  }

  private void ouvrirBas() {
    Display d = secondEcran();
    if (d == null || BasActivite.ouverte != null) return;
    if (bas != null) { if (bas.getDisplay().getDisplayId() == d.getDisplayId()) return; bas.fermer(); bas = null; }
    try {
      bas = new Bas(this, d);
      bas.show();
    } catch (WindowManager.InvalidDisplayException | IllegalStateException | SecurityException e) {
      bas = null;
      try {   // secours : une activité lancée sur le second écran
        ActivityOptions o = ActivityOptions.makeBasic().setLaunchDisplayId(d.getDisplayId());
        startActivity(new Intent(this, BasActivite.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_MULTIPLE_TASK), o.toBundle());
      } catch (Exception e2) { /* un seul écran utilisable : le jeu seul */ }
    }
  }

  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    if (Manette.cle(e)) return true;
    if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) { if (e.getAction() == KeyEvent.ACTION_UP) Toile.retour(vue); return true; }
    return super.dispatchKeyEvent(e);
  }

  @Override public boolean dispatchGenericMotionEvent(MotionEvent e) {
    return Manette.mouvement(e) || super.dispatchGenericMotionEvent(e);
  }
}
