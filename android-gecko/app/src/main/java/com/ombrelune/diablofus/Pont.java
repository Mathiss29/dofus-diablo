package com.ombrelune.diablofus;

import android.app.Activity;
import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.Window;
import android.view.WindowManager;
import org.json.JSONObject;

/** Ce que la page demande à l'appli par le pont (assets/pont/pont.js) : vibreur, luminosité, erreurs pour le journal. */
final class Pont {
  private Pont() {}

  static String journal(Context ignore) {
    Context c = Journal.contexte();
    return "Appli " + Principale.VERSION + "g · " + Moteur.version() + "\n" + (c != null ? Journal.lire(c) : "");
  }

  static void message(Context ctx, Activity activite, Window fenetre, String nom, Object m) {
    if (!(m instanceof JSONObject)) return;
    JSONObject o = (JSONObject) m;
    String k = o.optString("k");
    if (k.equals("vibrer")) vibrer(ctx, o.optDouble("fort", 0), o.optDouble("faible", 0), o.optDouble("ms", 100));
    else if (k.equals("lum")) luminosite(activite, fenetre, o.optDouble("f", -1));
    else if (k.equals("err") || k.equals("pret")) Journal.evenement(ctx, nom + " : " + o.optString("t"));
  }

  /** Forces de 0 à 1 : la Thor n'a qu'un moteur, on prend la plus forte. */
  static void vibrer(Context ctx, double fort, double faible, double ms) {
    int amp = (int) Math.round(Math.max(1, Math.min(255, 255 * Math.max(fort, faible))));
    long duree = (long) Math.max(10, Math.min(2000, ms));
    Vibrator v;
    if (Build.VERSION.SDK_INT >= 31) { VibratorManager m = (VibratorManager) ctx.getSystemService(Context.VIBRATOR_MANAGER_SERVICE); v = m != null ? m.getDefaultVibrator() : null; }
    else v = (Vibrator) ctx.getSystemService(Context.VIBRATOR_SERVICE);
    if (v == null || !v.hasVibrator()) return;
    v.vibrate(VibrationEffect.createOneShot(duree, v.hasAmplitudeControl() ? amp : VibrationEffect.DEFAULT_AMPLITUDE));
  }

  /** Luminosité de cet écran (0 à 1), -1 = celle du système. */
  static void luminosite(Activity activite, final Window fenetre, final double f) {
    if (fenetre == null || activite == null) return;
    activite.runOnUiThread(() -> {
      WindowManager.LayoutParams lp = fenetre.getAttributes();
      lp.screenBrightness = f < 0 ? WindowManager.LayoutParams.BRIGHTNESS_OVERRIDE_NONE : (float) Math.max(0.01, Math.min(1, f));
      fenetre.setAttributes(lp);
    });
  }
}
