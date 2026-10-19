import { cn } from "@/shared/utils/cn";

type Props = {
  currentPage: number;
  lastPage: number;
  onPageChange: (page: number) => void;
};

type PageItem = number | "ellipsis-start" | "ellipsis-end";

const buildPageItems = (current: number, last: number): PageItem[] => {
  if (last <= 7) {
    return Array.from({ length: last }, (_, index) => index + 1);
  }

  const items: PageItem[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(last - 1, current + 1);

  if (start > 2) items.push("ellipsis-start");
  for (let page = start; page <= end; page += 1) items.push(page);
  if (end < last - 1) items.push("ellipsis-end");
  items.push(last);

  return items;
};

export const NumberedPagination = ({ currentPage, lastPage, onPageChange }: Props) => {
  if (lastPage <= 1) return null;

  return (
    <nav aria-label="Pagination" className="flex items-center justify-center gap-1 py-3">
      {buildPageItems(currentPage, lastPage).map((item) =>
        typeof item === "number" ? (
          <button
            key={item}
            type="button"
            onClick={() => onPageChange(item)}
            aria-current={item === currentPage ? "page" : undefined}
            className={cn(
              "min-w-8 rounded border px-2.5 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-[#0284C7] focus:ring-offset-1",
              item === currentPage
                ? "border-[#0284C7] bg-[#0284C7] text-white font-semibold shadow-sm"
                : "border-slate-300 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-slate-700 dark:text-gray-300 dark:hover:bg-slate-800 dark:hover:text-white",
            )}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="px-1.5 text-xs text-slate-500 dark:text-gray-400">
            …
          </span>
        ),
      )}
    </nav>
  );
};
