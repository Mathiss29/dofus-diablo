package com.ombrelune.diablofus;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.ClipboardManager;
import android.content.Context;
import android.widget.Toast;
import java.io.File;
import java.io.FileOutputStream;
import java.io.PrintWriter;
import java.io.StringWriter;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;

/**
 * Plantages de l'appli : la trace est écrite dans un fichier avant que l'appli se ferme, puis montrée au lancement
 * suivant (bouton Copier, à coller dans le fil). Après un plantage, l'appli démarre sans l'écran du bas (mode sûr).
 */
final class Journal {
  private Journal() {}

  private static File fichier(Context c) { return new File(c.getFilesDir(), "plantage.txt"); }
  private static File marqueur(Context c) { return new File(c.getFilesDir(), "en-cours.txt"); }
  private static File evts(Context c) { return new File(c.getFilesDir(), "evenements.txt"); }

  /** Ce qui s'est passé pendant la partie (page chargée, erreurs de la page, page tuée par Android) : 40 dernières lignes. */
  static synchronized void evenement(Context c, String t) {
    try {
      File f = evts(c);
      java.util.List<String> l = f.exists() ? new java.util.ArrayList<>(Files.readAllLines(f.toPath(), StandardCharsets.UTF_8)) : new java.util.ArrayList<String>();
      l.add(new java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.FRANCE).format(new java.util.Date()) + "  " + t.replace('\n', ' '));
      while (l.size() > 40) l.remove(0);
      Files.write(f.toPath(), l, StandardCharsets.UTF_8);
    } catch (Throwable ignore) { /* rien */ }
  }
  /** Les évènements gardés (pour le rapport de l'écran du bas). */
  static synchronized String lire(Context c) {
    try { File f = evts(c); return f.exists() ? new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8) : ""; } catch (Throwable e) { return String.valueOf(e); }
  }
  /** Lancement : un marqueur reste tant que l'appli n'est pas quittée proprement (une fermeture brutale le laisse). */
  static void marquerLancement(Context c) { try { new FileOutputStream(marqueur(c)).close(); } catch (Throwable ignore) { } }
  static void marquerSortie(Context c) { marqueur(c).delete(); }

  static void brancher(final Context c) {
    final Thread.UncaughtExceptionHandler avant = Thread.getDefaultUncaughtExceptionHandler();
    Thread.setDefaultUncaughtExceptionHandler(new Gardien(c.getApplicationContext(), avant));
  }

  private static final class Gardien implements Thread.UncaughtExceptionHandler {
    private final Context c; private final Thread.UncaughtExceptionHandler avant;
    Gardien(Context c, Thread.UncaughtExceptionHandler avant) { this.c = c; this.avant = avant; }
    @Override public void uncaughtException(Thread t, Throwable e) {
      noter(c, e);
      if (avant != null) avant.uncaughtException(t, e);
    }
  }

  /** Écrit la trace (aussi pour une erreur rattrapée qu'on veut voir). */
  static void noter(Context c, Throwable e) {
    try {
      StringWriter s = new StringWriter();
      s.append("Diablofus Thor ").append(String.valueOf(Principale.VERSION)).append(" · Android ").append(android.os.Build.VERSION.RELEASE)
          .append(" · ").append(android.os.Build.MODEL).append('\n');
      e.printStackTrace(new PrintWriter(s));
      try (FileOutputStream o = new FileOutputStream(fichier(c), true)) { o.write(s.toString().getBytes(StandardCharsets.UTF_8)); }
    } catch (Throwable ignore) { /* rien à faire */ }
  }

  /** Vrai s'il y a eu un plantage depuis le dernier lancement (et le montre). */
  static boolean montrerSiPlantage(final Activity a) {
    File f = fichier(a), m = marqueur(a), ev = evts(a);
    boolean trace = f.exists(), brutal = m.exists();
    if (!trace && !brutal) { ev.delete(); return false; }
    StringBuilder t = new StringBuilder();
    t.append("Diablofus Thor ").append(Principale.VERSION).append(" · Android ").append(android.os.Build.VERSION.RELEASE).append(" · ").append(android.os.Build.MODEL);
    try { android.content.pm.PackageInfo w = android.webkit.WebView.getCurrentWebViewPackage(); if (w != null) t.append(" · WebView ").append(w.versionName); } catch (Throwable ignore) { }
    t.append('\n');
    if (!trace) t.append("Fermeture sans erreur Java (page tuée par Android, mémoire ?)\n");
    try { if (trace) t.append(new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8)); } catch (Throwable e) { t.append(e); }
    try { if (ev.exists()) t.append("\nDernières nouvelles :\n").append(new String(Files.readAllBytes(ev.toPath()), StandardCharsets.UTF_8)); } catch (Throwable ignore) { }
    f.delete(); m.delete(); ev.delete();
    String texte = t.length() > 8000 ? t.substring(t.length() - 8000) : t.toString();
    new AlertDialog.Builder(a)
        .setTitle("Diablofus s'est fermé au dernier lancement")
        .setMessage("Copie ce rapport et colle-le dans le fil. Cette fois, l'écran du bas reste éteint.\n\n" + texte)
        .setPositiveButton("Copier", new Copier(a, texte))
        .setNegativeButton("Fermer", null)
        .show();
    return true;
  }

  private static final class Copier implements android.content.DialogInterface.OnClickListener {
    private final Activity a; private final String t;
    Copier(Activity a, String t) { this.a = a; this.t = t; }
    @Override public void onClick(android.content.DialogInterface d, int w) {
      ClipboardManager m = (ClipboardManager) a.getSystemService(Context.CLIPBOARD_SERVICE);
      if (m != null) m.setPrimaryClip(ClipData.newPlainText("Diablofus", t));
      Toast.makeText(a, "Rapport copié", Toast.LENGTH_SHORT).show();
    }
  }
}
