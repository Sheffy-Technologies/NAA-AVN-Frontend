let sharedContext: AudioContext | null = null;
let unlockListenersAttached = false;

const getAudioContext = (): AudioContext | null => {
  if (sharedContext) {
    return sharedContext;
  }

  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  sharedContext = new AudioContextCtor();
  attachUnlockListeners(sharedContext);
  return sharedContext;
};

const attachUnlockListeners = (context: AudioContext): void => {
  if (unlockListenersAttached) {
    return;
  }
  unlockListenersAttached = true;

  const unlock = () => {
    if (context.state === "suspended") {
      void context.resume();
    }
  };

  for (const eventName of ["click", "keydown", "touchstart"]) {
    document.addEventListener(eventName, unlock, { passive: true });
  }
};

const playTone = (
  context: AudioContext,
  frequency: number,
  durationSeconds: number,
  gainValue: number,
): void => {
  const oscillator = context.createOscillator();
  const gainNode = context.createGain();

  oscillator.type = "sine";
  oscillator.frequency.value = frequency;

  oscillator.connect(gainNode);
  gainNode.connect(context.destination);

  const now = context.currentTime;
  gainNode.gain.setValueAtTime(0, now);
  gainNode.gain.linearRampToValueAtTime(gainValue, now + 0.01);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, now + durationSeconds);

  oscillator.start(now);
  oscillator.stop(now + durationSeconds);
};

const playBeepSequence = async (tones: Array<{ frequency: number; duration: number }>, gain = 0.06): Promise<void> => {
  try {
    const context = getAudioContext();
    if (!context) {
      return;
    }

    if (context.state === "suspended") {
      await context.resume();
    }

    for (const tone of tones) {
      playTone(context, tone.frequency, tone.duration, gain);
    }
  } catch {
    // Ignore sound errors so notifications never break app flow.
  }
};

export const playMessageBeep = async (): Promise<void> => {
  await playBeepSequence([
    { frequency: 880, duration: 0.08 },
    { frequency: 1046, duration: 0.1 },
  ]);
};

export const playCallActivatedBeep = async (): Promise<void> => {
  await playBeepSequence([
    { frequency: 660, duration: 0.08 },
    { frequency: 880, duration: 0.08 },
    { frequency: 1200, duration: 0.12 },
  ]);
};

export const playIncomingCallRing = async (): Promise<void> => {
  await playBeepSequence(
    [
      { frequency: 480, duration: 0.35 },
      { frequency: 440, duration: 0.35 },
    ],
    0.09,
  );
};
