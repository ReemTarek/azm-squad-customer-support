const STYLE_ELEMENT_ID = "branding-color-override";

function hexToRgbTriplet(hex: string): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const r = (num >> 16) & 0xff;
  const g = (num >> 8) & 0xff;
  const b = num & 0xff;
  return `${r}, ${g}, ${b}`;
}

// A simple linear lighten/darken (percent negative = darker, positive =
// lighter) — not Bootstrap's own SASS shade-color()/tint-color() (those
// only run at build time), but close enough to produce a genuinely
// distinct, sensible hover/active shade at runtime.
function shadeColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const clamp = (v: number) => Math.max(0, Math.min(255, v));
  const r = clamp(((num >> 16) & 0xff) + amt);
  const g = clamp(((num >> 8) & 0xff) + amt);
  const b = clamp((num & 0xff) + amt);
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

/**
 * Injects (or removes, when color is null) a <style> block overriding
 * Bootstrap's primary-color custom properties at runtime. Two distinct
 * targets are needed: :root-level variables that Bootstrap's compiled
 * CSS genuinely reads generically (--bs-primary/--bs-primary-rgb for
 * .text-primary/.bg-primary/.border-primary, --bs-link-color-rgb for
 * default <a> links), and .btn-primary/.btn-outline-primary's OWN
 * scoped --bs-btn-* variables, which Bootstrap's precompiled CSS bakes
 * to literal hex values independent of --bs-primary — overriding only
 * the :root variable would leave every primary button's actual
 * rendered color unchanged.
 */
export function applyBrandColor(hex: string | null): void {
  let styleEl = document.getElementById(STYLE_ELEMENT_ID) as HTMLStyleElement | null;

  if (!hex) {
    styleEl?.remove();
    return;
  }

  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = STYLE_ELEMENT_ID;
    document.head.appendChild(styleEl);
  }

  const rgb = hexToRgbTriplet(hex);
  const hoverShade = shadeColor(hex, -15);
  const activeShade = shadeColor(hex, -20);

  styleEl.textContent = `
    :root {
      --bs-primary: ${hex};
      --bs-primary-rgb: ${rgb};
      --bs-link-color: ${hex};
      --bs-link-color-rgb: ${rgb};
      --bs-link-hover-color: ${hoverShade};
      --bs-link-hover-color-rgb: ${hexToRgbTriplet(hoverShade)};
    }
    .btn-primary {
      --bs-btn-bg: ${hex};
      --bs-btn-border-color: ${hex};
      --bs-btn-hover-bg: ${hoverShade};
      --bs-btn-hover-border-color: ${hoverShade};
      --bs-btn-active-bg: ${activeShade};
      --bs-btn-active-border-color: ${activeShade};
      --bs-btn-disabled-bg: ${hex};
      --bs-btn-disabled-border-color: ${hex};
      --bs-btn-focus-shadow-rgb: ${rgb};
    }
    .btn-outline-primary {
      --bs-btn-color: ${hex};
      --bs-btn-border-color: ${hex};
      --bs-btn-hover-bg: ${hex};
      --bs-btn-hover-border-color: ${hex};
      --bs-btn-active-bg: ${hex};
      --bs-btn-active-border-color: ${hex};
      --bs-btn-disabled-color: ${hex};
      --bs-btn-disabled-border-color: ${hex};
      --bs-btn-focus-shadow-rgb: ${rgb};
    }
  `;
}
