import { useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Icon } from "@/shared/icons/Icon";
import { cn } from "@/shared/utils/cn";
import { useGetUnitByIdQuery } from "@/shared/api/units";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { downloadElementAsPdf } from "@/shared/utils/downloadPdf";

type Card = {
  label: string;
  value: string | number;
  icon?: string;
  bgClass?: string;
  textColor?: string;
  subText?: string;
  alert?: boolean;
};

const CardItem = ({ card }: { card: Card }) => (
  <div
    className={cn(
      "rounded-lg border border-[#0A4D66]/40 p-4 flex items-center justify-between",
      card.bgClass || "bg-[#001219]",
    )}
  >
    <div>
      <p className="text-[11px] uppercase tracking-wide text-gray-400">
        {card.label}
      </p>
      <p className={cn("text-2xl font-semibold mt-1", card.textColor || "text-white")}>
        {card.value}
      </p>
      {card.subText && (
        <p className="text-[10px] text-yellow-400 mt-1 flex items-center gap-1">
           {card.alert && <Icon icon="mdi:alert" className="w-3 h-3" />}
           {card.subText}
        </p>
      )}
    </div>
    {card.icon && (
      <div className="w-10 h-10 rounded bg-[#021a27] flex items-center justify-center">
        <Icon icon={card.icon} className="w-5 h-5 text-cyan-300" />
      </div>
    )}
  </div>
);

