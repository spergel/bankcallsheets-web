export default function AboutPage() {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold text-[#0a2342] mb-6">About the Data</h1>

      <div className="space-y-8 text-sm text-gray-700 leading-relaxed">
        <section className="bg-white border border-gray-200 rounded p-6">
          <h2 className="font-semibold text-[#0a2342] text-base mb-3">What are FFIEC Call Reports?</h2>
          <p>
            The <strong>Call Report</strong> (formally, the Report of Condition and Income) is a quarterly regulatory filing
            required of all FDIC-insured commercial banks and savings institutions operating in the United States.
            It captures a comprehensive snapshot of each institution's financial condition, including its balance sheet,
            income statement, off-balance-sheet items, and asset quality metrics.
          </p>
          <p className="mt-3">
            Call Reports are collected and managed by the <strong>Federal Financial Institutions Examination Council (FFIEC)</strong>
            through its Central Data Repository (CDR). The FFIEC is an interagency body composed of the Federal Reserve,
            FDIC, OCC, NCUA, and CFPB.
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded p-6">
          <h2 className="font-semibold text-[#0a2342] text-base mb-3">What data is shown here?</h2>
          <p>
            This site aggregates Call Report filings from <strong>2001 through 2025</strong> — 25 years of annual
            snapshots. For each institution and reporting period, we surface the following key metrics:
          </p>
          <table className="mt-3 w-full text-xs border border-gray-200 rounded overflow-hidden">
            <thead>
              <tr className="bg-[#0a2342] text-white">
                <th className="text-left px-3 py-2">Metric</th>
                <th className="text-left px-3 py-2">FFIEC Code</th>
                <th className="text-left px-3 py-2">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ["Total Assets", "RCFD2170", "Consolidated total assets on the balance sheet"],
                ["Total Deposits", "RCFD2200", "All domestic and foreign deposit liabilities"],
                ["Total Equity Capital", "RCFD3210", "Total stockholders' equity"],
                ["Net Loans & Leases", "RCFD2122", "Loans and leases, net of unearned income and allowance"],
                ["Net Income", "RIAD4340", "After-tax net income for the reporting period"],
                ["Interest Income", "RIAD4010", "Total interest and fee income on loans"],
                ["Past Due 30–89d", "RCFD1406", "Loans 30 to 89 days past due, still accruing"],
                ["Past Due 90d+ / Nonaccrual", "RCFD1407", "Loans 90+ days past due or on nonaccrual status"],
                ["Goodwill", "RCFD3163", "Goodwill and other intangible assets"],
              ].map(([metric, code, desc]) => (
                <tr key={code} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-medium">{metric}</td>
                  <td className="px-3 py-2 font-mono text-gray-400">{code}</td>
                  <td className="px-3 py-2 text-gray-500">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-3 text-xs text-gray-500">
            All monetary values are reported in thousands of US dollars, as filed in the Call Report.
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded p-6">
          <h2 className="font-semibold text-[#0a2342] text-base mb-3">Data freshness & attribution</h2>
          <p>
            Data is sourced from the <strong>FFIEC Central Data Repository (CDR)</strong> public bulk download files.
            The CDR provides annual bulk exports of Call Report subset schedules.
          </p>
          <p className="mt-3">
            BankData is not affiliated with, endorsed by, or sponsored by the FDIC, OCC, Federal Reserve, FFIEC,
            or any other government agency. This site is an independent aggregation of publicly available regulatory data.
          </p>
        </section>

        <section className="bg-white border border-gray-200 rounded p-6">
          <h2 className="font-semibold text-[#0a2342] text-base mb-3">Understanding the FFIEC codes</h2>
          <p>Call Report field codes follow a standard prefix convention:</p>
          <ul className="mt-2 space-y-1.5 list-none">
            {[
              ["RCFD", "Report of Condition — Consolidated Domestic and Foreign"],
              ["RCON", "Report of Condition — Domestic only"],
              ["RIAD", "Report of Income and Analysis Domestic"],
            ].map(([prefix, desc]) => (
              <li key={prefix} className="flex gap-3">
                <span className="font-mono font-bold text-[#0a2342] w-12 shrink-0">{prefix}</span>
                <span className="text-gray-600">{desc}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
