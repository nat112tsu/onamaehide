import { useRef, useState, type ChangeEvent, type DragEvent } from 'react'

interface UploadZoneProps {
  onFilesSelected: (files: File[]) => void
  errors: string[]
  disabled?: boolean
}

export function UploadZone({ onFilesSelected, errors, disabled }: UploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [isDragOver, setIsDragOver] = useState(false)

  function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return
    onFilesSelected(Array.from(fileList))
  }

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault()
    setIsDragOver(false)
    if (disabled) return
    handleFiles(e.dataTransfer.files)
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>) {
    handleFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault()
          if (!disabled) setIsDragOver(true)
        }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
        onClick={() => !disabled && inputRef.current?.click()}
        className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors ${
          disabled
            ? 'cursor-not-allowed border-line bg-bg text-mut'
            : isDragOver
              ? 'cursor-pointer border-primary bg-primary-soft text-primary'
              : 'cursor-pointer border-line bg-surface text-mut hover:border-primary hover:bg-primary-soft/50'
        }`}
      >
        <p className="text-sm font-medium">
          画像をドラッグ&ドロップ、またはクリックして選択
        </p>
        <p className="text-xs text-mut">
          PNG / JPEG・最大10枚・1枚10MBまで
        </p>
        <input
          ref={inputRef}
          type="file"
          accept="image/png,image/jpeg"
          multiple
          disabled={disabled}
          onChange={handleInputChange}
          className="hidden"
        />
      </div>
      {errors.length > 0 && (
        <ul className="mt-2 space-y-1 text-sm text-danger">
          {errors.map((err, i) => (
            <li key={i}>{err}</li>
          ))}
        </ul>
      )}
    </div>
  )
}
