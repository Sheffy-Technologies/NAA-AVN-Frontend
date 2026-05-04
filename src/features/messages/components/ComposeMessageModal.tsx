import { useEffect, useMemo, useRef, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { MultiSelect } from "@/shared/ui/multi-select/MultiSelect";
import { useClickOutside } from "@/shared/hooks/useClickOutside";
import {
  useSendMessageMutation,
  type MessageAttachableType,
} from "@/features/messages/api";
import { useGetUsersQuery } from "@/features/users/api";
import { useGetOperationsQuery } from "@/features/operations/api";
import { useGetWorkOrdersQuery } from "@/features/maintenance/api";
import { useGetAssetsQuery } from "@/features/assets/api";
import {
  useGetPurchaseOrdersQuery,
  useGetInventoriesQuery,
} from "@/features/inventory/api";
import { closeCompose } from "@/features/messages/composeSlice";
import { useTheme } from "@/context/ThemeContext";

const ATTACHABLE_OPTIONS: Array<{
  value: MessageAttachableType;
  label: string;
}> = [
  { value: "operation", label: "Operation" },
  { value: "work-order", label: "Work Order" },
  { value: "work-order-task", label: "Work Order Task" },
  { value: "maintenance-event", label: "Maintenance Event" },
  { value: "purchase-order", label: "Purchase Order" },
  { value: "asset", label: "Asset" },
  { value: "inventory", label: "Inventory Item" },
];

const userName = (user?: {
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
}) => {
  if (!user) return "Unknown User";
  const fullName = [user.firstname, user.lastname]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (fullName) return fullName;
  if (user.username) return user.username;
  return user.email || "Unknown User";
};

export const ComposeMessageModal = () => {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { isDark } = useTheme();
  const isOpen = useAppSelector((state) => state.messageCompose.isOpen);
  const authUser = useAppSelector((state) => state.auth.user);
  const userPermissions = authUser?.permissions ?? [];
  const canCreateMessages = userPermissions.includes("messages.create");
  const currentUserId = Number(authUser?.id || 0);

  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>(
    [],
  );
  const [body, setBody] = useState("");
  const [attachableType, setAttachableType] = useState<
    MessageAttachableType | ""
  >("");
  const [attachableId, setAttachableId] = useState<string>("");
  const [isRecipientPickerOpen, setIsRecipientPickerOpen] = useState(false);
  const [isAttachPickerOpen, setIsAttachPickerOpen] = useState(false);

  const recipientPickerRef = useRef<HTMLDivElement>(null);
  const attachPickerRef = useRef<HTMLDivElement>(null);

  useClickOutside(recipientPickerRef, () => setIsRecipientPickerOpen(false));
  useClickOutside(attachPickerRef, () => setIsAttachPickerOpen(false));

  const { data: users = [] } = useGetUsersQuery(undefined, {
    skip: !isOpen || !canCreateMessages,
  });
  const { data: operations = [] } = useGetOperationsQuery(undefined, {
    skip: !isOpen || attachableType !== "operation",
  });
  const { data: workOrders = [] } = useGetWorkOrdersQuery(undefined, {
    skip: !isOpen || attachableType !== "work-order",
  });
  const { data: assets = [] } = useGetAssetsQuery(undefined, {
    skip: !isOpen || attachableType !== "asset",
  });
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery(undefined, {
    skip: !isOpen || attachableType !== "purchase-order",
  });
  const { data: inventoryItems = [] } = useGetInventoriesQuery(undefined, {
    skip: !isOpen || attachableType !== "inventory",
  });

  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();

  const attachableSelectionOptions = useMemo(() => {
    if (attachableType === "operation") {
      return operations.map((operation) => ({
        id: operation.id,
        label: operation.name || `Operation #${operation.id}`,
      }));
    }
    if (attachableType === "work-order") {
      return workOrders.map((workOrder) => ({
        id: workOrder.id,
        label: workOrder.title || `Work Order #${workOrder.id}`,
      }));
    }
    if (attachableType === "asset") {
      return assets.map((asset) => ({
        id: asset.id,
        label: asset.name || `Asset #${asset.id}`,
      }));
    }
    if (attachableType === "purchase-order") {
      return purchaseOrders.map((purchaseOrder) => ({
        id: purchaseOrder.id,
        label: purchaseOrder.name || `Purchase Order #${purchaseOrder.id}`,
      }));
    }
    if (attachableType === "inventory") {
      return inventoryItems.map((item) => ({
        id: item.id,
        label: item.description
          ? `${item.part_number ?? item.id} – ${item.description}`
          : (item.part_number ?? `Item #${item.id}`),
      }));
    }
    return [];
  }, [
    attachableType,
    operations,
    workOrders,
    assets,
    purchaseOrders,
    inventoryItems,
  ]);

  const selectedAttachableOption = useMemo(() => {
    if (!attachableType || !attachableId) return null;
    const id = Number(attachableId);
    const match = attachableSelectionOptions.find((option) => option.id === id);
    if (!match) return null;
    const typeLabel =
      ATTACHABLE_OPTIONS.find((option) => option.value === attachableType)
        ?.label ?? attachableType;
    return { ...match, label: `${typeLabel}: ${match.label}` };
  }, [attachableType, attachableId, attachableSelectionOptions]);

  const resetComposeForm = () => {
    setSelectedRecipientIds([]);
    setBody("");
    setAttachableType("");
    setAttachableId("");
    setIsRecipientPickerOpen(false);
    setIsAttachPickerOpen(false);
  };

  useEffect(() => {
    if (!isOpen) {
      resetComposeForm();
    }
  }, [isOpen]);

  const handleClose = () => {
    dispatch(closeCompose());
  };

  const handleOpenMessagesPage = () => {
    handleClose();
    navigate("/dashboard/messages");
  };

  const handleSend = async () => {
    if (!canCreateMessages) {
      dispatch(
        showToast({
          message: "You do not have permission to send messages",
          type: "error",
        }),
      );
      return;
    }

    if (!body.trim()) {
      dispatch(
        showToast({ message: "Message body is required", type: "error" }),
      );
      return;
    }

    if (selectedRecipientIds.length === 0) {
      dispatch(
        showToast({ message: "Select at least one recipient", type: "error" }),
      );
      return;
    }

    try {
      await sendMessage({
        subject: null,
        body: body.trim(),
        recipient_ids: selectedRecipientIds,
        attachable_type: attachableType || null,
        attachable_id: attachableId ? Number(attachableId) : null,
      }).unwrap();

      dispatch(showToast({ message: "Message sent", type: "success" }));
      handleClose();
    } catch {
      dispatch(
        showToast({ message: "Failed to send message", type: "error" }),
      );
    }
  };

  if (!isOpen) return null;

  const cardCls = isDark
    ? "border-[#0A4D66]/40 bg-[#001219]"
    : "border-[#E5E7EB] bg-white shadow-[0_10px_25px_rgba(0,0,0,0.12)]";
  const headingCls = isDark ? "text-white" : "text-[#111827]";
  const labelCls = isDark ? "text-gray-300" : "text-[#6B7280]";
  const inputAreaCls = isDark
    ? "border-[#0A4D66]/40 bg-[#061A24]"
    : "border-[#D1D5DB] bg-[#F9FAFB]";
  const inputCls = isDark
    ? "border-[#0A4D66]/40 bg-[#001825] text-white focus:border-[#7FD5FF]"
    : "border-[#D1D5DB] bg-white text-[#111827] focus:border-[#2563EB]";
  const textareaCls = isDark
    ? "text-white focus:border-[#0A4D66]/40"
    : "text-[#111827] focus:border-[#2563EB]";
  const accentCls = isDark ? "text-[#7FD5FF]" : "text-[#0369A1]";
  const accentBorderCls = isDark ? "border-[#7FD5FF]/50" : "border-[#0369A1]/50";
  const popupCls = isDark
    ? "border-[#0A4D66]/45 bg-[#03151E]"
    : "border-[#E5E7EB] bg-white shadow-lg";
  const popupTextCls = isDark ? "text-gray-200" : "text-[#374151]";
  const iconBtnActiveCls = isDark
    ? "bg-[#0A4D66]/50 text-[#7FD5FF]"
    : "bg-blue-100 text-[#0369A1]";
  const iconBtnIdleCls = isDark
    ? "text-gray-400 hover:bg-[#0A4D66]/25"
    : "text-gray-500 hover:bg-gray-100";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className={`w-full max-w-2xl rounded-xl border p-5 ${cardCls}`}>
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className={`text-base font-semibold ${headingCls}`}>
            Compose Message
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleOpenMessagesPage}
              className={`inline-flex items-center gap-1.5 rounded border px-3 py-1.5 text-xs hover:bg-[#0A4D66]/20 ${accentBorderCls} ${accentCls}`}
              title="Open messages page"
              aria-label="Open messages page"
            >
              <Icon icon="mdi:open-in-new" className="h-4 w-4" />
              Open Messages
            </button>
            <button
              type="button"
              title="Close compose dialog"
              aria-label="Close compose dialog"
              onClick={handleClose}
              className={isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#111827]"}
            >
              <Icon icon="mdi:close" className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <label className={`text-xs ${labelCls}`}>Message</label>
          <div className={`relative flex items-end gap-2 rounded-2xl border p-2 ${inputAreaCls}`}>
            <button
              type="button"
              onClick={() => {
                setIsRecipientPickerOpen((value) => !value);
                setIsAttachPickerOpen(false);
              }}
              className={`rounded-xl p-2 transition-colors ${
                isRecipientPickerOpen || selectedRecipientIds.length > 0
                  ? iconBtnActiveCls
                  : iconBtnIdleCls
              }`}
              title="Select recipients"
              aria-label="Select recipients"
            >
              <Icon
                icon="mdi:account-multiple-plus-outline"
                className="h-5 w-5"
              />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsAttachPickerOpen((value) => !value);
                setIsRecipientPickerOpen(false);
              }}
              className={`rounded-xl p-2 transition-colors ${
                isAttachPickerOpen || attachableType
                  ? iconBtnActiveCls
                  : iconBtnIdleCls
              }`}
              title="Attach model"
              aria-label="Attach model"
            >
              <Icon icon="mdi:paperclip" className="h-5 w-5" />
            </button>

            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className={`h-24 w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm focus:outline-none placeholder-gray-400 ${textareaCls}`}
              placeholder="Type a message"
            />

            <button
              type="button"
              onClick={() => void handleSend()}
              disabled={isSending || !canCreateMessages}
              className="rounded-xl bg-[#128C7E] p-2 text-white transition-colors hover:bg-[#20a193] disabled:opacity-60"
              title="Send"
              aria-label="Send"
            >
              <Icon icon="mdi:send" className="h-4 w-4" />
            </button>

            {isAttachPickerOpen && (
              <div
                ref={attachPickerRef}
                className={`absolute bottom-[110%] left-0 z-20 w-full rounded-xl border p-3 ${popupCls}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className={`text-xs font-medium ${popupTextCls}`}>
                    Attach a model
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAttachPickerOpen(false)}
                    className={isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#111827]"}
                    title="Close attachment picker"
                    aria-label="Close attachment picker"
                  >
                    <Icon icon="mdi:close" className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {ATTACHABLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => {
                        setAttachableType(option.value);
                        setAttachableId("");
                      }}
                      className={`rounded-lg border px-2 py-1.5 text-xs transition-colors ${
                        attachableType === option.value
                          ? isDark
                            ? "border-[#7FD5FF]/70 bg-[#0A4D66]/40 text-[#C9F1FF]"
                            : "border-[#2563EB]/70 bg-blue-50 text-[#1D4ED8]"
                          : isDark
                            ? "border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/25"
                            : "border-[#D1D5DB] text-[#374151] hover:bg-gray-50"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                {attachableType && (
                  <div className="space-y-2">
                    <label className={`text-xs ${labelCls}`}>Select item</label>
                    {attachableSelectionOptions.length > 0 ? (
                      <select
                        title="Attachable item"
                        value={attachableId}
                        onChange={(event) => setAttachableId(event.target.value)}
                        className={`w-full rounded border px-3 py-2 text-sm focus:outline-none ${inputCls}`}
                      >
                        <option value="">Select item</option>
                        {attachableSelectionOptions.map((option) => (
                          <option key={option.id} value={option.id}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        value={attachableId}
                        onChange={(event) => setAttachableId(event.target.value)}
                        className={`w-full rounded border px-3 py-2 text-sm focus:outline-none ${inputCls}`}
                        placeholder="Attachable ID"
                        type="number"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {isRecipientPickerOpen && (
              <div
                ref={recipientPickerRef}
                className={`absolute bottom-[110%] left-0 z-20 w-full rounded-xl border p-3 ${popupCls}`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className={`text-xs font-medium ${popupTextCls}`}>
                    Choose recipients
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsRecipientPickerOpen(false)}
                    className={isDark ? "text-gray-400 hover:text-white" : "text-gray-500 hover:text-[#111827]"}
                    title="Close recipient picker"
                    aria-label="Close recipient picker"
                  >
                    <Icon icon="mdi:close" className="h-4 w-4" />
                  </button>
                </div>

                <MultiSelect
                  label="Recipients"
                  placeholder={
                    users.length === 0
                      ? "No users available"
                      : "Select recipients..."
                  }
                  searchable
                  searchPlaceholder="Search users..."
                  options={users
                    .filter((user) => user.id !== currentUserId)
                    .map((user) => ({
                      value: user.id,
                      label: userName(user),
                    }))}
                  selectedValues={selectedRecipientIds}
                  onChange={(values) =>
                    setSelectedRecipientIds(values.map((v) => Number(v)))
                  }
                  disabled={!canCreateMessages || users.length === 0}
                />
              </div>
            )}
          </div>

          {selectedRecipientIds.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {selectedRecipientIds.map((recipientId) => {
                const recipient = users.find(
                  (user) => user.id === recipientId,
                );
                if (!recipient) return null;

                return (
                  <span
                    key={recipientId}
                    className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${
                      isDark
                        ? "border-[#0A4D66]/45 bg-[#0A4D66]/15 text-[#A6E7FF]"
                        : "border-blue-200 bg-blue-50 text-[#1D4ED8]"
                    }`}
                  >
                    <Icon icon="mdi:account" className="h-3 w-3" />
                    {userName(recipient)}
                  </span>
                );
              })}
            </div>
          )}

          {selectedAttachableOption && (
            <div className={`mt-2 inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs ${
              isDark
                ? "border-[#128C7E]/45 bg-[#128C7E]/15 text-[#8FF3E6]"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}>
              <Icon icon="mdi:link-variant" className="h-3.5 w-3.5" />
              <span>{selectedAttachableOption.label}</span>
            </div>
          )}
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-[#0A4D66]/40 px-3 py-2 text-xs text-gray-300 hover:bg-[#0A4D66]/20"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};
