package com.ombrelune.diablofus;

import android.os.Build;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;

/** Plein écran (barres d'Android cachées, un glissement les montre un instant) et écran qui ne s'éteint pas. */
final class Plein {
  private Plein() {}

  static void appliquer(Window w) {
    w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    if (Build.VERSION.SDK_INT >= 30) {
      w.setDecorFitsSystemWindows(false);
      WindowInsetsController c = w.getInsetsController();
      if (c != null) {
        c.hide(WindowInsets.Type.systemBars());
        c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
      }
    } else {
      w.getDecorView().setSystemUiVisibility(0x1000 | 0x4 | 0x2 | 0x200 | 0x400 | 0x100);   // IMMERSIVE_STICKY, plein écran, sans navigation
    }
  }
}
