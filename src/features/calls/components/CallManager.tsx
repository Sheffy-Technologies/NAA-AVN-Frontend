import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AgoraRTC, {
  type IAgoraRTCClient,
  type IAgoraRTCRemoteUser,
  type ICameraVideoTrack,
  type IMicrophoneAudioTrack,
} from "agora-rtc-sdk-ng";
import { Icon } from "@iconify/react";
import {
  useAcceptCallMutation,
  useDeclineCallMutation,
  useEndCallMutation,
  useLazyGetCallTokenQuery,
  type CallItem,
  type CallUser,
} from "@/features/calls/api";
import {
  clearIncomingCall,
  clearOutgoingCall,
  resetCallState,
  setActiveCall,
  setIncomingCall,
} from "@/features/calls/callSlice";
import { useAppDispatch, useAppSelector } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import { getEchoClient } from "@/shared/realtime/echo";
import { useTheme } from "@/context/ThemeContext";
import { playCallActivatedBeep, playIncomingCallRing } from "@/shared/utils/sound";

const userName = (user?: CallUser | null): string => {
  if (!user) return "Unknown User";
  const fullName = [user.firstname, user.lastname].filter(Boolean).join(" ").trim();
  if (fullName) return fullName;
  if (user.username) return user.username;
  return user.email || "Unknown User";
};

const callEquals = (a: CallItem | null, b: CallItem | null): boolean => {
  if (!a || !b) return false;
  return a.id === b.id;
};

