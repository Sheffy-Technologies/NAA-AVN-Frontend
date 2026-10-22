import { useState, useRef, useEffect, useMemo } from "react";
import { Icon } from "@iconify/react";
import { cn } from "@/shared/utils/cn";
import { useAppDispatch } from "@/shared/hooks/redux";
import { showToast } from "@/shared/store/toastSlice";
import {
  useGetOperationSatelliteMessagesQuery,
  useSendSatelliteMessageMutation,
  useSimulateGarminPingMutation,
  type LiveAircraftPosition,
  type TelemetryPoint,
  type OperationAssignedAsset,
} from "../api";
import { latLonToMgrs, formatMgrsSpaced, decimalToDms } from "../utils/coordinates";

type SatelliteCommsCardProps = {
  operationId: number;
  operationName?: string;
  assets?: OperationAssignedAsset[];
  latestPositions?: LiveAircraftPosition[];
  telemetryTracks?: TelemetryPoint[];
  onFocusPosition?: (lat: number, lng: number) => void;
};

const QUICK_COMMANDS = [
  { label: "Request SitRep", text: "HQ C2: Request immediate operational SitRep and fuel state. Over." },
  { label: "Ops Normal Check", text: "HQ C2: Routine comms check. Confirm all systems nominal." },
  { label: "Weather Warning", text: "HQ C2 ADVISORY: Severe convective cells & lightning detected enroute. Exercise caution." },
  { label: "Hold at Waypoint", text: "HQ C2 ORDER: Hold at current checkpoint until airspace cleared. Standby." },
  { label: "Mission Acknowledge", text: "HQ C2: Message received and logged. Continue mission profile." },
];

