import { useEffect, useRef, useState, useCallback, forwardRef, useImperativeHandle } from 'react';
import { AlertTriangle, ExternalLink } from 'lucide-react';

/**
 * Thin wrapper around the YouTube IFrame API.
 * Loads the API script once, exposes imperative controls (play/pause/seek/getTime)
 * so Watch Together can synchronise playback, and reports state changes upward.
 */
let apiPromise = null;

function loadYouTubeAPI() {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'));
  if (window.YT && window.YT.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;

  apiPromise = new Promise((resolve, reject) => {
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      resolve(window.YT);
    };
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    script.async = true;
    script.onerror = () => reject(new Error('YouTube player could not be loaded (offline?)'));
    document.head.appendChild(script);
    setTimeout(() => {
      if (!window.YT?.Player) reject(new Error('YouTube player timed out'));
    }, 12000);
  });
  return apiPromise;
}

const YouTubePlayer = forwardRef(function YouTubePlayer(
  {
    videoId,
    startAt = 0,
    onReady,
    onStateChange,
    onProgress,
    progressInterval = 5000,
    controls = true,
    className = '',
    autoplay = false,
  },
  ref
) {
  const hostRef = useRef(null);
  const playerRef = useRef(null);
  const timerRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      play: () => playerRef.current?.playVideo?.(),
      pause: () => playerRef.current?.pauseVideo?.(),
      seekTo: (s, allowSeekAhead = true) => playerRef.current?.seekTo?.(s, allowSeekAhead),
      getCurrentTime: () => playerRef.current?.getCurrentTime?.() ?? 0,
      getDuration: () => playerRef.current?.getDuration?.() ?? 0,
      getState: () => playerRef.current?.getPlayerState?.() ?? -1,
      isReady: () => ready,
    }),
    [ready]
  );

  const startProgressTimer = useCallback(() => {
    clearInterval(timerRef.current);
    if (!onProgress) return;
    timerRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime) return;
      const current = p.getCurrentTime();
      const duration = p.getDuration?.() || 0;
      onProgress({ current, duration, percent: duration ? (current / duration) * 100 : 0 });
    }, progressInterval);
  }, [onProgress, progressInterval]);

  useEffect(() => {
    let cancelled = false;
    let player;

    loadYouTubeAPI()
      .then((YT) => {
        if (cancelled || !hostRef.current) return;
        player = new YT.Player(hostRef.current, {
          videoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            controls: controls ? 1 : 0,
            start: Math.floor(startAt) || 0,
            autoplay: autoplay ? 1 : 0,
            origin: window.location.origin,
          },
          events: {
            onReady: (e) => {
              if (cancelled) return;
              playerRef.current = e.target;
              setReady(true);
              startProgressTimer();
              onReady?.(e.target);
            },
            onStateChange: (e) => {
              if (cancelled) return;
              onStateChange?.(e.data, e.target);
            },
            onError: () => {
              if (!cancelled) setError('This video cannot be embedded. Open it on YouTube instead.');
            },
          },
        });
      })
      .catch((e) => {
        if (!cancelled) setError(e.message);
      });

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
      try {
        player?.destroy?.();
      } catch {
        /* ignore */
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoId]);

  if (error) {
    return (
      <div className={`relative w-full aspect-video rounded-xl border border-amber-400/25 bg-amber-400/[0.06] flex flex-col items-center justify-center gap-3 p-6 text-center ${className}`}>
        <AlertTriangle size={26} className="text-amber-400" />
        <p className="text-sm text-amber-100/85 max-w-sm leading-relaxed">{error}</p>
        <a
          href={`https://www.youtube.com/watch?v=${videoId}`}
          target="_blank"
          rel="noreferrer noopener"
          className="btn-secondary btn-sm"
        >
          <ExternalLink size={13} /> Watch on YouTube
        </a>
      </div>
    );
  }

  return (
    <div className={`relative w-full aspect-video rounded-xl overflow-hidden bg-black border border-white/[0.08] ${className}`}>
      <div ref={hostRef} className="absolute inset-0 w-full h-full" />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-space-950/80 pointer-events-none">
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-9 h-9 rounded-full border-2 border-orbit-violet/25 border-t-orbit-violet animate-spin" />
            <p className="text-xs text-slate-400">Loading player…</p>
          </div>
        </div>
      )}
    </div>
  );
});

export default YouTubePlayer;

/** YouTube player states (window.YT.PlayerState mirror, safe before API load). */
export const YT_STATE = {
  UNSTARTED: -1,
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2,
  BUFFERING: 3,
  CUED: 5,
};
