import { useMemo, useState } from "react";

export const PAGE_SIZE = 12;

export function usePaged<T>(
  items: T[],
  resetKey: string,
  pageSize = PAGE_SIZE,
) {
  const [pagination, setPagination] = useState({ key: resetKey, page: 1 });
  const page = pagination.key === resetKey ? pagination.page : 1;

  const visible = useMemo(
    () => items.slice(0, page * pageSize),
    [items, page, pageSize],
  );

  return {
    visible,
    hasMore: visible.length < items.length,
    remaining: Math.max(0, items.length - visible.length),
    more: () =>
      setPagination((current) => ({
        key: resetKey,
        page: (current.key === resetKey ? current.page : 1) + 1,
      })),
  };
}
