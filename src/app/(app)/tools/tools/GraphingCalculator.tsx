'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import clsx from 'clsx'
import { compile, ExpressionError, type Compiled } from '@/lib/expression'
import { ShellCard, ShellPanel, ToolShell, type ShellTab } from '../ToolShell'

const IconChart = (
  <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 4v16h16" />
    <path d="M7 15c2.5 0 3-8 5.5-8S16 13 19 13" />
  </svg>
)

const tabIcon = (path: string) => (
  <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    <path d={path} />
  </svg>
)

const TABS: ShellTab[] = [
  { id: 'functions', label: 'Functions', icon: tabIcon('M4 19c4 0 4-14 8-14s4 14 8 14') },
  { id: 'help', label: 'Help', icon: tabIcon('M12 17h.01M9.1 9a3 3 0 1 1 4 2.8c-.7.3-1.1 1-1.1 1.7M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
  { id: 'about', label: 'About', icon: tabIcon('M12 8h.01M11 12h1v4h1M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z') },
]

type Plot = { id: number; source: string; colour: string; visible: boolean }

const PALETTE = ['#e8590c', '#1c7ed6', '#2f9e44', '#9c36b5', '#c2255c', '#0c8599']

type View = { xMin: number; xMax: number; yMin: number; yMax: number }
const DEFAULT_VIEW: View = { xMin: -10, xMax: 10, yMin: -6, yMax: 6 }

/** Gridline spacing that lands on 1, 2 or 5 × 10^n so labels stay readable. */
function niceStep(span: number, targetLines: number): number {
  const rough = span / targetLines
  const magnitude = 10 ** Math.floor(Math.log10(rough))
  const normalised = rough / magnitude
  const step = normalised >= 5 ? 5 : normalised >= 2 ? 2 : 1
  return step * magnitude
}

function formatTick(value: number, step: number): string {
  if (Math.abs(value) < step / 1000) return '0'
  const decimals = Math.max(0, -Math.floor(Math.log10(step)))
  if (Math.abs(value) >= 1e5 || (Math.abs(value) < 1e-4 && value !== 0)) {
    return value.toExponential(1)
  }
  return value.toFixed(Math.min(decimals, 6))
}

export function GraphingCalculator({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState('functions')
  const [showGrid, setShowGrid] = useState(true)
  const [plots, setPlots] = useState<Plot[]>([
    { id: 1, source: 'sin(x)', colour: PALETTE[0]!, visible: true },
  ])
  const [view, setView] = useState<View>(DEFAULT_VIEW)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const wrapRef = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ width: 640, height: 420 })

  // Compile once per edit, not once per pixel — the draw loop below evaluates
  // each function several hundred times per frame.
  const compiled = useMemo(
    () =>
      plots.map((plot) => {
        if (!plot.source.trim()) return { plot, fn: null, error: null }
        try {
          const fn = compile(plot.source)
          const unknown = fn.variables.filter((v) => v !== 'x')
          if (unknown.length > 0) {
            return { plot, fn: null, error: `Only x is allowed as a variable (found ${unknown[0]})` }
          }
          return { plot, fn, error: null }
        } catch (err) {
          return {
            plot,
            fn: null,
            error: err instanceof ExpressionError ? err.message : 'Could not read that',
          }
        }
      }),
    [plots],
  )

  useEffect(() => {
    const wrap = wrapRef.current
    if (!wrap) return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      const width = Math.max(280, Math.floor(entry.contentRect.width))
      setSize({ width, height: Math.round(Math.min(520, Math.max(300, width * 0.62))) })
    })
    observer.observe(wrap)
    return () => observer.disconnect()
  }, [])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return

    const { width, height } = size
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

    const { xMin, xMax, yMin, yMax } = view
    const toPixelX = (x: number) => ((x - xMin) / (xMax - xMin)) * width
    const toPixelY = (y: number) => height - ((y - yMin) / (yMax - yMin)) * height

    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)

    // --- grid -------------------------------------------------------------
    const xStep = niceStep(xMax - xMin, Math.max(4, Math.round(width / 90)))
    const yStep = niceStep(yMax - yMin, Math.max(4, Math.round(height / 70)))

    if (showGrid) {
      ctx.lineWidth = 1
      ctx.strokeStyle = 'rgba(23,43,77,0.08)'
      ctx.beginPath()
      for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
        const px = Math.round(toPixelX(x)) + 0.5
        ctx.moveTo(px, 0)
        ctx.lineTo(px, height)
      }
      for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
        const py = Math.round(toPixelY(y)) + 0.5
        ctx.moveTo(0, py)
        ctx.lineTo(width, py)
      }
      ctx.stroke()
    }

    // --- axes -------------------------------------------------------------
    ctx.strokeStyle = 'rgba(23,43,77,0.45)'
    ctx.lineWidth = 1.5
    ctx.beginPath()
    if (yMin < 0 && yMax > 0) {
      const py = Math.round(toPixelY(0)) + 0.5
      ctx.moveTo(0, py)
      ctx.lineTo(width, py)
    }
    if (xMin < 0 && xMax > 0) {
      const px = Math.round(toPixelX(0)) + 0.5
      ctx.moveTo(px, 0)
      ctx.lineTo(px, height)
    }
    ctx.stroke()

    // --- tick labels ------------------------------------------------------
    ctx.fillStyle = 'rgba(23,43,77,0.55)'
    ctx.font = '600 11px ui-sans-serif, system-ui, sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'
    const axisY = Math.min(height - 14, Math.max(2, toPixelY(0) + 3))
    for (let x = Math.ceil(xMin / xStep) * xStep; x <= xMax; x += xStep) {
      if (Math.abs(x) < xStep / 1000) continue
      const text = formatTick(x, xStep)
      // Nudge the end labels inward. Centred on their tick they would hang off
      // the canvas and render as "-1" where "-10" was meant.
      const half = ctx.measureText(text).width / 2
      ctx.fillText(text, Math.min(width - half - 2, Math.max(half + 2, toPixelX(x))), axisY)
    }
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    const axisX = Math.min(width - 4, Math.max(24, toPixelX(0) - 5))
    for (let y = Math.ceil(yMin / yStep) * yStep; y <= yMax; y += yStep) {
      if (Math.abs(y) < yStep / 1000) continue
      ctx.fillText(formatTick(y, yStep), axisX, Math.min(height - 7, Math.max(7, toPixelY(y))))
    }

    // --- curves -----------------------------------------------------------
    // One sample per pixel column. A curve is broken wherever the value stops
    // being finite (1/x at zero) or leaps most of the viewport in one pixel
    // (tan at its asymptotes) — otherwise the canvas would draw a vertical line
    // through the discontinuity and imply a value that is not there.
    const breakThreshold = (yMax - yMin) * 4

    for (const { plot, fn } of compiled) {
      if (!fn || !plot.visible) continue
      ctx.strokeStyle = plot.colour
      ctx.lineWidth = 2
      ctx.lineJoin = 'round'
      ctx.beginPath()

      let pen = false
      let previous = Number.NaN
      for (let px = 0; px <= width; px++) {
        const x = xMin + (px / width) * (xMax - xMin)
        let y: number
        try {
          y = (fn as Compiled).evaluate({ vars: { x } })
        } catch {
          y = Number.NaN
        }

        if (!Number.isFinite(y) || Math.abs(y - previous) > breakThreshold) {
          pen = false
          previous = y
          continue
        }
        const py = toPixelY(y)
        // Keep well clear of the canvas edge; huge values still steer the path.
        const clamped = Math.max(-1e5, Math.min(1e5, py))
        if (pen) ctx.lineTo(px, clamped)
        else {
          ctx.moveTo(px, clamped)
          pen = true
        }
        previous = y
      }
      ctx.stroke()
    }
  }, [compiled, size, view, showGrid])

  useEffect(() => {
    draw()
  }, [draw])

  // --- pan and zoom -------------------------------------------------------
  const drag = useRef<{ x: number; y: number; view: View } | null>(null)

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    drag.current = { x: e.clientX, y: e.clientY, view }
  }

  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const start = drag.current
    if (!start) return
    const dx = ((e.clientX - start.x) / size.width) * (start.view.xMax - start.view.xMin)
    const dy = ((e.clientY - start.y) / size.height) * (start.view.yMax - start.view.yMin)
    setView({
      xMin: start.view.xMin - dx,
      xMax: start.view.xMax - dx,
      yMin: start.view.yMin + dy,
      yMax: start.view.yMax + dy,
    })
  }

  function endDrag(e: React.PointerEvent<HTMLCanvasElement>) {
    drag.current = null
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId)
    }
  }

  const zoomBy = useCallback((factor: number, originX = 0.5, originY = 0.5) => {
    setView((v) => {
      const cx = v.xMin + (v.xMax - v.xMin) * originX
      const cy = v.yMax - (v.yMax - v.yMin) * originY
      return {
        xMin: cx - (cx - v.xMin) * factor,
        xMax: cx + (v.xMax - cx) * factor,
        yMin: cy - (cy - v.yMin) * factor,
        yMax: cy + (v.yMax - cy) * factor,
      }
    })
  }, [])

  // Wheel zoom is registered natively so it can be non-passive: React's onWheel
  // is passive, and a passive listener may not call preventDefault, which would
  // let the page scroll while zooming.
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      zoomBy(
        e.deltaY > 0 ? 1.12 : 0.89,
        (e.clientX - rect.left) / rect.width,
        (e.clientY - rect.top) / rect.height,
      )
    }
    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  }, [zoomBy])

  function update(id: number, patch: Partial<Plot>) {
    setPlots((list) => list.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }

  /** Saves exactly what is on screen — the canvas already has the axes drawn. */
  function downloadPng() {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.toBlob((blob) => {
      if (!blob) return
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'graph.png'
      link.click()
      // Revoking immediately can cancel the download in some browsers.
      window.setTimeout(() => URL.revokeObjectURL(url), 10_000)
    }, 'image/png')
  }

  const field =
    'w-full min-w-0 rounded-lg px-2 py-2 font-mono text-sm font-semibold outline-none transition focus:border-amber'
  const fieldStyle = {
    background: 'var(--shell-raise)',
    border: '1px solid var(--shell-line)',
    color: 'var(--shell-text)',
  }

  const sidebar = (
    <>
      {tab === 'functions' && (
        <>
          {compiled.map(({ plot, error }, i) => (
            <ShellCard key={plot.id}>
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm font-extrabold">f{i + 1}(x) =</span>
                <span className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => update(plot.id, { visible: !plot.visible })}
                    aria-pressed={plot.visible}
                    aria-label={`${plot.visible ? 'Hide' : 'Show'} f${i + 1}`}
                    className={clsx('rounded-md p-1 transition', !plot.visible && 'opacity-35')}
                  >
                    <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
                      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                  {plots.length > 1 && (
                    <button
                      type="button"
                      onClick={() => setPlots((list) => list.filter((p) => p.id !== plot.id))}
                      aria-label="Remove this function"
                      className="rounded-md p-1 text-ember transition hover:brightness-110"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                        <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
                      </svg>
                    </button>
                  )}
                </span>
              </div>
              <input
                value={plot.source}
                onChange={(e) => update(plot.id, { source: e.target.value })}
                spellCheck={false}
                autoComplete="off"
                placeholder="x^2"
                aria-label="Function of x"
                className={field}
                style={fieldStyle}
              />
              <input
                type="color"
                value={plot.colour}
                onChange={(e) => update(plot.id, { colour: e.target.value })}
                aria-label={`Colour for f${i + 1}`}
                className="mt-2 h-8 w-16 cursor-pointer rounded-md border-0 bg-transparent p-0"
              />
              {error && <p className="mt-2 text-xs font-bold text-ember">{error}</p>}
            </ShellCard>
          ))}

          <div className="mb-3 flex gap-2">
            <button
              type="button"
              onClick={() =>
                setPlots((list) => [
                  ...list,
                  {
                    id: Math.max(0, ...list.map((p) => p.id)) + 1,
                    source: '',
                    colour: PALETTE[list.length % PALETTE.length]!,
                    visible: true,
                  },
                ])
              }
              className="min-h-11 flex-1 rounded-xl bg-navy text-sm font-extrabold text-white transition hover:brightness-110"
            >
              + Add
            </button>
            <button
              type="button"
              onClick={() => setPlots([{ id: 1, source: '', colour: PALETTE[0]!, visible: true }])}
              aria-label="Remove all functions"
              className="grid min-h-11 w-12 place-items-center rounded-xl bg-ember text-white transition hover:brightness-110"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
              </svg>
            </button>
          </div>

          <ShellCard title="Examples">
            <div className="grid grid-cols-3 gap-1.5">
              {['x^2', 'x^3', 'sin(x)', 'cos(x)', 'tan(x)', 'e^x', 'ln(x)', '1/x', '√x'].map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() =>
                    setPlots((list) => {
                      const next = [...list]
                      const last = next.length - 1
                      next[last] = { ...next[last]!, source: ex }
                      return next
                    })
                  }
                  className="min-h-9 rounded-lg font-mono text-xs font-bold transition hover:brightness-95"
                  style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-raise)' }}
                >
                  {ex}
                </button>
              ))}
            </div>
          </ShellCard>
        </>
      )}

      {tab === 'help' && (
        <ShellCard title="How to use">
          <ul className="space-y-2 text-sm font-semibold leading-relaxed">
            <li>Drag the graph to pan; scroll to zoom.</li>
            <li>Angles are in radians.</li>
            <li>
              Operators: <code className="font-mono">+ − * / ^ !</code> and <code className="font-mono">√</code>.
            </li>
            <li>Functions: sin, cos, tan, ln, log, sqrt, abs, exp, min, max.</li>
          </ul>
        </ShellCard>
      )}

      {tab === 'about' && (
        <ShellCard title="About">
          <p className="text-sm font-semibold leading-relaxed">
            Each function is compiled once and then sampled per pixel column. Curves break at
            discontinuities rather than drawing a false vertical line through them — try{' '}
            <code className="font-mono">tan(x)</code> or <code className="font-mono">1/x</code>.
          </p>
        </ShellCard>
      )}
    </>
  )

  const toolbarButton = 'flex min-h-10 items-center gap-2 rounded-xl px-3 text-sm font-extrabold transition'

  return (
    <ToolShell
      title="Graphing Calculator"
      subtitle="Plot and explore functions"
      icon={IconChart}
      version="Graphing Calculator v1.0"
      tabs={TABS}
      activeTab={tab}
      onTabChange={setTab}
      sidebar={sidebar}
      onClose={onClose}
    >
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setShowGrid((g) => !g)}
          aria-pressed={showGrid}
          className={toolbarButton}
          style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-panel)' }}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8}>
            <rect x="3" y="3" width="18" height="18" rx="2" />
            <path d="M3 9h18M3 15h18M9 3v18M15 3v18" />
          </svg>
          Grid
        </button>
        <button
          type="button"
          onClick={() => setView(DEFAULT_VIEW)}
          className={toolbarButton}
          style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-panel)' }}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
            <path d="M3 12a9 9 0 1 0 3-6.7M3 4v4h4" />
          </svg>
          Reset
        </button>

        <button
          type="button"
          onClick={downloadPng}
          className={`${toolbarButton} bg-navy text-white`}
          style={{ border: '1px solid transparent' }}
        >
          <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
          </svg>
          Download
        </button>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => zoomBy(1.25)}
            aria-label="Zoom out"
            className="grid size-10 place-items-center rounded-xl transition"
            style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-panel)' }}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5M8 11h6" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => zoomBy(0.8)}
            aria-label="Zoom in"
            className="grid size-10 place-items-center rounded-xl transition"
            style={{ border: '1px solid var(--shell-line)', background: 'var(--shell-panel)' }}
          >
            <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round">
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5M8 11h6M11 8v6" />
            </svg>
          </button>
        </div>
      </div>

      <ShellPanel className="!p-3">
        {/* Legend, so several curves stay tellable apart. */}
        <div className="mb-2 flex flex-wrap items-center justify-center gap-3">
          {compiled
            .filter(({ plot, fn }) => fn && plot.visible)
            .map(({ plot }, i) => (
              <span key={plot.id} className="flex items-center gap-1.5 text-xs font-bold">
                <span className="h-3 w-6 rounded" style={{ background: plot.colour }} />
                f{i + 1}: <code className="font-mono">{plot.source}</code>
              </span>
            ))}
        </div>

        <div ref={wrapRef} className="min-w-0 overflow-hidden rounded-xl" style={{ border: '1px solid var(--shell-line)' }}>
          <canvas
            ref={canvasRef}
            style={{ width: size.width, height: size.height, touchAction: 'none' }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            className="block cursor-grab active:cursor-grabbing"
          />
        </div>

        <p className="mt-2 text-center font-mono text-[11px] font-semibold" style={{ color: 'var(--shell-muted)' }}>
          x [{view.xMin.toFixed(2)}, {view.xMax.toFixed(2)}] · y [{view.yMin.toFixed(2)},{' '}
          {view.yMax.toFixed(2)}]
        </p>
      </ShellPanel>
    </ToolShell>
  )
}
