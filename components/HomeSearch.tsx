"use client";

import { useRouter } from "next/navigation";
import { useState, FormEvent } from "react";

export default function HomeSearch() {
  const router = useRouter();
  const [q, setQ] = useState("");

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = q.trim();
    if (trimmed) router.push(`/search?q=${encodeURIComponent(trimmed)}`);
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-lg mx-auto flex shadow-lg">
      <input
        type="text"
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Search any US bank by name, state, or FDIC cert…"
        className="flex-1 px-4 py-3 text-sm rounded-l bg-white text-gray-900 placeholder-gray-400 focus:outline-none"
        autoFocus
      />
      <button
        type="submit"
        className="px-6 py-3 bg-[#c9a84c] text-[#0a2342] text-sm font-bold rounded-r hover:bg-[#b8963f] transition-colors"
      >
        Search
      </button>
    </form>
  );
}
