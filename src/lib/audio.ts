// Audio utility for notification sounds
let audioCtx: AudioContext | null = null;
let unlocked = false;

export function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const Ctx = (window.AudioContext || (window as any).webkitAudioContext);
    audioCtx = new Ctx();
  }
  return audioCtx!;
}

export function unlockAudio() {
  const ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {});
  }
  unlocked = true;
  localStorage.setItem('zeger-sound-enabled', 'true');
}

export function ensureUnlockListeners() {
  if (localStorage.getItem('zeger-sound-enabled') === 'true' || unlocked) return;
  const tryUnlock = () => {
    unlockAudio();
    document.removeEventListener('click', tryUnlock, true);
    document.removeEventListener('touchstart', tryUnlock, true);
  };
  document.addEventListener('click', tryUnlock, true);
  document.addEventListener('touchstart', tryUnlock, true);
}

type BeepOpts = { 
  times?: number; 
  freq?: number; 
  durationMs?: number; 
  volume?: number; 
  intervalMs?: number; 
}

export function playAlertBeep(opts: BeepOpts = {}) {
  ensureUnlockListeners();
  const { times = 5, freq = 1200, durationMs = 600, volume = 0.9, intervalMs = 800 } = opts;
  const ctx = getAudioContext();
  
  for (let i = 0; i < times; i++) {
    setTimeout(() => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); 
      gain.connect(ctx.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      gain.gain.value = volume;
      const now = ctx.currentTime;
      osc.start(now);
      osc.stop(now + durationMs / 1000);
    }, i * intervalMs);
  }
  
  if ('vibrate' in navigator) {
    navigator.vibrate([800, 200, 800, 200, 800, 200, 800]);
  }
}
