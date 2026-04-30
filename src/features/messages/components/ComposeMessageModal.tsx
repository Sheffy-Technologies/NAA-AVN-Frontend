import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { MultiSelect } from "@/shared/ui/multi-select/MultiSelect";
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
  const isOpen = useAppSelector((state) => state.messageCompose.isOpen);
  const authUser = useAppSelector((state) => state.auth.user);
  const userPermissions = authUser?.permissions ?? [];
  const canCreateMessages = userPermissions.includes("messages.create");

  const [selectedRecipientIds, setSelectedRecipientIds] = useState<number[]>(
    [],
  );
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [attachableType, setAttachableType] = useState<
    MessageAttachableType | ""
  >("");
  const [attachableId, setAttachableId] = useState<string>("");

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

  const resetComposeForm = () => {
    setSelectedRecipientIds([]);
    setSubject("");
    setBody("");
    setAttachableType("");
    setAttachableId("");
  };

  useEffect(() => {
    if (!isOpen) {
      resetComposeForm();
    }
  }, [isOpen]);

  const handleClose = () => {
    dispatch(closeCompose());
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
        subject: subject.trim() || null,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="w-full max-w-3xl rounded-xl border border-[#0A4D66]/40 bg-[#001219] p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-white">
            Compose Message
          </h2>
          <button
            type="button"
            title="Close compose dialog"
            aria-label="Close compose dialog"
            onClick={handleClose}
            className="text-gray-400 hover:text-white"
          >
            <Icon icon="mdi:close" className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <MultiSelect
              label="Recipients"
              placeholder={
                users.length === 0
                  ? "No users available"
                  : "Select recipients..."
              }
              searchable
              searchPlaceholder="Search users..."
              options={users.map((user) => ({
                value: user.id,
                label: userName(user),
              }))}
              selectedValues={selectedRecipientIds}
              onChange={(values) =>
                setSelectedRecipientIds(values.map((v) => Number(v)))
              }
              disabled={users.length === 0}
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-gray-300">Subject</label>
            <input
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:border-[#7FD5FF] focus:outline-none"
              placeholder="Subject (optional)"
            />
          </div>

          <div className="space-y-2 md:col-span-2">
            <label className="text-xs text-gray-300">Message</label>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              className="h-28 w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:border-[#7FD5FF] focus:outline-none"
              placeholder="Type your message"
            />
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-300">Attachable Type</label>
            <select
              title="Attachable type"
              value={attachableType}
              onChange={(event) => {
                setAttachableType(
                  event.target.value as MessageAttachableType | "",
                );
                setAttachableId("");
              }}
              className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:border-[#7FD5FF] focus:outline-none"
            >
              <option value="">None</option>
              {ATTACHABLE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <label className="text-xs text-gray-300">Attachable Item</label>
            {attachableSelectionOptions.length > 0 ? (
              <select
                title="Attachable item"
                value={attachableId}
                onChange={(event) => setAttachableId(event.target.value)}
                className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:border-[#7FD5FF] focus:outline-none"
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
                className="w-full rounded border border-[#0A4D66]/40 bg-[#001825] px-3 py-2 text-sm text-white focus:border-[#7FD5FF] focus:outline-none"
                placeholder="Attachable ID (optional)"
                type="number"
              />
            )}
          </div>
        </div>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="rounded border border-[#0A4D66]/40 px-3 py-2 text-xs text-gray-300 hover:bg-[#0A4D66]/20"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={isSending}
            className="rounded border border-[#7FD5FF]/50 px-3 py-2 text-xs text-[#7FD5FF] hover:bg-[#0A4D66]/20 disabled:opacity-60"
          >
            {isSending ? "Sending..." : "Send"}
          </button>
        </div>
      </div>
    </div>
  );
};
