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
              "min-w-8 rounded border px-2.5 py-1 text-xs transition-colors",
              item === currentPage
                ? "border-[#0369A1] bg-[#0369A1] text-white"
                : "border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/30 hover:text-white",
            )}
          >
            {item}
          </button>
        ) : (
          <span key={item} className="px-1.5 text-xs text-gray-500">
            …
          </span>
        ),
      )}
    </nav>
  );
};
