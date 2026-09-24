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
