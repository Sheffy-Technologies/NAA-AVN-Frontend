import { useEffect, useMemo, useState } from "react";
import { Icon } from "@iconify/react";
import { useNavigate } from "react-router-dom";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import {
  useDeleteMessageMutation,
  useGetMessagesQuery,
  useSendMessageMutation,
  useUpdateMessageMutation,
  type MessageAttachableType,
  type MessageItem,
  type MessageUser,
} from "@/features/messages/api";
import { useGetUsersQuery } from "@/features/users/api";
import { useGetOperationsQuery } from "@/features/operations/api";
import { useGetWorkOrdersQuery } from "@/features/maintenance/api";
import { useGetAssetsQuery } from "@/features/assets/api";
import {
  useGetPurchaseOrdersQuery,
  useGetInventoriesQuery,
} from "@/features/inventory/api";
import { getEchoClient } from "@/shared/realtime/echo";
import { MultiSelect } from "@/shared/ui/multi-select/MultiSelect";
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

const formatDateTime = (value?: string | null) => {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const userName = (user?: {
  firstname?: string | null;
  lastname?: string | null;
  username?: string | null;
  email?: string | null;
}) => {
  if (!user) return "Unknown User";
  const fullName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username) return user.username;
  return user.email || "Unknown User";
};

const getAttachablePath = (
  type?: MessageAttachableType | null,
  id?: number | null,
): string | null => {
  if (!type || !id) return null;

  switch (type) {
    case "operation":
      return `/dashboard/operations/${id}`;
    case "work-order":
      return `/dashboard/maintenance/work-orders/${id}`;
    case "work-order-task":
      return `/dashboard/maintenance/work-order-tasks/${id}`;
    case "maintenance-event":
      return `/dashboard/maintenance/events/${id}`;
    case "purchase-order":
      return `/dashboard/inventory/purchase-orders/${id}`;
    case "asset":
      return `/dashboard/assets/${id}`;
    case "inventory":
      return `/dashboard/inventory/${id}`;
    default:
      return null;
  }
};

