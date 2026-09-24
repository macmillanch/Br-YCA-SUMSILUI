export type FiscalYear = {
  label: string;
  startDate: string;
  endDate: string;
};

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function labelFor(startYear: number): string {
  const end = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${end}`;
}

function isIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const year = Number(value.slice(0, 4));
  const month = Number(value.slice(5, 7));
  const day = Number(value.slice(8, 10));
  if (month < 1 || month > 12) return false;
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

export function fiscalYearOf(isoDate: string): FiscalYear {
  if (!isIsoDate(isoDate)) {
    throw new TypeError(`expected an ISO date (YYYY-MM-DD), got "${isoDate}"`);
  }
  const year = Number(isoDate.slice(0, 4));
  const month = Number(isoDate.slice(5, 7));
  const startYear = month >= 4 ? year : year - 1;
  return {
    label: labelFor(startYear),
    startDate: `${startYear}-04-01`,
    endDate: `${startYear + 1}-03-31`,
  };
}

export function currentFiscalYear(now: Date = new Date()): FiscalYear {
  const iso = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;
  return fiscalYearOf(iso);
}

export function isInFiscalYear(isoDate: string, year: FiscalYear): boolean {
  return isIsoDate(isoDate) && isoDate >= year.startDate && isoDate <= year.endDate;
}

export function fiscalYearFromLabel(label: string): FiscalYear {
  const match = /^(\d{4})-(\d{2})$/.exec(label);
  if (!match) throw new TypeError(`expected a fiscal-year label like 2026-27, got "${label}"`);
  const startYear = Number(match[1]);
  if (labelFor(startYear) !== label) {
    throw new RangeError(`fiscal-year label "${label}" does not run 1 April to 31 March`);
  }
  return { label, startDate: `${startYear}-04-01`, endDate: `${startYear + 1}-03-31` };
}

export function sameFiscalYear(a: string, b: string): boolean {
  return fiscalYearOf(a).label === fiscalYearOf(b).label;
}