export const CallManager = () => {
  const dispatch = useAppDispatch();
  const { isDark } = useTheme();
  const authToken = useAppSelector((state) => state.auth.token);
  const authUser = useAppSelector((state) => state.auth.user);
  const incomingCall = useAppSelector((state) => state.call.incomingCall);
  const outgoingCall = useAppSelector((state) => state.call.outgoingCall);
  const activeCall = useAppSelector((state) => state.call.activeCall);

  const [acceptCall, { isLoading: isAccepting }] = useAcceptCallMutation();
  const [declineCall, { isLoading: isDeclining }] = useDeclineCallMutation();
  const [endCall, { isLoading: isEnding }] = useEndCallMutation();
  const [fetchCallToken] = useLazyGetCallTokenQuery();

  const [isJoining, setIsJoining] = useState(false);
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [remoteUsers, setRemoteUsers] = useState<IAgoraRTCRemoteUser[]>([]);

  const joinedCallIdRef = useRef<number | null>(null);
  const incomingCallRef = useRef<CallItem | null>(null);
  const outgoingCallRef = useRef<CallItem | null>(null);
  const activeCallRef = useRef<CallItem | null>(null);
  const clientRef = useRef<IAgoraRTCClient | null>(null);
  const localAudioTrackRef = useRef<IMicrophoneAudioTrack | null>(null);
  const localVideoTrackRef = useRef<ICameraVideoTrack | null>(null);
  const localVideoContainerRef = useRef<HTMLDivElement | null>(null);

  const currentUserId = Number(authUser?.id || 0);

  const cardCls = isDark
    ? "border-[#0A4D66]/40 bg-[#001825] text-white"
    : "border-gray-200 bg-white text-gray-900";
  const subTextCls = isDark ? "text-gray-300" : "text-gray-500";

  const cleanupRtc = useCallback(async () => {
    try {
      if (clientRef.current && localAudioTrackRef.current) {
        await clientRef.current.unpublish([localAudioTrackRef.current]);
      }
      if (clientRef.current && localVideoTrackRef.current) {
        await clientRef.current.unpublish([localVideoTrackRef.current]);
      }
    } catch {
      // Unpublish can fail if client is already disconnected.
    }

    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
      localAudioTrackRef.current.close();
      localAudioTrackRef.current = null;
    }

    if (localVideoTrackRef.current) {
      localVideoTrackRef.current.stop();
      localVideoTrackRef.current.close();
      localVideoTrackRef.current = null;
    }

    if (clientRef.current) {
      try {
        await clientRef.current.leave();
      } catch {
        // Leave can fail if not joined anymore.
      }
    }

    clientRef.current = null;
    joinedCallIdRef.current = null;
    setRemoteUsers([]);
    setIsMicEnabled(true);
    setIsCameraEnabled(true);
  }, []);

  const joinCall = async (call: CallItem) => {
    if (!authToken || !authUser?.id) return;
    if (joinedCallIdRef.current === call.id) return;

    setIsJoining(true);

    try {
      await cleanupRtc();

      const tokenPayload = await fetchCallToken(call.id, true).unwrap();

      const client = AgoraRTC.createClient({ mode: "rtc", codec: "vp8" });
      clientRef.current = client;

      client.on("user-published", async (user, mediaType) => {
        await client.subscribe(user, mediaType);

        if (mediaType === "video") {
          setRemoteUsers((prev) => {
            const filtered = prev.filter((item) => item.uid !== user.uid);
            return [...filtered, user];
          });
        }

        if (mediaType === "audio") {
          user.audioTrack?.play();
        }
      });

      client.on("user-unpublished", (user, mediaType) => {
        if (mediaType === "video") {
          setRemoteUsers((prev) => prev.filter((item) => item.uid !== user.uid));
        }
      });

      client.on("user-left", (user) => {
        setRemoteUsers((prev) => prev.filter((item) => item.uid !== user.uid));
      });

      await client.join(
        tokenPayload.app_id,
        tokenPayload.channel_name,
        tokenPayload.token,
        tokenPayload.uid,
      );

      const [microphoneTrack, cameraTrack] = await AgoraRTC.createMicrophoneAndCameraTracks();

      localAudioTrackRef.current = microphoneTrack;
      localVideoTrackRef.current = cameraTrack;

      await client.publish([microphoneTrack, cameraTrack]);

      if (localVideoContainerRef.current) {
        cameraTrack.play(localVideoContainerRef.current);
      }

      joinedCallIdRef.current = call.id;
    } catch {
      dispatch(showToast({ message: "Unable to join call", type: "error" }));
    } finally {
      setIsJoining(false);
    }
  };

  useEffect(() => {
    incomingCallRef.current = incomingCall;
    outgoingCallRef.current = outgoingCall;
    activeCallRef.current = activeCall;
  }, [incomingCall, outgoingCall, activeCall]);

  useEffect(() => {
    if (!authToken || !authUser?.id) {
      return;
    }

    const echo = getEchoClient(authToken);
    if (!echo) {
      return;
    }

    const channel = `App.Models.User.${authUser.id}`;
    const privateChannel = `private-${channel}`;

    echo.private(channel).listen(".call.invited", (payload: { call?: CallItem }) => {
      if (!payload.call) return;

      const currentActive = activeCallRef.current;

      if (currentActive && currentActive.id !== payload.call.id) {
        dispatch(showToast({ message: "Incoming call missed: already on another call", type: "error" }));
        return;
      }

      dispatch(setIncomingCall(payload.call));
      dispatch(showToast({ message: `Incoming call from ${userName(payload.call.caller)}`, type: "success" }));
    });

    echo.private(channel).listen(".call.accepted", (payload: { call?: CallItem }) => {
      if (!payload.call) return;

      const currentOutgoing = outgoingCallRef.current;
      const currentIncoming = incomingCallRef.current;

      if (currentOutgoing && payload.call.id === currentOutgoing.id) {
        dispatch(clearOutgoingCall());
        dispatch(clearIncomingCall());
        dispatch(setActiveCall(payload.call));
        void playCallActivatedBeep();
      } else if (currentIncoming && payload.call.id === currentIncoming.id) {
        dispatch(clearIncomingCall());
        dispatch(setActiveCall(payload.call));
        void playCallActivatedBeep();
      }
    });

    echo.private(channel).listen(".call.declined", (payload: { call?: CallItem }) => {
      if (!payload.call) return;

      if (callEquals(outgoingCallRef.current, payload.call) || callEquals(incomingCallRef.current, payload.call) || callEquals(activeCallRef.current, payload.call)) {
        dispatch(resetCallState());
        void cleanupRtc();
        dispatch(showToast({ message: "Call declined", type: "error" }));
      }
    });

    echo.private(channel).listen(".call.ended", (payload: { call?: CallItem }) => {
      if (!payload.call) return;

      if (callEquals(outgoingCallRef.current, payload.call) || callEquals(incomingCallRef.current, payload.call) || callEquals(activeCallRef.current, payload.call)) {
        dispatch(resetCallState());
        void cleanupRtc();
        dispatch(showToast({ message: "Call ended", type: "success" }));
      }
    });

    return () => {
      echo.leaveChannel(privateChannel);
    };
  }, [authToken, authUser?.id, dispatch, cleanupRtc]);

  useEffect(() => {
    if (!activeCall) {
      void cleanupRtc();
      return;
    }

    if (joinedCallIdRef.current !== activeCall.id) {
      void joinCall(activeCall);
    }
  }, [activeCall, cleanupRtc]);

  useEffect(() => {
    return () => {
      void cleanupRtc();
    };
  }, [cleanupRtc]);

  useEffect(() => {
    if (!incomingCall || activeCall) {
      return;
    }

    void playIncomingCallRing();
    const ringInterval = window.setInterval(() => {
      void playIncomingCallRing();
    }, 2000);

    return () => {
      window.clearInterval(ringInterval);
    };
  }, [incomingCall, activeCall]);

  const incomingCallerName = useMemo(() => userName(incomingCall?.caller), [incomingCall]);
  const outgoingRecipientName = useMemo(() => {
    if (!outgoingCall) return "";
    const otherUser = outgoingCall.caller_id === currentUserId ? outgoingCall.callee : outgoingCall.caller;
    return userName(otherUser);
  }, [outgoingCall, currentUserId]);

  const activePeerName = useMemo(() => {
    if (!activeCall) return "";
    const otherUser = activeCall.caller_id === currentUserId ? activeCall.callee : activeCall.caller;
    return userName(otherUser);
  }, [activeCall, currentUserId]);

  const handleAcceptIncoming = async () => {
    if (!incomingCall) return;

    try {
      const call = await acceptCall(incomingCall.id).unwrap();
      dispatch(clearIncomingCall());
      dispatch(clearOutgoingCall());
      dispatch(setActiveCall(call));
    } catch {
      dispatch(showToast({ message: "Failed to accept call", type: "error" }));
    }
  };

  const handleDeclineIncoming = async () => {
    if (!incomingCall) return;

    try {
      await declineCall(incomingCall.id).unwrap();
      dispatch(clearIncomingCall());
    } catch {
      dispatch(showToast({ message: "Failed to decline call", type: "error" }));
    }
  };

  const handleCancelOutgoing = async () => {
    if (!outgoingCall) return;

    try {
      await endCall(outgoingCall.id).unwrap();
    } catch {
      dispatch(showToast({ message: "Failed to cancel outgoing call", type: "error" }));
    } finally {
      dispatch(clearOutgoingCall());
    }
  };

  const handleEndActiveCall = async () => {
    if (!activeCall) return;

    try {
      await endCall(activeCall.id).unwrap();
    } catch {
      dispatch(showToast({ message: "Failed to end call", type: "error" }));
    } finally {
      dispatch(resetCallState());
      await cleanupRtc();
    }
  };

  const toggleMic = async () => {
    if (!localAudioTrackRef.current) return;

    const next = !isMicEnabled;
    await localAudioTrackRef.current.setEnabled(next);
    setIsMicEnabled(next);
  };

  const toggleCamera = async () => {
    if (!localVideoTrackRef.current) return;

    const next = !isCameraEnabled;
    await localVideoTrackRef.current.setEnabled(next);
    setIsCameraEnabled(next);
  };

  if (!authUser?.id) return null;

  return (
    <>
      {incomingCall && !activeCall && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div className={`w-full max-w-sm rounded-xl border p-5 ${cardCls}`}>
            <p className="text-sm font-semibold">Incoming video call</p>
            <p className={`mt-1 text-sm ${subTextCls}`}>{incomingCallerName}</p>

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => void handleDeclineIncoming()}
                disabled={isDeclining}
                className="rounded-md border border-red-500/40 px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-60"
              >
                Decline
              </button>
              <button
                type="button"
                onClick={() => void handleAcceptIncoming()}
                disabled={isAccepting}
                className="rounded-md bg-[#128C7E] px-3 py-2 text-xs font-medium text-white hover:bg-[#20a193] disabled:opacity-60"
              >
                Accept
              </button>
            </div>
          </div>
        </div>
      )}

      {outgoingCall && !activeCall && (
        <div className="fixed bottom-6 left-1/2 z-[75] w-[calc(100vw-2rem)] max-w-md -translate-x-1/2">
          <div className={`rounded-xl border px-4 py-3 shadow-lg ${cardCls}`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold">Calling {outgoingRecipientName}</p>
                <p className={`text-xs ${subTextCls}`}>Waiting for answer...</p>
              </div>
              <button
                type="button"
                onClick={() => void handleCancelOutgoing()}
                disabled={isEnding}
                className="rounded-md border border-red-500/40 px-2.5 py-1.5 text-xs text-red-400 hover:bg-red-500/10 disabled:opacity-60"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {activeCall && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/75 p-3">
          <div className={`h-[92vh] w-full max-w-5xl rounded-xl border p-3 ${cardCls}`}>
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">In call with {activePeerName}</p>
                <p className={`text-xs ${subTextCls}`}>{isJoining ? "Connecting media..." : "Connected"}</p>
              </div>
              <button
                type="button"
                onClick={() => void handleEndActiveCall()}
                className="inline-flex items-center gap-1.5 rounded-md border border-red-500/40 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10"
              >
                <Icon icon="mdi:phone-hangup" className="h-4 w-4" />
                End
              </button>
            </div>

            <div className="grid h-[calc(100%-88px)] grid-cols-1 gap-2 lg:grid-cols-[1fr_260px]">
              <div className="rounded-lg border border-[#0A4D66]/30 bg-black/40 p-2">
                {remoteUsers.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-gray-300">
                    Waiting for the other participant...
                  </div>
                ) : (
                  <div className="grid h-full grid-cols-1 gap-2 md:grid-cols-2">
                    {remoteUsers.map((user) => (
                      <div key={String(user.uid)} className="relative overflow-hidden rounded-md border border-[#0A4D66]/30 bg-black">
                        <div
                          className="h-full min-h-[220px] w-full"
                          ref={(element) => {
                            if (element && user.videoTrack) {
                              user.videoTrack.play(element);
                            }
                          }}
                        />
                        <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
                          Remote {String(user.uid)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 rounded-lg border border-[#0A4D66]/30 bg-black/30 p-2">
                <div className="relative flex-1 overflow-hidden rounded-md border border-[#0A4D66]/30 bg-black">
                  <div ref={localVideoContainerRef} className="h-full min-h-[180px] w-full" />
                  <span className="pointer-events-none absolute left-2 top-2 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
                    You
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleMic()}
                    className={`inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-2 text-xs ${
                      isMicEnabled
                        ? "bg-[#128C7E] text-white"
                        : "bg-amber-600/80 text-white"
                    }`}
                  >
                    <Icon icon={isMicEnabled ? "mdi:microphone" : "mdi:microphone-off"} className="h-4 w-4" />
                    {isMicEnabled ? "Mute" : "Unmute"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleCamera()}
                    className={`inline-flex items-center justify-center gap-1 rounded-md px-2.5 py-2 text-xs ${
                      isCameraEnabled
                        ? "bg-[#128C7E] text-white"
                        : "bg-amber-600/80 text-white"
                    }`}
                  >
                    <Icon icon={isCameraEnabled ? "mdi:video" : "mdi:video-off"} className="h-4 w-4" />
                    {isCameraEnabled ? "Camera Off" : "Camera On"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
