"use client"

import { useState, useEffect } from "react"
import { motion } from "framer-motion"
import { DollarSign, Users, Percent, Copy, Moon, Sun } from "lucide-react"
import { cn } from "@/lib/utils"

export default function TipCalculator() {
  const [billAmount, setBillAmount] = useState("")
  const [tipPercent, setTipPercent] = useState(15)
  const [customTip, setCustomTip] = useState("")
  const [numberOfPeople, setNumberOfPeople] = useState(1)
  const [darkMode, setDarkMode] = useState(false)
  const [currency, setCurrency] = useState("USD")
  const [roundingMode, setRoundingMode] = useState<"none" | "up" | "down">("none")
  
  const tipPresets = [10, 15, 18, 20, 25]
  const currencies = {
    USD: { symbol: "$", name: "US Dollar" },
    EUR: { symbol: "€", name: "Euro" },
    GBP: { symbol: "£", name: "British Pound" },
    JPY: { symbol: "¥", name: "Japanese Yen" },
  }

  // Calculations
  const bill = parseFloat(billAmount) || 0
  const tip = customTip ? parseFloat(customTip) : tipPercent
  const tipAmount = bill * (tip / 100)
  const totalAmount = bill + tipAmount
  const perPersonAmount = totalAmount / numberOfPeople
  const tipPerPerson = tipAmount / numberOfPeople

  // Apply rounding
  const applyRounding = (amount: number) => {
    if (roundingMode === "up") return Math.ceil(amount)
    if (roundingMode === "down") return Math.floor(amount)
    return amount
  }

  const finalPerPerson = applyRounding(perPersonAmount)
  const finalTotal = finalPerPerson * numberOfPeople

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
    const savedCurrency = localStorage.getItem("currency") || "USD"
    const savedRounding = localStorage.getItem("roundingMode") as "none" | "up" | "down" || "none"
    
    setDarkMode(savedDarkMode)
    setCurrency(savedCurrency)
    setRoundingMode(savedRounding)
  }, [])

  // Save preferences to localStorage
  useEffect(() => {
    localStorage.setItem("darkMode", darkMode.toString())
    localStorage.setItem("currency", currency)
    localStorage.setItem("roundingMode", roundingMode)
  }, [darkMode, currency, roundingMode])

  const copyToClipboard = () => {
    const text = `Bill: ${currencies[currency as keyof typeof currencies].symbol}${bill.toFixed(2)}
Tip (${tip}%): ${currencies[currency as keyof typeof currencies].symbol}${tipAmount.toFixed(2)}
Total: ${currencies[currency as keyof typeof currencies].symbol}${finalTotal.toFixed(2)}
Split ${numberOfPeople} ways: ${currencies[currency as keyof typeof currencies].symbol}${finalPerPerson.toFixed(2)} each`
    
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
                  className="w-full pl-10 pr-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
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
              <div className="relative">
                <Users className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <input
                  type="number"
                  value={numberOfPeople}
                  onChange={(e) => setNumberOfPeople(Math.max(1, parseInt(e.target.value) || 1))}
                  min="1"
                  className="w-full pl-10 pr-4 py-3 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Advanced Options */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Currency</label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  {Object.entries(currencies).map(([code, { name }]) => (
                    <option key={code} value={code}>
                      {code} - {name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-medium text-muted-foreground">Rounding</label>
                <select
                  value={roundingMode}
                  onChange={(e) => setRoundingMode(e.target.value as "none" | "up" | "down")}
                  className="w-full px-3 py-2 rounded-lg border bg-background focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
                >
                  <option value="none">No Rounding</option>
                  <option value="up">Round Up</option>
                  <option value="down">Round Down</option>
                </select>
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
                      {currencies[currency as keyof typeof currencies].symbol}
                      {tipAmount.toFixed(2)}
                    </p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-sm text-muted-foreground">Total Amount</p>
                    <p className="text-2xl font-bold">
                      {currencies[currency as keyof typeof currencies].symbol}
                      {finalTotal.toFixed(2)}
                    </p>
                  </div>
                </div>

                <div className="bg-primary/10 rounded-lg p-4 space-y-2">
                  <p className="text-lg font-semibold">Per Person</p>
                  <div className="flex justify-between items-center">
                    <span>Amount</span>
                    <span className="font-bold">
                      {currencies[currency as keyof typeof currencies].symbol}
                      {finalPerPerson.toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Tip</span>
                    <span className="font-bold">
                      {currencies[currency as keyof typeof currencies].symbol}
                      {tipPerPerson.toFixed(2)}
                    </span>
                  </div>
                </div>

                {numberOfPeople > 1 && (
                  <p className="text-center text-sm text-muted-foreground">
                    You saved {currencies[currency as keyof typeof currencies].symbol}
                    {(finalTotal - finalPerPerson).toFixed(2)} by splitting!
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
    </div>
  )
}