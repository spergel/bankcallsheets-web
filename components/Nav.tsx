"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

export default function Nav() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSearch(e: FormEvent) {
    e.preventDefault();
    if (q.trim()) router.push(`/search?q=${encodeURIComponent(q.trim())}`);
  }

  return (
    <header className="bg-[#0a2342] text-white shadow-md">
      <div className="max-w-7xl mx-auto px-4 h-14 flex items-center gap-6">
        <Link href="/" className="text-lg font-bold tracking-tight text-white hover:text-[#c9a84c] transition-colors shrink-0">
          BankData
        </Link>

        <form onSubmit={handleSearch} className="flex-1 max-w-xl">
          <div className="flex">
            <input
              type="text"
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Search banks by name, state, or FDIC cert…"
              className="flex-1 px-3 py-1.5 text-sm rounded-l bg-white/10 border border-white/20 text-white placeholder-white/50 focus:outline-none focus:bg-white/20"
            />
            <button
              type="submit"
              className="px-4 py-1.5 bg-[#c9a84c] text-[#0a2342] text-sm font-semibold rounded-r hover:bg-[#b8963f] transition-colors"
            >
              Search
            </button>
          </div>
        </form>

        <nav className="flex items-center gap-4 text-sm shrink-0">
          <Link href="/explore" className="text-white/80 hover:text-white transition-colors">Browse</Link>
          <Link href="/about" className="text-white/80 hover:text-white transition-colors">About</Link>
        </nav>
      </div>
    </header>
  );
}
