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
    <div className="rounded border border-slate-200 bg-white p-3">
      <div className="mb-2 text-sm font-medium text-slate-700">
        マスクする名前を登録（表記ゆれがあれば複数登録できます）
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              addName()
            }
          }}
          placeholder="例: すあ"
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="button"
          onClick={addName}
          className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
        >
          追加
        </button>
      </div>
      {names.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-2">
          {names.map((name) => (
            <span
              key={name}
              className="flex items-center gap-1 rounded-full bg-indigo-50 px-3 py-1 text-sm text-indigo-700"
            >
              {name}
              <button
                type="button"
                onClick={() => removeName(name)}
                className="text-indigo-400 hover:text-red-500"
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