export const UnitsDetailsPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { id } = useParams<{ id: string }>();
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const {
    data: unit,
    isLoading,
    isError,
    refetch,
  } = useGetUnitByIdQuery(id ?? "", {
    skip: !id,
  });

  const formatCount = (value: number | undefined) => value ?? 0;

  const formatDate = (value: string | undefined) => {
    if (!value) return "—";

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const overviewCards: Card[] = [
    {
      label: "ASSETS",
      value: formatCount(unit?.assets_count),
      icon: "mdi:helicopter",
    },
    {
      label: "OPERATIONS",
      value: formatCount(unit?.operations_count),
      icon: "mdi:clipboard-text-clock-outline",
    },
    {
      label: "PERSONNEL",
      value: formatCount(unit?.personnel_count),
      icon: "mdi:account-hard-hat",
    },
    {
      label: "INVENTORY ITEMS",
      value: formatCount(unit?.inventory_count),
      icon: "mdi:package-variant",
    },
    {
      label: "FINANCE RECORDS",
      value: formatCount(unit?.finances_count),
      icon: "mdi:cash-multiple",
    },
  ];

  const inventoryCards: Card[] = [
    {
      label: "TOTAL IN STOCK",
      value: formatCount(unit?.total_stock),
      bgClass: "bg-green-900/20 border-green-800/50",
      icon: "mdi:package-variant-closed",
      textColor: "text-white",
    },
    {
      label: "LOW STOCK ITEMS",
      value: formatCount(unit?.low_stock),
      bgClass: "bg-yellow-900/20 border-yellow-800/50",
      icon: "mdi:clipboard-alert",
      textColor: "text-white",
    },
    {
      label: "EXPIRED ITEMS",
      value: formatCount(unit?.expired_stock),
      bgClass: "bg-red-900/20 border-red-800/50",
      icon: "mdi:alert-octagon",
      textColor: "text-white",
    },
    {
      label: "CRITICAL STOCK",
      value: formatCount(unit?.critical_stock),
      bgClass: "bg-orange-900/20 border-orange-800/50",
      icon: "mdi:calendar-clock",
      textColor: "text-white",
    },
  ];

  const handleDownloadPdf = async () => {
    if (!contentRef.current || !unit || isDownloadingPdf) return;

    setIsDownloadingPdf(true);
    try {
      await downloadElementAsPdf({
        element: contentRef.current,
        fileName: `${unit.name || "unit"}-${unit.id}`,
        backgroundColor: "#001219",
      });
      dispatch(showToast({ message: "PDF downloaded", type: "success" }));
    } catch {
      dispatch(showToast({ message: "Failed to download PDF", type: "error" }));
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>

          <div className="p-4 sm:p-6 space-y-4">
            <div className="h-24 rounded-lg bg-[#001825] border border-[#0A4D66]/40 animate-pulse" />
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div
                  key={index}
                  className="h-28 rounded-lg bg-[#001825] border border-[#0A4D66]/40 animate-pulse"
                />
              ))}
            </div>
          </div>
        </section>
      </div>
    );
  }

  if (!id || isError || !unit) {
    return (
      <div className="px-2 sm:px-0">
        <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
          <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18] flex items-center justify-between">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 text-xs sm:text-sm text-gray-300 hover:text-white"
            >
              <Icon icon="mdi:arrow-left" className="w-4 h-4" />
              <span>Back</span>
            </button>
          </div>

          <div className="p-6 text-center space-y-3">
            <p className="text-sm text-red-300">Failed to load unit details.</p>
            <button
              type="button"
              onClick={() => refetch()}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-[#0A4D66]/60 text-xs text-gray-200 hover:bg-[#0A4D66]/30"
            >
              <Icon icon="mdi:refresh" className="w-4 h-4" />
              <span>Retry</span>
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="px-2 sm:px-0 space-y-6">
      <section className="bg-[#001219] border border-[#0A4D66]/40 rounded-xl overflow-hidden">
        <div className="px-4 sm:px-6 py-4 border-b border-[#0A4D66]/40 bg-[#000f18]">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 text-sm"
          >
            <Icon icon="mdi:arrow-left" className="w-4 h-4" />
            <span>Back</span>
          </button>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-xl font-bold text-white uppercase tracking-wide">
                {unit.name}
              </h1>
              <p className="text-sm text-gray-400">
                {unit.description?.trim() || "No description available for this unit."}
              </p>
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => navigate(`/dashboard/units/${unit.id}/edit`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#0A4D66] text-white hover:bg-[#0A4D66]/80 text-xs"
              >
                <Icon icon="mdi:pencil" className="w-4 h-4" />
                Edit
              </button>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#001219] text-gray-300 border border-[#0A4D66]/40 hover:bg-[#001825] text-xs disabled:opacity-60"
                title="Download unit details"
                aria-label="Download unit details"
              >
                <Icon
                  icon={isDownloadingPdf ? "mdi:loading" : "mdi:download"}
                  className={cn("w-4 h-4", isDownloadingPdf ? "animate-spin" : "")}
                />
              </button>
              <button
                type="button"
                onClick={() => refetch()}
                className="flex items-center gap-2 px-3 py-1.5 rounded bg-[#001219] text-gray-300 border border-[#0A4D66]/40 hover:bg-[#001825] text-xs"
                title="Refresh unit details"
                aria-label="Refresh unit details"
              >
                <Icon icon="mdi:refresh" className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div ref={contentRef} className="p-4 sm:p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">
                Unit ID
              </p>
              <p className="mt-1 text-lg font-semibold text-white">#{unit.id}</p>
            </div>
            <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">
                Created
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatDate(unit.created_at)}
              </p>
            </div>
            <div className="p-4 bg-[#001219] border border-[#0A4D66]/40 rounded-lg">
              <p className="text-[11px] uppercase tracking-wide text-gray-400">
                Last Updated
              </p>
              <p className="mt-1 text-lg font-semibold text-white">
                {formatDate(unit.updated_at)}
              </p>
            </div>
          </div>

          <section>
            <h2 className="text-xs font-bold tracking-wide text-gray-400 mb-3 uppercase">
              Overview
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
              {overviewCards.map((card) => (
                <CardItem key={card.label} card={card} />
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-xs font-bold tracking-wide text-gray-400 mb-3 uppercase">
              Inventory
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {inventoryCards.map((card) => (
                <CardItem key={card.label} card={card} />
              ))}
            </div>
          </section>
        </div>
      </section>
    </div>
  );
};
