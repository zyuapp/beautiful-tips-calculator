import { describe, expect, it } from "vitest"

import {
  parseCurrencyString,
  detectNumberFormat,
  findAmountsInText,
  validateTotalRelationship,
  categorizeAmount,
  type ExtractedAmount,
} from "../lib/number-utils"

describe("parseCurrencyString", () => {
  it("parses ungrouped 4+ digit decimals", () => {
    expect(parseCurrencyString("1234.56")).toBe(1234.56)
  })

  it("parses apostrophe and space thousand separators", () => {
    expect(parseCurrencyString("1'234.56")).toBe(1234.56)
    expect(parseCurrencyString("1 234,56")).toBe(1234.56)
  })

  it("parses ambiguous single separator with locale hint", () => {
    expect(parseCurrencyString("1.234", "european")).toBe(1234)
  })

  it("parses malformed OCR separators like 1,234,56", () => {
    expect(parseCurrencyString("1,234,56")).toBe(1234.56)
  })
})

describe("detectNumberFormat", () => {
  it("detects european-style formatting", () => {
    const text = ["SUBTOTAL 1.234,00", "TAX 12,34", "TOTAL 1.246,34"].join("\n")
    expect(detectNumberFormat(text)).toBe("european")
  })

  it("detects us-style formatting", () => {
    const text = ["SUBTOTAL 1,234.00", "TAX 12.34", "TOTAL 1,246.34"].join("\n")
    expect(detectNumberFormat(text)).toBe("us")
  })
})

describe("findAmountsInText", () => {
  it("extracts amounts with exact line context and line index", () => {
    const text = ["ITEM 9.99", "TOTAL CHF 1'234.56"].join("\n")
    const amounts = findAmountsInText(text)

    expect(amounts).toHaveLength(2)
    expect(amounts[1]).toMatchObject({
      value: 1234.56,
      context: "TOTAL CHF 1'234.56",
      lineIndex: 1,
    })
  })
})

describe("validateTotalRelationship", () => {
  const receiptAmounts: ExtractedAmount[] = [
    { value: 45, context: "SUBTOTAL 45.00", lineIndex: 3 },
    { value: 4.5, context: "TAX 4.50", lineIndex: 4 },
    { value: 2, context: "TIP 2.00", lineIndex: 5 },
    { value: 51.5, context: "TOTAL 51.50", lineIndex: 6 },
  ]

  it("validates realistic subtotal+tax+tip totals", () => {
    const result = validateTotalRelationship(51.5, receiptAmounts)
    expect(result.valid).toBe(true)
    expect(result.confidence).toBeGreaterThanOrEqual(0.9)
  })

  it("rejects totals that are too far off", () => {
    const result = validateTotalRelationship(80, receiptAmounts)
    expect(result.valid).toBe(false)
    expect(result.confidence).toBe(0)
  })
})

describe("categorizeAmount", () => {
  it("classifies payment lines as payment", () => {
    const allAmounts: ExtractedAmount[] = [
      { value: 37.2, context: "TOTAL 37.20", lineIndex: 5 },
      { value: 50, context: "CASH 50.00", lineIndex: 6 },
      { value: 12.8, context: "CHANGE 12.80", lineIndex: 7 },
    ]

    const category = categorizeAmount(allAmounts[1], allAmounts)
    expect(category.category).toBe("payment")
  })
})
