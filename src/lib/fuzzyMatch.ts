function levenshteinDistance(a: string, b: string): number {
  const m = a.length
  const n = b.length
  if (m === 0) return n
  if (n === 0) return m

  let prevRow = Array.from({ length: n + 1 }, (_, j) => j)
  let currRow = new Array(n + 1).fill(0)

  for (let i = 1; i <= m; i++) {
    currRow[0] = i
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      currRow[j] = Math.min(
        prevRow[j] + 1,
        currRow[j - 1] + 1,
        prevRow[j - 1] + cost,
      )
    }
    ;[prevRow, currRow] = [currRow, prevRow]
  }
  return prevRow[n]
}

const FUZZY_THRESHOLD_RATIO = 0.2

// 全角/半角の表記ゆれやOCRの大文字小文字ゆれを吸収するための正規化
function normalize(text: string): string {
  return text.trim().normalize('NFKC').toLowerCase()
}

export function isFuzzyMatch(query: string, candidate: string): boolean {
  const a = normalize(query)
  const b = normalize(candidate)
  if (!a || !b) return false
  if (a === b) return true

  // 名前が短い（4文字以下）場合は誤差を許容しない。Math.max(1, …)の下駄を履かせると
  // 例えば1文字の名前が無関係などの1文字とも編集距離1で一致してしまうため。
  const maxLen = Math.max(a.length, b.length)
  const maxAllowedDistance = Math.floor(maxLen * FUZZY_THRESHOLD_RATIO)
  if (maxAllowedDistance === 0) return false
  return levenshteinDistance(a, b) <= maxAllowedDistance
}

export interface SubstringMatch {
  // マッチした範囲の開始/終了位置と、比較対象文字列全体の長さ（比率計算用）
  start: number
  end: number
  totalLength: number
}

// 地の文に名前が埋め込まれているケース向け。OCRは文全体を1つの領域として
// まとめて認識することが多く、名前だけが単独の検出結果にならないため、
// 長い文字列の中に名前に近い部分文字列が含まれるかどうかを走査して調べる。
// 見つかった場合はマッチ位置（文字数比率で後から座標を絞り込むため）も返す。
export function findFuzzySubstringMatch(query: string, candidate: string): SubstringMatch | null {
  const a = normalize(query)
  const bTrimmed = candidate.trim()
  const b = normalize(bTrimmed)
  if (!a || !b) return null
  const totalLength = bTrimmed.length

  const exactIdx = b.indexOf(a)
  if (exactIdx !== -1) {
    return { start: exactIdx, end: exactIdx + a.length, totalLength }
  }
  if (a.length > b.length) return null

  // 長い文章の中を走査すると誤検出の機会が単語単位の一致判定より格段に増えるため、
  // 名前が短い場合は許容誤差を持たせない（実質的に完全一致のみ）。
  // whole-word判定と違いMath.max(1, …)の下駄を履かせないことで、
  // 例えば2文字の名前が無関係な2文字の並びに誤って一致するのを防ぐ。
  const maxAllowedDistance = Math.floor(a.length * FUZZY_THRESHOLD_RATIO)
  if (maxAllowedDistance === 0) return null

  for (let start = 0; start <= b.length - a.length; start++) {
    const window = b.slice(start, start + a.length)
    if (levenshteinDistance(a, window) <= maxAllowedDistance) {
      return { start, end: start + a.length, totalLength }
    }
  }
  return null
}
