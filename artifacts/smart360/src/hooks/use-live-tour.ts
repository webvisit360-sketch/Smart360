import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  finishTour, loadTour, pauseTour, recordTourPoint, recoverTour, resumeTour,
  saveTour, startTour, tourMetrics, MAX_ACCURACY_M, type TourActivity, type TourState,
} from '../lib/live-tour';
import type { TourProfile } from '../lib/tour-calories';

export type WakeStatus = 'idle' | 'requesting' | 'held' | 'unavailable';
type WakeSentinel = { released: boolean; release(): Promise<void>; addEventListener(type: 'release', listener: () => void): void };
type WakeEnvironment = {
  visible(): boolean;
  request(): Promise<WakeSentinel>;
  onVisibility(listener: () => void): () => void;
};

/** Browser wake locks may be revoked at any time. The indicator reflects the sentinel, not request success alone. */
export class TourWakeController {
  status: WakeStatus = 'idle';
  private active = false;
  private generation = 0;
  private sentinel: WakeSentinel | null = null;
  private retryUsed = false;
  private unsubscribe: () => void;
  constructor(private env: WakeEnvironment, private notify: (status: WakeStatus) => void) {
    this.unsubscribe = env.onVisibility(() => this.visibilityChanged());
  }
  private setStatus(status: WakeStatus) { this.status = status; this.notify(status); }
  activate() {
    if (this.active) return;
    this.active = true;
    this.retryUsed = false;
    this.acquire();
  }
  private async acquire() {
    if (!this.active || !this.env.visible() || this.sentinel || this.status === 'requesting') return;
    const token = ++this.generation;
    this.setStatus('requesting');
    try {
      const sentinel = await this.env.request();
      if (token !== this.generation || !this.active || !this.env.visible() || sentinel.released) {
        if (!sentinel.released) void sentinel.release().catch(() => {});
        if (token === this.generation && this.active) this.setStatus('unavailable');
        return;
      }
      this.sentinel = sentinel;
      sentinel.addEventListener('release', () => {
        if (this.sentinel !== sentinel) return;
        this.sentinel = null;
        if (!this.active) return;
        if (this.env.visible() && !this.retryUsed) {
          this.retryUsed = true;
          this.setStatus('idle');
          this.acquire();
        } else this.setStatus(this.env.visible() ? 'unavailable' : 'idle');
      });
      this.setStatus('held');
    } catch {
      if (token === this.generation && this.active) this.setStatus('unavailable');
    }
  }
  private visibilityChanged() {
    if (!this.active) return;
    if (!this.env.visible()) {
      ++this.generation;
      const sentinel = this.sentinel;
      this.sentinel = null;
      this.setStatus('idle');
      if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
    } else {
      this.retryUsed = false;
      if (this.status === 'requesting') this.setStatus('idle');
      this.acquire();
    }
  }
  deactivate() {
    this.active = false;
    ++this.generation;
    const sentinel = this.sentinel;
    this.sentinel = null;
    this.setStatus('idle');
    if (sentinel && !sentinel.released) void sentinel.release().catch(() => {});
  }
  dispose() { this.deactivate(); this.unsubscribe(); }
}

function browserWakeEnvironment(): WakeEnvironment {
  return {
    visible: () => document.visibilityState === 'visible',
    request: async () => {
      if (!('wakeLock' in navigator) || !navigator.wakeLock?.request) throw new Error('Screen Wake Lock unavailable');
      return navigator.wakeLock.request('screen');
    },
    onVisibility: listener => {
      document.addEventListener('visibilitychange', listener);
      return () => document.removeEventListener('visibilitychange', listener);
    },
  };
}

