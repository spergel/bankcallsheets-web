"use client";

import { useState } from "react";
import { formatDollars } from "@/lib/format";

// Categories derived from code prefixes + known groupings
function getCategory(code: string): string {
  const c = code.toUpperCase();
  if (c.startsWith('RIAD')) return 'Income Statement';
  if (c.startsWith('RCFN') || c.startsWith('RCONB5') || c.match(/RCFD2200|RCON2200|RCFN2200/)) return 'Deposits';
  if (c.match(/RCFD3[2-9]|RCON3[2-9]|RCFDA130|RCONA130/)) return 'Equity Capital';
  if (c.match(/RCFD29[34]|RCON29[34]/)) return 'Securities';
  if (c.match(/RCFD3[5-9]|RCON3[5-9]/)) return 'Trading Assets & Borrowings';
  if (c.match(/1[2-9]\d\d|[2-9]\d\d\d/) && (c.startsWith('RCFDK') || c.startsWith('RCONK') || c.includes('1[234]') || c.includes('5[3-9]') || c.includes('6[5-9]') || c.includes('HK') || c.includes('JJ') || c.includes('JA') || c.includes('B5') || c.includes('C2') || c.includes('F1') || c.includes('F6') || c.includes('L1'))) return 'Past Due & Nonaccrual';
  // Catch all past-due codes by common patterns
  if (/PD|PAST_DUE|NONACCRUAL|NACRL|DU_30|DU_90/i.test(code)) return 'Past Due & Nonaccrual';
  if (c.startsWith('RCFD') || c.startsWith('RCON')) return 'Balance Sheet';
  return 'Other';
}

const CATEGORY_ORDER = [
  'Balance Sheet',
  'Income Statement',
  'Deposits',
  'Securities',
  'Equity Capital',
  'Trading Assets & Borrowings',
  'Past Due & Nonaccrual',
  'Other',
];

// Dollar-value categories
const DOLLAR_CATEGORIES = new Set([
  'Balance Sheet', 'Income Statement', 'Deposits',
  'Securities', 'Equity Capital', 'Trading Assets & Borrowings', 'Past Due & Nonaccrual',
]);

type Props = {
  rawData: Record<string, number>;
  labelMap: Record<string, string>;
};

export default function RawDataSection({ rawData, labelMap }: Props) {
  const [openCategories, setOpenCategories] = useState<Set<string>>(
    new Set(['Balance Sheet', 'Income Statement'])
  );

  function toggle(cat: string) {
    setOpenCategories(prev => {
      const next = new Set(prev);
      next.has(cat) ? next.delete(cat) : next.add(cat);
      return next;
    });
  }

  // Group by category
  const grouped: Record<string, { code: string; label: string; value: number }[]> = {};

  for (const [code, value] of Object.entries(rawData)) {
    const category = getCategory(code);
    const label    = labelMap[code] ?? code;
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push({ code, label, value });
  }

  for (const cat of Object.keys(grouped)) {
    grouped[cat].sort((a, b) => a.label.localeCompare(b.label));
  }

  const categories = [
    ...CATEGORY_ORDER.filter(c => grouped[c]?.length),
    ...Object.keys(grouped).filter(c => !CATEGORY_ORDER.includes(c)),
  ];

  return (
    <div className="space-y-2">
      {categories.map(cat => {
        const fields  = grouped[cat] ?? [];
        const isOpen  = openCategories.has(cat);
        const isDollar = DOLLAR_CATEGORIES.has(cat);
        return (
          <div key={cat} className="bg-white border border-gray-200 rounded overflow-hidden">
            <button
              onClick={() => toggle(cat)}
              className="w-full flex items-center justify-between px-4 py-3 bg-[#0a2342]/5 hover:bg-[#0a2342]/10 transition-colors text-left"
            >
              <span className="font-semibold text-sm text-[#0a2342]">{cat}</span>
              <span className="text-xs text-gray-400 flex items-center gap-3">
                <span>{fields.length} field{fields.length !== 1 ? "s" : ""}</span>
                <span className="text-lg leading-none">{isOpen ? "−" : "+"}</span>
              </span>
            </button>

            {isOpen && (
              <table className="w-full text-xs">
                <thead>
                  <tr className="bg-gray-50 border-t border-gray-100">
                    <th className="text-left px-4 py-2 font-medium text-gray-500 w-32">Code</th>
                    <th className="text-left px-4 py-2 font-medium text-gray-500">Field</th>
                    <th className="text-right px-4 py-2 font-medium text-gray-500">Value</th>
                  </tr>
                </thead>
                <tbody>
                  {fields.map(({ code, label, value }) => (
                    <tr key={code} className="border-t border-gray-50 hover:bg-gray-50">
                      <td className="px-4 py-2 font-mono text-gray-400">{code}</td>
                      <td className="px-4 py-2 text-gray-700">{label}</td>
                      <td className="px-4 py-2 text-right font-mono text-[#0a2342] font-medium">
                        {isDollar ? formatDollars(value) : value.toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}
    </div>
  );
}
