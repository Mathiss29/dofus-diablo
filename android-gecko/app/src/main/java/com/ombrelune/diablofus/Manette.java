package com.ombrelune.diablofus;

import android.os.SystemClock;
import android.view.InputDevice;
import android.view.InputEvent;
import android.view.KeyEvent;
import android.view.MotionEvent;

/**
 * La manette de la Thor, lue par l'appli et passée à la page (DiablofusAppli.manette()), dans la disposition standard du
 * navigateur (A B X Y LB RB LT RT Select Start L3 R3 croix, Accueil). Un seul état pour les deux écrans : toucher l'écran
 * du bas ne coupe donc jamais la manette du jeu.
 */
final class Manette {
  private static final int NB = 17;
  private static final float[] cles = new float[NB], axesBoutons = new float[NB];
  private static final float[] axes = new float[4];
  private static boolean connectee = false;
  private static long temps = 0;

  private Manette() {}

  private static int index(int code) {
    switch (code) {
      case KeyEvent.KEYCODE_BUTTON_A: return 0;
      case KeyEvent.KEYCODE_BUTTON_B: return 1;
      case KeyEvent.KEYCODE_BUTTON_X: return 2;
      case KeyEvent.KEYCODE_BUTTON_Y: return 3;
      case KeyEvent.KEYCODE_BUTTON_L1: return 4;
      case KeyEvent.KEYCODE_BUTTON_R1: return 5;
      case KeyEvent.KEYCODE_BUTTON_L2: return 6;
      case KeyEvent.KEYCODE_BUTTON_R2: return 7;
      case KeyEvent.KEYCODE_BUTTON_SELECT: return 8;
      case KeyEvent.KEYCODE_BUTTON_START: return 9;
      case KeyEvent.KEYCODE_BUTTON_THUMBL: return 10;
      case KeyEvent.KEYCODE_BUTTON_THUMBR: return 11;
      case KeyEvent.KEYCODE_DPAD_UP: return 12;
      case KeyEvent.KEYCODE_DPAD_DOWN: return 13;
      case KeyEvent.KEYCODE_DPAD_LEFT: return 14;
      case KeyEvent.KEYCODE_DPAD_RIGHT: return 15;
      case KeyEvent.KEYCODE_BUTTON_MODE: return 16;
      default: return -1;
    }
  }

  /** Vrai si l'évènement vient d'une manette (jamais du clavier à l'écran : le tchat garde ses touches). */
  private static boolean deManette(InputEvent e) {
    InputDevice d = e.getDevice();
    if (d == null || d.isVirtual()) return false;
    int s = d.getSources();
    return (s & InputDevice.SOURCE_GAMEPAD) == InputDevice.SOURCE_GAMEPAD || (s & InputDevice.SOURCE_JOYSTICK) == InputDevice.SOURCE_JOYSTICK;
  }

  /** Touche de manette : prise (vrai), elle ne part pas à la page comme une touche du clavier. */
  static synchronized boolean cle(KeyEvent e) {
    int i = index(e.getKeyCode());
    if (i < 0 || !deManette(e)) return false;
    if (e.getAction() == KeyEvent.ACTION_DOWN) cles[i] = 1f;
    else if (e.getAction() == KeyEvent.ACTION_UP) cles[i] = 0f;
    connectee = true; temps = SystemClock.uptimeMillis();
    return true;
  }

  private static float axe(MotionEvent e, InputDevice d, int a) {
    return d != null && d.getMotionRange(a, e.getSource()) != null ? e.getAxisValue(a) : 0f;
  }

  /** Sticks, gâchettes analogiques et croix en axes (HAT). */
  static synchronized boolean mouvement(MotionEvent e) {
    if ((e.getSource() & InputDevice.SOURCE_JOYSTICK) != InputDevice.SOURCE_JOYSTICK || e.getAction() != MotionEvent.ACTION_MOVE) return false;
    InputDevice d = e.getDevice();
    axes[0] = axe(e, d, MotionEvent.AXIS_X); axes[1] = axe(e, d, MotionEvent.AXIS_Y);
    axes[2] = axe(e, d, MotionEvent.AXIS_Z); axes[3] = axe(e, d, MotionEvent.AXIS_RZ);
    axesBoutons[6] = Math.max(axe(e, d, MotionEvent.AXIS_LTRIGGER), axe(e, d, MotionEvent.AXIS_BRAKE));
    axesBoutons[7] = Math.max(axe(e, d, MotionEvent.AXIS_RTRIGGER), axe(e, d, MotionEvent.AXIS_GAS));
    float hx = axe(e, d, MotionEvent.AXIS_HAT_X), hy = axe(e, d, MotionEvent.AXIS_HAT_Y);
    axesBoutons[14] = hx < -0.5f ? 1f : 0f; axesBoutons[15] = hx > 0.5f ? 1f : 0f;
    axesBoutons[12] = hy < -0.5f ? 1f : 0f; axesBoutons[13] = hy > 0.5f ? 1f : 0f;
    connectee = true; temps = SystemClock.uptimeMillis();
    return true;
  }

  /** {"c":true,"b":[17 valeurs 0..1],"a":[x,y,z,rz],"t":ms} */
  static synchronized String json() {
    if (!connectee) return "{\"c\":false}";
    StringBuilder s = new StringBuilder(160).append("{\"c\":true,\"b\":[");
    for (int i = 0; i < NB; i++) { if (i > 0) s.append(','); s.append(Math.max(cles[i], axesBoutons[i])); }
    s.append("],\"a\":[");
    for (int i = 0; i < 4; i++) { if (i > 0) s.append(','); s.append(axes[i]); }
    return s.append("],\"t\":").append(temps).append('}').toString();
  }

  /** Appli cachée : on relâche tout (un bouton tenu au moment de quitter ne reste pas appuyé). */
  static synchronized void lacher() {
    java.util.Arrays.fill(cles, 0f); java.util.Arrays.fill(axesBoutons, 0f); java.util.Arrays.fill(axes, 0f);
  }
}
