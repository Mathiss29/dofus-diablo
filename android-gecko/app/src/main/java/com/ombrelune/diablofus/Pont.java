package com.ombrelune.diablofus;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.view.Display;
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
    else if (k.equals("hz")) frequence(activite, fenetre, o.optDouble("hz", 0));
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

  private static Activity haut;
  private static String modes = "?";
  /** Lancement qui suit une fermeture brutale : on ne touche pas à la fréquence de l'écran (appli 4 fermée 10 s après
   *  son lancement sur la Thor, 2026-11-25, juste après une demande de 120 Hz). */
  static boolean prudent = false;
  /**
   * « Fluidité Thor : » 5B + 5D : fréquence de l'écran de cette fenêtre. 0 = la plus haute que l'écran offre à cette
   * définition (120 Hz sur l'écran du haut de la Thor), sinon hz (60 : rythme régulier, batterie ménagée).
   * On donne à Android une fréquence souhaitée (preferredRefreshRate), pas un numéro de mode : l'appli 4 lisait les modes
   * d'un écran (celui de l'activité, vu comme 1080×1240 : l'écran du bas) et posait leur numéro sur la fenêtre d'un autre.
   */
  static void frequence(final Activity activite, final Window fenetre, final double hz) {
    if (fenetre == null || activite == null) return;
    haut = activite;
    if (prudent) { modes = "fréquence non touchée (lancement après une fermeture)"; Journal.evenement(activite, "écran : " + modes); return; }
    activite.runOnUiThread(() -> {
      try {
        Display d = fenetre.getDecorView().getDisplay();   // l'écran où la fenêtre est vraiment posée
        if (d == null) { Journal.evenement(activite, "écran : fenêtre pas encore posée, fréquence laissée"); return; }
        Display.Mode ici = d.getMode();
        float choix = hz > 0 ? (float) hz : ici.getRefreshRate();
        StringBuilder liste = new StringBuilder();
        for (Display.Mode m : d.getSupportedModes()) {
          if (m.getPhysicalWidth() != ici.getPhysicalWidth() || m.getPhysicalHeight() != ici.getPhysicalHeight()) continue;
          liste.append(liste.length() > 0 ? "/" : "").append(Math.round(m.getRefreshRate()));
          if (hz <= 0 && m.getRefreshRate() > choix + 0.5f) choix = m.getRefreshRate();
        }
        modes = "écran n° " + d.getDisplayId() + ", " + ici.getPhysicalWidth() + "×" + ici.getPhysicalHeight() + ", fréquences offertes " + liste + " Hz, souhaitée " + Math.round(choix) + " Hz";
        Journal.evenement(activite, "écran du jeu : " + modes + " (demande en cours)");
        WindowManager.LayoutParams lp = fenetre.getAttributes();
        if (Math.abs(lp.preferredRefreshRate - choix) > 0.5f) { lp.preferredRefreshRate = choix; fenetre.setAttributes(lp); }
        Journal.evenement(activite, "écran du jeu : demande faite");
        Moteur.ecran();
      } catch (Throwable e) { Journal.evenement(activite, "fréquence de l'écran : " + e); }
    });
  }

  /** Pour le rapport : l'écran du haut, les processus de l'appli (un par page si tout va bien), les réglages du moteur. */
  static String ecran() {
    StringBuilder t = new StringBuilder("écran du jeu : ").append(modes);
    try {
      Activity a = haut;
      if (a != null) {
        Display d = a.getWindow().getDecorView().getDisplay();
        if (d != null) t.append(", en ce moment ").append(Math.round(d.getRefreshRate())).append(" Hz");
      }
      Context c = Journal.contexte();
      ActivityManager am = c != null ? (ActivityManager) c.getSystemService(Context.ACTIVITY_SERVICE) : null;
      if (am != null && am.getRunningAppProcesses() != null) {
        StringBuilder p = new StringBuilder(); int pages = 0;
        for (ActivityManager.RunningAppProcessInfo i : am.getRunningAppProcesses()) {
          String n = i.processName; int k = n.indexOf(':');
          String court = k >= 0 ? n.substring(k + 1) : "appli";
          if (court.contains("tab")) pages++;
          p.append(p.length() > 0 ? ", " : "").append(court);
        }
        t.append(" · processus : ").append(p).append(" (").append(pages).append(" pour les pages)");
      }
    } catch (Throwable e) { t.append(" · processus : ").append(e); }
    return t.append(" · ").append(Moteur.reglages).toString();
  }
}
