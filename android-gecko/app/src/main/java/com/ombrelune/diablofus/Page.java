package com.ombrelune.diablofus;

import android.app.Activity;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.view.Window;
import org.mozilla.geckoview.AllowOrDeny;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoSessionSettings;
import org.mozilla.geckoview.GeckoView;
import org.mozilla.geckoview.WebExtension;
import org.mozilla.geckoview.WebResponse;

/** Une page du jeu (le jeu en haut ou l'écran du bas) dans le moteur de l'appli. Si Android tue la page, on en refait une. */
final class Page {
  static final String JEU = "https://diablofus.com/";
  static final String BAS = "https://diablofus.com/#compagnon";

  /** Appelé quand la page meurt (mémoire, plantage) : la page est déjà relancée, c'est pour compter. */
  interface SurPerte { void pagePerdue(Page p); }
  /** Choix d'un fichier (charger une sauvegarde) : seule l'activité sait le demander à Android. */
  interface Fichiers { GeckoResult<GeckoSession.PromptDelegate.PromptResponse> choisir(GeckoSession.PromptDelegate.FilePrompt p); }

  final GeckoView vue;
  GeckoSession session;
  WebExtension.Port port;
  private final Context ctx; private final Activity activite; private final Window fenetre;
  private final String url, nom; private final SurPerte perte; private final Fichiers fichiers;

  Page(Context ctx, Activity activite, Window fenetre, String url, SurPerte perte, Fichiers fichiers) {
    this.ctx = ctx; this.activite = activite; this.fenetre = fenetre; this.url = url; this.perte = perte; this.fichiers = fichiers;
    this.nom = url.endsWith("#compagnon") ? "bas" : "jeu";
    vue = new GeckoView(ctx);
    vue.coverUntilFirstPaint(0xFF12141B);
    ouvrir();
  }

  /** Le jeu, ses fichiers et la connexion Discord restent dans l'appli ; tout autre lien part dans le navigateur. */
  static boolean dansAppli(Uri u) {
    String s = u.getScheme();
    if (s != null && !s.equals("https") && !s.equals("http")) return s.equals("about") || s.equals("data") || s.equals("blob") || s.equals("resource");
    String h = u.getHost();
    if (h == null) return true;
    return h.equals("diablofus.com") || h.endsWith(".diablofus.com") || h.equals("discord.com") || h.endsWith(".discord.com") || h.equals("discordapp.com");
  }

  private void ouvrir() {
    GeckoSessionSettings s = new GeckoSessionSettings.Builder()
        .usePrivateMode(false)
        .useTrackingProtection(false)
        .allowJavascript(true)
        .userAgentOverride(GeckoSession.getDefaultUserAgent() + " DiablofusAppli/1")
        .build();
    final GeckoSession se = new GeckoSession(s);
    session = se;
    se.setContentDelegate(new Contenu());
    se.setNavigationDelegate(new Navigation());
    se.setProgressDelegate(new Progres());
    se.setPermissionDelegate(new Permissions());
    se.setPromptDelegate(new Invites());
    se.open(Moteur.runtime(ctx));
    // « Fluidité Thor : » 7A : le jeu passe avant l'écran du bas (priorité du processus de sa page)
    if (nom.equals("jeu")) try { se.setPriorityHint(GeckoSession.PRIORITY_HIGH); } catch (Throwable ignore) { }
    vue.setSession(se);
    Moteur.pont(ctx).accept(ext -> {
      if (se != session) return;
      if (ext != null) se.getWebExtensionController().setMessageDelegate(ext, new Messages(), Moteur.NATIF);
      se.loadUri(url);
    }, e -> {
      Journal.evenement(ctx, nom + " : pont indisponible (" + e + ")");
      if (se == session) se.loadUri(url);

    });
  }

