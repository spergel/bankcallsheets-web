// Derived metrics computed from raw FFIEC TSV rows.
// All dollar values stay in thousands (FFIEC native unit).
// Ratio/percentage fields are in % units (e.g. 12.5 = 12.5%).
//
// NOTE: This data is the FFIEC "Bulk Subset" which does NOT include:
//   - RC-R (Regulatory Capital): no CET1/Tier 1/risk-based capital ratios
//   - RC-C (Loan detail): no loan composition by type, no gross loan total
//   - RC-E (Deposit detail): no deposit breakdown by type
//
// Loan totals are derived from RC balance sheet line: RCFDB528/529.

const C = {
  total_assets:     ['RCFD2170', 'RCON2170'],
  // RC-C not in bulk subset; use RC balance sheet loan summary fields
  gross_loans:      ['RCFDB528', 'RCONB528'], // loans & leases, net of unearned income
  net_loans:        ['RCFDB529', 'RCONB529'], // loans & leases, net of unearned income & ALLL
  // Total deposits = domestic + foreign (see derivePeriod)
  deposits_domestic:['RCON2200'],
  deposits_foreign: ['RCFN2200'],
  total_equity:     ['RCFD3210', 'RCON3210'],
  alll:             ['RCFD3123', 'RCON3123'],
  oreo:             ['RCFD2150', 'RCON2150'],
  past_due_90:      ['RCFD1407', 'RCON1407'],
  nonaccrual:       ['RCFD1403', 'RCON1403'],
  // Income statement (RIAD4635 net charge-offs not in bulk subset)
  net_income:       ['RIAD4340'],
  interest_income:  ['RIAD4010'],
  interest_expense: ['RIAD4073'],
  net_interest_inc: ['RIAD4074'],
  nonint_income:    ['RIAD4079'],
  nonint_expense:   ['RIAD4093'],
  provision:        ['RIAD4230'],
  past_due_30_89:   ['RCFD1406', 'RCON1406'],
  // Balance sheet components available in bulk subset
  htm_securities:   ['RCFD1754', 'RCON1754'],
  afs_securities:   ['RCFD1773', 'RCON1773'],
  fed_funds_sold:   ['RCFD1350', 'RCON1350'],
  loans_held_sale:  ['RCFD5369', 'RCON5369'],
  goodwill:         ['RCFD3163', 'RCON3163'],
  other_intangibles:['RCFD0426', 'RCON0426'],
  sub_debt:         ['RCFD3200', 'RCON3200'],
  fed_funds_purch:  ['RCFD2800', 'RCON2800'],
  other_borrowed:   ['RCFD3190', 'RCON3190'],
  total_liabilities:['RCFD2948', 'RCON2948'],
} as const;

function p(row: Record<string, string>, codes: readonly string[]): number | null {
  for (const c of codes) {
    const v = row[c];
    if (v !== undefined && v !== '') return Number(v);
  }
  return null;
}

function pct(num: number | null, den: number | null): number | null {
  if (num == null || den == null || den === 0) return null;
  return (num / den) * 100;
}

// Net income in call reports is year-to-date. Annualize based on quarter.
function annualizeMultiplier(periodDate: string): number {
  const month = parseInt(periodDate.slice(5, 7), 10);
  if (month <= 3)  return 4;
  if (month <= 6)  return 2;
  if (month <= 9)  return 4 / 3;
  return 1;
}

export type DerivedPeriod = {
  period: string;
  // Dollar values in thousands
  total_assets:     number | null;
  gross_loans:      number | null;
  net_loans:        number | null;
  total_deposits:   number | null;
  total_equity:     number | null;
  net_income:       number | null;  // YTD as reported
  interest_income:  number | null;  // YTD
  interest_expense: number | null;  // YTD
  net_interest_inc: number | null;  // YTD
  nonint_income:    number | null;  // YTD
  nonint_expense:   number | null;  // YTD
  provision:        number | null;  // YTD
  alll:             number | null;
  nonaccrual:       number | null;
  past_due_30_89:   number | null;
  past_due_90:      number | null;
  oreo:             number | null;
  // Annualized computed
  ppnr:             number | null;  // Pre-provision net revenue (ann.)
  provision_rate:   number | null;  // Annualized provision / gross loans %
  // Balance sheet components
  htm_securities:   number | null;
  afs_securities:   number | null;
  fed_funds_sold:   number | null;
  loans_held_sale:  number | null;
  goodwill:         number | null;
  other_intangibles:number | null;
  sub_debt:         number | null;
  fed_funds_purch:  number | null;
  other_borrowed:   number | null;
  total_liabilities:number | null;
  // Computed
  tangible_equity:  number | null;  // equity - goodwill - other intangibles
  // Computed ratios (annualized where applicable)
  roa:          number | null;  // %
  roe:          number | null;  // %
  nim:          number | null;  // % (NII / total assets — approximation)
  efficiency:   number | null;  // %
  npl_ratio:    number | null;  // % of gross loans
  npa_ratio:    number | null;  // % of total assets
  texas_ratio:  number | null;  // %
  alll_coverage:number | null;  // x coverage multiple
  ltd_ratio:    number | null;  // %
  equity_ratio: number | null;  // % (equity / assets)
};

