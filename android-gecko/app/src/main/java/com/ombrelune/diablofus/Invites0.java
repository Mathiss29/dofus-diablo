package com.ombrelune.diablofus;

import android.app.AlertDialog;
import android.content.Context;
import android.graphics.Color;
import android.view.View;
import android.widget.EditText;
import android.widget.LinearLayout;
import android.widget.SeekBar;
import android.widget.TextView;
import java.util.ArrayList;
import java.util.List;
import org.mozilla.geckoview.GeckoResult;
import org.mozilla.geckoview.GeckoSession;
import org.mozilla.geckoview.GeckoSession.PromptDelegate;

/**
 * Fenêtres que la page demande au moteur : listes déroulantes (<select> des Options), couleurs (création du perso),
 * alert/confirm/prompt. GeckoView ne les dessine pas lui-même (rapport de Mathis, appli 2 : « je ne peux pas modifier
 * les paramètres en jeu ») : l'appli les ouvre en fenêtres Android (stick/croix + A, ou au doigt).
 */
class Invites0 implements PromptDelegate {
  private final Context ctx;
  Invites0(Context ctx) { this.ctx = ctx; }

  private AlertDialog.Builder fenetre() { return new AlertDialog.Builder(ctx, android.R.style.Theme_DeviceDefault_Dialog_Alert); }
  private static <T> void montrer(AlertDialog.Builder b, GeckoResult<T> r, T siAnnule) {
    // fermée sans choix : la page reçoit « annulé » (déjà répondu : complete() refuse, on l'ignore)
    try { AlertDialog d = b.create(); d.setOnDismissListener(x -> { try { r.complete(siAnnule); } catch (Throwable ignore) { } }); d.show(); }
    catch (Throwable e) { try { r.complete(siAnnule); } catch (Throwable ignore) { } }
  }
  private static String nom(String t, String sinon) { return t == null || t.isEmpty() ? sinon : t; }

  /** <select> : une liste (choix unique) ou des cases (choix multiple), groupes aplatis. */
  @Override public GeckoResult<PromptResponse> onChoicePrompt(GeckoSession s, ChoicePrompt p) {
    final List<ChoicePrompt.Choice> liste = new ArrayList<>();
    aplatir(p.choices, liste);
    final GeckoResult<PromptResponse> r = new GeckoResult<>();
    final String[] noms = new String[liste.size()];
    int coche = -1;
    final boolean[] cochees = new boolean[liste.size()];
    for (int i = 0; i < liste.size(); i++) { ChoicePrompt.Choice c = liste.get(i); noms[i] = c.label; cochees[i] = c.selected; if (c.selected && coche < 0) coche = i; }
    AlertDialog.Builder b = fenetre();
    if (p.title != null && !p.title.isEmpty()) b.setTitle(p.title);
    if (p.type == ChoicePrompt.Type.MULTIPLE) {
      b.setMultiChoiceItems(noms, cochees, (d, i, oui) -> cochees[i] = oui);
      b.setPositiveButton("OK", (d, w) -> {
        List<String> ids = new ArrayList<>();
        for (int i = 0; i < liste.size(); i++) if (cochees[i]) ids.add(liste.get(i).id);
        r.complete(p.confirm(ids.toArray(new String[0])));
      });
    } else {
      b.setSingleChoiceItems(noms, coche, (d, i) -> {
        ChoicePrompt.Choice c = liste.get(i);
        if (c.disabled) return;
        r.complete(p.confirm(c));
        d.dismiss();
      });
    }
    montrer(b, r, p.dismiss());
    return r;
  }
  private static void aplatir(ChoicePrompt.Choice[] cs, List<ChoicePrompt.Choice> out) {
    if (cs == null) return;
    for (ChoicePrompt.Choice c : cs) { if (c.items != null) aplatir(c.items, out); else if (!c.separator) out.add(c); }
  }

  /** <input type="color"> : rouge, vert, bleu en curseurs, avec l'aperçu. */
  @Override public GeckoResult<PromptResponse> onColorPrompt(GeckoSession s, ColorPrompt p) {
    final GeckoResult<PromptResponse> r = new GeckoResult<>();
    int c0;
    try { c0 = Color.parseColor(p.defaultValue != null ? p.defaultValue : "#808080"); } catch (Throwable e) { c0 = Color.GRAY; }
    final int[] rgb = { Color.red(c0), Color.green(c0), Color.blue(c0) };
    LinearLayout l = new LinearLayout(ctx); l.setOrientation(LinearLayout.VERTICAL); l.setPadding(48, 24, 48, 0);
    final View apercu = new View(ctx); apercu.setBackgroundColor(c0); l.addView(apercu, new LinearLayout.LayoutParams(LinearLayout.LayoutParams.MATCH_PARENT, 72));
    String[] noms = { "Rouge", "Vert", "Bleu" };
    for (int k = 0; k < 3; k++) {
      final int i = k;
      TextView t = new TextView(ctx); t.setText(noms[k]); l.addView(t);
      SeekBar b = new SeekBar(ctx); b.setMax(255); b.setProgress(rgb[k]);
      b.setOnSeekBarChangeListener(new SeekBar.OnSeekBarChangeListener() {
        @Override public void onProgressChanged(SeekBar sb, int v, boolean u) { rgb[i] = v; apercu.setBackgroundColor(Color.rgb(rgb[0], rgb[1], rgb[2])); }
        @Override public void onStartTrackingTouch(SeekBar sb) { }
        @Override public void onStopTrackingTouch(SeekBar sb) { }
      });
      l.addView(b);
    }
    AlertDialog.Builder b = fenetre().setTitle(nom(p.title, "Couleur")).setView(l)
        .setPositiveButton("OK", (d, w) -> r.complete(p.confirm(String.format("#%02x%02x%02x", rgb[0], rgb[1], rgb[2]))))
        .setNegativeButton("Annuler", null);
    montrer(b, r, p.dismiss());
    return r;
  }

  @Override public GeckoResult<PromptResponse> onAlertPrompt(GeckoSession s, AlertPrompt p) {
    final GeckoResult<PromptResponse> r = new GeckoResult<>();
    montrer(fenetre().setTitle(p.title).setMessage(p.message).setPositiveButton("OK", null), r, p.dismiss());
    return r;
  }

  /** confirm() */
  @Override public GeckoResult<PromptResponse> onButtonPrompt(GeckoSession s, ButtonPrompt p) {
    final GeckoResult<PromptResponse> r = new GeckoResult<>();
    AlertDialog.Builder b = fenetre().setTitle(p.title).setMessage(p.message)
        .setPositiveButton("OK", (d, w) -> r.complete(p.confirm(ButtonPrompt.Type.POSITIVE)))
        .setNegativeButton("Annuler", (d, w) -> r.complete(p.confirm(ButtonPrompt.Type.NEGATIVE)));
    montrer(b, r, p.dismiss());
    return r;
  }

  /** prompt() */
  @Override public GeckoResult<PromptResponse> onTextPrompt(GeckoSession s, TextPrompt p) {
    final GeckoResult<PromptResponse> r = new GeckoResult<>();
    final EditText e = new EditText(ctx); e.setText(p.defaultValue);
    AlertDialog.Builder b = fenetre().setTitle(p.title).setMessage(p.message).setView(e)
        .setPositiveButton("OK", (d, w) -> r.complete(p.confirm(e.getText().toString())))
        .setNegativeButton("Annuler", null);
    montrer(b, r, p.dismiss());
    return r;
  }
}
