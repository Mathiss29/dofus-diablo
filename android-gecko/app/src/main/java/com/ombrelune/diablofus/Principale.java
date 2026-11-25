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
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoSession;

/**
 * Diablofus sur l'AYN Thor, avec son propre moteur (GeckoView, le moteur de Firefox, embarqué dans l'appli) : le jeu sur
 * l'écran du haut, l'écran du bas (diablofus.com/#compagnon) sur le second écran. Même rôle que l'appli WebView (android/),
 * mais le jeu ne dépend plus du « Android System WebView » de la Thor (109, impossible à mettre à jour).
 */
public final class Principale extends Activity {
  static final int VERSION = 4;
  private static final int FICHIER = 41;
  /** Mode sûr : après un plantage, on lance le jeu seul (sans l'écran du bas). */
  private boolean sansBas = false;
  private Page jeu;
  private Bas bas;
  private DisplayManager ecrans;
  private final Handler main = new Handler(Looper.getMainLooper());
  private final Suivi suivi = new Suivi();
  private GeckoResult<GeckoSession.PromptDelegate.PromptResponse> fichierAttendu;
  private GeckoSession.PromptDelegate.FilePrompt fichierInvite;

  private final class Suivi implements DisplayManager.DisplayListener {
    @Override public void onDisplayAdded(int id) { ouvrirBas(); }
    @Override public void onDisplayRemoved(int id) { if (bas != null && bas.getDisplay().getDisplayId() == id) { bas.fermer(); bas = null; } }
    @Override public void onDisplayChanged(int id) { }
  }

  private boolean enErreur = false;

  @Override protected void onCreate(Bundle b) {
    super.onCreate(b);
    Journal.brancher(this);
    ecrans = (DisplayManager) getSystemService(DISPLAY_SERVICE);
    try {
      Journal.evenement(this, "démarrage (appli " + VERSION + "g, " + Moteur.version() + ")");
      sansBas = Journal.montrerSiPlantage(this);
      jeu = new Page(this, this, getWindow(), Page.JEU, new Perte(), this::choisirFichier);
      setContentView(jeu.vue);
      Journal.evenement(this, "page du jeu posée");
      Plein.appliquer(getWindow());
      Pont.frequence(this, getWindow(), 0);   // « Fluidité Thor : » 5D : la fréquence la plus haute, jusqu'à ce que le jeu dise son réglage
    } catch (Throwable e) { erreur("au démarrage", e); }
  }

  private void erreur(String quand, Throwable e) {
    enErreur = true; sansBas = true;
    Journal.evenement(this, "erreur " + quand + " : " + e);
    java.io.StringWriter w = new java.io.StringWriter(); e.printStackTrace(new java.io.PrintWriter(w));
    final String t = "Diablofus Gecko " + VERSION + " · Android " + android.os.Build.VERSION.RELEASE + " · " + android.os.Build.MODEL + "\nErreur " + quand + "\n" + w;
    android.widget.LinearLayout l = new android.widget.LinearLayout(this);
    l.setOrientation(android.widget.LinearLayout.VERTICAL); l.setPadding(32, 32, 32, 32); l.setBackgroundColor(0xFF12141B);
    android.widget.Button copier = new android.widget.Button(this); copier.setText("Copier le rapport");
    copier.setOnClickListener(v -> {
      android.content.ClipboardManager m = (android.content.ClipboardManager) getSystemService(CLIPBOARD_SERVICE);
      if (m != null) m.setPrimaryClip(android.content.ClipData.newPlainText("Diablofus", t));
      signaler("Rapport copié : colle-le dans le fil");
    });
    android.widget.TextView tv = new android.widget.TextView(this); tv.setText(t); tv.setTextColor(0xFFE8E2D4); tv.setTextSize(12); tv.setTextIsSelectable(true);
    android.widget.ScrollView sv = new android.widget.ScrollView(this); sv.addView(tv);
    l.addView(copier); l.addView(sv);
    try { setContentView(l); } catch (Throwable ignore) { }
  }

  private long dernierePerte = 0;
  /** Une page relancée après sa mort ; deux fois en une minute : l'écran du bas s'éteint pour cette fois. */
  final class Perte implements Page.SurPerte {
    @Override public void pagePerdue(Page p) {
      long t = android.os.SystemClock.uptimeMillis();
      if (t - dernierePerte < 60_000 && !sansBas) { sansBas = true; if (bas != null) { bas.fermer(); bas = null; } signaler("La page du jeu a été fermée deux fois : l'écran du bas est éteint pour cette fois"); }
      dernierePerte = t;
    }
  }

