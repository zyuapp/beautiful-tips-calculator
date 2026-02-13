import Tesseract from "tesseract.js"

import {
  categorizeAmount,
  findAmountsInText,
  type ExtractedAmount,
  validateTotalRelationship,
} from "./number-utils"

export type OcrMode = "normal" | "high-contrast" | "low-contrast"

export type ReceiptAmountOption = ExtractedAmount

export interface ExtractedData {
  amount: number
  confidence: number
  allAmounts: ReceiptAmountOption[]
  rawText: string
}

interface ScanReceiptImageOptions {
  onProgress?: (progress: number) => void
  shouldContinue?: () => boolean
}

const RELATIONSHIP_ANCHOR_PATTERN = /SUB\s*TOTAL|SUBTOTAL|SUB-TOTAL|BEFORE\s*TAX|TAX|HST|GST|PST|VAT|TIP|GRATUITY|SERVICE/i
const STRONG_TOTAL_SIGNAL_PATTERN = /\b(GRAND\s*TOTAL|AMOUNT\s*DUE|BALANCE\s*DUE|FINAL\s*AMOUNT|TOTAL\s*DUE|TOTAL\s*AMOUNT|TO\s*PAY)\b/i
const WEAK_TOTAL_SIGNAL_PATTERN = /\b(TOTAL|SUM|AMOUNT|DUE|BAL)\b/i
const MISLEADING_TOTAL_SIGNAL_PATTERN = /\b(ITEMS?\s*TOTAL|TOTAL\s*SAVINGS?|SAVINGS?\s*TOTAL|DISCOUNT|MERCHANDISE|FOOD\s*TOTAL)\b/i
const PAYMENT_SIGNAL_PATTERN = /\b(CASH|CHANGE|TENDERED|PAID|APPROVAL|AUTH|CARD|VISA|MASTERCARD|AMEX)\b/i

const MINIMUM_ACCEPTABLE_SCORE = 1.2
const MIN_CONFIDENCE = 0.2
const MAX_CONFIDENCE = 0.98

export function extractAmountsFromText(text: string): ExtractedData {
  const lines = text.split("\n")
  const extractedAmounts = findAmountsInText(text)

  if (extractedAmounts.length === 0) {
    return {
      amount: 0,
      confidence: 0,
      allAmounts: [],
      rawText: text,
    }
  }

  const maxValue = Math.max(...extractedAmounts.map((amount) => amount.value))
  const sortedByValue = [...extractedAmounts].sort((a, b) => b.value - a.value)
  const hasRelationshipAnchors = extractedAmounts.some((amount) =>
    RELATIONSHIP_ANCHOR_PATTERN.test(amount.context)
  )

  const scoredAmounts = extractedAmounts
    .map((amount) => {
      const context = amount.context.toUpperCase()
      const relativeLinePosition = lines.length > 1 ? amount.lineIndex / (lines.length - 1) : 1
      const inTopThreeValues = sortedByValue
        .slice(0, 3)
        .some((valueCandidate) => Math.abs(valueCandidate.value - amount.value) < 0.01)

      const hasStrongTotalSignal = STRONG_TOTAL_SIGNAL_PATTERN.test(context)
      const hasWeakTotalSignal = WEAK_TOTAL_SIGNAL_PATTERN.test(context)
      const hasMisleadingTotalSignal = MISLEADING_TOTAL_SIGNAL_PATTERN.test(context)
      const hasPaymentSignal = PAYMENT_SIGNAL_PATTERN.test(context)

      const category = categorizeAmount(amount, extractedAmounts)
      const validation = validateTotalRelationship(amount.value, extractedAmounts)

      let score = 0
      if (hasStrongTotalSignal) score += 4.2
      if (hasWeakTotalSignal) score += 1.8
      if (hasMisleadingTotalSignal) score -= 2.2
      if (hasPaymentSignal || category.category === "payment") score -= 2.8

      if (category.category === "total") score += 1.4
      if (category.category === "subtotal") score += 0.4
      if (category.category === "tax" || category.category === "tip") score -= 0.8
      if (category.category === "item") score -= 0.4

      if (validation.valid) {
        score += 2.4 * validation.confidence
      } else if (hasRelationshipAnchors) {
        score -= 0.6
      }

      score += Math.min(1.2, amount.value / maxValue)
      if (inTopThreeValues) score += 0.5
      score += relativeLinePosition * 1.6
      if (amount.value < 1) score -= 1

      return {
        ...amount,
        score,
        validation,
      }
    })
    .sort((a, b) => b.score - a.score || b.lineIndex - a.lineIndex)

  const best = scoredAmounts[0]
  if (!best || best.score < MINIMUM_ACCEPTABLE_SCORE) {
    const fallbackConfidence = best ? Math.max(0.1, Math.min(0.35, best.score / 4)) : 0

    return {
      amount: 0,
      confidence: fallbackConfidence,
      allAmounts: extractedAmounts,
      rawText: text,
    }
  }

  const secondBest = scoredAmounts[1]
  const scoreMargin = secondBest ? best.score - secondBest.score : best.score
  const baseConfidence = Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, best.score / 8))
  const marginFactor = Math.min(1, Math.max(0.45, scoreMargin / 3))
  let confidence = baseConfidence * marginFactor

  if (best.validation.valid) {
    confidence = Math.min(MAX_CONFIDENCE, confidence + 0.1)
  }

  return {
    amount: best.value,
    confidence,
    allAmounts: extractedAmounts,
    rawText: text,
  }
}

