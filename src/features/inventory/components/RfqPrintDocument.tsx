import { forwardRef } from "react";
import type { Rfq, SupplierQuotation } from "../api";
import {
  ARMY_LOGO_DATA_URL,
  NA_AVN_LOGO_DATA_URL,
} from "./purchaseOrderLogos";

type RfqPrintDocumentProps = {
  rfq: Rfq;
  approvedQuotation?: SupplierQuotation | null;
};

const formatFullDate = (value?: string | null) => {
  if (!value) {
    const today = new Date();
    return today.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
};

const formatCurrencyValue = (
  val: number | string | null | undefined,
): string => {
  if (val === null || val === undefined || val === "") return "";
  const num = typeof val === "number" ? val : parseFloat(String(val));
  if (isNaN(num)) return "";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const RfqPrintDocument = forwardRef<HTMLDivElement, RfqPrintDocumentProps>(
  function RfqPrintDocument({ rfq, approvedQuotation }, ref) {
    const lines = rfq.stock_movement?.stocks ?? [];
    const currencySymbol =
      approvedQuotation?.currency === "NGN"
        ? "₦"
        : approvedQuotation?.currency === "EUR"
          ? "€"
          : approvedQuotation?.currency === "GBP"
            ? "£"
            : "$";

    const totalQuotedAmount = approvedQuotation?.total_amount
      ? Number(approvedQuotation.total_amount)
      : null;

    // Fill up to at least 4 rows to maintain the official form height
    const minRows = 4;
    const emptyRowsCount = Math.max(0, minRows - lines.length);

    return (
      <>
        <style>{`
          @page {
            size: A4 portrait;
            margin: 10mm;
          }
          @media print {
            body * {
              visibility: hidden !important;
            }
            #rfq-document-root,
            #rfq-document-root * {
              visibility: visible !important;
            }
            #rfq-document-root {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              min-height: 100% !important;
              margin: 0 !important;
              padding: 10mm !important;
              background: white !important;
              color: black !important;
            }
          }
        `}</style>
        <div
          ref={ref}
          id="rfq-document-root"
          style={{
            width: "794px",
            minHeight: "1123px",
            boxSizing: "border-box",
            backgroundColor: "#ffffff",
            color: "#000000",
            fontFamily: "Arial, Helvetica, sans-serif",
          }}
          className="p-10 flex flex-col justify-between"
        >
          <div>
            {/* Header with official insignias and titles */}
            <header className="flex items-center justify-between pb-3">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                <img
                  src={ARMY_LOGO_DATA_URL}
                  alt="Nigerian Army Emblem"
                  className="max-h-20 max-w-20 object-contain"
                />
              </div>

              <div className="text-center flex-1 px-4">
                <p className="text-[11px] font-bold tracking-[0.25em] uppercase text-black mb-1">
                  RESTRICTED
                </p>
                <h1 className="text-[17px] font-black uppercase tracking-wide text-black leading-tight">
                  NIGERIAN ARMY AVIATION
                </h1>
                <h2 className="text-[15px] font-black uppercase tracking-wide text-black mt-0.5">
                  REQUEST FOR QUOTATION (RFQ)
                </h2>
                <p className="text-[10px] font-bold uppercase tracking-wider text-black mt-1">
                  DOCUMENT REF No.: NAAVN-005
                </p>
              </div>

              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                <img
                  src={NA_AVN_LOGO_DATA_URL}
                  alt="Nigerian Army Aviation Emblem"
                  className="max-h-20 max-w-20 object-contain"
                />
              </div>
            </header>

            {/* Metadata Grid */}
            <div className="mt-4 border border-black border-collapse text-[10px]">
              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-2 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
                  DATE:
                </div>
                <div className="col-span-4 p-1.5 border-r border-black flex items-center font-medium">
                  {formatFullDate(rfq.issued_at)}
                </div>
                <div className="col-span-3 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
                  RFQ NUMBER:
                </div>
                <div className="col-span-3 p-1.5 flex items-center font-bold">
                  {rfq.rfq_number || `RFQ-${rfq.id}`}
                </div>
              </div>

              <div className="grid grid-cols-12 border-b border-black">
                <div className="col-span-2 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
                  REQUISITION:
                </div>
                <div className="col-span-4 p-1.5 border-r border-black flex items-center font-medium uppercase truncate">
                  REQ #{rfq.stock_movement_id}
                </div>
                <div className="col-span-3 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
                  STATUS:
                </div>
                <div className="col-span-3 p-1.5 flex items-center font-bold uppercase truncate">
                  {rfq.status ?? "SENT"}
                </div>
              </div>

              <div className="grid grid-cols-12">
                <div className="col-span-2 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
                  INVITED VENDOR:
                </div>
                <div className="col-span-10 p-1.5 flex items-center font-medium">
                  {approvedQuotation?.supplier?.name ||
                    (rfq.suppliers && rfq.suppliers.length > 0
                      ? rfq.suppliers.map((s) => s.name).join(", ")
                      : "REGISTERED AVIATION SUPPLIERS")}
                </div>
              </div>
            </div>

            {/* Ship To Section */}
            <div className="mt-5 text-[10px] flex gap-4 leading-relaxed">
              <div className="font-bold whitespace-nowrap">SHIP TO</div>
              <div className="font-medium text-black">
                <p className="font-semibold">Nigerian Army Aviation</p>
                <p>Airport Road, Opposite University of Abuja</p>
                <p>Giri, Abuja.</p>
                <p>Nigeria</p>
              </div>
            </div>

            {/* Items Table matching exact official specification */}
            <table
              style={{
                width: "100%",
                borderCollapse: "collapse",
                border: "2px solid #000000",
                fontSize: "10px",
                fontFamily: "Arial, Helvetica, sans-serif",
                marginTop: "18px",
              }}
            >
              <thead>
                <tr style={{ backgroundColor: "#ffffff" }}>
                  <th
                    style={{
                      width: "6%",
                      borderRight: "1px solid #000000",
                      borderBottom: "2px solid #000000",
                      padding: "6px 4px",
                      textAlign: "center",
                      color: "#000000",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "10px" }}>ITEM</div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: "8.5px",
                        marginTop: "1px",
                      }}
                    >
                      (a)
                    </div>
                  </th>
                  <th
                    style={{
                      width: "18%",
                      borderRight: "1px solid #000000",
                      borderBottom: "2px solid #000000",
                      padding: "6px 8px",
                      textAlign: "center",
                      color: "#000000",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "10px" }}>
                      PART NUMBER
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: "8.5px",
                        marginTop: "1px",
                      }}
                    >
                      (b)
                    </div>
                  </th>
                  <th
                    style={{
                      width: "24%",
                      borderRight: "1px solid #000000",
                      borderBottom: "2px solid #000000",
                      padding: "6px 8px",
                      textAlign: "center",
                      color: "#000000",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "10px" }}>
                      DESCRIPTION
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: "8.5px",
                        marginTop: "1px",
                      }}
                    >
                      (c)
                    </div>
                  </th>
                  <th
                    style={{
                      width: "11%",
                      borderRight: "1px solid #000000",
                      borderBottom: "2px solid #000000",
                      padding: "6px 4px",
                      textAlign: "center",
                      color: "#000000",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "10px" }}>
                      CONDITION
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: "8.5px",
                        marginTop: "1px",
                      }}
                    >
                      (d)
                    </div>
                  </th>
                  <th
                    style={{
                      width: "11%",
                      borderRight: "1px solid #000000",
                      borderBottom: "2px solid #000000",
                      padding: "6px 8px",
                      textAlign: "center",
                      color: "#000000",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "10px" }}>
                      QUANTITY
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: "8.5px",
                        marginTop: "1px",
                      }}
                    >
                      (e)
                    </div>
                  </th>
                  <th
                    style={{
                      width: "15%",
                      borderRight: "1px solid #000000",
                      borderBottom: "2px solid #000000",
                      padding: "6px 8px",
                      textAlign: "center",
                      color: "#000000",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "10px" }}>
                      UNIT PRICE
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: "8.5px",
                        marginTop: "1px",
                      }}
                    >
                      (f)
                    </div>
                  </th>
                  <th
                    style={{
                      width: "15%",
                      borderBottom: "2px solid #000000",
                      padding: "6px 8px",
                      textAlign: "center",
                      color: "#000000",
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: "10px" }}>
                      TOTAL PRICE
                    </div>
                    <div
                      style={{
                        fontWeight: 400,
                        fontSize: "8.5px",
                        marginTop: "1px",
                      }}
                    >
                      (g)
                    </div>
                  </th>
                </tr>
              </thead>
              <tbody>
                {lines.map((item, idx) => {
                  const qty = Number(item.quantity_requested ?? 0);
                  const partNo = item.inventory?.part_number || "-";
                  const desc =
                    item.inventory?.description ||
                    item.inventory?.part_name ||
                    "-";
                  const condition =
                    item.inventory?.type || item.inventory?.stock_level || "";
                  const unitCost = item.inventory?.unit_cost
                    ? Number(item.inventory.unit_cost)
                    : null;
                  const estimatedTotal = unitCost ? qty * unitCost : null;

                  return (
                    <tr
                      key={item.id ?? idx}
                      style={{ borderBottom: "1px solid #000000" }}
                    >
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "8px 6px",
                          textAlign: "center",
                          fontWeight: 500,
                        }}
                      >
                        {idx + 1}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "8px 10px",
                          textAlign: "left",
                          fontWeight: 400,
                        }}
                      >
                        {partNo}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "8px 10px",
                          textAlign: "left",
                          textTransform: "uppercase",
                          fontWeight: 500,
                          lineHeight: "1.25",
                        }}
                      >
                        {desc}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "8px 6px",
                          textAlign: "center",
                          textTransform: "uppercase",
                        }}
                      >
                        {condition}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "8px 10px",
                          textAlign: "right",
                          fontVariantNumeric: "tabular-nums",
                        }}
                      >
                        {qty.toFixed(2)}
                      </td>
                      <td
                        style={{
                          borderRight: "1px solid #000000",
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            width: "100%",
                          }}
                        >
                          <span style={{ fontWeight: 400 }}>{currencySymbol}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrencyValue(unitCost)}
                          </span>
                        </div>
                      </td>
                      <td
                        style={{
                          padding: "8px 10px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            width: "100%",
                          }}
                        >
                          <span style={{ fontWeight: 400 }}>{currencySymbol}</span>
                          <span style={{ fontVariantNumeric: "tabular-nums" }}>
                            {formatCurrencyValue(estimatedTotal)}
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {/* Empty padding rows to maintain the official form height */}
                {Array.from({ length: emptyRowsCount }).map((_, i) => (
                  <tr
                    key={`empty-${i}`}
                    style={{ borderBottom: "1px solid #000000", height: "34px" }}
                  >
                    <td style={{ borderRight: "1px solid #000000" }}></td>
                    <td style={{ borderRight: "1px solid #000000" }}></td>
                    <td style={{ borderRight: "1px solid #000000" }}></td>
                    <td style={{ borderRight: "1px solid #000000" }}></td>
                    <td style={{ borderRight: "1px solid #000000" }}></td>
                    <td style={{ borderRight: "1px solid #000000" }}></td>
                    <td></td>
                  </tr>
                ))}

                {/* Total Row */}
                <tr style={{ borderTop: "2px solid #000000" }}>
                  <td
                    colSpan={5}
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "8px 10px",
                    }}
                  ></td>
                  <td
                    style={{
                      borderRight: "1px solid #000000",
                      padding: "8px 10px",
                      textAlign: "center",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      fontSize: "10px",
                      backgroundColor: "#ffffff",
                    }}
                  >
                    TOTAL
                  </td>
                  <td
                    style={{
                      padding: "8px 10px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        width: "100%",
                        fontWeight: 700,
                      }}
                    >
                      <span>{currencySymbol}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {formatCurrencyValue(totalQuotedAmount)}
                      </span>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>

            {/* Instructions to Vendor */}
            <div className="mt-4 p-2.5 border border-black bg-white text-[9px] leading-relaxed">
              <p className="font-bold uppercase tracking-wider text-[9.5px] mb-1">
                INSTRUCTIONS TO VENDORS:
              </p>
              <p>
                1. Please quote unit and total prices in the columns indicated
                above inclusive of shipping and handling.
              </p>
              <p>
                2. Indicate warranty terms, delivery lead times, and quote
                validity period (minimum 30 days requested).
              </p>
              <p>
                3. All aviation spares must be accompanied by relevant EASA Form
                1 / FAA 8130-3 or OEM Certificate of Conformity upon delivery.
              </p>
            </div>

            {/* Signature and Approval Section */}
            <div className="mt-6 grid grid-cols-2 gap-8 text-[9.5px]">
              <div>
                <div className="border border-black flex">
                  <div className="w-[45%] bg-[#d9d9d9] font-bold p-2 text-center flex items-center justify-center border-r border-black uppercase leading-tight">
                    PROCUREMENT OFFICER:
                  </div>
                  <div className="flex-1 h-14 bg-white"></div>
                </div>
                <p className="mt-1 text-[8.5px] font-bold text-black">
                  *Issued by NAA Aviation Maintenance Stores / Logistics Depot
                </p>
              </div>

              <div className="border border-black">
                <div className="border-b border-black flex">
                  <div className="w-[45%] bg-[#d9d9d9] font-bold p-2 text-center flex items-center justify-center border-r border-black uppercase">
                    AUTHORIZING OFFICER:
                  </div>
                  <div className="flex-1 p-2 flex items-center justify-center text-[#9ca3af] font-medium uppercase tracking-wider text-[8.5px]">
                    COMMANDING OFFICER / CHIEF LOGISTICS
                  </div>
                </div>
                <div className="flex">
                  <div className="w-[45%] bg-[#d9d9d9] font-bold p-2 text-center flex items-center justify-center border-r border-black uppercase leading-tight">
                    SIGNATURE & STAMP:
                  </div>
                  <div className="flex-1 h-12 bg-white"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Revision and Page Footer */}
          <footer className="pt-8 flex items-center justify-between text-[8.5px] text-black font-semibold">
            <div>Revision No.: 00</div>
            <div>Revision Date: 17 February 2026</div>
            <div>Page 1 of 1</div>
          </footer>
        </div>
      </>
    );
  },
);