export function derivePeriod(row: Record<string, string>): DerivedPeriod {
  const period      = row.period_end_date ?? '';
  const mult        = annualizeMultiplier(period);
  const assets      = p(row, C.total_assets);
  const grossLoans  = p(row, C.gross_loans);
  const netLoans    = p(row, C.net_loans);
  const depDomestic = p(row, C.deposits_domestic) ?? 0;
  const depForeign  = p(row, C.deposits_foreign)  ?? 0;
  const deposits    = (depDomestic + depForeign) > 0 ? depDomestic + depForeign : null;
  const equity      = p(row, C.total_equity);
  const alll        = p(row, C.alll);
  const nonaccrual  = p(row, C.nonaccrual);
  const pastDue90   = p(row, C.past_due_90);
  const oreo        = p(row, C.oreo);
  const netInc      = p(row, C.net_income);
  const intInc      = p(row, C.interest_income);
  const intExp      = p(row, C.interest_expense);
  const nii         = p(row, C.net_interest_inc);
  const nonintInc   = p(row, C.nonint_income);
  const nonintExp   = p(row, C.nonint_expense);
  const provision   = p(row, C.provision);
  const pastDue30   = p(row, C.past_due_30_89);
  const goodwill    = p(row, C.goodwill);
  const intangibles = p(row, C.other_intangibles);

  const annNetInc    = netInc    != null ? netInc    * mult : null;
  const annNii       = nii       != null ? nii       * mult : null;
  const annNonIntInc = nonintInc != null ? nonintInc * mult : null;
  const annNonIntExp = nonintExp != null ? nonintExp * mult : null;
  const annProv      = provision != null ? provision * mult : null;
  const ppnr = annNii != null && annNonIntInc != null && annNonIntExp != null
    ? annNii + annNonIntInc - annNonIntExp : null;

  const npls = nonaccrual != null || pastDue90 != null
    ? (nonaccrual ?? 0) + (pastDue90 ?? 0) : null;
  const npas = npls != null || oreo != null
    ? (npls ?? 0) + (oreo ?? 0) : null;
  const tangibleBase = (equity ?? 0) + (alll ?? 0);
  const tangibleEquity = equity != null
    ? equity - (goodwill ?? 0) - (intangibles ?? 0) : null;

  return {
    period,
    total_assets:     assets,
    gross_loans:      grossLoans,
    net_loans:        netLoans,
    total_deposits:   deposits,
    total_equity:     equity,
    net_income:       netInc,
    interest_income:  intInc,
    interest_expense: intExp,
    net_interest_inc: nii,
    nonint_income:    nonintInc,
    nonint_expense:   nonintExp,
    provision,
    alll,
    nonaccrual,
    past_due_30_89:   pastDue30,
    past_due_90:      pastDue90,
    oreo,
    htm_securities:   p(row, C.htm_securities),
    afs_securities:   p(row, C.afs_securities),
    fed_funds_sold:   p(row, C.fed_funds_sold),
    loans_held_sale:  p(row, C.loans_held_sale),
    goodwill,
    other_intangibles:intangibles,
    sub_debt:         p(row, C.sub_debt),
    fed_funds_purch:  p(row, C.fed_funds_purch),
    other_borrowed:   p(row, C.other_borrowed),
    total_liabilities:p(row, C.total_liabilities),
    tangible_equity:  tangibleEquity,
    roa:          pct(annNetInc, assets),
    roe:          pct(annNetInc, equity),
    nim:          pct(annNii, assets),
    efficiency:   annNonIntInc != null && annNii != null && annNonIntExp != null && (annNii + annNonIntInc) > 0
                    ? (annNonIntExp / (annNii + annNonIntInc)) * 100 : null,
    npl_ratio:    pct(npls, grossLoans),
    npa_ratio:    pct(npas, assets),
    texas_ratio:  npas != null && tangibleBase > 0 ? (npas / tangibleBase) * 100 : null,
    alll_coverage:npls != null && npls > 0 && alll != null ? alll / npls : null,
    ltd_ratio:    (deposits != null && assets != null && assets > 0 && deposits / assets >= 0.02)
                    ? pct(grossLoans, deposits) : null,
    equity_ratio: pct(equity, assets),
    ppnr,
    provision_rate: pct(annProv, grossLoans),
  };
}

export function derivePeriods(history: Record<string, string>[]): DerivedPeriod[] {
  return history.map(derivePeriod);
}

// % change between two values
export function delta(curr: number | null | undefined, prev: number | null | undefined): number | null {
  if (curr == null || prev == null || prev === 0) return null;
  return ((curr - prev) / Math.abs(prev)) * 100;
}

export function formatPeriodLabel(iso: string): string {
  const month = parseInt(iso.slice(5, 7), 10);
  const year  = iso.slice(0, 4);
  const q = month <= 3 ? 'Q1' : month <= 6 ? 'Q2' : month <= 9 ? 'Q3' : 'Q4';
  return `${q} ${year}`;
}
