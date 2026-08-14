'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Hls from 'hls.js'

type Props = {
  topicId: string
  src: string
  /**
   * Whether `src` resolves to an HLS manifest. Passed explicitly because `src`
   * is now a ticketed API path with no extension to sniff — the server knows
   * the real format, the client cannot.
   */
  hls?: boolean
  poster?: string | null
  startAt: number
  /** Fraction of the video that counts as "watched". */
  completeAt?: number
}

export function VideoPlayer({ topicId, src, hls: isHls = false, poster, startAt, completeAt = 0.92 }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  // Keep the latest position in a ref so the flush-on-unload handler doesn't
  // need to re-register on every timeupdate.
  const position = useRef(startAt)
  const completed = useRef(false)

  const save = useCallback(
    (body: { positionSec: number; completed?: boolean }, beacon = false) => {
      const payload = JSON.stringify({ topicId, ...body })
      if (beacon && typeof navigator.sendBeacon === 'function') {
        navigator.sendBeacon('/api/progress', new Blob([payload], { type: 'application/json' }))
        return
      }
      void fetch('/api/progress', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        keepalive: true,
      })
        .then((r) => setSaved(r.ok))
        .catch(() => setSaved(false))
    },
    [topicId],
  )

  // --- source wiring: native HLS on Safari, hls.js everywhere else ---------
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    let engine: Hls | undefined

    if (isHls && !video.canPlayType('application/vnd.apple.mpegurl') && Hls.isSupported()) {
      engine = new Hls({ enableWorker: true, lowLatencyMode: false })
      engine.loadSource(src)
      engine.attachMedia(video)
      engine.on(Hls.Events.ERROR, (_e, data) => {
        if (data.fatal) setError('This lesson could not be loaded. Please try again.')
      })
    } else {
      video.src = src
    }

    return () => engine?.destroy()
  }, [src, isHls])

  // --- resume ---------------------------------------------------------------
  useEffect(() => {
    const video = videoRef.current
    if (!video || startAt <= 0) return
    const onLoaded = () => {
      // Guard against a stale position past the end of a re-encoded video.
      if (startAt < video.duration - 5) video.currentTime = startAt
    }
    video.addEventListener('loadedmetadata', onLoaded, { once: true })
    return () => video.removeEventListener('loadedmetadata', onLoaded)
  }, [startAt])

  // --- periodic save + flush on leave --------------------------------------
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    const onTime = () => {
      position.current = video.currentTime
      if (!completed.current && video.duration && video.currentTime / video.duration >= completeAt) {
        completed.current = true
        save({ positionSec: Math.floor(video.currentTime), completed: true })
      }
    }
    const onEnded = () => {
      completed.current = true
      save({ positionSec: Math.floor(video.duration || position.current), completed: true })
    }

    video.addEventListener('timeupdate', onTime)
    video.addEventListener('ended', onEnded)

    // Checkpoint every 15s of wall time while the tab is open.
    const id = setInterval(() => {
      if (!video.paused && position.current > 0) save({ positionSec: Math.floor(position.current) })
    }, 15_000)

    const flush = () => {
      if (position.current > 0) save({ positionSec: Math.floor(position.current) }, true)
    }
    window.addEventListener('pagehide', flush)

    return () => {
      video.removeEventListener('timeupdate', onTime)
      video.removeEventListener('ended', onEnded)
      window.removeEventListener('pagehide', flush)
      clearInterval(id)
      flush()
    }
  }, [save, completeAt])

  return (
    <div className="space-y-2">
      <div className="overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          poster={poster ?? undefined}
          controls
          playsInline
          preload="metadata"
          className="aspect-video w-full"
        />
      </div>

      {error && (
        <p role="alert" className="rounded-xl bg-ember/10 px-3 py-2 text-sm font-semibold text-ember">
          {error}
        </p>
      )}
      {saved && !error && (
        <p className="text-xs font-semibold text-navy/40">Progress saved automatically</p>
      )}
    </div>
  )
}