export const MessagesPage = () => {
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const authUser = useAppSelector((state) => state.auth.user);
  const authToken = useAppSelector((state) => state.auth.token);
  const currentUserId = Number(authUser?.id || 0);
  const userPermissions = authUser?.permissions ?? [];

  const canViewMessages = userPermissions.includes("messages.viewAny");
  const canCreateMessages = userPermissions.includes("messages.create");
  const canUpdateMessages = userPermissions.includes("messages.update");
  const canDeleteMessages = userPermissions.includes("messages.delete");

  const { isDark } = useTheme();

  /* ── theme helpers ───────────────────────────────────── */
  const panelBg       = isDark ? "bg-[#04131A] border-[#0A4D66]/30" : "bg-white border-gray-200";
  const panelDivider  = isDark ? "border-[#0A4D66]/30" : "border-gray-200";
  const listDivider   = isDark ? "divide-[#0A4D66]/20" : "divide-gray-100";
  const titleText     = isDark ? "text-white" : "text-gray-900";
  const mutedText     = isDark ? "text-gray-400" : "text-gray-500";
  const subtleText    = isDark ? "text-gray-500" : "text-gray-400";
  const convActive    = isDark ? "border-l-[#7FD5FF] bg-[#0A4D66]/35" : "border-l-[#0369A1] bg-blue-50";
  const convInactive  = isDark ? "hover:bg-[#0A4D66]/15 hover:border-l-[#0A4D66]/70" : "hover:bg-gray-50 hover:border-l-gray-300";
  const msgAreaBg     = isDark
    ? "bg-[radial-gradient(circle_at_top_right,rgba(10,77,102,0.08),transparent_45%),radial-gradient(circle_at_bottom_left,rgba(127,213,255,0.05),transparent_40%)]"
    : "bg-gray-50";
  const myBubble      = isDark ? "border-[#1E6E59]/70 bg-[#0A4D66]/25" : "border-blue-200 bg-blue-50";
  const theirBubble   = isDark ? "border-[#0A4D66]/40 bg-[#0A4D66]/15" : "border-gray-200 bg-white";
  const msgBodyText   = isDark ? "text-gray-200" : "text-gray-800";
  const replyFooter   = isDark ? `border-[#0A4D66]/30 bg-[#04131A]/92` : "border-gray-200 bg-white/95";
  const composeBox    = isDark ? "border-[#0A4D66]/40 bg-[#061A24]" : "border-gray-200 bg-gray-50";
  const textareaText  = isDark ? "text-white placeholder-gray-500" : "text-gray-900 placeholder-gray-400";
  const pickerBg      = isDark ? "border-[#0A4D66]/45 bg-[#03151E]" : "border-gray-200 bg-white";
  const pickerTitle   = isDark ? "text-gray-200" : "text-gray-700";
  const pickerClose   = isDark ? "text-gray-400 hover:text-white" : "text-gray-400 hover:text-gray-700";
  const pickerInput   = isDark
    ? "border-[#0A4D66]/40 bg-[#001825] text-white focus:border-[#7FD5FF]"
    : "border-gray-200 bg-white text-gray-900 focus:border-[#0369A1]";
  const typeChipInactive = isDark
    ? "border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/25"
    : "border-gray-200 text-gray-600 hover:bg-gray-100";
  const attachLink    = isDark
    ? "border-[#0A4D66]/60 bg-[#001825] text-[#7FD5FF] hover:border-[#7FD5FF]/60 hover:bg-[#0A4D66]/20"
    : "border-blue-200 bg-blue-50 text-[#0369A1] hover:border-[#0369A1]/60 hover:bg-blue-100";
  const attachSpan    = isDark
    ? "border-[#0A4D66]/40 bg-[#001825] text-gray-300"
    : "border-gray-200 bg-gray-100 text-gray-600";
  const markReadBtn   = isDark
    ? "border-[#0A4D66]/40 text-[#7FD5FF] hover:bg-[#0A4D66]/20"
    : "border-blue-200 text-[#0369A1] hover:bg-blue-50";
  const clearBtn      = isDark
    ? "border-[#0A4D66]/40 text-gray-300 hover:bg-[#0A4D66]/20"
    : "border-gray-200 text-gray-600 hover:bg-gray-100";
  const recipientTag  = isDark
    ? "border-[#0A4D66]/45 bg-[#0A4D66]/15 text-[#A6E7FF]"
    : "border-blue-200 bg-blue-50 text-[#0369A1]";

  const [selectedConversationUserId, setSelectedConversationUserId] = useState<number | null>(null);
  const [replyRecipientIds, setReplyRecipientIds] = useState<number[]>([]);
  const [replyBody, setReplyBody] = useState("");
  const [attachableType, setAttachableType] = useState<MessageAttachableType | "">("");
  const [attachableId, setAttachableId] = useState<string>("");
  const [isRecipientPickerOpen, setIsRecipientPickerOpen] = useState(false);
  const [isAttachPickerOpen, setIsAttachPickerOpen] = useState(false);

  const {
    data: inboxMessages = [],
    isFetching: isInboxFetching,
    refetch: refetchInbox,
  } = useGetMessagesQuery({ box: "inbox" }, { skip: !canViewMessages });

  const {
    data: sentMessages = [],
    isFetching: isSentFetching,
    refetch: refetchSent,
  } = useGetMessagesQuery({ box: "sent" }, { skip: !canViewMessages });

  const { data: users = [] } = useGetUsersQuery(undefined, { skip: !canViewMessages });

  const { data: operations = [] } = useGetOperationsQuery(undefined, {
    skip: !canCreateMessages || attachableType !== "operation",
  });
  const { data: workOrders = [] } = useGetWorkOrdersQuery(undefined, {
    skip: !canCreateMessages || attachableType !== "work-order",
  });
  const { data: assets = [] } = useGetAssetsQuery(undefined, {
    skip: !canCreateMessages || attachableType !== "asset",
  });
  const { data: purchaseOrders = [] } = useGetPurchaseOrdersQuery(undefined, {
    skip: !canCreateMessages || attachableType !== "purchase-order",
  });
  const { data: inventoryItems = [] } = useGetInventoriesQuery(undefined, {
    skip: !canCreateMessages || attachableType !== "inventory",
  });

  const [sendMessage, { isLoading: isSending }] = useSendMessageMutation();
  const [updateMessage, { isLoading: isUpdating }] = useUpdateMessageMutation();
  const [deleteMessage, { isLoading: isDeleting }] = useDeleteMessageMutation();

  const unreadCount = useMemo(
    () => inboxMessages.filter((message) => message.is_read === false).length,
    [inboxMessages],
  );

  const allMessages = useMemo(() => {
    const byId = new Map<number, MessageItem>();

    for (const message of [...inboxMessages, ...sentMessages]) {
      byId.set(message.id, message);
    }

    return Array.from(byId.values());
  }, [inboxMessages, sentMessages]);

  const usersById = useMemo(() => {
    return new Map<number, MessageUser>(
      users.map((user) => [
        user.id,
        {
          id: user.id,
          firstname: user.firstname,
          lastname: user.lastname,
          username: user.username,
          email: user.email,
        },
      ]),
    );
  }, [users]);

  const conversations = useMemo(() => {
    const byUser = new Map<number, {
      user: MessageUser;
      messages: MessageItem[];
      unreadCount: number;
      lastMessageAt: string | null;
    }>();

    const resolveUser = (userId: number, fallback?: MessageUser | null): MessageUser => {
      const fromDirectory = usersById.get(userId);
      if (fromDirectory) return fromDirectory;
      if (fallback) return fallback;
      return { id: userId, firstname: "User", lastname: `#${userId}` };
    };

    for (const message of allMessages) {
      const participantIds = new Set<number>();

      if (message.sender_id !== currentUserId) {
        participantIds.add(message.sender_id);
      }

      for (const recipient of message.recipients || []) {
        if (recipient.id !== currentUserId) {
          participantIds.add(recipient.id);
        }
      }

      participantIds.forEach((participantId) => {
        const existing = byUser.get(participantId);
        const participantUser = participantId === message.sender_id
          ? resolveUser(participantId, message.sender || null)
          : resolveUser(participantId, message.recipients?.find((recipient) => recipient.id === participantId));

        if (!existing) {
          byUser.set(participantId, {
            user: participantUser,
            messages: [message],
            unreadCount: message.sender_id !== currentUserId && message.is_read === false ? 1 : 0,
            lastMessageAt: message.created_at || null,
          });
          return;
        }

        existing.messages.push(message);
        if (message.sender_id !== currentUserId && message.is_read === false) {
          existing.unreadCount += 1;
        }

        if ((message.created_at || "") > (existing.lastMessageAt || "")) {
          existing.lastMessageAt = message.created_at || null;
        }
      });
    }

    return Array.from(byUser.values())
      .map((conversation) => ({
        ...conversation,
        messages: conversation.messages.sort(
          (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime(),
        ),
      }))
      .sort((a, b) => new Date(b.lastMessageAt || 0).getTime() - new Date(a.lastMessageAt || 0).getTime());
  }, [allMessages, currentUserId, usersById]);

  const selectedConversation = useMemo(() => {
    return conversations.find((conversation) => conversation.user.id === selectedConversationUserId) || null;
  }, [conversations, selectedConversationUserId]);

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
  }, [attachableType, operations, workOrders, assets, purchaseOrders, inventoryItems]);

  const selectedAttachableOption = useMemo(() => {
    if (!attachableId) return null;
    return attachableSelectionOptions.find((option) => String(option.id) === attachableId) || null;
  }, [attachableId, attachableSelectionOptions]);

  useEffect(() => {
    if (!authUser?.id || !authToken || !canViewMessages) {
      return;
    }

    const echo = getEchoClient(authToken);

    if (!echo) {
      return;
    }

    const userId = Number(authUser.id);
    const channel = `App.Models.User.${userId}`;
    const privateChannel = `private-${channel}`;

    echo.private(channel).listen(".message.delivered", () => {
      void refetchInbox();
      void refetchSent();
      dispatch(
        showToast({
          message: "New message received",
          type: "success",
        }),
      );
    });

    return () => {
      echo.leaveChannel(privateChannel);
    };
  }, [authUser?.id, authToken, canViewMessages, refetchInbox, refetchSent, dispatch]);

  useEffect(() => {
    if (!conversations.length) {
      setSelectedConversationUserId(null);
      return;
    }

    if (!selectedConversationUserId || !conversations.some((item) => item.user.id === selectedConversationUserId)) {
      setSelectedConversationUserId(conversations[0].user.id);
    }
  }, [conversations, selectedConversationUserId]);

  useEffect(() => {
    if (!selectedConversationUserId) {
      setReplyRecipientIds([]);
      return;
    }

    setReplyRecipientIds((prev) => {
      if (prev.length === 0) {
        return [selectedConversationUserId];
      }

      if (!prev.includes(selectedConversationUserId)) {
        return [selectedConversationUserId, ...prev];
      }

      return prev;
    });
  }, [selectedConversationUserId]);

  const resetReplyForm = () => {
    setReplyBody("");
    setAttachableType("");
    setAttachableId("");
    setIsRecipientPickerOpen(false);
    setIsAttachPickerOpen(false);
  };

  const handleSend = async () => {
    if (!canCreateMessages) {
      dispatch(showToast({ message: "You do not have permission to send messages", type: "error" }));
      return;
    }

    if (!replyBody.trim()) {
      dispatch(showToast({ message: "Message body is required", type: "error" }));
      return;
    }

    const uniqueRecipients = Array.from(new Set(replyRecipientIds.filter((id) => id !== currentUserId)));
    const derivedSubject = selectedAttachableOption?.label || null;

    if (uniqueRecipients.length === 0) {
      dispatch(showToast({ message: "Select at least one recipient", type: "error" }));
      return;
    }

    try {
      await sendMessage({
        subject: derivedSubject,
        body: replyBody.trim(),
        recipient_ids: uniqueRecipients,
        attachable_type: attachableType || null,
        attachable_id: attachableId ? Number(attachableId) : null,
      }).unwrap();

      dispatch(showToast({ message: "Message sent", type: "success" }));
      resetReplyForm();
      void refetchInbox();
      void refetchSent();
    } catch {
      dispatch(showToast({ message: "Failed to send message", type: "error" }));
    }
  };

  const handleToggleRead = async (message: MessageItem) => {
    if (!canUpdateMessages) {
      dispatch(showToast({ message: "You do not have permission to update messages", type: "error" }));
      return;
    }

    try {
      await updateMessage({ id: message.id, is_read: !(message.is_read ?? false) }).unwrap();
      void refetchInbox();
    } catch {
      dispatch(showToast({ message: "Failed to update read status", type: "error" }));
    }
  };

  const handleDelete = async (message: MessageItem) => {
    if (!canDeleteMessages) {
      dispatch(showToast({ message: "You do not have permission to delete messages", type: "error" }));
      return;
    }

    if (!window.confirm("Delete this message?")) {
      return;
    }

    try {
      await deleteMessage(message.id).unwrap();
      dispatch(showToast({ message: "Message deleted", type: "success" }));
      void refetchInbox();
      void refetchSent();
    } catch {
      dispatch(showToast({ message: "Failed to delete message", type: "error" }));
    }
  };

  if (!canViewMessages) {
    return (
      <div className={`rounded-xl border p-6 text-sm ${isDark ? "border-[#0A4D66]/30 bg-[#001219] text-gray-300" : "border-gray-200 bg-white text-gray-600"}`}>
        You do not have permission to view messages.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className={`text-xl font-semibold ${titleText}`}>Messages</h1>
          <p className={`text-xs ${mutedText}`}>Private-style chats with optional extra recipients and smart attachments.</p>
        </div>
        <div className={`text-xs ${mutedText}`}>
          {unreadCount > 0 ? `${unreadCount} unread messages` : "No unread messages"}
        </div>
      </div>

      <div className="grid h-[calc(100vh-190px)] grid-cols-1 gap-4 lg:grid-cols-[320px_1fr]">
        <div className={`rounded-2xl border shadow-[0_20px_50px_rgba(0,0,0,0.35)] ${panelBg}`}>
          <div className={`border-b px-4 py-3 text-xs ${mutedText} ${panelDivider}`}>
            Conversations ({conversations.length})
          </div>

          {(isInboxFetching || isSentFetching) && (
            <div className={`px-4 py-3 text-xs ${subtleText}`}>Loading conversations...</div>
          )}

          {!isInboxFetching && !isSentFetching && conversations.length === 0 && (
            <div className={`px-4 py-8 text-sm ${subtleText}`}>No conversations yet.</div>
          )}

          <div className={`h-[calc(100%-44px)] overflow-y-auto ${listDivider}`}>
            {conversations.map((conversation) => {
              const lastMessage = conversation.messages[conversation.messages.length - 1];
              const isActive = selectedConversationUserId === conversation.user.id;
              const preview = lastMessage?.body?.trim() || "(No message body)";

              return (
                <button
                  key={conversation.user.id}
                  type="button"
                  onClick={() => setSelectedConversationUserId(conversation.user.id)}
                  className={`w-full border-l-2 border-transparent px-4 py-3 text-left transition-colors divide-y ${
                    isActive ? convActive : `bg-transparent ${convInactive}`
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className={`text-sm font-medium ${titleText}`}>{userName(conversation.user)}</p>
                      <p className={`mt-0.5 line-clamp-2 text-xs ${mutedText}`}>{preview}</p>
                    </div>
                    <div className="text-right">
                      <p className={`text-[10px] ${subtleText}`}>{formatDateTime(lastMessage?.created_at)}</p>
                      {conversation.unreadCount > 0 && (
                        <span className="mt-1 inline-flex min-w-5 justify-center rounded-full bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                          {conversation.unreadCount}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div className={`flex h-full min-h-0 flex-col rounded-2xl border shadow-[0_20px_50px_rgba(0,0,0,0.2)] ${panelBg}`}>
          {!selectedConversation ? (
            <div className={`px-6 py-10 text-center text-sm ${mutedText}`}>
              Select a user to view chat history.
            </div>
          ) : (
            <>
              <div className={`border-b px-4 py-3 ${panelDivider} ${isDark ? "bg-[#04131A]" : "bg-gray-50"}`}>
                <p className={`text-sm font-semibold ${titleText}`}>{userName(selectedConversation.user)}</p>
                <p className={`text-xs ${mutedText}`}>
                  {selectedConversation.messages.length} messages in this thread
                </p>
              </div>

              <div className={`min-h-0 flex-1 space-y-3 overflow-y-auto px-4 py-4 ${msgAreaBg}`}>
                {selectedConversation.messages.map((message) => {
                  const isMine = message.sender_id === currentUserId;
                  const attachablePath = getAttachablePath(message.attachable_type, message.attachable_id);

                  const copiedUsers = (message.recipients || []).filter(
                    (recipient) => recipient.id !== currentUserId && recipient.id !== selectedConversation.user.id,
                  );

                  return (
                    <div
                      key={message.id}
                      className={`max-w-[90%] rounded-lg border px-3 py-2 ${
                        isMine ? `ml-auto ${myBubble}` : `mr-auto ${theirBubble}`
                      }`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-3">
                        <span className={`text-[11px] ${mutedText}`}>
                          {isMine ? "You" : userName(message.sender || undefined)}
                        </span>
                        <span className={`text-[10px] ${subtleText}`}>{formatDateTime(message.created_at)}</span>
                      </div>

                      <p className={`whitespace-pre-wrap text-sm ${msgBodyText}`}>{message.body}</p>

                      {copiedUsers.length > 0 && (
                        <p className={`mt-2 text-[11px] ${mutedText}`}>
                          CC: {copiedUsers.map((user) => userName(user)).join(", ")}
                        </p>
                      )}

                      {(message.attachable_type || message.attachable_id) && (
                        <div className="mt-2">
                          {attachablePath ? (
                            <button
                              type="button"
                              onClick={() => navigate(attachablePath)}
                              className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs ${attachLink}`}
                            >
                              <Icon icon="mdi:paperclip" className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {message.attachable_details?.label ||
                                  `${message.attachable_type ?? ""} #${message.attachable_id ?? ""}`}
                              </span>
                              {message.attachable_details?.reference && (
                                <span className={mutedText}>· {message.attachable_details.reference}</span>
                              )}
                              <Icon icon="mdi:arrow-top-right" className="h-3 w-3 shrink-0 opacity-60" />
                            </button>
                          ) : (
                            <span className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs ${attachSpan}`}>
                              <Icon icon="mdi:paperclip" className="h-3.5 w-3.5 shrink-0" />
                              <span>
                                {message.attachable_details?.label ||
                                  `${message.attachable_type ?? ""} #${message.attachable_id ?? ""}`}
                              </span>
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2 flex flex-wrap gap-2">
                        {!isMine && canUpdateMessages && (
                          <button
                            type="button"
                            onClick={() => void handleToggleRead(message)}
                            disabled={isUpdating}
                            className={`rounded border px-2 py-0.5 text-[11px] disabled:opacity-60 ${markReadBtn}`}
                          >
                            {message.is_read ? "Mark Unread" : "Mark Read"}
                          </button>
                        )}

                        {isMine && canDeleteMessages && (
                          <button
                            type="button"
                            onClick={() => void handleDelete(message)}
                            disabled={isDeleting}
                            className="rounded border border-red-500/40 px-2 py-0.5 text-[11px] text-red-400 hover:bg-red-500/10 disabled:opacity-60"
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className={`sticky bottom-0 border-t px-4 py-4 backdrop-blur-sm ${replyFooter}`}>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <label className={`text-xs ${mutedText}`}>Message</label>
                    <div className={`relative flex items-end gap-2 rounded-2xl border p-2 ${composeBox}`}>
                      <button
                        type="button"
                        onClick={() => {
                          setIsRecipientPickerOpen((value) => !value);
                          setIsAttachPickerOpen(false);
                        }}
                        className={`rounded-xl p-2 transition-colors ${
                          isRecipientPickerOpen || replyRecipientIds.length > 0
                            ? "bg-[#0A4D66]/50 text-[#7FD5FF]"
                            : "text-gray-400 hover:bg-[#0A4D66]/25"
                        }`}
                        title="Select recipients"
                        aria-label="Select recipients"
                      >
                        <Icon icon="mdi:account-multiple-plus-outline" className="h-5 w-5" />
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setIsAttachPickerOpen((value) => !value);
                          setIsRecipientPickerOpen(false);
                        }}
                        className={`rounded-xl p-2 transition-colors ${
                          isAttachPickerOpen || attachableType
                            ? "bg-[#0A4D66]/50 text-[#7FD5FF]"
                            : "text-gray-400 hover:bg-[#0A4D66]/25"
                        }`}
                        title="Attach model"
                        aria-label="Attach model"
                      >
                        <Icon icon="mdi:paperclip" className="h-5 w-5" />
                      </button>

                      <textarea
                        value={replyBody}
                        onChange={(event) => setReplyBody(event.target.value)}
                        className={`h-24 w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-2 text-sm focus:border-[#0A4D66]/40 focus:outline-none ${textareaText}`}
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
                        <div className={`absolute bottom-[110%] left-0 z-20 w-full rounded-xl border p-3 shadow-[0_15px_40px_rgba(0,0,0,0.45)] ${pickerBg}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <p className={`text-xs font-medium ${pickerTitle}`}>Attach a model</p>
                            <button
                              type="button"
                              onClick={() => setIsAttachPickerOpen(false)}
                              className={pickerClose}
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
                                    ? "border-[#7FD5FF]/70 bg-[#0A4D66]/40 text-[#C9F1FF]"
                                    : typeChipInactive
                                }`}
                              >
                                {option.label}
                              </button>
                            ))}
                          </div>

                          {attachableType && (
                            <div className="space-y-2">
                              <label className={`text-xs ${mutedText}`}>Select item</label>
                              {attachableSelectionOptions.length > 0 ? (
                                <select
                                  title="Attachable item"
                                  value={attachableId}
                                  onChange={(event) => setAttachableId(event.target.value)}
                                  className={`w-full rounded border px-3 py-2 text-sm focus:outline-none ${pickerInput}`}
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
                                  className={`w-full rounded border px-3 py-2 text-sm focus:outline-none ${pickerInput}`}
                                  placeholder="Attachable ID"
                                  type="number"
                                />
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {isRecipientPickerOpen && (
                        <div className={`absolute bottom-[110%] left-0 z-20 w-full rounded-xl border p-3 shadow-[0_15px_40px_rgba(0,0,0,0.45)] ${pickerBg}`}>
                          <div className="mb-2 flex items-center justify-between">
                            <p className={`text-xs font-medium ${pickerTitle}`}>Choose recipients</p>
                            <button
                              type="button"
                              onClick={() => setIsRecipientPickerOpen(false)}
                              className={pickerClose}
                              title="Close recipient picker"
                              aria-label="Close recipient picker"
                            >
                              <Icon icon="mdi:close" className="h-4 w-4" />
                            </button>
                          </div>

                          <MultiSelect
                            label="Recipients"
                            placeholder={users.length === 0 ? "No users available" : "Select recipients..."}
                            searchable
                            searchPlaceholder="Search users..."
                            options={users
                              .filter((user) => user.id !== currentUserId)
                              .map((user) => ({ value: user.id, label: userName(user) }))}
                            selectedValues={replyRecipientIds}
                            onChange={(values) => setReplyRecipientIds(values.map((value) => Number(value)))}
                            disabled={!canCreateMessages || users.length === 0}
                          />
                        </div>
                      )}
                    </div>

                    {replyRecipientIds.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {replyRecipientIds.map((recipientId) => {
                          const recipient = users.find((user) => user.id === recipientId);
                          if (!recipient) return null;

                          return (
                            <span
                              key={recipientId}
                              className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] ${recipientTag}`}
                            >
                              <Icon icon="mdi:account" className="h-3 w-3" />
                              {userName(recipient)}
                            </span>
                          );
                        })}
                      </div>
                    )}

                    {selectedAttachableOption && (
                      <div className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-[#128C7E]/45 bg-[#128C7E]/15 px-2.5 py-1 text-xs text-[#8FF3E6]">
                        <Icon icon="mdi:link-variant" className="h-3.5 w-3.5" />
                        <span>{selectedAttachableOption.label}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={resetReplyForm}
                    className={`rounded border px-3 py-2 text-xs ${clearBtn}`}
                  >
                    Clear
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {canCreateMessages && (
        <button
          type="button"
          onClick={() => {
            if (!selectedConversationUserId && conversations.length > 0) {
              setSelectedConversationUserId(conversations[0].user.id);
            }
            setIsRecipientPickerOpen(true);
            setIsAttachPickerOpen(false);
          }}
          className="fixed bottom-6 right-6 z-40 inline-flex h-14 w-14 items-center justify-center rounded-full border border-[#29D6B5]/45 bg-[#128C7E] text-white shadow-[0_18px_40px_rgba(0,0,0,0.35)] transition-colors hover:bg-[#20a193]"
          aria-label="Compose message"
          title="Compose message"
        >
          <Icon icon="mdi:message-plus-outline" className="h-6 w-6" />
        </button>
      )}
    </div>
  );
};
