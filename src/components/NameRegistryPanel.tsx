import { useState } from 'react'

interface NameRegistryPanelProps {
  names: string[]
  onNamesChange: (names: string[]) => void
}

export function NameRegistryPanel({ names, onNamesChange }: NameRegistryPanelProps) {
  const [input, setInput] = useState('')

  function addName() {
    const trimmed = input.trim()
    if (!trimmed || names.includes(trimmed)) {
      setInput('')
      return
    }
    onNamesChange([...names, trimmed])
    setInput('')
  }

  function removeName(name: string) {
    onNamesChange(names.filter((n) => n !== name))
  }

  return (
    <div className="rounded-2xl border border-line bg-surface p-3">
      <div className="mb-2 text-sm font-medium text-ink">
        マスクする名前を登録（表記ゆれがあれば複数登録できます）
      </div>
      {/* 入力欄のtext-base: iOS Safariはフォントサイズ16px未満の入力欄をタップすると
          自動的に画面を拡大するため、スマホ幅では16pxにして拡大を防ぐ */}
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            // isComposing: IME変換中のEnter（変換確定）を無視する
            // keyCode 229: SafariはcompositionendをEnterのkeydownより先に発火するため
            //   isComposingだけでは確定Enterを検出できない。Safariは該当keydownを
            //   keyCode 229でマークするので、これも併せて無視する
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.nativeEvent.keyCode !== 229) {
              e.preventDefault()
              addName()
            }
          }}
          placeholder="例: 太郎"
          // iOS Safariはフォントサイズ16px未満の入力欄をタップすると自動的に画面を拡大するため、
          // スマホ幅では16px（text-base）にして拡大を防ぐ
          className="min-h-11 flex-1 rounded-xl border border-line px-2 text-base sm:text-sm"
        />
        <button
          type="button"
          onClick={addName}
          className="min-h-11 rounded-xl bg-primary px-3 text-sm font-medium text-on-primary"
        >
          追加
        </button>
      </div>
      {names.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {names.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-full bg-primary-soft px-3 py-1 text-sm text-primary"
            >
              {name}
              <button
                type="button"
                onClick={() => removeName(name)}
                aria-label={`${name} を削除`}
                className="-my-2.5 -mr-2 flex h-11 w-9 items-center justify-center text-primary hover:text-danger"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