export const SatelliteCommsCard = ({
  operationId,
  operationName,
  assets = [],
  latestPositions = [],
  telemetryTracks = [],
  onFocusPosition,
}: SatelliteCommsCardProps) => {
  const dispatch = useAppDispatch();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  // Queries & Mutations
  const {
    data: messages = [],
    isLoading: isLoadingMessages,
    refetch: refetchMessages,
  } = useGetOperationSatelliteMessagesQuery(operationId, {
    pollingInterval: 6000,
  });

  const [sendSatelliteMessage, { isLoading: isSending }] = useSendSatelliteMessageMutation();
  const [simulateGarminPing, { isLoading: isSimulating }] = useSimulateGarminPingMutation();

  // Local State
  const [messageText, setMessageText] = useState("");
  const [selectedAssetId, setSelectedAssetId] = useState<number | undefined>(
    assets[0]?.asset_id ?? undefined
  );
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);

  // Simulation Form State
  const defaultLat = latestPositions[0]?.latitude ?? 11.8333;
  const defaultLng = latestPositions[0]?.longitude ?? 13.1500;
  const [simLat, setSimLat] = useState(String(defaultLat));
  const [simLng, setSimLng] = useState(String(defaultLng));
  const [simAlt, setSimAlt] = useState("2450");
  const [simSpeed, setSimSpeed] = useState("115");
  const [simCourse, setSimCourse] = useState("45");
  const [simText, setSimText] = useState("");
  const [simIsSos, setSimIsSos] = useState(false);

  // Scroll to bottom on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // Handle Outbound Message Send
  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = messageText.trim();
    if (!trimmed) return;

    try {
      await sendSatelliteMessage({
        operation_id: operationId,
        message_text: trimmed,
        asset_id: selectedAssetId,
      }).unwrap();

      setMessageText("");
      dispatch(
        showToast({
          message: "Satellite transmission dispatched via Iridium uplink",
          type: "success",
        })
      );
    } catch (error) {
      console.error("Failed to transmit satellite message:", error);
      dispatch(
        showToast({
          message: "Failed to dispatch satellite transmission",
          type: "error",
        })
      );
    }
  };

  // Handle Quick Command Click
  const handleQuickCommand = (text: string) => {
    setMessageText(text);
  };

  // Handle Simulator Injection
  const handleSimulatePing = async (e: React.FormEvent) => {
    e.preventDefault();
    const lat = parseFloat(simLat);
    const lng = parseFloat(simLng);
    if (isNaN(lat) || isNaN(lng)) {
      dispatch(showToast({ message: "Invalid latitude or longitude", type: "error" }));
      return;
    }

    try {
      await simulateGarminPing({
        operation_id: operationId,
        asset_id: selectedAssetId,
        latitude: lat,
        longitude: lng,
        altitude: parseFloat(simAlt) || 2450,
        speed: parseFloat(simSpeed) || 115,
        course: parseFloat(simCourse) || 45,
        message_text: simText.trim() || undefined,
        is_sos: simIsSos,
      }).unwrap();

      dispatch(
        showToast({
          message: simIsSos
            ? "CRITICAL SOS SIMULATION INJECTED"
            : "inReach Satellite telemetry fix simulated successfully",
          type: simIsSos ? "error" : "success",
        })
      );
      setSimText("");
      setSimIsSos(false);
      setIsSimulatorOpen(false);
    } catch (error) {
      console.error("Failed to simulate inReach ping:", error);
      dispatch(
        showToast({
          message: "Failed to inject simulation telemetry",
          type: "error",
        })
      );
    }
  };

  const hasSosMessage = useMemo(() => {
    return messages.some((m) => m.is_sos);
  }, [messages]);

  return (
    <div className="space-y-6">
      {/* Critical SOS Emergency Banner if Active */}
      {hasSosMessage && (
        <div className="rounded-xl border-2 border-red-500 bg-red-950/80 p-4 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)] animate-pulse flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-red-600 flex items-center justify-center shrink-0">
              <Icon icon="mdi:alert-octagon" className="w-6 h-6 text-white" />
            </div>
            <div>
              <h4 className="font-bold text-red-200 text-sm tracking-wide uppercase flex items-center gap-2">
                <span>EMERGENCY DISTRESS BEACON ACTIVE (inReach SOS)</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-red-600 text-white font-mono">PRIORITY 1</span>
              </h4>
              <p className="text-xs text-red-300">
                A satellite distress message has been recorded from this operation. Initiate Search & Rescue (SAR) procedures immediately.
              </p>
            </div>
          </div>
          {latestPositions[0] && onFocusPosition && (
            <button
              type="button"
              onClick={() => onFocusPosition(latestPositions[0].latitude, latestPositions[0].longitude)}
              className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 shadow"
            >
              <Icon icon="mdi:crosshairs-gps" className="w-4 h-4" />
              <span>Center on SOS Coordinates</span>
            </button>
          )}
        </div>
      )}

      {/* Top Telemetry & Fleet Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {latestPositions.length > 0 ? (
          latestPositions.map((pos) => {
            const mgrs = formatMgrsSpaced(latLonToMgrs(pos.latitude, pos.longitude));
            const dms = `${decimalToDms(pos.latitude, true)}, ${decimalToDms(pos.longitude, false)}`;

            return (
              <div
                key={pos.asset_id ?? pos.imei}
                className="rounded-xl border border-cyan-500/30 bg-[#001825]/90 p-4 shadow-lg backdrop-blur-md relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 h-1 w-full bg-gradient-to-r from-cyan-500 to-sky-400" />
                <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                    <span className="font-bold text-white text-sm">
                      {pos.call_sign || pos.asset_name || "Aircraft Unit"}
                    </span>
                  </div>
                  {pos.battery_level !== undefined && pos.battery_level !== null && (
                    <span className="text-[11px] font-mono text-emerald-400 flex items-center gap-1">
                      <Icon icon="mdi:battery-charging-80" className="w-3.5 h-3.5" />
                      <span>{pos.battery_level}%</span>
                    </span>
                  )}
                </div>

                <div className="space-y-2 text-xs">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-[#001219] p-2 rounded border border-white/5">
                      <span className="text-[10px] text-gray-400 block uppercase">Altitude MSL</span>
                      <span className="text-sm font-bold font-mono text-cyan-300">
                        {pos.altitude ? `${Math.round(pos.altitude)} FT` : "Surface"}
                      </span>
                    </div>
                    <div className="bg-[#001219] p-2 rounded border border-white/5">
                      <span className="text-[10px] text-gray-400 block uppercase">Ground Speed</span>
                      <span className="text-sm font-bold font-mono text-sky-300">
                        {pos.speed ? `${Math.round(pos.speed)} KTS` : "0 KTS"}
                      </span>
                    </div>
                  </div>

                  <div className="bg-[#001219] p-2 rounded border border-white/5 font-mono text-[11px] space-y-0.5">
                    <div className="text-[#7FD5FF] flex items-center justify-between">
                      <span>MGRS:</span>
                      <span className="text-white font-bold">{mgrs}</span>
                    </div>
                    <div className="text-gray-400 flex items-center justify-between text-[10px]">
                      <span>DMS:</span>
                      <span className="text-gray-300 truncate max-w-[170px]" title={dms}>{dms}</span>
                    </div>
                    <div className="text-gray-400 flex items-center justify-between text-[10px]">
                      <span>HDG / CRS:</span>
                      <span className="text-gray-200">{pos.course !== undefined && pos.course !== null ? `${Math.round(pos.course)}°` : "N/A"}</span>
                    </div>
                  </div>

                  {onFocusPosition && (
                    <button
                      type="button"
                      onClick={() => onFocusPosition(pos.latitude, pos.longitude)}
                      className="w-full text-center py-1.5 rounded bg-cyan-950/80 hover:bg-cyan-900/90 text-cyan-300 border border-cyan-500/30 text-[11px] font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Icon icon="mdi:crosshairs" className="w-3.5 h-3.5" />
                      <span>Pin on Tactical Map</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full rounded-xl border border-[#0A4D66]/40 bg-[#001825]/60 p-4 text-center text-sm text-gray-400">
            <Icon icon="mdi:satellite-uplink" className="w-8 h-8 text-cyan-400/60 mx-auto mb-2 animate-pulse" />
            <p className="font-semibold text-gray-300">Awaiting inReach Satellite Link</p>
            <p className="text-xs text-gray-500 mt-1">
              No live telemetry breadcrumbs reported yet for this operation. InReach pings will automatically populate here via Iridium satellite.
            </p>
          </div>
        )}
      </div>

      {/* Main Tactical Comms & Chat Terminal */}
      <div className="rounded-xl border border-[#0A4D66]/50 bg-[#001219] shadow-2xl flex flex-col overflow-hidden">
        {/* Terminal Header */}
        <div className="bg-[#001825] px-6 py-4 border-b border-[#0A4D66]/40 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-cyan-950 border border-cyan-500/40 flex items-center justify-center">
              <Icon icon="mdi:satellite-variant" className="w-5 h-5 text-cyan-400 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Tactical Satellite Comms (Garmin inReach / Iridium)
                </h3>
                {operationName && (
                  <span className="text-xs font-semibold text-cyan-300/80 font-mono hidden sm:inline">
                    [{operationName}]
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 border border-emerald-500/40 text-emerald-300 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span>LEO Gateway Online</span>
                </span>
                {telemetryTracks && telemetryTracks.length > 0 && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 border border-cyan-500/30 text-cyan-300">
                    {telemetryTracks.length} Pings Logged
                  </span>
                )}
              </div>
              <span className="text-xs text-gray-400">
                Encrypted Two-Way Beyond-Line-of-Sight (BLOS) Satellite Data Link
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsSimulatorOpen((prev) => !prev)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-cyan-500/30 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 text-xs font-semibold transition-colors cursor-pointer"
            >
              <Icon icon="mdi:robot-confused" className="w-4 h-4" />
              <span>{isSimulatorOpen ? "Close Simulator" : "Test inReach Simulator"}</span>
            </button>
            <button
              type="button"
              onClick={() => refetchMessages()}
              className="p-1.5 rounded-lg border border-[#0A4D66]/40 hover:bg-white/5 text-gray-300 hover:text-white transition-colors"
              title="Refresh Comms"
            >
              <Icon icon="mdi:refresh" className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Collapsible Test Simulation Panel */}
        {isSimulatorOpen && (
          <div className="bg-[#001420] border-b border-cyan-500/30 p-5 animate-in fade-in slide-in-from-top-3 duration-200">
            <div className="flex items-center justify-between mb-3 border-b border-white/5 pb-2">
              <span className="text-xs font-bold uppercase tracking-wider text-cyan-300 flex items-center gap-1.5">
                <Icon icon="mdi:test-tube" className="w-4 h-4" />
                <span>Simulate Cockpit inReach Transmission (Satellite Ingest Drill)</span>
              </span>
              <span className="text-[11px] text-gray-400">
                Simulates real-world Iridium IPC Outbound Webhook arrival
              </span>
            </div>

            <form onSubmit={handleSimulatePing} className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Latitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={simLat}
                    onChange={(e) => setSimLat(e.target.value)}
                    className="w-full bg-[#001825] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="11.8333"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Longitude</label>
                  <input
                    type="number"
                    step="0.0001"
                    value={simLng}
                    onChange={(e) => setSimLng(e.target.value)}
                    className="w-full bg-[#001825] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="13.1500"
                    required
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Altitude (FT)</label>
                  <input
                    type="number"
                    value={simAlt}
                    onChange={(e) => setSimAlt(e.target.value)}
                    className="w-full bg-[#001825] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="2450"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Speed (KTS)</label>
                  <input
                    type="number"
                    value={simSpeed}
                    onChange={(e) => setSimSpeed(e.target.value)}
                    className="w-full bg-[#001825] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="115"
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-gray-400 block mb-1">Heading (°)</label>
                  <input
                    type="number"
                    value={simCourse}
                    onChange={(e) => setSimCourse(e.target.value)}
                    className="w-full bg-[#001825] border border-gray-700 rounded px-2.5 py-1.5 text-xs text-white font-mono focus:border-cyan-500 focus:outline-none"
                    placeholder="45"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <label className="flex items-center gap-2 cursor-pointer bg-red-950/40 border border-red-500/30 rounded px-2.5 py-1.5 text-xs text-red-300 font-semibold hover:bg-red-950/60 transition-colors">
                    <input
                      type="checkbox"
                      checked={simIsSos}
                      onChange={(e) => setSimIsSos(e.target.checked)}
                      className="rounded border-red-500 text-red-600 focus:ring-red-500"
                    />
                    <span>Trigger SOS</span>
                  </label>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 items-center">
                <input
                  type="text"
                  value={simText}
                  onChange={(e) => setSimText(e.target.value)}
                  placeholder="Simulated text message from cockpit (e.g. 'Passing Checkpoint Bravo, all quiet')..."
                  className="w-full bg-[#001825] border border-gray-700 rounded px-3 py-2 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none"
                />
                <button
                  type="submit"
                  disabled={isSimulating}
                  className="w-full sm:w-auto px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-colors shrink-0 flex items-center justify-center gap-1.5 shadow disabled:opacity-50 cursor-pointer"
                >
                  <Icon icon="mdi:satellite-uplink" className="w-4 h-4" />
                  <span>{isSimulating ? "Transmitting..." : "Inject Satellite Telemetry"}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Message Stream */}
        <div className="p-6 h-96 overflow-y-auto space-y-4 font-sans bg-[#001018]/90">
          {isLoadingMessages ? (
            <div className="h-full flex items-center justify-center text-cyan-400">
              <Icon icon="mdi:loading" className="w-8 h-8 animate-spin" />
            </div>
          ) : messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 text-xs gap-2">
              <Icon icon="mdi:message-satellite-outline" className="w-10 h-10 text-gray-600" />
              <p>No satellite messages logged for this mission profile.</p>
              <p className="text-[11px] text-gray-600">
                Outbound transmissions from HQ and inbound texts from the inReach cockpit unit will appear here in real time.
              </p>
            </div>
          ) : (
            messages.map((msg) => {
              const isInbound = msg.direction === "inbound";
              const isSos = msg.is_sos;
              const hasCoords = msg.latitude !== null && msg.longitude !== null;

              return (
                <div
                  key={msg.id}
                  className={cn(
                    "flex flex-col max-w-[85%] rounded-xl p-3.5 shadow-md space-y-1.5 text-xs transition-all",
                    isSos
                      ? "bg-red-950/90 border-2 border-red-500 text-red-100 self-center max-w-[95%] animate-pulse"
                      : isInbound
                      ? "bg-[#002233] border border-cyan-500/40 text-gray-100 self-start"
                      : "bg-[#0A3D55] border border-sky-400/30 text-white self-end"
                  )}
                >
                  {/* Sender & Timestamp Header */}
                  <div className="flex items-center justify-between gap-4 border-b border-white/10 pb-1 text-[11px]">
                    <div className="flex items-center gap-1.5 font-bold">
                      <Icon
                        icon={
                          isSos
                            ? "mdi:alert-decagram"
                            : isInbound
                            ? "mdi:airplane"
                            : "mdi:transmission-tower"
                        }
                        className={cn(
                          "w-4 h-4",
                          isSos ? "text-red-400" : isInbound ? "text-cyan-400" : "text-sky-300"
                        )}
                      />
                      <span className={isSos ? "text-red-300 font-extrabold uppercase" : "text-white"}>
                        {msg.sender || (isInbound ? "Cockpit Aircrew" : "HQ Operations Center")}
                      </span>
                      <span className="text-[10px] font-normal text-gray-400">
                        {isInbound ? "via inReach (Iridium)" : "to inReach"}
                      </span>
                    </div>
                    <span className="text-[10px] text-gray-400 font-mono">
                      {msg.sent_at ? new Date(msg.sent_at).toLocaleTimeString() : ""}
                    </span>
                  </div>

                  {/* Body Text */}
                  <p className={cn("text-xs leading-relaxed whitespace-pre-wrap", isSos && "font-bold text-sm")}>
                    {msg.message_text}
                  </p>

                  {/* Location Coordinate Tag if available */}
                  {hasCoords && (
                    <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t border-white/5 text-[10px] font-mono text-gray-300">
                      <div className="flex items-center gap-2">
                        <span>
                          📍 {msg.latitude!.toFixed(4)}°, {msg.longitude!.toFixed(4)}°
                        </span>
                        <span>•</span>
                        <span className="text-[#7FD5FF]">
                          {formatMgrsSpaced(latLonToMgrs(msg.latitude!, msg.longitude!))}
                        </span>
                        {msg.altitude && (
                          <>
                            <span>•</span>
                            <span>{Math.round(msg.altitude)} FT</span>
                          </>
                        )}
                      </div>
                      {onFocusPosition && (
                        <button
                          type="button"
                          onClick={() => onFocusPosition(msg.latitude!, msg.longitude!)}
                          className="text-cyan-400 hover:text-cyan-200 underline cursor-pointer"
                        >
                          View Fix on Map
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Tactical Quick Action Chips */}
        <div className="bg-[#001622] px-6 py-2 border-t border-[#0A4D66]/40 flex flex-wrap items-center gap-2">
          <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
            <Icon icon="mdi:lightning-bolt" className="w-3.5 h-3.5 text-amber-400" />
            <span>Tactical Presets:</span>
          </span>
          {QUICK_COMMANDS.map((cmd) => (
            <button
              key={cmd.label}
              type="button"
              onClick={() => handleQuickCommand(cmd.text)}
              className="text-[11px] px-2.5 py-1 rounded-full bg-[#002233] hover:bg-[#002e45] text-cyan-300 border border-cyan-500/30 transition-colors cursor-pointer"
            >
              {cmd.label}
            </button>
          ))}
        </div>

        {/* Input & Dispatch Bar */}
        <form onSubmit={handleSendMessage} className="bg-[#001825] p-4 border-t border-[#0A4D66]/40 flex flex-col sm:flex-row items-center gap-3">
          {assets.length > 1 && (
            <select
              value={selectedAssetId ?? ""}
              onChange={(e) => setSelectedAssetId(Number(e.target.value) || undefined)}
              className="w-full sm:w-auto bg-[#001219] border border-gray-700 rounded-lg px-3 py-2 text-xs text-white focus:border-cyan-500 focus:outline-none"
            >
              <option value="">Broadcast to All Units</option>
              {assets.map((a) => (
                <option key={a.asset_id} value={a.asset_id}>
                  {a.asset?.name || a.name || `Asset #${a.asset_id}`}
                </option>
              ))}
            </select>
          )}

          <div className="relative flex-1 w-full">
            <input
              type="text"
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder="Transmit tactical satellite message to cockpit inReach unit..."
              maxLength={160}
              className="w-full rounded-lg border border-gray-700 bg-[#001219] pl-3 pr-16 py-2.5 text-xs text-white placeholder-gray-500 focus:border-cyan-500 focus:outline-none focus:ring-1 focus:ring-cyan-500"
            />
            <span className="absolute right-3 top-3 text-[10px] font-mono text-gray-500">
              {messageText.length}/160
            </span>
          </div>

          <button
            type="submit"
            disabled={isSending || !messageText.trim()}
            className="w-full sm:w-auto px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-bold transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
          >
            <Icon icon="mdi:send" className="w-4 h-4" />
            <span>{isSending ? "Transmitting..." : "Send Uplink"}</span>
          </button>
        </form>
      </div>
    </div>
  );
};
