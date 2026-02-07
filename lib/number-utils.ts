type NumberFormat = 'european' | 'us' | 'mixed'

const RECEIPT_AMOUNT_PATTERN = /(?:[$€£¥₹₽]\s*)?(\d{1,3}(?:[.,'’\s]\d{3})+(?:[.,]\d{1,2})?|\d+(?:[.,]\d{1,2})?)(?:\s*[$€£¥₹₽])?/g

export interface ExtractedAmount {
  value: number
  context: string
  lineIndex: number
}

export interface CategorizedAmount extends ExtractedAmount {
  category: 'total' | 'subtotal' | 'tax' | 'tip' | 'item' | 'payment' | 'unknown'
}

export function parseCurrencyString(valueStr: string, formatHint: NumberFormat = 'mixed'): number | null {
  if (!valueStr || typeof valueStr !== 'string') {
    return null
  }

  const cleaned = valueStr
    .replace(/[^\d.,'’\s-]/g, '')
    .replace(/[\u00A0\u202F]/g, ' ')
    .replace(/[’']/g, "'")
    .trim()

  if (!cleaned || !/\d/.test(cleaned)) {
    return null
  }

  let normalized = cleaned.replace(/\s+/g, '').replace(/'/g, '')
  normalized = normalized.replace(/(?!^)-/g, '')

  const hasComma = normalized.includes(',')
  const hasDot = normalized.includes('.')

  const chooseDecimalSeparator = (): ',' | '.' | null => {
    if (hasComma && hasDot) {
      return normalized.lastIndexOf(',') > normalized.lastIndexOf('.') ? ',' : '.'
    }

    const separator = hasComma ? ',' : hasDot ? '.' : null
    if (!separator) {
      return null
    }

    const parts = normalized.split(separator)
    const lastPart = parts[parts.length - 1] || ''
    const isSingleSeparator = parts.length === 2

    if (lastPart.length <= 2) {
      return separator
    }

    if (lastPart.length === 3 && !isSingleSeparator) {
      return null
    }

    if (lastPart.length === 3 && isSingleSeparator) {
      if (formatHint === 'european') {
        return null
      }

      return null
    }

    return null
  }

  const decimalSeparator = chooseDecimalSeparator()
  if (decimalSeparator) {
    const parts = normalized.split(decimalSeparator)
    const fractionPart = parts.pop() || ''
    const integerPart = parts.join('').replace(/[.,]/g, '')

    if (!integerPart || !/^\d+$/.test(integerPart) || !/^\d+$/.test(fractionPart)) {
      return null
    }

    const value = Number.parseFloat(`${integerPart}.${fractionPart}`)
    return Number.isFinite(value) ? value : null
  }

  const integerLike = normalized.replace(/[.,]/g, '')
  if (!/^[-]?\d+$/.test(integerLike)) {
    return null
  }

  const value = Number.parseFloat(integerLike)
  return Number.isFinite(value) ? value : null
}

export function detectNumberFormat(text: string): NumberFormat {
  const matches = text.match(/\b\d{1,3}(?:[.,'’\s]\d{3})*(?:[.,]\d{1,2})?\b/g)

  if (!matches || matches.length < 3) {
    return 'us'
  }

  let europeanCount = 0
  let usCount = 0

  for (const raw of matches) {
    const match = raw.replace(/[\s'’]/g, '')

    if (match.includes(',') && match.includes('.')) {
      if (match.lastIndexOf(',') > match.lastIndexOf('.')) {
        europeanCount++
      } else {
        usCount++
      }
      continue
    }

    if (match.includes(',') && !match.includes('.')) {
      const parts = match.split(',')
      const lastPart = parts[parts.length - 1] || ''
      if (lastPart.length <= 2) {
        europeanCount++
      } else {
        usCount++
      }
      continue
    }

    if (!match.includes(',') && match.includes('.')) {
      const parts = match.split('.')
      const lastPart = parts[parts.length - 1] || ''
      if (lastPart.length <= 2) {
        usCount++
      } else {
        europeanCount++
      }
    }
  }

  if (europeanCount > usCount * 1.5) {
    return 'european'
  }

  if (usCount > europeanCount * 1.5) {
    return 'us'
  }

  return 'mixed'
}

export function findAmountsInText(text: string): ExtractedAmount[] {
  const lines = text.split('\n')
  const amounts: ExtractedAmount[] = []
  const formatHint = detectNumberFormat(text)

  for (const [index, line] of lines.entries()) {
    const lineText = line.replace(/\s+/g, ' ').trim()
    const matches = line.matchAll(RECEIPT_AMOUNT_PATTERN)

    for (const match of matches) {
      const valueStr = match[1]
      const value = parseCurrencyString(valueStr, formatHint)

      if (value !== null && isValidReceiptAmount(value)) {
        amounts.push({
          value,
          context: lineText,
          lineIndex: index,
        })
      }
    }
  }

  return amounts
}

export function isValidReceiptAmount(value: number): boolean {
  return (
    typeof value === 'number' &&
    !Number.isNaN(value) &&
    Number.isFinite(value) &&
    value > 0 &&
    value < 100000
  )
}

export function validateTotalRelationship(
  total: number,
  allAmounts: ExtractedAmount[]
): { valid: boolean; confidence: number } {
  const subtotalCandidates = allAmounts
    .filter((a) => /SUB\s*TOTAL|SUBTOTAL|SUB-TOTAL|BEFORE\s*TAX/i.test(a.context))
    .sort((a, b) => b.lineIndex - a.lineIndex)
    .slice(0, 5)

  const taxCandidates = allAmounts
    .filter((a) => /(?:TAX|HST|GST|PST|VAT)\b/i.test(a.context))
    .sort((a, b) => b.lineIndex - a.lineIndex)
    .slice(0, 5)

  const tipCandidates = allAmounts
    .filter((a) => /(?:TIP|GRATUITY|SERVICE)\b/i.test(a.context))
    .sort((a, b) => b.lineIndex - a.lineIndex)
    .slice(0, 5)

  if (subtotalCandidates.length === 0) {
    return { valid: false, confidence: 0 }
  }

  let bestRatio = Number.POSITIVE_INFINITY
  let hasExactishMatch = false

  const taxOptions = [0, ...taxCandidates.map((c) => c.value)]
  const tipOptions = [0, ...tipCandidates.map((c) => c.value)]

  for (const subtotal of subtotalCandidates) {
    for (const tax of taxOptions) {
      for (const tip of tipOptions) {
        const expectedTotal = subtotal.value + tax + tip
        if (expectedTotal <= 0) {
          continue
        }

        const ratio = Math.abs(total - expectedTotal) / expectedTotal
        if (ratio < bestRatio) {
          bestRatio = ratio
        }

        if (ratio <= 0.02) {
          hasExactishMatch = true
        }
      }
    }
  }

  if (bestRatio <= 0.02) {
    return { valid: true, confidence: 0.96 }
  }

  if (bestRatio <= 0.05) {
    return { valid: true, confidence: 0.9 }
  }

  if (bestRatio <= 0.1) {
    return { valid: true, confidence: 0.8 }
  }

  const latestSubtotal = subtotalCandidates[0].value
  if (!hasExactishMatch && total >= latestSubtotal * 0.95 && total <= latestSubtotal * 1.35) {
    return { valid: true, confidence: 0.65 }
  }

  return { valid: false, confidence: 0 }
}

export function categorizeAmount(amount: ExtractedAmount, allAmounts: ExtractedAmount[]): CategorizedAmount {
  const context = amount.context.toUpperCase()
  const value = amount.value

  const isPaymentLine = /\b(CASH|CHANGE|TENDERED|PAID|APPROVAL|AUTH|CARD|VISA|MASTERCARD|AMEX)\b/i.test(context)
  if (isPaymentLine) {
    return { ...amount, category: 'payment' }
  }

  if (/(?:GRAND\s*TOTAL|TOTAL\s*DUE|AMOUNT\s*DUE|BALANCE\s*DUE|PLEASE\s*PAY|FINAL\s+AMOUNT|TO\s*PAY)/i.test(context)) {
    return { ...amount, category: 'total' }
  }

  if (
    /(?:^|\s)TOTAL[:\s]/im.test(context) &&
    !/(?:SUB|ITEM|SAVINGS?|DISCOUNT|MERCHANDISE|FOOD|ITEMS?)\s*TOTAL/i.test(context)
  ) {
    return { ...amount, category: 'total' }
  }

  if (/SUB\s*TOTAL|SUBTOTAL|SUB-TOTAL|BEFORE\s*TAX/i.test(context)) {
    return { ...amount, category: 'subtotal' }
  }

  if (/TAX|HST|GST|PST|VAT/i.test(context)) {
    return { ...amount, category: 'tax' }
  }

  if (/TIP|GRATUITY|SERVICE/i.test(context)) {
    return { ...amount, category: 'tip' }
  }

  const maxValue = Math.max(...allAmounts.map((a) => a.value), value)
  const sortedAmounts = [...allAmounts].sort((a, b) => b.value - a.value)

  const isLargeValue = value >= maxValue * 0.9
  const isAmongLargest = sortedAmounts.slice(0, 3).some((a) => Math.abs(a.value - value) < 0.01)

  if (isLargeValue || isAmongLargest) {
    return { ...amount, category: 'unknown' }
  }

  return { ...amount, category: 'item' }
}
