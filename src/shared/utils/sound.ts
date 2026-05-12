const createAudioContext = (): AudioContext | null => {
  const AudioContextCtor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

  if (!AudioContextCtor) {
    return null;
  }

  return new AudioContextCtor();
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
    const context = createAudioContext();
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
