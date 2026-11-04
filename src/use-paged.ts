import { useEffect, useMemo, useState } from "react";

export const PAGE_SIZE = 12;

export function usePaged<T>(
  items: T[],
  resetKey: string,
  pageSize = PAGE_SIZE,
) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [resetKey]);

  const visible = useMemo(
    () => items.slice(0, page * pageSize),
    [items, page, pageSize],
  );

  return {
    visible,
    hasMore: visible.length < items.length,
    remaining: Math.max(0, items.length - visible.length),
    more: () => setPage((current) => current + 1),
  };
}
