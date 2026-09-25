export const PAISE_PER_RUPEE = 100;

function assertInteger(paise: number): void {
  if (!Number.isInteger(paise)) {
    throw new TypeError(`money must be whole paise, got ${paise}`);
  }
}

function groupIndian(rupees: number): string {
  const digits = String(rupees);
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
}

export function formatPaise(paise: number): string {
  assertInteger(paise);
  const sign = paise < 0 ? "-" : "";
  const abs = Math.abs(paise);
  const rupees = Math.floor(abs / PAISE_PER_RUPEE);
  const sub = abs % PAISE_PER_RUPEE;
  const fraction = sub === 0 ? "" : `.${String(sub).padStart(2, "0")}`;
  return `${sign}₹${groupIndian(rupees)}${fraction}`;
}

export function paiseToRupees(paise: number): number {
  assertInteger(paise);
  return paise / PAISE_PER_RUPEE;
}

export function rupeesToPaise(rupees: number): number {
  const paise = Math.round(rupees * PAISE_PER_RUPEE);
  if (Math.abs(rupees * PAISE_PER_RUPEE - paise) > 1e-9) {
    throw new RangeError(`rupees value ${rupees} is finer than one paisa`);
  }
  return paise;
}

export function sumPaise(values: readonly number[]): number {
  let total = 0;
  for (const value of values) {
    assertInteger(value);
    total += value;
  }
  return total;
}

/** Digits with at most two decimal places — no signs, no exponents, no `NaN`. */
const RUPEE_FIGURE = /^\d+(?:\.\d{1,2})?$/;

/**
 * The figure a treasurer writes on a voucher into whole paise, or `null` when
 * it is not a figure at all. A comma is kept out of the pattern rather than the
 * parse, so `1,005` and `1005` mean the same amount and `1e5` means nothing —
 * a shorthand nobody books an entry with.
 */
export function rupeesInputToPaise(value: string): number | null {
  const typed = value.trim().replace(/,/g, "");
  if (!RUPEE_FIGURE.test(typed)) return null;
  const [rupees, paise = ""] = typed.split(".");
  const total = Number(rupees) * PAISE_PER_RUPEE + Number(paise.padEnd(2, "0"));
  return Number.isSafeInteger(total) ? total : null;
}

/**
 * The inverse, for a form that shows a saved amount again. Zero stays blank:
 * an empty field is "nothing recorded", while a printed `0` is a claim that
 * somebody checked and found nothing.
 */
export function paiseToRupeesInput(paise: number): string {
  assertInteger(paise);
  if (paise === 0) return "";
  const sign = paise < 0 ? "-" : "";
  const absolute = Math.abs(paise);
  const rupees = Math.floor(absolute / PAISE_PER_RUPEE);
  const fraction = absolute % PAISE_PER_RUPEE;
  return fraction === 0
    ? `${sign}${rupees}`
    : `${sign}${rupees}.${String(fraction).padStart(2, "0")}`;
}
