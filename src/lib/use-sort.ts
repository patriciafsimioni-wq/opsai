"use client";

import { useMemo, useState } from "react";

type Getter<T> = (row: T) => string | number | null | undefined;

// Shared client-side table sorting. Pass a map of column key -> value getter,
// then use `toggle(col)` on a SortTh header and `sortRows(rows)` on the body.
export function useTableSort<T, K extends string>(
  getters: Record<K, Getter<T>>,
  initialKey: K,
  initialDir: "asc" | "desc" = "asc",
) {
  const [sortKey, setSortKey] = useState<K>(initialKey);
  const [sortDir, setSortDir] = useState<"asc" | "desc">(initialDir);

  function toggle(col: K) {
    if (col === sortKey) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(col);
      setSortDir("asc");
    }
  }

  function sortRows(rows: T[]): T[] {
    const get = getters[sortKey];
    if (!get) return rows;
    return [...rows].sort((a, b) => {
      const av = get(a);
      const bv = get(b);
      // Nullish always sorts last regardless of direction.
      const aNull = av == null || av === "";
      const bNull = bv == null || bv === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      let cmp: number;
      if (typeof av === "number" && typeof bv === "number") cmp = av - bv;
      else cmp = String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" });
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  return { sortKey, sortDir, toggle, sortRows };
}

// Convenience: memoized sorted rows.
export function useSortedRows<T, K extends string>(
  rows: T[],
  getters: Record<K, Getter<T>>,
  initialKey: K,
  initialDir: "asc" | "desc" = "asc",
) {
  const sort = useTableSort<T, K>(getters, initialKey, initialDir);
  const { sortKey, sortDir, sortRows } = sort;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sorted = useMemo(() => sortRows(rows), [rows, sortKey, sortDir]);
  return { ...sort, sorted };
}
