import Echo from "laravel-echo";
import Pusher from "pusher-js";

type EchoInstance = Echo<"reverb">;

let echoInstance: EchoInstance | null = null;
let activeToken: string | null = null;

const apiBaseUrl = (import.meta.env.VITE_API_BASE_URL as string | undefined) || "";

const backendBaseUrl = apiBaseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");

const normalizeReverbHost = (value: string): string => {
  return value
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/.*$/, "")
    .replace(/:\d+$/, "");
};

const reverbHostRaw =
  (import.meta.env.VITE_REVERB_HOST as string | undefined) ||
  (backendBaseUrl ? new URL(backendBaseUrl).hostname : window.location.hostname);

const reverbHost = normalizeReverbHost(reverbHostRaw || window.location.hostname);

const reverbScheme = (import.meta.env.VITE_REVERB_SCHEME as string | undefined) || "http";
const reverbPort = Number(
  (import.meta.env.VITE_REVERB_PORT as string | undefined) ||
    (reverbScheme === "https" ? 443 : 8080),
);
const forceTLS = reverbScheme === "https";

const reverbAppKey =
  (import.meta.env.VITE_REVERB_APP_KEY as string | undefined) || "app-key";

const authEndpoint = `${apiBaseUrl.replace(/\/$/, "")}/broadcasting/auth`;

const createEcho = (token: string): EchoInstance => {
  (window as Window & typeof globalThis & { Pusher?: typeof Pusher }).Pusher = Pusher;

  return new Echo({
    broadcaster: "reverb",
    key: reverbAppKey,
    wsHost: reverbHost,
    wsPort: reverbPort,
    wssPort: reverbPort,
    forceTLS,
    enabledTransports: ["ws", "wss"],
    authEndpoint,
    auth: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
  });
};

export const getEchoClient = (token: string | null | undefined): EchoInstance | null => {
  if (!token) {
    return null;
  }

  if (echoInstance && activeToken === token) {
    return echoInstance;
  }

  if (echoInstance) {
    echoInstance.disconnect();
  }

  echoInstance = createEcho(token);
  activeToken = token;

  return echoInstance;
};

export const disconnectEchoClient = (): void => {
  if (echoInstance) {
    echoInstance.disconnect();
  }

  echoInstance = null;
  activeToken = null;
};