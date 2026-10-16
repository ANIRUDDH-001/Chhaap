import { useEffect, useState } from "react";
import { useInfiniteQuery } from "@tanstack/react-query";
import { api } from "./api";

type Page<T> = { items: T[]; next_cursor: string | null };
export function useRecords<T>(resource: string, search = "", status = "") {
  const [term, setTerm] = useState(search);
  useEffect(() => {
    const timer = setTimeout(() => setTerm(search), 250);
    return () => clearTimeout(timer);
  }, [search]);
  const result = useInfiniteQuery({
    queryKey: [resource, "pages", term, status],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => {
      const params = new URLSearchParams({
        limit: "50",
        q: term,
        status: status === "all" ? "" : status,
      });
      if (pageParam) params.set("cursor", pageParam);
      return api<Page<T>>("/" + resource + "?" + params);
    },
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
  return {
    ...result,
    data: result.data
      ? { items: result.data.pages.flatMap((page) => page.items) }
      : undefined,
  };
}

export function MoreRecords({
  list,
}: {
  list: {
    hasNextPage: boolean;
    isFetchingNextPage: boolean;
    fetchNextPage: () => unknown;
    isFetchNextPageError: boolean;
  };
}) {
  if (!list.hasNextPage) return null;
  return (
    <div className="pagination-row">
      <button
        className="button"
        disabled={list.isFetchingNextPage}
        onClick={() => list.fetchNextPage()}
      >
        {list.isFetchingNextPage
          ? "Loading…"
          : list.isFetchNextPageError
            ? "Retry loading more"
            : "Load more records"}
      </button>
      <small>
        Showing the records loaded so far. Search covers the entire shop.
      </small>
    </div>
  );
}
