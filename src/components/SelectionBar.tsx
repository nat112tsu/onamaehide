interface SelectionBarProps {
  onResize: (factor: number) => void
  onDelete: () => void
  canShrink: boolean
  canGrow: boolean
}

// 選択中のマスクにだけ効く操作。設定を探しに行かなくて済むよう、
// ツールバーのすぐ上（＝指の届く位置）に選択中だけ現れる。
export function SelectionBar({ onResize, onDelete, canShrink, canGrow }: SelectionBarProps) {
  return (
    <div className="flex w-full items-center gap-2 rounded-xl bg-primary-soft px-2 py-1.5">
      <span className="pl-1 text-aux font-medium text-ink">えらんだマスク</span>
      <button
        type="button"
        onClick={() => onResize(0.8)}
        disabled={!canShrink}
        aria-label="小さくする"
        className="min-h-11 min-w-11 rounded-xl bg-surface text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        −
      </button>
      <button
        type="button"
        onClick={() => onResize(1.25)}
        disabled={!canGrow}
        aria-label="大きくする"
        className="min-h-11 min-w-11 rounded-xl bg-surface text-sm text-ink disabled:cursor-not-allowed disabled:opacity-40"
      >
        ＋
      </button>
      <button
        type="button"
        onClick={onDelete}
        className="ml-auto min-h-11 rounded-xl bg-danger/10 px-3 text-sm font-medium text-danger"
      >
        削除
      </button>
    </div>
  )
}