  /** Charger une sauvegarde (bouton de l'accueil) : le sélecteur de fichiers d'Android. */
  private GeckoResult<GeckoSession.PromptDelegate.PromptResponse> choisirFichier(GeckoSession.PromptDelegate.FilePrompt p) {
    if (fichierAttendu != null) fichierAttendu.complete(fichierInvite.dismiss());
    fichierAttendu = new GeckoResult<>(); fichierInvite = p;
    try {
      Intent i = new Intent(Intent.ACTION_GET_CONTENT).addCategory(Intent.CATEGORY_OPENABLE).setType("*/*");
      startActivityForResult(i, FICHIER);
    } catch (Throwable e) { GeckoResult<GeckoSession.PromptDelegate.PromptResponse> r = fichierAttendu; fichierAttendu = null; r.complete(p.dismiss()); return r; }
    return fichierAttendu;
  }
  @Override protected void onActivityResult(int code, int res, Intent data) {
    super.onActivityResult(code, res, data);
    if (code != FICHIER || fichierAttendu == null) return;
    GeckoResult<GeckoSession.PromptDelegate.PromptResponse> r = fichierAttendu; fichierAttendu = null;
    if (res == RESULT_OK && data != null && data.getData() != null) r.complete(fichierInvite.confirm(this, data.getData()));
    else r.complete(fichierInvite.dismiss());
  }

  @Override protected void onStart() {
    super.onStart();
    Journal.marquerLancement(this);
    ecrans.registerDisplayListener(suivi, main);
  }

  @Override protected void onResume() {
    super.onResume();
    if (enErreur || jeu == null) return;
    try { jeu.actif(true); Plein.appliquer(getWindow()); if (bas != null && bas.page != null) bas.page.actif(true); }
    catch (Throwable e) { erreur("à la reprise", e); return; }
    main.postDelayed(this::ouvrirBas, 600);
  }

  @Override protected void onPause() {
    Manette.lacher(); Moteur.manette();
    if (jeu != null) jeu.actif(false);
    if (bas != null && bas.page != null) bas.page.actif(false);
    super.onPause();
  }

  @Override protected void onStop() {
    Journal.marquerSortie(this);
    ecrans.unregisterDisplayListener(suivi);
    if (bas != null) { bas.fermer(); bas = null; }   // appli cachée : l'écran du bas se ferme aussi (batterie)
    super.onStop();
  }

  @Override protected void onDestroy() {
    if (bas != null) { bas.fermer(); bas = null; }
    if (BasActivite.ouverte != null) BasActivite.ouverte.finish();
    if (jeu != null) { jeu.fermer(); jeu = null; }
    super.onDestroy();
  }

  @Override public void onWindowFocusChanged(boolean f) { super.onWindowFocusChanged(f); if (f && !enErreur) try { Plein.appliquer(getWindow()); } catch (Throwable ignore) { } }

  private Display secondEcran() {
    Display[] p = ecrans.getDisplays(DisplayManager.DISPLAY_CATEGORY_PRESENTATION);
    int ici = getDisplay() != null ? getDisplay().getDisplayId() : Display.DEFAULT_DISPLAY;
    for (Display d : p) if (d.getDisplayId() != ici) return d;
    for (Display d : ecrans.getDisplays()) if (d.getDisplayId() != ici && d.getState() != Display.STATE_OFF) return d;
    return null;
  }

  private void ouvrirBas() {
    if (sansBas || enErreur || isFinishing() || isDestroyed()) return;
    try {
      Display d = secondEcran();
      if (d == null || BasActivite.ouverte != null) return;
      if (bas != null) { if (bas.getDisplay().getDisplayId() == d.getDisplayId()) return; bas.fermer(); bas = null; }
      try {
        bas = new Bas(this, d, new Perte());
        bas.show();
      } catch (Throwable e) {
        signaler("Écran du bas en présentation refusé (" + e.getClass().getSimpleName() + ") : essai en activité");
        if (bas != null) { try { bas.fermer(); } catch (Throwable ignore) { } bas = null; }
        try {
          ActivityOptions o = ActivityOptions.makeBasic().setLaunchDisplayId(d.getDisplayId());
          startActivity(new Intent(this, BasActivite.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_MULTIPLE_TASK), o.toBundle());
        } catch (Throwable e2) { signaler("Écran du bas indisponible : " + e2.getMessage()); }
      }
    } catch (Throwable e) { signaler("Écran du bas indisponible : " + e.getMessage()); sansBas = true; }
  }

  private void signaler(String t) { android.widget.Toast.makeText(this, t, android.widget.Toast.LENGTH_LONG).show(); }

  @Override public boolean dispatchKeyEvent(KeyEvent e) {
    if (Manette.cle(e)) { Moteur.manette(); return true; }
    if (e.getKeyCode() == KeyEvent.KEYCODE_BACK) { if (jeu == null) return super.dispatchKeyEvent(e); if (e.getAction() == KeyEvent.ACTION_UP) jeu.retour(); return true; }
    return super.dispatchKeyEvent(e);
  }

  @Override public boolean dispatchGenericMotionEvent(MotionEvent e) {
    if (Manette.mouvement(e)) { Moteur.manette(); return true; }
    return super.dispatchGenericMotionEvent(e);
  }
}
