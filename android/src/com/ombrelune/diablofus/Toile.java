package com.ombrelune.diablofus;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.webkit.WebChromeClient;
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

  static WebView creer(Context ctx, Pont pont, String url) {
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
    w.setWebChromeClient(new WebChromeClient());
    w.setWebViewClient(new Liens(ctx));
    w.loadUrl(url);
    return w;
  }

  private static final class Liens extends WebViewClient {
    private final Context ctx;
    Liens(Context ctx) { this.ctx = ctx; }
    @Override public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
      if (dansAppli(r.getUrl())) return false;
      try { ctx.startActivity(new Intent(Intent.ACTION_VIEW, r.getUrl()).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception e) { /* pas de navigateur */ }
      return true;
    }
  }

  /** Retour système (geste ou touche) : Échap dans la page, comme au clavier. */
  static void retour(WebView w) {
    w.evaluateJavascript("(()=>{const o={key:'Escape',code:'Escape',keyCode:27,which:27,bubbles:true,cancelable:true};"
        + "(document.activeElement||document.body).dispatchEvent(new KeyboardEvent('keydown',o));document.dispatchEvent(new KeyboardEvent('keyup',o));})()", null);
  }
}
