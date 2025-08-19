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
    <div className="min-h-screen bg-gradient-to-br from-background to-muted transition-colors duration-300">
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
              Tip Calculator
            </h1>
            <button
              onClick={() => setDarkMode(!darkMode)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
              aria-label="Toggle dark mode"
            >
              {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
          </div>

          {/* Main Calculator Card */}
          <motion.div
            className="bg-card rounded-2xl shadow-xl p-6 space-y-6"
            initial={{ scale: 0.95 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.3 }}
          >
            {/* Bill Amount Input */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Bill Amount</label>
              <div className="relative">
                <DollarSign className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="number"
                  value={billAmount}
                  onChange={(e) => setBillAmount(e.target.value)}
                  placeholder="0.00"
                  className="w-full pl-10 pr-12 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
                <button
                  onClick={() => setShowScanner(true)}
                  className="absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-md hover:bg-accent active:bg-accent/70 transition-colors flex items-center justify-center touch-manipulation"
                  title="Scan receipt"
                  type="button"
                >
                  <ScanLine className="h-5 w-5 text-primary" />
                </button>
              </div>
            </div>

            {/* Tip Percentage */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Tip %</label>
              <div className="grid grid-cols-5 gap-2 mb-3">
                {tipPresets.map((preset) => (
                  <motion.button
                    key={preset}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => {
                      setTipPercent(preset)
                      setCustomTip("")
                    }}
                    className={cn(
                      "py-2 rounded-lg font-medium transition-all",
                      tipPercent === preset && !customTip
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/80"
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
                  className="w-full pr-10 pl-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Number of People */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Split Between</label>
              
              {/* Quick presets */}
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[1, 2, 3, 4].map((num) => (
                  <motion.button
                    key={num}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setNumberOfPeople(num)}
                    className={cn(
                      "py-2.5 rounded-lg font-medium transition-all flex items-center justify-center gap-1",
                      numberOfPeople === num
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary hover:bg-secondary/80"
                    )}
                  >
                    <Users className="h-4 w-4" />
                    <span>{num}</span>
                  </motion.button>
                ))}
              </div>
              
              {/* Custom number with stepper */}
              <div className="flex items-center gap-2 p-2 rounded-lg bg-secondary/50">
                <button
                  onClick={() => setNumberOfPeople(Math.max(1, numberOfPeople - 1))}
                  className="p-2 rounded-md hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
                  type="button"
                  disabled={numberOfPeople <= 1}
                >
                  <Minus className="h-5 w-5" />
                </button>
                
                <div className="flex-1 text-center">
                  <div className="text-2xl font-bold">{numberOfPeople}</div>
                  <div className="text-xs text-muted-foreground">
                    {numberOfPeople === 1 ? 'person' : 'people'}
                  </div>
                </div>
                
                <button
                  onClick={() => setNumberOfPeople(numberOfPeople + 1)}
                  className="p-2 rounded-md hover:bg-accent active:bg-accent/70 transition-colors touch-manipulation"
                  type="button"
                >
                  <Plus className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Rounding Options */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-muted-foreground">Rounding</label>
              <div className="grid grid-cols-3 gap-2">
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRoundingMode("none")}
                  className={cn(
                    "py-2.5 px-3 rounded-lg font-medium transition-all",
                    roundingMode === "none"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                  type="button"
                >
                  <div className="text-sm">None</div>
                  <div className="text-xs opacity-70">¢.99</div>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRoundingMode("up")}
                  className={cn(
                    "py-2.5 px-3 rounded-lg font-medium transition-all",
                    roundingMode === "up"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                  type="button"
                >
                  <div className="text-sm">Round Up</div>
                  <div className="text-xs opacity-70">$1.00</div>
                </motion.button>
                
                <motion.button
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRoundingMode("down")}
                  className={cn(
                    "py-2.5 px-3 rounded-lg font-medium transition-all",
                    roundingMode === "down"
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary hover:bg-secondary/80"
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
                className="space-y-4 pt-6 border-t"
              >
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Tip Amount</p>
                    <p className="text-2xl font-bold">
                      ${finalTipAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold">
                      ${finalTotal.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="bg-primary/10 rounded-lg p-4 space-y-2">
                  <p className="text-lg font-semibold">Per Person</p>
                  <div className="flex justify-between items-center">
                    <span>Amount</span>
                    <span className="font-bold">
                      ${finalPerPerson.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Tip</span>
                    <span className="font-bold">
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
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={copyToClipboard}
                    className="flex-1 flex items-center justify-center gap-2 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                  >
                    <Copy className="h-4 w-4" />
                    Copy Summary
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={clearAll}
                    className="px-6 py-3 bg-secondary text-secondary-foreground rounded-lg font-medium hover:bg-secondary/80 transition-colors"
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