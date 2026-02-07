type NumberFormat = 'european' | 'us' | 'mixed'

export interface ExtractedAmount {
  value: number
  context: string
  lineIndex: number
}

export interface CategorizedAmount extends ExtractedAmount {
  category: 'total' | 'subtotal' | 'tax' | 'tip' | 'item' | 'unknown'
}

export function parseCurrencyString(valueStr: string): number | null {
  if (!valueStr || typeof valueStr !== 'string') {
    return null
  }

  const cleaned = valueStr.trim()
  if (!cleaned) {
    return null
  }

  const hasComma = cleaned.includes(',')
  const hasDot = cleaned.includes('.')

  let value: number
  let normalized: string

  if (hasComma && hasDot) {
    const lastCommaIndex = cleaned.lastIndexOf(',')
    const lastDotIndex = cleaned.lastIndexOf('.')

    if (lastDotIndex > lastCommaIndex) {
      normalized = cleaned.replace(/,/g, '')
    } else {
      normalized = cleaned.replace(/\./g, '').replace(',', '.')
    }
    value = parseFloat(normalized)
  } else if (hasComma && !hasDot) {
    const parts = cleaned.split(',')
    const lastPart = parts[parts.length - 1]

    if (lastPart.length <= 2 && parts.length > 1) {
      normalized = cleaned.replace(',', '.')
    } else {
      normalized = cleaned.replace(/,/g, '')
    }
    value = parseFloat(normalized)
  } else if (!hasComma && hasDot) {
    const parts = cleaned.split('.')
    const lastPart = parts[parts.length - 1]

    if (parts.length > 1 && lastPart.length <= 3) {
      normalized = cleaned
    } else {
      normalized = cleaned.replace(/\./g, '')
    }
    value = parseFloat(normalized)
  } else {
    value = parseFloat(cleaned)
  }

  return isNaN(value) ? null : value
}

export function detectNumberFormat(text: string): NumberFormat {
  const amountPattern = /\b\d{1,3}(?:[.,]\d{3})*(?:[.,]\d{2})?\b/g
  const matches = text.match(amountPattern)

  if (!matches || matches.length < 3) {
    return 'us'
  }

  let europeanCount = 0
  let usCount = 0

  for (const match of matches) {
    if (match.includes(',') && match.includes('.')) {
      const lastCommaIndex = match.lastIndexOf(',')
      const lastDotIndex = match.lastIndexOf('.')
      if (lastDotIndex > lastCommaIndex) {
        usCount++
      } else {
        europeanCount++
      }
    } else if (match.includes(',') && !match.includes('.')) {
      const parts = match.split(',')
      const lastPart = parts[parts.length - 1]
      if (lastPart.length === 2) {
        europeanCount++
      } else {
        usCount++
      }
    } else if (!match.includes(',') && match.includes('.')) {
      usCount++
    }
  }

  if (europeanCount > usCount * 1.5) {
    return 'european'
  } else if (usCount > europeanCount * 1.5) {
    return 'us'
  }
  return 'mixed'
}

export function findAmountsInText(text: string): ExtractedAmount[] {
  const lines = text.split('\n')
  const amounts: ExtractedAmount[] = []

  const amountPattern = /[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]?\d{0,2})|(\d{1,3}(?:[.,]\d{3})*[.,]?\d{0,2})\s*[$€£¥₹₽]/g

  lines.forEach((line, index) => {
    const matches = line.matchAll(amountPattern)
    for (const match of matches) {
      const valueStr = match[1] || match[2]
      const value = parseCurrencyString(valueStr)

      if (value !== null && isValidReceiptAmount(value)) {
        const contextStart = Math.max(0, index - 1)
        const contextEnd = Math.min(lines.length, index + 2)
        const context = lines.slice(contextStart, contextEnd).join(' ')

        amounts.push({
          value,
          context,
          lineIndex: index
        })
      }
    }
  })

  return amounts
}

export function isValidReceiptAmount(value: number): boolean {
  return (
    typeof value === 'number' &&
    !isNaN(value) &&
    isFinite(value) &&
    value > 0 &&
    value < 100000
  )
}

export function validateTotalRelationship(
  total: number,
  allAmounts: ExtractedAmount[]
): { valid: boolean; confidence: number } {
  const tolerance = 0.05

  const subtotal = allAmounts.find(a =>
    /SUB\s*TOTAL|SUBTOTAL|SUB-TOTAL/i.test(a.context)
  )?.value ?? 0

  const tax = allAmounts.find(a =>
    /(?:TAX|HST|GST|PST|VAT)[:\s]+/i.test(a.context)
  )?.value ?? 0

  const tip = allAmounts.find(a =>
    /(?:TIP|GRATUITY|SERVICE)[:\s]+/i.test(a.context)
  )?.value ?? 0

  if (subtotal > 0) {
    const expectedTotal = subtotal + tax + tip
    const diff = Math.abs(total - expectedTotal)

    if (diff <= expectedTotal * tolerance) {
      return { valid: true, confidence: 0.95 }
    }

    if (diff <= expectedTotal * 0.10) {
      return { valid: true, confidence: 0.85 }
    }

    if (total > subtotal && total <= subtotal * 1.25) {
      return { valid: true, confidence: 0.7 }
    }
  }

  return { valid: false, confidence: 0 }
}

export function categorizeAmount(amount: ExtractedAmount, allAmounts: ExtractedAmount[]): CategorizedAmount {
  const context = amount.context.toUpperCase()
  const value = amount.value

  if (/(?:GRAND\s*TOTAL|TOTAL\s*DUE|AMOUNT\s*DUE|BALANCE\s*DUE|PLEASE\s*PAY|FINAL\s+AMOUNT)/i.test(context)) {
    return { ...amount, category: 'total' }
  }

  if (/(?:^|\s)TOTAL[:\s]/im.test(context) && !/(?:SUB|FOOD|MERCHANDISE|ITEMS?)\s*TOTAL/i.test(context)) {
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

  const maxValue = Math.max(...allAmounts.map(a => a.value))
  const sortedAmounts = [...allAmounts].sort((a, b) => b.value - a.value)

  const isLargeValue = value >= maxValue * 0.9
  const isAmongLargest = sortedAmounts.slice(0, 3).some(a => Math.abs(a.value - value) < 0.01)

  if (isLargeValue || isAmongLargest) {
    return { ...amount, category: 'total' }
  }

  return { ...amount, category: 'item' }
}
