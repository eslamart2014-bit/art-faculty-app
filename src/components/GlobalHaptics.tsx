"use client";

import { useEffect } from "react";

export default function GlobalHaptics() {
  useEffect(() => {
    if (typeof window === "undefined" || !navigator.vibrate) return;

    let lastVibrate = 0;

    const handlePointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      // Detect interactive buttons, tabs, links, or custom controls
      const interactiveEl = target.closest(
        'button, [role="button"], a, input[type="button"], input[type="submit"], select, .clickable, [data-interactive="true"]'
      );

      if (interactiveEl) {
        const now = Date.now();
        if (now - lastVibrate > 70) {
          lastVibrate = now;
          try {
            // 15ms subtle buzz for physical press confirmation
            navigator.vibrate(15);
          } catch (err) {}
        }
      }
    };

    window.addEventListener("pointerdown", handlePointerDown, { passive: true, capture: true });

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown, { capture: true });
    };
  }, []);

  return null;
}