export function getNoAmountErrorMessage(data: ExtractedData): string | null {
  if (data.amount > 0) {
    return null
  }

  const { allAmounts, rawText } = data

  if (rawText.length < 10) {
    return "Couldn't read text from image. Try better lighting or hold phone steadier."
  }

  if (allAmounts.length === 0) {
    return "Found text but no amounts. Make sure the total is visible and try again."
  }

  if (allAmounts.length === 1) {
    return `Found $${allAmounts[0].value.toFixed(2)} but unsure if it's the total. Click to use it anyway.`
  }

  return `Found ${allAmounts.length} amounts. Click one below or try a clearer image.`
}

function preprocessImage(
  img: HTMLImageElement,
  mode: OcrMode = "normal"
): string {
  const canvas = document.createElement("canvas")
  const ctx = canvas.getContext("2d")

  if (!ctx) {
    throw new Error("Could not initialize image processing canvas")
  }

  const maxWidth = 1000
  const scale = img.width > maxWidth ? maxWidth / img.width : 1
  canvas.width = img.width * scale
  canvas.height = img.height * scale

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  let brightnessSum = 0
  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    brightnessSum += gray
  }
  const avgBrightness = brightnessSum / (data.length / 4)

  let factor: number
  let threshold: number

  switch (mode) {
    case "high-contrast":
      factor = avgBrightness < 100 ? 2.5 : avgBrightness > 180 ? 1.8 : 2
      threshold = avgBrightness < 80 ? 90 : avgBrightness > 200 ? 150 : 120
      break
    case "low-contrast":
      factor = avgBrightness < 100 ? 1.2 : avgBrightness > 180 ? 0.8 : 1
      threshold = avgBrightness < 80 ? 110 : avgBrightness > 200 ? 130 : 135
      break
    default:
      factor = avgBrightness < 100 ? 2 : avgBrightness > 180 ? 1.2 : 1.5
      threshold = avgBrightness < 80 ? 100 : avgBrightness > 200 ? 140 : 128
      break
  }

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114
    const contrasted = gray * factor + 128 * (1 - factor)
    const finalValue = contrasted > threshold ? 255 : contrasted < 50 ? 0 : contrasted

    data[index] = finalValue
    data[index + 1] = finalValue
    data[index + 2] = finalValue
  }

  ctx.putImageData(imageData, 0, 0)
  return canvas.toDataURL()
}

function qualityScore(data: ExtractedData): number {
  const amountFoundScore = data.amount > 0 ? 1.5 : 0
  const optionsScore = Math.min(0.25, data.allAmounts.length * 0.03)
  return amountFoundScore + data.confidence + optionsScore
}

async function runOcrForMode({
  img,
  mode,
  onProgress,
  shouldContinue,
}: {
  img: HTMLImageElement
  mode: OcrMode
  onProgress: (progress: number) => void
  shouldContinue: () => boolean
}): Promise<ExtractedData | null> {
  if (!shouldContinue()) {
    return null
  }

  const processedUrl = preprocessImage(img, mode)
  const result = await Tesseract.recognize(processedUrl, "eng", {
    logger: (message) => {
      if (message.status !== "recognizing text") {
        return
      }

      if (!shouldContinue()) {
        return
      }

      onProgress(Math.round(message.progress * 100))
    },
  })

  if (!shouldContinue()) {
    return null
  }

  return extractAmountsFromText(result.data.text)
}

function selectBestResult(results: ExtractedData[]): ExtractedData | null {
  if (results.length === 0) {
    return null
  }

  return [...results].sort((a, b) => qualityScore(b) - qualityScore(a))[0]
}

export async function scanReceiptImage(
  img: HTMLImageElement,
  options: ScanReceiptImageOptions = {}
): Promise<ExtractedData | null> {
  const {
    onProgress = () => undefined,
    shouldContinue = () => true,
  } = options

  let latestProgress = 0
  const reportProgress = (nextProgress: number) => {
    if (!shouldContinue()) {
      return
    }

    latestProgress = Math.max(latestProgress, nextProgress)
    onProgress(latestProgress)
  }

  const results: ExtractedData[] = []
  const normalResult = await runOcrForMode({
    img,
    mode: "normal",
    onProgress: reportProgress,
    shouldContinue,
  })

  if (!normalResult || !shouldContinue()) {
    return null
  }

  results.push(normalResult)

  const shouldTryHighContrast = normalResult.amount === 0 || normalResult.confidence < 0.75
  if (shouldTryHighContrast) {
    reportProgress(50)

    const highContrastResult = await runOcrForMode({
      img,
      mode: "high-contrast",
      onProgress: reportProgress,
      shouldContinue,
    })

    if (highContrastResult) {
      results.push(highContrastResult)
    }
  }

  const bestSoFar = selectBestResult(results)
  const shouldTryLowContrast = !bestSoFar || bestSoFar.amount === 0 || bestSoFar.confidence < 0.75
  if (shouldTryLowContrast) {
    reportProgress(75)

    const lowContrastResult = await runOcrForMode({
      img,
      mode: "low-contrast",
      onProgress: reportProgress,
      shouldContinue,
    })

    if (lowContrastResult) {
      results.push(lowContrastResult)
    }
  }

  if (!shouldContinue()) {
    return null
  }

  return selectBestResult(results)
}
