import { formatPaise } from "@/lib/money";

/**
 * Bar geometry and the short money label that goes beside a bar.
 *
 * The branch's public pages draw their own charts, in a server component, so
 * that a figure a member reads does not arrive wrapped in a chart library's
 * JavaScript (§5 pairs every chart with the table that holds the exact numbers
 * — the labels here are only the short form of those numbers). Two failures are
 * designed out: a divide by zero, which would print an `Infinity` width, and a
 * bar longer than the picture it sits in.
 */

/** A scale the eye can read: no figure between these is a head nobody names. */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

const LAKH_PAISE = 10_000_000;
const CRORE_PAISE = 1_000_000_000;
const PAISE_PER_RUPEE = 100;

/**
 * The top of a chart's scale: the smallest round figure that still holds every
 * value. Zero and negative values are no reason to have a scale at all, so this
 * stays positive — a caller divides by it.
 */
export function niceScaleMax(values: readonly number[]): number {
  const highest = values.reduce((max, value) => Math.max(max, value), 0);
  if (highest <= 0) return 1;

  const magnitude = 10 ** Math.floor(Math.log10(highest));
  for (const step of NICE_STEPS) {
    if (step * magnitude >= highest) return step * magnitude;
  }
  return 10 * magnitude;
}

/** The share of the scale a value takes up, always between the edges of the picture. */
export function barFraction(value: number, scaleMax: number): number {
  if (!Number.isFinite(value) || !Number.isFinite(scaleMax) || scaleMax <= 0) return 0;
  return Math.min(1, Math.max(0, value / scaleMax));
}

/** One decimal at least, so a lakh reads `₹1.0 lakh` and not `₹1 lakh`. */
function withUnit(rupees: number, paisePerUnit: number, decimals: number): string {
  const text = (rupees / (paisePerUnit / PAISE_PER_RUPEE)).toFixed(decimals);
  const [whole, fraction = ""] = text.split(".");
  const trimmed = fraction.length > 1 && fraction.endsWith("0") ? fraction.slice(0, -1) : fraction;
  return trimmed === "" ? `${whole}.0` : `${whole}.${trimmed}`;
}

/**
 * Up to ₹99,999.99 in full, lakh to ₹99.9 lakh, crore above that — where an
 * Indian reader would say the figure that way. Below a lakh nothing is rounded,
 * because ₹50,000 written as `₹0.5 lakh` is a smaller lie than the same amount
 * left as it stands.
 */
export function formatShortPaise(paise: number): string {
  const absolute = Math.abs(paise);
  if (absolute < LAKH_PAISE) return formatPaise(paise);

  const sign = paise < 0 ? "-" : "";
  const rupees = absolute / PAISE_PER_RUPEE;

  if (absolute < CRORE_PAISE) {
    return `${sign}₹${withUnit(rupees, LAKH_PAISE, 1)} lakh`;
  }
  return `${sign}₹${withUnit(rupees, CRORE_PAISE, 2)} crore`;
}
