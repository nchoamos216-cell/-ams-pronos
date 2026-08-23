"use client";

import { useRouter, usePathname } from "next/navigation";

interface DashboardFiltersProps {
  competitions: string[];
  searchParams: { competition?: string; date?: string; type?: string };
}

const TYPES = [
  { value: "", label: "Tous les types" },
  { value: "BTTS", label: "BTTS" },
  { value: "OVER_2_5", label: "+2.5 buts" },
  { value: "HOME_WIN", label: "Victoire domicile" },
  { value: "AWAY_WIN", label: "Victoire extérieur" },
  { value: "HT_HOME_WIN", label: "Mi-temps domicile" },
  { value: "HT_AWAY_WIN", label: "Mi-temps extérieur" },
  { value: "GOAL_EACH_HALF", label: "But chaque mi-temps" },
  { value: "DRAW_IN_A_HALF", label: "Nul sur une mi-temps" },
];

const selectClass =
  "rounded-lg border border-pitch-700 bg-pitch-900 px-3 py-2 text-sm text-ink-200 outline-none focus:border-accent-go";

export default function DashboardFilters({
  competitions,
  searchParams,
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams as Record<string, string>);
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-3">
      <select
        className={selectClass}
        value={searchParams.competition ?? ""}
        onChange={(e) => updateFilter("competition", e.target.value)}
      >
        <option value="">Toutes les compétitions</option>
        {competitions.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      <input
        type="date"
        className={selectClass}
        value={searchParams.date ?? ""}
        onChange={(e) => updateFilter("date", e.target.value)}
      />

      <select
        className={selectClass}
        value={searchParams.type ?? ""}
        onChange={(e) => updateFilter("type", e.target.value)}
      >
        {TYPES.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
    </div>
  );
}
