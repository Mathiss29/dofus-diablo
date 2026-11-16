package com.ombrelune.diablofus;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;

/** window.DiablofusAppli dans la page : manette, vibrations, luminosité de l'écran du bas. */
final class Pont {
  private final Context ctx;
  private final Window fenetre;
  private final Activity activite;

  Pont(Context ctx, Activity activite, Window fenetre) { this.ctx = ctx; this.activite = activite; this.fenetre = fenetre; }

  @JavascriptInterface public String manette() { return Manette.json(); }
  @JavascriptInterface public String version() { return String.valueOf(Principale.VERSION); }
  /** Journal de l'appli (pages tuées, erreurs) et version du moteur web, pour le rapport de l'écran du bas. */
  @JavascriptInterface public String journal() {
    String w = "?";
    try { android.content.pm.PackageInfo p = android.webkit.WebView.getCurrentWebViewPackage(); if (p != null) w = p.packageName + " " + p.versionName; } catch (Throwable ignore) { }
    return "Appli " + Principale.VERSION + " · WebView " + w + "\n" + Journal.lire(ctx);
  }

  /** Forces de 0 à 1 : la Thor n'a qu'un moteur, on prend la plus forte. */
  @JavascriptInterface public void vibrer(double fort, double faible, double ms) {
    int amp = (int) Math.round(Math.max(1, Math.min(255, 255 * Math.max(fort, faible))));
    long duree = (long) Math.max(10, Math.min(2000, ms));
    Vibrator v;
    if (Build.VERSION.SDK_INT >= 31) { VibratorManager m = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE); v = m != null ? m.getDefaultVibrator() : null; }
    else v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    if (v == null || !v.hasVibrator()) return;
    v.vibrate(VibrationEffect.createOneShot(duree, v.hasAmplitudeControl() ? amp : VibrationEffect.DEFAULT_AMPLITUDE));
  }

  /** Luminosité de cet écran (0 à 1), -1 = celle du système. */
  @JavascriptInterface public void luminosite(final double f) {
    if (fenetre == null || activite == null) return;
    activite.runOnUiThread(new Luminosite(fenetre, f));
  }

  /** (Classes nommées plutôt qu'anonymes : le d8 du SDK 34 bute sur les classes anonymes compilées par Java 21.) */
  private static final class Luminosite implements Runnable {
    private final Window fenetre; private final double f;
    Luminosite(Window fenetre, double f) { this.fenetre = fenetre; this.f = f; }
    @Override public void run() {
      WindowManager.LayoutParams lp = fenetre.getAttributes();
      lp.screenBrightness = f < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : (float) Math.max(0.01, Math.min(1, f));
      fenetre.setAttributes(lp);
    }
  }
}
