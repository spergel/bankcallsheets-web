export default function Footer() {
  return (
    <footer className="bg-[#0a2342] text-white/60 text-xs py-4 mt-12">
      <div className="max-w-7xl mx-auto px-4 flex flex-wrap gap-4 justify-between">
        <span>
          Data source:{" "}
          <span className="text-white/80">FFIEC Central Data Repository (CDR)</span>
          {" "}· 2001–2025
        </span>
        <span>BankData is not affiliated with the FDIC, OCC, or FFIEC.</span>
      </div>
    </footer>
  );
}
