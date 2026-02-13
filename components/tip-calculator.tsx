"use client"

import { useState, useEffect } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { DollarSign, Users, Percent, Copy, Moon, Sun, ScanLine, Minus, Plus } from "lucide-react"
import { cn } from "@/lib/utils"
import ReceiptScanner from "./receipt-scanner"

export default function TipCalculator() {
  const [billAmount, setBillAmount] = useState("")
  const [tipPercent, setTipPercent] = useState(15)
  const [customTip, setCustomTip] = useState("")
  const [numberOfPeople, setNumberOfPeople] = useState(1)
  const [darkMode, setDarkMode] = useState(false)
  const [roundingMode, setRoundingMode] = useState<"none" | "up" | "down">("none")
  const [showScanner, setShowScanner] = useState(false)
  
  const tipPresets = [10, 15, 18, 20, 25]

  // Calculations
  const bill = parseFloat(billAmount) || 0
  const tip = customTip ? parseFloat(customTip) : tipPercent
  const tipAmount = bill * (tip / 100)
  const totalAmount = bill + tipAmount
  const perPersonAmount = totalAmount / numberOfPeople

  // Apply rounding
  const applyRounding = (amount: number) => {
    if (roundingMode === "up") return Math.ceil(amount)
    if (roundingMode === "down") return Math.floor(amount)
    return amount
  }

  const finalPerPerson = applyRounding(perPersonAmount)
  const finalTotal = finalPerPerson * numberOfPeople
  const finalTipAmount = finalTotal - bill
  const finalTipPerPerson = finalTipAmount / numberOfPeople

  // Dark mode effect
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
  }, [darkMode])

  // Load preferences from localStorage
  useEffect(() => {
    const savedDarkMode = localStorage.getItem("darkMode") === "true"
    const savedRounding = localStorage.getItem("roundingMode") as "none" | "up" | "down" || "none"
    
    setDarkMode(savedDarkMode)
    setRoundingMode(savedRounding)
  }, [])

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode.toString())
    localStorage.setItem("roundingMode", roundingMode)
  }, [darkMode, roundingMode])

  const copyToClipboard = () => {
    const text = `Bill: $${bill.toFixed(2)}
Tip (${tip}%): $${finalTipAmount.toFixed(2)}
Total: $${finalTotal.toFixed(2)}
Split ${numberOfPeople} ways: $${finalPerPerson.toFixed(2)} each`
    
    navigator.clipboard.writeText(text)
  }

  const clearAll = () => {
    setBillAmount("")
    setTipPercent(15)
    setCustomTip("")
    setNumberOfPeople(1)
  }

  return (
    <div className="min-h-screen bg-background transition-colors duration-200">
      <div className="container mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25 }}
        >
          {/* Header */}
          <div className="mb-6 flex items-center justify-between border-b border-border pb-4">
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Tip Calculator
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-background transition-colors hover:bg-secondary"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          {/* Main Calculator Card */}
          <motion.div
            className="space-y-6 rounded-lg border border-border bg-card p-5 shadow-sm sm:p-6"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
          >
            {/* Bill Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Bill Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="number"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-md border border-input bg-background py-2.5 pl-10 pr-12 text-base font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
                <button
                  onClick={() => setShowScanner(true)}
                  className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-md border border-transparent p-2 transition-colors hover:border-border hover:bg-secondary active:bg-accent touch-manipulation"
                  title="Scan receipt"
                  type="button"
                >
                  <ScanLine className="h-5 w-5 text-primary" />
                </button>
              </div>
            </div>

            {/* Tip Percentage */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Tip %</label>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {tipPresets.map((preset) => (
                  <motion.button
                    key={preset}
                    onClick={() => {
                      setTipPercent(preset)
                      setCustomTip("")
                    }}
                    className={cn(
                      "rounded-md border py-2 text-sm font-semibold transition-colors",
                      tipPercent === preset && !customTip
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    )}
                  >
                    {preset}%
                  </motion.button>
                ))}
              </div>
              <div className="relative">
                <Percent className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="number"
                  value={customTip}
                  onChange={(e) => setCustomTip(e.target.value)}
                  placeholder="Custom tip %"
                  className="w-full rounded-md border border-input bg-background py-2.5 pl-4 pr-10 text-base font-medium tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>
            </div>

            {/* Number of People */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Split Between</label>
              
              {/* Quick presets */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[1, 2, 3, 4].map((num) => (
                  <motion.button
                    key={num}
                    onClick={() => setNumberOfPeople(num)}
                    className={cn(
                      "flex items-center justify-center gap-1 rounded-md border py-2.5 text-sm font-semibold transition-colors",
                      numberOfPeople === num
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-secondary-foreground hover:bg-accent"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    <span>{num}</span>
                  </motion.button>
                ))}
              </div>
              
              {/* Custom number with stepper */}
              <div className="flex items-center gap-2 rounded-md border border-border bg-secondary p-2">
                <button
                  onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))}
                  className="rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent active:bg-accent touch-manipulation disabled:cursor-not-allowed disabled:opacity-40"
                  type="button"
                  disabled={numberOfPeople <= 1}
                >
                  <Minus className="h-5 w-5" />
                </button>
                
                <div className="flex-1 text-center">
                  <div className="font-mono text-2xl font-semibold tabular-nums">{numberOfPeople}</div>
                  <div className="text-xs uppercase tracking-wide text-muted-foreground">
                    {numberOfPeople === 1 ? 'person' : 'people'}
                  </div>
                </div>
                
                <button
                  onClick={() => setNumberOfPeople(numberOfPeople + 1)}
                  className="rounded-md border border-border bg-background p-2 transition-colors hover:bg-accent active:bg-accent touch-manipulation"
                  type="button"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Rounding Options */}
            <div className="space-y-2">
              <label className="text-sm font-semibold">Rounding</label>
              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  onClick={() => setRoundingMode("none")}
                  className={cn(
                    "rounded-md border px-3 py-2.5 font-medium transition-colors",
                    roundingMode === "none"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary hover:bg-accent"
                  )}
                  type="button"
                >
                  <div className="text-sm">None</div>
                  <div className="text-xs opacity-70">¢.99</div>
                </motion.button>
                
                <motion.button
                  onClick={() => setRoundingMode("up")}
                  className={cn(
                    "rounded-md border px-3 py-2.5 font-medium transition-colors",
                    roundingMode === "up"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary hover:bg-accent"
                  )}
                  type="button"
                >
                  <div className="text-sm">Round Up</div>
                  <div className="text-xs opacity-70">$1.00</div>
                </motion.button>
                
                <motion.button
                  onClick={() => setRoundingMode("down")}
                  className={cn(
                    "rounded-md border px-3 py-2.5 font-medium transition-colors",
                    roundingMode === "down"
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-secondary hover:bg-accent"
                  )}
                  type="button"
                >
                  <div className="text-sm">Round Down</div>
                  <div className="text-xs opacity-70">$0.00</div>
                </motion.button>
              </div>
            </div>

            {/* Results */}
            {bill > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="space-y-4 border-t border-border pt-6"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tip Amount</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">
                      ${finalTipAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="font-mono text-2xl font-semibold tabular-nums">
                      ${finalTotal.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="space-y-2 rounded-md border border-border bg-secondary p-4">
                  <p className="text-lg font-semibold">Per Person</p>
                  <div className="flex justify-between items-center">
                    <span>Amount</span>
                    <span className="font-mono font-semibold tabular-nums">
                      ${finalPerPerson.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Tip</span>
                    <span className="font-mono font-semibold tabular-nums">
                      ${finalTipPerPerson.toFixed(2)}
                    </span>
                  </div>
                </div>

                {numberOfPeople > 1 && (
                  <p className="text-center text-sm text-muted-foreground">
                    You saved ${(finalTotal - finalPerPerson).toFixed(2)} by splitting!
                  </p>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col gap-2 sm:flex-row">
                  <motion.button
                    onClick={copyToClipboard}
                    className="flex flex-1 items-center justify-center gap-2 rounded-md border border-primary bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Summary
                  </motion.button>
                  <motion.button
                    onClick={clearAll}
                    className="rounded-md border border-border bg-background px-6 py-3 font-semibold text-foreground transition-colors hover:bg-secondary"
                  >
                    Clear
                  </motion.button>
                </div>
              </motion.div>
            )}
          </motion.div>
        </motion.div>
      </div>

      {/* Receipt Scanner Modal */}
      <AnimatePresence>
        {showScanner && (
          <ReceiptScanner
            onAmountExtracted={(amount) => {
              setBillAmount(amount.toFixed(2))
              setShowScanner(false)
            }}
            onClose={() => setShowScanner(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
