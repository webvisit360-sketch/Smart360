let audioContext: AudioContext | null = null;

export function livingGuideClick(): void {
  try {
    const AudioContextConstructor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!AudioContextConstructor) return;

    audioContext ||= new AudioContextConstructor();
    if (audioContext.state === "suspended") void audioContext.resume();

    const time = audioContext.currentTime;
    const noiseBuffer = audioContext.createBuffer(
      1,
      audioContext.sampleRate * 0.05,
      audioContext.sampleRate,
    );
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i += 1) {
      noiseData[i] = Math.random() * 2 - 1;
    }

    const noise = audioContext.createBufferSource();
    noise.buffer = noiseBuffer;
    const bandpass = audioContext.createBiquadFilter();
    bandpass.type = "bandpass";
    bandpass.frequency.value = 2600;
    bandpass.Q.value = 1.1;
    const noiseGain = audioContext.createGain();
    noiseGain.gain.setValueAtTime(0.17, time);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, time + 0.045);
    noise.connect(bandpass).connect(noiseGain).connect(audioContext.destination);
    noise.start(time);

    const chirp = audioContext.createOscillator();
    chirp.type = "square";
    chirp.frequency.setValueAtTime(1750, time);
    chirp.frequency.exponentialRampToValueAtTime(760, time + 0.03);
    const chirpGain = audioContext.createGain();
    chirpGain.gain.setValueAtTime(0.055, time);
    chirpGain.gain.exponentialRampToValueAtTime(0.001, time + 0.035);
    chirp.connect(chirpGain).connect(audioContext.destination);
    chirp.start(time);
    chirp.stop(time + 0.05);

    if (navigator.vibrate) navigator.vibrate(6);
  } catch {
    // Sound and haptics must never block navigation.
  }
}

const PRESSABLE = "button,a[href],[role='button'],[data-click]";

export function installLivingGuideClick(): () => void {
  const onPointerDown = (event: PointerEvent) => {
    const target = event.target as HTMLElement | null;
    if (target?.closest(PRESSABLE)) livingGuideClick();
  };
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.repeat || (event.key !== "Enter" && event.key !== " ")) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest(PRESSABLE)) livingGuideClick();
  };
  document.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.addEventListener("keydown", onKeyDown);
  return () => {
    document.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("keydown", onKeyDown);
  };
}
