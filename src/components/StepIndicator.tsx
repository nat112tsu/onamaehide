export type Step = 1 | 2 | 3

interface StepIndicatorProps {
  current: Step
}

const STEPS: { value: Step; label: string }[] = [
  { value: 1, label: '名前' },
  { value: 2, label: '画像' },
  { value: 3, label: '保存' },
]

export function StepIndicator({ current }: StepIndicatorProps) {
  return (
    <ol className="flex gap-2" aria-label="進行状況">
      {STEPS.map((step) => {
        const done = step.value < current
        const active = step.value === current
        return (
          <li
            key={step.value}
            aria-current={active ? 'step' : undefined}
            className={`flex flex-1 items-center gap-1.5 ${active || done ? '' : 'opacity-40'}`}
          >
            <span
              className={`flex size-5 shrink-0 items-center justify-center rounded-full text-aux font-bold ${
                active || done ? 'bg-primary text-on-primary' : 'bg-line text-mut'
              }`}
            >
              {done ? '✓' : step.value}
            </span>
            <span className="text-aux font-bold text-ink">{step.label}</span>
          </li>
        )
      })}
    </ol>
  )
}
