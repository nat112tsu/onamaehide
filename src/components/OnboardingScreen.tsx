interface OnboardingScreenProps {
  onStart: () => void
}

const STEPS: { title: string; note?: string }[] = [
  { title: 'かくしたい名前を入れる' },
  { title: 'スクショをえらぶ', note: '名前が写っている所に、自動でふたをします' },
  { title: '保存して投稿', note: 'もれがあれば、自分で足せます' },
]

export function OnboardingScreen({ onStart }: OnboardingScreenProps) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <div className="mx-auto flex min-h-full max-w-md flex-col px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
        <div className="flex h-13 items-center justify-end">
          <button
            type="button"
            onClick={onStart}
            className="min-h-11 rounded-xl px-2 text-sm text-mut"
          >
            スキップ
          </button>
        </div>

        <div className="pt-6">
          <h1 className="text-2xl leading-relaxed font-bold text-ink">
            スクショの名前を
            <br />
            かくします
          </h1>
          <p className="pt-2.5 text-sm leading-relaxed text-mut">
            3ステップ、だいたい30秒で終わります
          </p>
        </div>

        <ol className="flex flex-col gap-3.5 pt-8">
          {STEPS.map((step, i) => (
            <li key={step.title} className="flex items-start gap-3">
              <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-primary-soft text-sm font-bold text-primary">
                {i + 1}
              </span>
              <span className="pt-0.5">
                <span className="block font-bold text-ink">{step.title}</span>
                {step.note && <span className="block pt-0.5 text-xs text-mut">{step.note}</span>}
              </span>
            </li>
          ))}
        </ol>

        <div className="flex-1" />

        <div className="mt-8 rounded-2xl bg-primary-soft px-4 py-3.5">
          <div className="pb-1 text-sm font-bold text-primary">🔒 画像はどこにも送りません</div>
          <p className="text-aux leading-relaxed text-ink">
            文字をさがすのも、ぬりつぶすのも、保存も、ぜんぶこの端末の中だけで行います
          </p>
        </div>

        <button
          type="button"
          onClick={onStart}
          className="mt-3.5 h-14 rounded-2xl bg-primary text-base font-bold text-on-primary"
        >
          はじめる
        </button>
        <p className="pt-2.5 text-center text-aux text-mut">この画面は最初の1回だけです</p>
      </div>
    </div>
  )
}
