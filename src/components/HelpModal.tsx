interface HelpModalProps {
  onClose: () => void
}

export function HelpModal({ onClose }: HelpModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[85dvh] w-full max-w-2xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between border-b border-slate-100 p-5 pb-4">
          <h2 className="text-lg font-semibold text-slate-800">使い方</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        <div className="space-y-5 overflow-y-auto p-5 pt-4 text-sm leading-relaxed text-slate-700">
          <section>
            <h3 className="mb-1 font-medium text-slate-800">このツールについて</h3>
            <p>
              キャラクターチャット/ロールプレイアプリのスクリーンショットから、自分の表示名を
              自動で見つけて黒塗りできるツールです。画像は一切サーバーに送信されず、すべての
              処理はこのブラウザ内だけで完結します。
            </p>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-slate-800">基本の流れ</h3>
            <ol className="list-decimal space-y-1 pl-5">
              <li>
                「マスクする名前を登録」欄に、隠したい表示名を入力して「追加」します。
                表記ゆれ（ひらがな/カタカナ違いなど）がある場合は複数登録できます。
              </li>
              <li>スクリーンショットをアップロードします（複数枚可・最大10枚・1枚10MBまで）。</li>
              <li>
                アップロード後、自動で文字を検出し、登録した名前と一致する箇所に黒塗りマスクが
                自動的に追加されます（少し時間がかかることがあります）。
              </li>
              <li>
                自動検出で見つからなかった箇所は、手動でマスクを追加できます
                （下記「手動でのマスク編集」を参照）。
              </li>
              <li>画面右側のボタンからダウンロードします（下記「ダウンロードについて」を参照）。</li>
            </ol>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-slate-800">ダウンロードについて</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                アップロードした画像が1枚のときは「PNGをダウンロード」ボタンが表示され、
                マスクを適用した画像がPNG形式で1枚だけ保存されます。
              </li>
              <li>
                2枚以上アップロードしているときは「ZIPで一括ダウンロード」ボタンに変わり、
                今どの画像を表示中かに関わらず、アップロードした全ページ分をまとめて
                ZIPファイルとしてダウンロードします（各画像はそれぞれ自身の検出結果・
                手動マスクの状態でマスクされます）。
              </li>
              <li>
                ファイル名は元の画像名に「_masked」を付けたもの（例:
                <code className="rounded bg-slate-100 px-1">screenshot_masked.png</code>
                ）になります。ZIPの場合はさらに
                <code className="rounded bg-slate-100 px-1">masked_images.zip</code>
                という名前でまとめられます。
              </li>
              <li>
                ダウンロード時点の「塗りつぶし色」がすべての画像に反映されます。色を
                変更してから改めてダウンロードし直すことも可能です。
              </li>
              <li>
                スマートフォンでは、ダウンロード後の保存先（ファイルアプリやダウンロード
                フォルダなど）を確認するダイアログが表示される場合があります。
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-slate-800">手動でのマスク編集</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>「編集」モードで画像上をドラッグすると、新しく矩形マスクを追加できます。</li>
              <li>マスクをクリックして選択すると、ドラッグで移動、角のハンドルでリサイズできます。</li>
              <li>選択した状態で「選択したマスクを削除」を押すと削除できます。</li>
              <li>
                細かい位置合わせをしたい場合は、＋/−ボタンで拡大表示にすると調整しやすくなります。
              </li>
              <li>
                画像が縦に長く、拡大時にスクロールしたい場合は「スクロール」モードに切り替えると、
                画面内をスクロールできます（「編集」モードのままだとマスク編集操作が優先されます）。
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-slate-800">その他の設定</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>「塗りつぶし色」で黒塗りの色を変更できます。</li>
              <li>「OCR検出枠を表示」で、文字として認識された箇所を枠で確認できます。</li>
              <li>
                「マスク適用プレビュー」をオフにすると、マスクを適用する前の元画像を確認できます。
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-1 font-medium text-slate-800">うまく検出されないときは</h3>
            <p>
              OCRの精度により、まれに名前が検出されないことがあります。「OCR検出枠を表示」で
              実際に検出された文字と登録名の表記が一致しているか確認するか、手動でマスクを
              追加してください。
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
