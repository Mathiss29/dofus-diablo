package com.ombrelune.diablofus;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Une page du jeu : même profil pour les deux écrans (sauvegarde, BroadcastChannel et stockage partagés). */
final class Toile {
  static final String JEU = "https://diablofus.com/";
  static final String BAS = "https://diablofus.com/#compagnon";

  private Toile() {}

  /** Le jeu, ses fichiers et la connexion Discord restent dans l'appli ; tout autre lien part dans le navigateur. */
  static boolean dansAppli(Uri u) {
    String h = u.getHost();
    if (h == null) return true;
    return h.equals("diablofus.com") || h.endsWith(".diablofus.com") || h.equals("discord.com") || h.endsWith(".discord.com") || h.equals("discordapp.com");
  }

  /** Appelé quand Android tue la page (le WebView est alors inutilisable : il faut en refaire un). */
  interface SurPerte { void pagePerdue(WebView w); }

  static WebView creer(Context ctx, Pont pont, String url, SurPerte perte) {
    WebView w = new WebView(ctx);
    WebSettings s = w.getSettings();
    s.setJavaScriptEnabled(true);
    s.setDomStorageEnabled(true);
    s.setDatabaseEnabled(true);
    s.setMediaPlaybackRequiresUserGesture(false);
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
    s.setUserAgentString(s.getUserAgentString() + " DiablofusAppli/1");
    w.addJavascriptInterface(pont, "DiablofusAppli");
    w.setBackgroundColor(0xFF12141B);
    w.setWebChromeClient(new Console(ctx, url));
    w.setWebViewClient(new Liens(ctx, url, perte));
    w.loadUrl(url);
    return w;
  }

  private static final class Liens extends WebViewClient {
    private final Context ctx; private final String nom; private final SurPerte perte;
    Liens(Context ctx, String nom, SurPerte perte) { this.ctx = ctx; this.nom = nom.endsWith("#compagnon") ? "bas" : "jeu"; this.perte = perte; }
    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
      if (dansAppli(r.getUrl())) return false;
      try { ctx.startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception e) { /* pas de navigateur */ }
      return true;
    }
    @Override public void onPageFinished(WebView v, String url) { Journal.evenement(ctx, nom + " : page chargée"); }
    @Override public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
      if (r.isForMainFrame()) Journal.evenement(ctx, nom + " : erreur réseau " + e.getErrorCode() + " " + e.getDescription());
    }
    /** Sans cette réponse, Android ferme TOUTE l'appli quand la page meurt (manque de mémoire, plantage de la carte graphique). */
    @Override public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
      Journal.evenement(ctx, nom + " : page tuée par Android (" + (d.didCrash() ? "plantage" : "mémoire") + ", priorité " + d.rendererPriorityAtExit() + ")");
      if (perte != null) perte.pagePerdue(v);
      return true;
    }
  }

  /** Erreurs JavaScript de la page, gardées pour le rapport. */
  private static final class Console extends WebChromeClient {
    private final Context ctx; private final String nom;
    Console(Context ctx, String url) { this.ctx = ctx; this.nom = url.endsWith("#compagnon") ? "bas" : "jeu"; }
    @Override public boolean onConsoleMessage(ConsoleMessage m) {
      if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR) Journal.evenement(ctx, nom + " : " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
      return false;
    }
  }

  /** Retour système (geste ou touche) : Échap dans la page, comme au clavier. */
  static void retour(WebView w) {
    w.evaluateJavascript("(()=>{const o={key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true};"
        + "(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',o));document.dispatchEvent(new KeyboardEvent('keyup',o));})()", null);
  }
}
