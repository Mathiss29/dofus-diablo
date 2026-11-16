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
    File f = fichier(a);
    if (!f.exists()) return false;
    String t;
    try { t = new String(Files.readAllBytes(f.toPath()), StandardCharsets.UTF_8); } catch (Throwable e) { t = String.valueOf(e); }
    f.delete();
    if (t.length() > 6000) t = t.substring(0, 6000);
    final String texte = t;
    new AlertDialog.Builder(a)
        .setTitle("Diablofus a planté au dernier lancement")
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
