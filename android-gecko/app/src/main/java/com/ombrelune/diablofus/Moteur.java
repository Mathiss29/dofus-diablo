package com.ombrelune.diablofus;

import android.content.Context;
import android.os.Handler;
import android.os.Looper;
import java.util.ArrayList;
import java.util.List;
import org.json.JSONObject;
import org.mozilla.geckoview.GeckoPreferenceController;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoRuntime;
import org.mozilla.geckoview.GeckoRuntimeSettings;
import org.mozilla.geckoview.WebExtension;

/**
 * Le moteur du jeu dans l'appli : GeckoView (le moteur de Firefox, livré DANS l'appli), au lieu du « Android System WebView »
 * de la Thor (version 109, début 2023, impossible à mettre à jour). Un seul moteur pour les deux écrans : même profil, donc
 * sauvegarde, BroadcastChannel et stockage partagés entre le jeu et l'écran du bas, comme deux onglets.
 */
final class Moteur {
  private Moteur() {}
  static final String NATIF = "diablofus";
  private static GeckoRuntime runtime;
  private static GeckoResult<WebExtension> pont;
  private static final List<WebExtension.Port> ports = new ArrayList<>();
  private static final Handler main = new Handler(Looper.getMainLooper());

  static GeckoRuntime runtime(Context ctx) {
    if (runtime == null) {
      GeckoRuntimeSettings s = new GeckoRuntimeSettings.Builder()
          .javaScriptEnabled(true)
          .remoteDebuggingEnabled(true)   // about:debugging depuis Firefox sur un PC, pour les rapports de bug
          .consoleOutput(true)
          .aboutConfigEnabled(true)
          // « Fluidité Thor : » 7B : un jeu en plein écran, pas un navigateur. Pas d'attente du double toucher (zoom),
          // pas de zoom sur les champs, pas de gonflage des textes, rien de ce qui sert à naviguer.
          .doubleTapZoomingEnabled(false)
          .inputAutoZoomEnabled(false)
          .fontInflation(false)
          .automaticFontSizeAdjustment(false)
          .loginAutofillEnabled(false)
          .translationsOfferPopup(false)
          .build();
      runtime = GeckoRuntime.create(ctx.getApplicationContext(), s);
      reglages();
    }
    return runtime;
  }

  /** Ce que l'appli a réglé dans le moteur (pour le rapport). */
  static String reglages = "réglages du moteur : pas encore posés";
  /**
   * « Fluidité Thor : » 7A + 7B : réglages du moteur, gardés dans le profil.
   * - dom.ipc.processCount : assez de processus de contenu pour que le jeu et l'écran du bas aient chacun le leur
   *   (une page occupée ne fait plus attendre l'autre) ;
   * - privacy.reduceTimerPrecision : Firefox arrondit l'horloge des pages à 1 ms ; un jeu a besoin de l'heure exacte de
   *   chaque image pour des mouvements réguliers.
   */
  private static void reglages() {
    try {
      List<GeckoPreferenceController.SetGeckoPreference<?>> l = new ArrayList<>();
      int b = GeckoPreferenceController.PREF_BRANCH_USER;
      l.add(GeckoPreferenceController.SetGeckoPreference.setIntPref("dom.ipc.processCount", 4, b));
      l.add(GeckoPreferenceController.SetGeckoPreference.setBoolPref("privacy.reduceTimerPrecision", false, b));
      GeckoPreferenceController.setGeckoPrefs(l).accept(
          r -> { reglages = "réglages du moteur : " + r; Journal.evenement(Journal.contexte(), reglages); },
          e -> { reglages = "réglages du moteur refusés : " + e; Journal.evenement(Journal.contexte(), reglages); });
    } catch (Throwable e) { reglages = "réglages du moteur impossibles : " + e; }
  }

  /** L'extension intégrée qui pose window.DiablofusAppli dans les pages (assets/pont). */
  static GeckoResult<WebExtension> pont(Context ctx) {
    if (pont == null) pont = runtime(ctx).getWebExtensionController().ensureBuiltIn("resource://android/assets/pont/", "pont@diablofus.com");
    return pont;
  }

  static String version() { return "Gecko " + org.mozilla.geckoview.BuildConfig.MOZILLA_VERSION; }

  static void ajouter(WebExtension.Port p) {
    ports.add(p);
    envoyer(p, "v", String.valueOf(Principale.VERSION) + "g");
    envoyer(p, "j", Pont.journal(null));
    envoyer(p, "m", Manette.json());
    ecran();
  }
  /** Ce que l'appli sait de l'écran et du moteur (fréquence, processus), pour le rapport : aux deux pages. */
  static void ecran() { if (!ports.isEmpty()) tous("e", Pont.ecran()); }
  static void retirer(WebExtension.Port p) { ports.remove(p); }

  private static void envoyer(WebExtension.Port p, String k, String v) {
    try { JSONObject o = new JSONObject(); o.put(k, v); p.postMessage(o); } catch (Throwable ignore) { /* port fermé */ }
  }
  private static void tous(String k, String v) { for (WebExtension.Port p : new ArrayList<>(ports)) envoyer(p, k, v); }

  /** La manette a bougé : les deux pages reçoivent le nouvel état (lu sans attendre par manette()). */
  static void manette() { if (!ports.isEmpty()) tous("m", Manette.json()); }
  /** Le journal a changé (page chargée, erreur…) : pour « Copier le rapport » de l'écran du bas. */
  static void journal() { main.post(Journaliser.UN); }
  private static final class Journaliser implements Runnable {
    static final Journaliser UN = new Journaliser();
    @Override public void run() { if (!ports.isEmpty()) { tous("j", Pont.journal(null)); tous("e", Pont.ecran()); } }
  }

  /** Retour Android : Échap dans cette page. */
  static void retour(WebExtension.Port p) {
    if (p == null) return;
    try { JSONObject o = new JSONObject(); o.put("retour", true); p.postMessage(o); } catch (Throwable ignore) { }
  }
}
