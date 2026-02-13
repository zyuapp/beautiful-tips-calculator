import { describe, expect, it } from "vitest"

import {
  extractAmountsFromText,
  getNoAmountErrorMessage,
  type ExtractedData,
} from "../lib/receipt-ocr"

describe("extractAmountsFromText", () => {
  it("prefers a validated total over payment lines", () => {
    const text = [
      "SUBTOTAL 45.00",
      "TAX 4.50",
      "TIP 2.00",
      "TOTAL 51.50",
      "CASH 60.00",
      "CHANGE 8.50",
    ].join("\n")

    const result = extractAmountsFromText(text)

    expect(result.amount).toBe(51.5)
    expect(result.confidence).toBeGreaterThan(0.7)
  })

  it("falls back to no amount for payment-only text", () => {
    const text = ["CASH 40.00", "CHANGE 12.50"].join("\n")

    const result = extractAmountsFromText(text)

    expect(result.amount).toBe(0)
    expect(result.allAmounts).toHaveLength(2)
  })
})

describe("getNoAmountErrorMessage", () => {
  it("returns a specific message when exactly one amount was found", () => {
    const data: ExtractedData = {
      amount: 0,
      confidence: 0.3,
      allAmounts: [
        {
          value: 12.34,
          context: "ITEM 12.34",
          lineIndex: 0,
        },
      ],
      rawText: "ITEM 12.34",
    }

    const message = getNoAmountErrorMessage(data)

    expect(message).toContain("Found $12.34")
  })

  it("returns null when a total amount is present", () => {
    const data: ExtractedData = {
      amount: 42,
      confidence: 0.9,
      allAmounts: [],
      rawText: "TOTAL 42.00",
    }

    expect(getNoAmountErrorMessage(data)).toBeNull()
  })
})
