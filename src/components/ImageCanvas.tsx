import { useEffect, useRef, useState } from 'react'
import type { ImageItem, MaskBox, Rect } from '../lib/types'
import { renderMasked } from '../lib/maskRenderer'

interface ImageCanvasProps {
  image: ImageItem
  maskColor: string
  showOcrOverlay: boolean
  showMaskPreview: boolean
  registeredNames: string[]
  onMasksChange: (masks: MaskBox[]) => void
  onBeforeEdit: () => void
  onUndo: () => void
  canUndo: boolean
  onDownload: () => void
  downloadLabel: string
  onShare: () => void
  shareLabel: string
  shareSupported: boolean
  exportBusy: boolean
  exportError: string | null
}

const HANDLE_SIZE = 14
// リサイズハンドルの目標サイズ（CSSピクセル）。ヒット判定は±この値なので
// 実質44px四方のグラブ領域になり、スマホの指でも掴める。
const HANDLE_TOUCH_CSS_PX = 22
const MIN_RECT_SIZE = 6
const MIN_STAMP_SIZE = 20
const MAX_STAMP_SIZE = 300
const STAMP_SIZE_STEP = 10
const DEFAULT_STAMP_SIZE = 120
const MIN_CHAR_SIZE = 10
const MAX_CHAR_SIZE = 100
const CHAR_SIZE_STEP = 4
const DEFAULT_CHAR_SIZE = 60

type DragState =
  | { type: 'create'; startX: number; startY: number; current: Rect }
  | { type: 'move'; id: string; grabDx: number; grabDy: number }
  | { type: 'resize'; id: string; corner: 'nw' | 'ne' | 'sw' | 'se' }
  | null

let nextMaskId = 0

function normalizeRect(x0: number, y0: number, x1: number, y1: number): Rect {
  return {
    x: Math.min(x0, x1),
    y: Math.min(y0, y1),
    width: Math.abs(x1 - x0),
    height: Math.abs(y1 - y0),
  }
}

