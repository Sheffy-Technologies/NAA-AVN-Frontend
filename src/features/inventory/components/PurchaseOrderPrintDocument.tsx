import { forwardRef } from "react";
import type { PurchaseOrder } from "../api";
import {
  ARMY_LOGO_DATA_URL,
  NA_AVN_LOGO_DATA_URL,
} from "./purchaseOrderLogos";

type PurchaseOrderPrintDocumentProps = {
  order: PurchaseOrder;
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
  const num = typeof val === "number" ? val : parseFloat(String(val ?? 0));
  if (isNaN(num)) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};

export const PurchaseOrderPrintDocument = forwardRef<
  HTMLDivElement,
  PurchaseOrderPrintDocumentProps
>(function PurchaseOrderPrintDocument({ order }, ref) {
  const items = order.items ?? [];
  const currencySymbol = order.currency?.code === "NGN" ? "₦" : "$";

  const totalAmount = items.reduce((sum, item) => {
    const qty = Number(item.quantity_ordered ?? 0);
    const price = Number(item.unit_price ?? item.inventory?.unit_cost ?? 0);
    return sum + qty * price;
  }, 0);

  // Fill up to at least 4 rows to maintain the official form height and spacing
  const minRows = 4;
  const emptyRowsCount = Math.max(0, minRows - items.length);

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
          #purchase-order-document-root,
          #purchase-order-document-root * {
            visibility: visible !important;
          }
          #purchase-order-document-root {
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
        id="purchase-order-document-root"
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
              PURCHASE ORDER
            </h2>
            <p className="text-[10px] font-bold uppercase tracking-wider text-black mt-1">
              DOCUMENT REF No.: NAAVN-006
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
              {formatFullDate(order.order_date)}
            </div>
            <div className="col-span-3 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
              P.O NUMBER:
            </div>
            <div className="col-span-3 p-1.5 flex items-center font-bold">
              {order.id}
            </div>
          </div>

          <div className="grid grid-cols-12 border-b border-black">
            <div className="col-span-2 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
              ISSUED BY:
            </div>
            <div className="col-span-4 p-1.5 border-r border-black flex items-center font-medium uppercase truncate">
              {order.name || "SHERIFF CONTROL SUPPORT"}
            </div>
            <div className="col-span-3 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
              SUPPLIER:
            </div>
            <div className="col-span-3 p-1.5 flex items-center font-bold uppercase truncate">
              {order.supplier?.name || "DAKOTA PARTS"}
            </div>
          </div>

          <div className="grid grid-cols-12">
            <div className="col-span-2 p-1.5 border-r border-black"></div>
            <div className="col-span-4 p-1.5 border-r border-black"></div>
            <div className="col-span-3 bg-[#d9d9d9] font-bold p-1.5 border-r border-black flex items-center">
              QUOTE NO.:
            </div>
            <div className="col-span-3 p-1.5 flex items-center font-medium">
              {order.rfq_id ? `RFQ-${order.rfq_id}` : ""}
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
                <div style={{ fontWeight: 400, fontSize: "8.5px", marginTop: "1px" }}>
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
                <div style={{ fontWeight: 700, fontSize: "10px" }}>PART NUMBER</div>
                <div style={{ fontWeight: 400, fontSize: "8.5px", marginTop: "1px" }}>
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
                <div style={{ fontWeight: 700, fontSize: "10px" }}>DESCRIPTION</div>
                <div style={{ fontWeight: 400, fontSize: "8.5px", marginTop: "1px" }}>
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
                <div style={{ fontWeight: 700, fontSize: "10px" }}>CONDITION</div>
                <div style={{ fontWeight: 400, fontSize: "8.5px", marginTop: "1px" }}>
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
                <div style={{ fontWeight: 700, fontSize: "10px" }}>QUANTITY</div>
                <div style={{ fontWeight: 400, fontSize: "8.5px", marginTop: "1px" }}>
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
                <div style={{ fontWeight: 700, fontSize: "10px" }}>UNIT PRICE</div>
                <div style={{ fontWeight: 400, fontSize: "8.5px", marginTop: "1px" }}>
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
                <div style={{ fontWeight: 700, fontSize: "10px" }}>TOTAL PRICE</div>
                <div style={{ fontWeight: 400, fontSize: "8.5px", marginTop: "1px" }}>
                  (g)
                </div>
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => {
              const qty = Number(item.quantity_ordered ?? 0);
              const unitPrice = Number(
                item.unit_price ?? item.inventory?.unit_cost ?? 0,
              );
              const totalPrice = qty * unitPrice;
              const partNo =
                item.part_number || item.inventory?.part_number || "-";
              const desc =
                item.inventory?.description ||
                item.inventory?.remark ||
                item.inventory?.part_name ||
                "-";
              const condition =
                item.inventory?.type || item.inventory?.stock_level || "";

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
                        {formatCurrencyValue(unitPrice)}
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
                        {formatCurrencyValue(totalPrice)}
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
                    {formatCurrencyValue(totalAmount)}
                  </span>
                </div>
              </td>
            </tr>
          </tbody>
        </table>

        {/* Signature and Approval Section */}
        <div className="mt-8 grid grid-cols-2 gap-8 text-[9.5px]">
          {/* Left Column: Signature of Issuer */}
          <div>
            <div className="border border-black flex">
              <div className="w-[45%] bg-[#d9d9d9] font-bold p-2 text-center flex items-center justify-center border-r border-black uppercase leading-tight">
                SIGNATURE OF ISSUER
              </div>
              <div className="flex-1 h-14 bg-white"></div>
            </div>
            <p className="mt-2 text-[8.5px] font-bold text-black">
              *Attach copy of quote provided by supplier for reference.
            </p>
          </div>

          {/* Right Column: Approval Block */}
          <div className="border border-black">
            <div className="border-b border-black flex">
              <div className="w-[45%] bg-[#d9d9d9] font-bold p-2 text-center flex items-center justify-center border-r border-black uppercase">
                APPROVED BY:
              </div>
              <div className="flex-1 p-2 flex items-center justify-center text-[#9ca3af] font-medium uppercase tracking-wider text-[8.5px]">
                RANK INITIAL AND SURNAME
              </div>
            </div>
            <div className="flex">
              <div className="w-[45%] bg-[#d9d9d9] font-bold p-2 text-center flex items-center justify-center border-r border-black uppercase leading-tight">
                APPROVAL SIGNATURE:
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
});