  /** La page est morte : on la refait dans la même vue. */
  private void relancer(String pourquoi) {
    Journal.evenement(ctx, nom + " : " + pourquoi);
    GeckoSession vieille = session;
    if (port != null) { Moteur.retirer(port); port = null; }
    try { vue.releaseSession(); } catch (Throwable ignore) { }
    try { vieille.close(); } catch (Throwable ignore) { }
    ouvrir();
    if (perte != null) perte.pagePerdue(this);
  }

  void actif(boolean oui) { try { session.setActive(oui); session.setFocused(oui); } catch (Throwable ignore) { } }
  void retour() { Moteur.retour(port); }

  void fermer() {
    if (port != null) { Moteur.retirer(port); port = null; }
    try { vue.releaseSession(); } catch (Throwable ignore) { }
    try { session.close(); } catch (Throwable ignore) { }
  }

  private final class Messages implements WebExtension.MessageDelegate {
    @Override public void onConnect(WebExtension.Port p) {
      if (port != null) Moteur.retirer(port);
      port = p;
      p.setDelegate(new WebExtension.PortDelegate() {
        @Override public void onPortMessage(Object m, WebExtension.Port q) { Pont.message(ctx, activite, fenetre, nom, m); }
        @Override public void onDisconnect(WebExtension.Port q) { Moteur.retirer(q); if (port == q) port = null; }
      });
      Moteur.ajouter(p);
    }
  }

  private final class Contenu implements GeckoSession.ContentDelegate {
    @Override public void onCrash(GeckoSession s) { if (s == session) relancer("page plantée (moteur), relancée"); }
    @Override public void onKill(GeckoSession s) { if (s == session) relancer("page tuée par Android (mémoire), relancée"); }
    @Override public void onExternalResponse(GeckoSession s, WebResponse r) { Journal.evenement(ctx, nom + " : téléchargement ignoré " + r.uri); }
  }

  private final class Navigation implements GeckoSession.NavigationDelegate {
    @Override public GeckoResult<AllowOrDeny> onLoadRequest(GeckoSession s, LoadRequest r) {
      Uri u = Uri.parse(r.uri);
      if (dansAppli(u)) return GeckoResult.allow();
      dehors(u);
      return GeckoResult.deny();
    }
    @Override public GeckoResult<GeckoSession> onNewSession(GeckoSession s, String uri) {   // window.open : dans la page, ou dehors
      Uri u = Uri.parse(uri);
      if (dansAppli(u)) s.loadUri(uri); else dehors(u);
      return null;
    }
  }
  private void dehors(Uri u) {
    try { ctx.startActivity(new Intent(Intent.ACTION_VIEW, u).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)); } catch (Exception e) { /* pas de navigateur */ }
  }

  private final class Progres implements GeckoSession.ProgressDelegate {
    @Override public void onPageStop(GeckoSession s, boolean ok) { Journal.evenement(ctx, nom + (ok ? " : page chargée" : " : page non chargée (réseau ?)")); }
  }

  /** Musique et sons sans toucher l'écran (la manette ne compte pas comme un geste pour le navigateur), stockage gardé. */
  private static final class Permissions implements GeckoSession.PermissionDelegate {
    @Override public GeckoResult<Integer> onContentPermissionRequest(GeckoSession s, ContentPermission p) {
      switch (p.permission) {
        case PERMISSION_AUTOPLAY_AUDIBLE:
        case PERMISSION_AUTOPLAY_INAUDIBLE:
        case PERMISSION_PERSISTENT_STORAGE:
        case PERMISSION_STORAGE_ACCESS:
          return GeckoResult.fromValue(ContentPermission.VALUE_ALLOW);
        default:
          return GeckoResult.fromValue(ContentPermission.VALUE_DENY);
      }
    }
  }

  private final class Invites extends Invites0 {
    Invites() { super(ctx); }
    @Override public GeckoResult<PromptResponse> onFilePrompt(GeckoSession s, FilePrompt p) {
      return fichiers != null ? fichiers.choisir(p) : GeckoResult.fromValue(p.dismiss());
    }
  }
}