export function ImageCanvas({
  image,
  maskColor,
  showOcrOverlay,
  showMaskPreview,
  registeredNames,
  onMasksChange,
  onBeforeEdit,
  onUndo,
  canUndo,
  onDownload,
  downloadLabel,
  onShare,
  shareLabel,
  shareSupported,
  exportBusy,
  exportError,
}: ImageCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const baseCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [drag, setDrag] = useState<DragState>(null)
  const [zoom, setZoom] = useState(1)
  // 初期状態はスクロール。スマホで画像を眺めている最中に誤ってマスクを置いてしまうのを防ぐ
  const [mode, setMode] = useState<'draw' | 'pan'>('pan')
  const [tool, setTool] = useState<'rect' | 'stamp'>('rect')
  const [stampSize, setStampSize] = useState(DEFAULT_STAMP_SIZE)
  const [charSize, setCharSize] = useState(DEFAULT_CHAR_SIZE)
  const dragRef = useRef<DragState>(null)

  // 四角スタンプ（ドラッグせずタップした場合）の幅を決める文字数。登録名のうち
  // 最も長いものに合わせておけば、表記ゆれのどれが実際に出ていても隠しきれる。
  const registeredNameLength = Math.max(
    0,
    ...registeredNames.map((n) => n.trim()).filter(Boolean).map((n) => n.length),
  )

  useEffect(() => {
    const base = document.createElement('canvas')
    base.width = image.width
    base.height = image.height
    const ctx = base.getContext('2d')
    ctx?.drawImage(image.imageBitmap, 0, 0)
    baseCanvasRef.current = base
    draw()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image])

  // 表示中の画像が切り替わった際に、前の画像のマスクを指したままの選択/ドラッグ状態が
  // 残らないようリセットする（マスク編集によるimage更新では発火しないようimage.idのみを見る）。
  useEffect(() => {
    setSelectedId(null)
    dragRef.current = null
    setDrag(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [image.id])

  useEffect(() => {
    draw()
    // ハンドルサイズが表示スケール依存になったため、zoomの変化でも再描画する
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    image.masks,
    image.ocrWords,
    showOcrOverlay,
    showMaskPreview,
    maskColor,
    selectedId,
    drag,
    zoom,
  ])

  // ウィンドウリサイズ・画面回転などで表示スケールが変わった際にハンドルサイズを追従させる。
  // Observerはマウント時に1度だけ作るため、drawを直接渡すと初回レンダー時点の
  // クロージャ（マスクもOCR結果も空）を掴んだままになり、画像切り替え等でサイズが
  // 変わったときに空の状態で描き直してしまう。常に最新のdrawを呼ぶためrefを経由する。
  const drawRef = useRef(draw)
  drawRef.current = draw

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const observer = new ResizeObserver(() => drawRef.current())
    observer.observe(canvas)
    return () => observer.disconnect()
  }, [])

  function draw() {
    const canvas = canvasRef.current
    const base = baseCanvasRef.current
    if (!canvas || !base) return
    canvas.width = image.width
    canvas.height = image.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    if (showMaskPreview) {
      const rendered = renderMasked(base, image.masks, { color: maskColor })
      ctx.drawImage(rendered, 0, 0)
    } else {
      ctx.drawImage(base, 0, 0)
    }

    if (showOcrOverlay) {
      ctx.save()
      ctx.strokeStyle = 'rgba(37, 99, 235, 0.7)'
      ctx.lineWidth = Math.max(1, image.width / 600)
      for (const word of image.ocrWords) {
        ctx.strokeRect(word.bbox.x, word.bbox.y, word.bbox.width, word.bbox.height)
      }
      ctx.restore()
    }

    // Mask outlines + handles (drawn regardless of preview mode so editing is always visible)
    ctx.save()
    for (const mask of image.masks) {
      const isSelected = mask.id === selectedId
      ctx.strokeStyle = isSelected ? '#f97316' : 'rgba(15, 23, 42, 0.5)'
      ctx.lineWidth = Math.max(1.5, image.width / 500)
      ctx.setLineDash(mask.enabled ? [] : [8, 6])
      if (mask.shape === 'circle') {
        ctx.beginPath()
        ctx.ellipse(
          mask.rect.x + mask.rect.width / 2,
          mask.rect.y + mask.rect.height / 2,
          mask.rect.width / 2,
          mask.rect.height / 2,
          0,
          0,
          Math.PI * 2,
        )
        ctx.stroke()
      } else {
        ctx.strokeRect(mask.rect.x, mask.rect.y, mask.rect.width, mask.rect.height)
      }

      if (isSelected) {
        const handleSize = getHandleSize(mask.rect)
        ctx.setLineDash([])
        ctx.fillStyle = '#f97316'
        for (const [hx, hy] of cornerPoints(mask.rect)) {
          ctx.fillRect(hx - handleSize / 2, hy - handleSize / 2, handleSize, handleSize)
        }
      }
    }

    if (drag?.type === 'create') {
      ctx.setLineDash([6, 4])
      ctx.strokeStyle = '#f97316'
      ctx.lineWidth = Math.max(1.5, image.width / 500)
      ctx.strokeRect(drag.current.x, drag.current.y, drag.current.width, drag.current.height)
    }
    ctx.restore()
  }

  function cornerPoints(rect: Rect): [number, number][] {
    return [
      [rect.x, rect.y],
      [rect.x + rect.width, rect.y],
      [rect.x, rect.y + rect.height],
      [rect.x + rect.width, rect.y + rect.height],
    ]
  }

  function toImageCoords(e: { clientX: number; clientY: number }): { x: number; y: number } {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  // ハンドルサイズ（画像ピクセル単位）。キャンバスは縮小表示されるため、画像ピクセル固定だと
  // スマホでは数物理ピクセルまで潰れて掴めない。表示スケールから逆算して、画面上で常に
  // HANDLE_TOUCH_CSS_PX程度の大きさになるようにする（高ズーム時はHANDLE_SIZEを下限とする）。
  // ただし小さいマスクではハンドル判定がマスク全体を覆い、移動しようとしても必ず
  // リサイズになってしまうため、中央に移動用の領域が残るよう短辺の1/3を上限とする。
  function getHandleSize(rect?: Rect): number {
    const canvasWidth = canvasRef.current?.getBoundingClientRect().width
    const base = canvasWidth
      ? Math.max(HANDLE_SIZE, HANDLE_TOUCH_CSS_PX / (canvasWidth / image.width))
      : Math.max(HANDLE_SIZE, image.width / 60)
    if (!rect) return base
    return Math.min(base, Math.min(rect.width, rect.height) / 3)
  }

  function hitTestHandle(pos: { x: number; y: number }, rect: Rect): DragState {
    const handleSize = getHandleSize(rect)
    const corners: { corner: 'nw' | 'ne' | 'sw' | 'se'; x: number; y: number }[] = [
      { corner: 'nw', x: rect.x, y: rect.y },
      { corner: 'ne', x: rect.x + rect.width, y: rect.y },
      { corner: 'sw', x: rect.x, y: rect.y + rect.height },
      { corner: 'se', x: rect.x + rect.width, y: rect.y + rect.height },
    ]
    for (const c of corners) {
      if (Math.abs(pos.x - c.x) <= handleSize && Math.abs(pos.y - c.y) <= handleSize) {
        return { type: 'resize', id: '', corner: c.corner }
      }
    }
    return null
  }

  function handlePointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    if (mode === 'pan') return
    e.currentTarget.setPointerCapture(e.pointerId)
    const pos = toImageCoords(e)

    if (selectedId) {
      const selectedMask = image.masks.find((m) => m.id === selectedId)
      if (selectedMask) {
        const handleHit = hitTestHandle(pos, selectedMask.rect)
        if (handleHit && handleHit.type === 'resize') {
          onBeforeEdit()
          const next: DragState = { type: 'resize', id: selectedId, corner: handleHit.corner }
          dragRef.current = next
          setDrag(next)
          return
        }
      }
    }

    const hitMask = [...image.masks].reverse().find((m) => isInsideRect(pos, m.rect))
    if (hitMask) {
      // タップ選択のみで動かさなかった場合のスナップショットはフック側の重複ガードで吸収される
      onBeforeEdit()
      setSelectedId(hitMask.id)
      const next: DragState = {
        type: 'move',
        id: hitMask.id,
        grabDx: pos.x - hitMask.rect.x,
        grabDy: pos.y - hitMask.rect.y,
      }
      dragRef.current = next
      setDrag(next)
      return
    }

    setSelectedId(null)

    if (tool === 'stamp') {
      const rect: Rect = {
        x: clamp(pos.x - stampSize / 2, 0, Math.max(0, image.width - stampSize)),
        y: clamp(pos.y - stampSize / 2, 0, Math.max(0, image.height - stampSize)),
        width: Math.min(stampSize, image.width),
        height: Math.min(stampSize, image.height),
      }
      const newMask: MaskBox = {
        id: `mask-${nextMaskId++}`,
        rect,
        shape: 'circle',
        source: 'manual',
        enabled: true,
      }
      onBeforeEdit()
      onMasksChange([...image.masks, newMask])
      setSelectedId(newMask.id)
      return
    }

    const next: DragState = {
      type: 'create',
      startX: pos.x,
      startY: pos.y,
      current: { x: pos.x, y: pos.y, width: 0, height: 0 },
    }
    dragRef.current = next
    setDrag(next)
  }

  function isInsideRect(pos: { x: number; y: number }, rect: Rect): boolean {
    return (
      pos.x >= rect.x &&
      pos.x <= rect.x + rect.width &&
      pos.y >= rect.y &&
      pos.y <= rect.y + rect.height
    )
  }

  function handlePointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const current = dragRef.current
    if (!current) return
    const pos = toImageCoords(e)

    if (current.type === 'create') {
      const next: DragState = {
        ...current,
        current: normalizeRect(current.startX, current.startY, pos.x, pos.y),
      }
      dragRef.current = next
      setDrag(next)
      return
    }

    if (current.type === 'move') {
      const mask = image.masks.find((m) => m.id === current.id)
      if (!mask) return
      const newRect: Rect = {
        ...mask.rect,
        x: clamp(pos.x - current.grabDx, 0, image.width - mask.rect.width),
        y: clamp(pos.y - current.grabDy, 0, image.height - mask.rect.height),
      }
      onMasksChange(image.masks.map((m) => (m.id === mask.id ? { ...m, rect: newRect } : m)))
      return
    }

    if (current.type === 'resize') {
      const mask = image.masks.find((m) => m.id === current.id)
      if (!mask) return
      const r = mask.rect
      let x0 = r.x
      let y0 = r.y
      let x1 = r.x + r.width
      let y1 = r.y + r.height
      if (current.corner === 'nw') {
        x0 = pos.x
        y0 = pos.y
      } else if (current.corner === 'ne') {
        x1 = pos.x
        y0 = pos.y
      } else if (current.corner === 'sw') {
        x0 = pos.x
        y1 = pos.y
      } else if (current.corner === 'se') {
        x1 = pos.x
        y1 = pos.y
      }
      const newRect = normalizeRect(x0, y0, x1, y1)
      onMasksChange(image.masks.map((m) => (m.id === mask.id ? { ...m, rect: newRect } : m)))
    }
  }

  function handlePointerUp(e: React.PointerEvent<HTMLCanvasElement>) {
    const current = dragRef.current
    if (current?.type === 'create') {
      const pos = toImageCoords(e)
      const finalRect = normalizeRect(current.startX, current.startY, pos.x, pos.y)

      if (finalRect.width >= MIN_RECT_SIZE && finalRect.height >= MIN_RECT_SIZE) {
        const newMask: MaskBox = {
          id: `mask-${nextMaskId++}`,
          rect: finalRect,
          shape: 'rect',
          source: 'manual',
          enabled: true,
        }
        onBeforeEdit()
        onMasksChange([...image.masks, newMask])
        setSelectedId(newMask.id)
      } else if (registeredNameLength > 0) {
        // ドラッグせずタップしただけの場合は、登録名の文字数に応じた大きさの四角を
        // タップ位置中心に即配置する（丸スタンプと同様、細かい位置合わせは後からドラッグで行う）。
        const width = charSize * registeredNameLength
        const height = charSize
        const rect: Rect = {
          x: clamp(current.startX - width / 2, 0, Math.max(0, image.width - width)),
          y: clamp(current.startY - height / 2, 0, Math.max(0, image.height - height)),
          width: Math.min(width, image.width),
          height: Math.min(height, image.height),
        }
        const newMask: MaskBox = {
          id: `mask-${nextMaskId++}`,
          rect,
          shape: 'rect',
          source: 'manual',
          enabled: true,
        }
        onBeforeEdit()
        onMasksChange([...image.masks, newMask])
        setSelectedId(newMask.id)
      }
    }
    dragRef.current = null
    setDrag(null)
  }

  function clamp(v: number, min: number, max: number) {
    return Math.min(Math.max(v, min), Math.max(min, max))
  }

  function deleteSelected() {
    if (!selectedId) return
    onBeforeEdit()
    onMasksChange(image.masks.filter((m) => m.id !== selectedId))
    setSelectedId(null)
  }

  function handleUndo() {
    onUndo()
    // 復元後のマスク一覧に存在しないIDを指したままにしない
    setSelectedId(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="max-h-[70vh] overflow-auto rounded border border-slate-200 bg-slate-100">
        <canvas
          ref={canvasRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          className={`block select-none ${mode === 'draw' ? 'touch-none' : 'touch-pan-y'}`}
          style={{ width: `${zoom * 100}%` }}
        />
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {mode === 'draw' && tool === 'rect' && registeredNameLength > 0 && (
          <div className="flex items-center gap-1 rounded bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setCharSize((s) => Math.max(MIN_CHAR_SIZE, s - CHAR_SIZE_STEP))}
              disabled={charSize <= MIN_CHAR_SIZE}
              className="min-h-11 min-w-11 rounded text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[4rem] text-center text-xs text-slate-500">
              文字幅 {charSize}px
            </span>
            <button
              type="button"
              onClick={() => setCharSize((s) => Math.min(MAX_CHAR_SIZE, s + CHAR_SIZE_STEP))}
              disabled={charSize >= MAX_CHAR_SIZE}
              className="min-h-11 min-w-11 rounded text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ＋
            </button>
          </div>
        )}
        {mode === 'draw' && tool === 'stamp' && (
          <div className="flex items-center gap-1 rounded bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setStampSize((s) => Math.max(MIN_STAMP_SIZE, s - STAMP_SIZE_STEP))}
              disabled={stampSize <= MIN_STAMP_SIZE}
              className="min-h-11 min-w-11 rounded text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              −
            </button>
            <span className="min-w-[4rem] text-center text-xs text-slate-500">
              スタンプ {stampSize}px
            </span>
            <button
              type="button"
              onClick={() => setStampSize((s) => Math.min(MAX_STAMP_SIZE, s + STAMP_SIZE_STEP))}
              disabled={stampSize >= MAX_STAMP_SIZE}
              className="min-h-11 min-w-11 rounded text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
            >
              ＋
            </button>
          </div>
        )}
        <div className="flex items-center gap-1 rounded bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(1, Math.round((z - 0.25) * 100) / 100))}
            disabled={zoom <= 1}
            className="min-h-11 min-w-11 rounded text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            −
          </button>
          <span className="min-w-[3rem] text-center text-xs text-slate-500">
            {Math.round(zoom * 100)}%
          </span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(3, Math.round((z + 0.25) * 100) / 100))}
            disabled={zoom >= 3}
            className="min-h-11 min-w-11 rounded text-sm text-slate-600 disabled:cursor-not-allowed disabled:opacity-40"
          >
            ＋
          </button>
          {zoom !== 1 && (
            <button
              type="button"
              onClick={() => setZoom(1)}
              className="min-h-11 rounded px-3 text-xs text-indigo-600"
            >
              リセット
            </button>
          )}
        </div>
        <span className="text-xs text-slate-400">
          {mode !== 'draw'
            ? '画像内を指でスクロールできます。マスクを編集する場合は「編集」に切り替えてください'
            : tool === 'stamp'
              ? 'タップした位置に丸スタンプを配置します。配置後はドラッグで移動、角をドラッグでリサイズできます'
              : registeredNameLength > 0
                ? 'タップすると登録名の文字数に応じた四角を配置します。ドラッグすれば好きな大きさの四角を追加できます'
                : 'ドラッグで矩形マスクを追加・移動・角をドラッグでリサイズ。画像内をスクロールしたい場合は「スクロール」に切り替えてください'}
        </span>
      </div>
      {/* 主要操作バー: モバイルではキャンバスが画面外に続く間だけ下部に固定表示される
          （stickyなので通過後は流れに戻り、フッター等を覆わない） */}
      <div className="sticky bottom-0 z-10 -mx-4 flex flex-wrap items-center gap-2 border-t border-slate-200 bg-white/95 px-4 pt-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:z-auto sm:mx-0 sm:border-0 sm:bg-transparent sm:px-0 sm:pt-0 sm:pb-0 sm:backdrop-blur-none">
        <div className="flex gap-1 rounded bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => setMode('draw')}
            className={`min-h-11 rounded px-3 text-sm transition-colors ${
              mode === 'draw'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            ✏️ 編集
          </button>
          <button
            type="button"
            onClick={() => setMode('pan')}
            className={`min-h-11 rounded px-3 text-sm transition-colors ${
              mode === 'pan'
                ? 'bg-white text-indigo-600 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
          >
            🖐 スクロール
          </button>
        </div>
        {mode === 'draw' && (
          <div className="flex gap-1 rounded bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setTool('rect')}
              className={`min-h-11 rounded px-3 text-sm transition-colors ${
                tool === 'rect'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ▭ 四角
            </button>
            <button
              type="button"
              onClick={() => setTool('stamp')}
              className={`min-h-11 rounded px-3 text-sm transition-colors ${
                tool === 'stamp'
                  ? 'bg-white text-indigo-600 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              ⚪ 丸スタンプ
            </button>
          </div>
        )}
        <button
          type="button"
          onClick={handleUndo}
          disabled={!canUndo}
          className="min-h-11 rounded bg-slate-100 px-3 text-sm font-medium text-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          ↩︎ 元に戻す
        </button>
        <button
          type="button"
          onClick={deleteSelected}
          disabled={!selectedId}
          className="min-h-11 rounded bg-red-50 px-3 text-sm font-medium text-red-600 disabled:cursor-not-allowed disabled:opacity-40"
        >
          選択したマスクを削除
        </button>
        <div className="flex w-full gap-2 sm:hidden">
          {shareSupported && (
            <button
              type="button"
              onClick={onShare}
              disabled={exportBusy}
              className="min-h-11 flex-1 rounded border border-indigo-300 px-3 text-sm font-medium text-indigo-700 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {shareLabel}
            </button>
          )}
          <button
            type="button"
            onClick={onDownload}
            disabled={exportBusy}
            className="min-h-11 flex-1 rounded bg-indigo-600 px-3 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {downloadLabel}
          </button>
        </div>
        {exportError && <p className="w-full text-xs text-red-600 sm:hidden">{exportError}</p>}
      </div>
    </div>
  )
}