export function useLiveTour(key: string) {
  const [state, setState] = useState<TourState | null>(() => {
    const saved = loadTour(key);
    const recovered = saved && recoverTour(saved, Date.now());
    if (recovered && recovered !== saved) saveTour(key, recovered);
    return recovered;
  });
  const stateRef = useRef(state);
  const keyRef = useRef(key);
  const [clock, setClock] = useState(() => Date.now());
  const [geoError, setGeoError] = useState<string | null>(null);
  const [currentPosition, setCurrentPosition] = useState<{ lat: number; lon: number; heading: number | null; speed: number | null } | null>(null);
  const [wakeStatus, setWakeStatus] = useState<WakeStatus>('idle');
  const [platform] = useState<'ios' | 'android' | 'other'>(() => {
    if (typeof navigator === 'undefined') return 'other';
    const ua = navigator.userAgent;
    return /iPhone|iPad|iPod/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)
      ? 'ios' : /Android/i.test(ua) ? 'android' : 'other';
  });
  const wakeRef = useRef<TourWakeController | null>(null);
  const watchRef = useRef<number | null>(null);
  const watchGeneration = useRef(0);
  const commit = useCallback((next: TourState | null) => {
    stateRef.current = next;
    setState(next);
    if (!next || next.status === 'finished') setCurrentPosition(null);
    saveTour(keyRef.current, next);
    setClock(Date.now());
  }, []);

  // Key changes isolate tours. Do not accidentally persist an old tour under a new entry.
  useEffect(() => {
    if (keyRef.current === key) return;
    keyRef.current = key;
    const saved = loadTour(key);
    const loaded = saved && recoverTour(saved, Date.now());
    if (loaded && loaded !== saved) saveTour(key, loaded);
    stateRef.current = loaded;
    setState(loaded);
    setCurrentPosition(null);
    setGeoError(null);
  }, [key]);

  useEffect(() => {
    const controller = new TourWakeController(browserWakeEnvironment(), setWakeStatus);
    wakeRef.current = controller;
    return () => { controller.dispose(); wakeRef.current = null; };
  }, []);

  const active = state !== null && state.status !== 'finished';
  useEffect(() => {
    if (!active) { wakeRef.current?.deactivate(); setCurrentPosition(null); return; }
    wakeRef.current?.activate();
    if (!navigator.geolocation) {
      setGeoError('geo-unavailable');
      return () => {};
    }
    const generation = ++watchGeneration.current;
    // Native watchPosition delivers updates according to hardware/provider; no polling.
    try {
      watchRef.current = navigator.geolocation.watchPosition(
        position => {
          if (generation !== watchGeneration.current) return;
          setGeoError(null);
          const current = stateRef.current;
          if (!current || current.status === 'finished') return;
            const { latitude: lat, longitude: lon, accuracy, altitude, altitudeAccuracy, heading, speed } = position.coords;
           if (Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 &&
               Number.isFinite(accuracy) && accuracy >= 0 && accuracy <= MAX_ACCURACY_M) {
             // Current accurate fix is independent of downsampled recording and
             // remains live through manual pause; inaccurate jitter leaves it still.
              setCurrentPosition({
                lat, lon,
                heading: typeof heading === 'number' && Number.isFinite(heading) && heading >= 0 && heading <= 360 ? heading % 360 : null,
                speed: typeof speed === 'number' && Number.isFinite(speed) && speed >= 0 ? speed : null,
              });
           }
           const next = recordTourPoint(current, { lat, lon, accuracy, altitude, altitudeAccuracy, timestamp: position.timestamp });
          if (next !== current) commit(next);
        },
        error => {
           if (generation === watchGeneration.current) {
             setCurrentPosition(null);
             setGeoError(error.code === 1 ? 'geo-denied' : error.code === 3 ? 'geo-timeout' : 'geo-unavailable');
           }
        },
        { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 },
      );
    } catch {
      setGeoError('geo-unavailable');
    }
    return () => {
      ++watchGeneration.current;
      if (watchRef.current !== null) navigator.geolocation.clearWatch(watchRef.current);
      watchRef.current = null;
    };
  }, [active, key, commit]);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1_000);
    return () => window.clearInterval(timer);
  }, [active]);

   const start = useCallback((activity: TourActivity = 'hiking', profile: TourProfile = {}) => {
    if (stateRef.current && stateRef.current.status !== 'finished') return;
    setGeoError(null);
      commit(startTour(Date.now(), activity, profile));
  }, [commit]);
  const pause = useCallback(() => {
    if (stateRef.current) commit(pauseTour(stateRef.current, Date.now()));
  }, [commit]);
  const resume = useCallback(() => {
    if (stateRef.current) commit(resumeTour(stateRef.current, Date.now()));
  }, [commit]);
  const finish = useCallback(() => {
    if (stateRef.current) commit(finishTour(stateRef.current, Date.now()));
  }, [commit]);
  const reset = useCallback(() => { setGeoError(null); commit(null); }, [commit]);
  const metrics = useMemo(() => tourMetrics(state, clock), [state, clock]);
  return { state, currentPosition: active ? currentPosition : null, metrics, start, pause, resume, finish, reset, geoError, wakeStatus, platform };
}