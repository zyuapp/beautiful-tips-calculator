"use client"

import { useState, useRef, useCallback } from "react"
import { motion } from "framer-motion"
import { Camera, Upload, X, CheckCircle, AlertCircle, Loader2 } from "lucide-react"
import Tesseract from "tesseract.js"
import NextImage from "next/image"

interface ReceiptScannerProps {
  onAmountExtracted: (amount: number) => void
  onClose: () => void
}

interface ExtractedData {
  amount: number
  confidence: number
  allAmounts: Array<{ value: number; context: string }>
  rawText: string
}

export default function ReceiptScanner({ onAmountExtracted, onClose }: ReceiptScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  // Pattern matching for common receipt formats
  const extractAmounts = useCallback((text: string): ExtractedData => {
    const lines = text.split('\n')
    const amounts: Array<{ value: number; context: string }> = []
    
    // Patterns that indicate NOT the final total
    const excludePatterns = [
      /SUB\s*TOTAL/i,
      /SUBTOTAL/i,
      /SUB-TOTAL/i,
      /BEFORE\s*TAX/i,
      /FOOD\s*TOTAL/i,
      /MERCHANDISE/i,
      /ITEMS?\s*TOTAL/i,
    ]
    
    // Common patterns for total amounts (ordered by priority) - supporting European formats
    const totalPatterns = [
      // Highest priority - very specific total patterns
      /(?:GRAND\s*TOTAL|AMOUNT\s*DUE|BALANCE\s*DUE|PLEASE\s*PAY)[:\s]+[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
      /TOTAL\s*(?:DUE|AMOUNT|CHARGE)[:\s]+[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
      
      // Medium priority - generic total but not subtotal
      /^TOTAL[:\s]+[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/im,
      /(?<!SUB)TOTAL[:\s]+[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
      
      // Lower priority - other payment indicators
      /TO\s*PAY[:\s]+[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
      /CHARGE[:\s]+[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i,
      /[$€£¥₹₽]\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*(?:TOTAL|DUE)$/i,
    ]

    // Enhanced amount pattern supporting European formats and more currencies
    const amountPattern = /[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})|(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})\s*[$€£¥₹₽]/g

    // Extract all amounts with context
    lines.forEach((line, index) => {
      // Skip lines that match exclude patterns
      const shouldExclude = excludePatterns.some(pattern => line.match(pattern))
      
      const matches = line.matchAll(amountPattern)
      for (const match of matches) {
        const valueStr = match[1] || match[2]
        
        // Handle European decimal format (1.234,56 -> 1234.56)
        let value: number
        if (valueStr.includes(',') && valueStr.includes('.')) {
          // Format like 1.234,56
          const normalized = valueStr.replace(/\./g, '').replace(',', '.')
          value = parseFloat(normalized)
        } else if (valueStr.includes(',') && !valueStr.includes('.')) {
          // Format like 123,45 - check if it's decimal or thousands separator
          const parts = valueStr.split(',')
          if (parts[parts.length - 1].length === 2) {
            // Last part is 2 digits, treat comma as decimal
            value = parseFloat(valueStr.replace(',', '.'))
          } else {
            // Treat as thousands separator
            value = parseFloat(valueStr.replace(/,/g, ''))
          }
        } else {
          value = parseFloat(valueStr.replace(/,/g, ''))
        }
        
        if (!isNaN(value) && value > 0 && value < 10000) {
          const context = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2)).join(' ')
          // Mark if this amount should be excluded
          amounts.push({ 
            value, 
            context: shouldExclude ? `[EXCLUDED] ${context}` : context 
          })
        }
      }
    })

    // Try to find total using patterns
    let totalAmount = 0
    let confidence = 0

    for (const pattern of totalPatterns) {
      const match = text.match(pattern)
      if (match) {
        const valueStr = match[1]
        
        // Handle European decimal format for pattern matches too
        let matchedValue: number
        if (valueStr.includes(',') && valueStr.includes('.')) {
          // Format like 1.234,56
          const normalized = valueStr.replace(/\./g, '').replace(',', '.')
          matchedValue = parseFloat(normalized)
        } else if (valueStr.includes(',') && !valueStr.includes('.')) {
          // Format like 123,45 - check if it's decimal or thousands separator
          const parts = valueStr.split(',')
          if (parts[parts.length - 1].length === 2) {
            // Last part is 2 digits, treat comma as decimal
            matchedValue = parseFloat(valueStr.replace(',', '.'))
          } else {
            // Treat as thousands separator
            matchedValue = parseFloat(valueStr.replace(/,/g, ''))
          }
        } else {
          matchedValue = parseFloat(valueStr.replace(/,/g, ''))
        }
        
        // Verify this is likely the total by checking if it's one of the larger amounts
        const sortedAmounts = [...amounts].sort((a, b) => b.value - a.value)
        const isAmongLargest = sortedAmounts.slice(0, 3).some(a => Math.abs(a.value - matchedValue) < 0.01)
        
        if (isAmongLargest) {
          totalAmount = matchedValue
          confidence = 0.95 // Very high confidence
          break
        }
      }
    }

    // If no pattern matched, use advanced heuristics
    if (totalAmount === 0 && amounts.length > 0) {
      // Filter out excluded amounts
      const validAmounts = amounts.filter(a => !a.context.includes('[EXCLUDED]'))
      
      if (validAmounts.length > 0) {
        // Sort amounts by value
        const sortedAmounts = [...validAmounts].sort((a, b) => b.value - a.value)
        
        // Look for tax pattern to help identify total
        const taxPattern = /(?:TAX|HST|GST|PST|VAT)[:\s]+[$€£¥₹₽]?\s*(\d{1,3}(?:[.,]\d{3})*[.,]\d{2})/i
        const taxMatch = text.match(taxPattern)
        let taxAmount = 0
        if (taxMatch) {
          const taxStr = taxMatch[1]
          // Handle European decimal format for tax too
          if (taxStr.includes(',') && taxStr.includes('.')) {
            const normalized = taxStr.replace(/\./g, '').replace(',', '.')
            taxAmount = parseFloat(normalized)
          } else if (taxStr.includes(',') && !taxStr.includes('.')) {
            const parts = taxStr.split(',')
            if (parts[parts.length - 1].length === 2) {
              taxAmount = parseFloat(taxStr.replace(',', '.'))
            } else {
              taxAmount = parseFloat(taxStr.replace(/,/g, ''))
            }
          } else {
            taxAmount = parseFloat(taxStr.replace(/,/g, ''))
          }
        }
        
        // If we found tax, look for an amount that's larger than subtotal + tax
        if (taxAmount > 0) {
          const possibleTotal = sortedAmounts.find(a => {
            // Check if this could be subtotal + tax (within 10 cents tolerance)
            const subtotalCandidates = sortedAmounts.filter(s => s.value < a.value)
            return subtotalCandidates.some(sub => 
              Math.abs((sub.value + taxAmount) - a.value) < 0.10
            )
          })
          
          if (possibleTotal) {
            totalAmount = possibleTotal.value
            confidence = 0.85
          }
        }
        
        // If still no total, use position-based heuristics
        if (totalAmount === 0) {
          // Find the largest amount in the bottom 40% of the receipt
          const bottomAmounts = validAmounts.slice(Math.floor(validAmounts.length * 0.6))
          if (bottomAmounts.length > 0) {
            const largestInBottom = bottomAmounts.sort((a, b) => b.value - a.value)[0]
            totalAmount = largestInBottom.value
            confidence = 0.7
          } else {
            // Last resort: largest valid amount
            totalAmount = sortedAmounts[0].value
            confidence = 0.5
          }
        }
      } else {
        // All amounts were excluded, use largest anyway with low confidence
        const sortedAll = [...amounts].sort((a, b) => b.value - a.value)
        totalAmount = sortedAll[0]?.value || 0
        confidence = 0.3
      }
    }

    return {
      amount: totalAmount,
      confidence,
      allAmounts: amounts.filter(a => !a.context.includes('[EXCLUDED]')),
      rawText: text
    }
  }, [])

  // Image preprocessing with adaptive thresholds
  const preprocessImage = useCallback((img: HTMLImageElement, mode: 'normal' | 'high-contrast' | 'low-contrast' = 'normal'): string => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    
    // Set canvas size
    const maxWidth = 1000
    const scale = img.width > maxWidth ? maxWidth / img.width : 1
    canvas.width = img.width * scale
    canvas.height = img.height * scale
    
    // Draw image
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    
    // Apply filters
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const data = imageData.data
    
    // Calculate average brightness
    let brightnessSum = 0
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      brightnessSum += gray
    }
    const avgBrightness = brightnessSum / (data.length / 4)
    
    // Adaptive threshold and contrast based on mode and brightness
    let factor: number
    let threshold: number
    
    switch (mode) {
      case 'high-contrast':
        factor = avgBrightness < 100 ? 2.5 : avgBrightness > 180 ? 1.8 : 2.0
        threshold = avgBrightness < 80 ? 90 : avgBrightness > 200 ? 150 : 120
        break
      case 'low-contrast':
        factor = avgBrightness < 100 ? 1.2 : avgBrightness > 180 ? 0.8 : 1.0
        threshold = avgBrightness < 80 ? 110 : avgBrightness > 200 ? 130 : 135
        break
      default: // normal
        factor = avgBrightness < 100 ? 2.0 : avgBrightness > 180 ? 1.2 : 1.5
        threshold = avgBrightness < 80 ? 100 : avgBrightness > 200 ? 140 : 128
    }
    
    // Apply enhanced processing
    for (let i = 0; i < data.length; i += 4) {
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      const contrasted = gray * factor + (128 * (1 - factor))
      const final = contrasted > threshold ? 255 : contrasted < 50 ? 0 : contrasted
      
      data[i] = final
      data[i + 1] = final
      data[i + 2] = final
    }
    
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL()
  }, [])

  // Helper function to try OCR with different processing modes
  const tryOCR = useCallback(async (img: HTMLImageElement, mode: 'normal' | 'high-contrast' | 'low-contrast'): Promise<ExtractedData> => {
    const processedUrl = preprocessImage(img, mode)
    
    const result = await Tesseract.recognize(processedUrl, 'eng', {
      logger: (m) => {
        if (m.status === 'recognizing text') {
          setProgress(Math.round(m.progress * 100))
        }
      },
    })
    
    return extractAmounts(result.data.text)
  }, [preprocessImage, extractAmounts])

  const processImage = useCallback(async (file: File) => {
    setIsProcessing(true)
    setError(null)
    setProgress(0)

    try {
      // Create image preview
      const reader = new FileReader()
      reader.onload = (e) => {
        setImagePreview(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Load image
      const img = new Image()
      const imageUrl = URL.createObjectURL(file)
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageUrl
      })

      // Try normal processing first
      let result = await tryOCR(img, 'normal')
      
      if (result.confidence < 0.3 && result.amount === 0) {
        setProgress(50) // Show we're trying again
        
        // Try with higher contrast for dark images
        result = await tryOCR(img, 'high-contrast')
        
        if (result.confidence < 0.3 && result.amount === 0) {
          setProgress(75)
          // Try with lower contrast for bright images  
          result = await tryOCR(img, 'low-contrast')
        }
      }

      setExtractedData(result)

      // Set better error messages if no amount found
      if (result.amount === 0) {
        const { allAmounts, rawText } = result
        if (rawText.length < 10) {
          setError("Couldn't read text from image. Try better lighting or hold phone steadier.")
        } else if (allAmounts.length === 0) {
          setError("Found text but no amounts. Make sure the total is visible and try again.")
        } else if (allAmounts.length === 1) {
          setError(`Found $${allAmounts[0].value.toFixed(2)} but unsure if it's the total. Click to use it anyway.`)
        } else {
          setError(`Found ${allAmounts.length} amounts. Click one below or try a clearer image.`)
        }
      }

      // Clean up
      URL.revokeObjectURL(imageUrl)
    } catch (err) {
      console.error('OCR Error:', err)
      setError('Could not process image. Try a different photo.')
    } finally {
      setIsProcessing(false)
    }
  }, [tryOCR])

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      processImage(file)
    }
  }

  const confirmAmount = (amount: number) => {
    onAmountExtracted(amount)
    onClose()
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-card rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Scan Receipt</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-accent transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!imagePreview && !isProcessing && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-center">
                Take a photo or upload an image of your receipt
              </p>
              
              {/* Privacy Notice */}
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <p className="font-medium">100% Private & Secure</p>
                    <p className="text-xs mt-1 opacity-90">
                      All processing happens in your browser. No images are uploaded to any server.
                    </p>
                  </div>
                </div>
              </div>
              
              {/* Camera and Upload buttons */}
              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => cameraInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed hover:border-primary hover:bg-accent/50 transition-all"
                >
                  <Camera className="h-10 w-10 text-primary" />
                  <span className="font-medium">Take Photo</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => fileInputRef.current?.click()}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-dashed hover:border-primary hover:bg-accent/50 transition-all"
                >
                  <Upload className="h-10 w-10 text-primary" />
                  <span className="font-medium">Upload Image</span>
                </motion.button>
              </div>

              {/* Hidden inputs */}
              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
            </div>
          )}

          {/* Processing state */}
          {isProcessing && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
                <p className="text-lg font-medium">Processing receipt...</p>
                <div className="w-full max-w-xs">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Extracting text</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
              {imagePreview && (
                <div className="relative w-full h-64">
                  <NextImage
                    src={imagePreview}
                    alt="Receipt preview"
                    fill
                    className="object-contain rounded-lg opacity-50"
                  />
                </div>
              )}
            </div>
          )}

          {/* Results */}
          {extractedData && !isProcessing && (
            <div className="space-y-6">
              {imagePreview && (
                <div className="relative w-full h-96">
                  <NextImage
                    src={imagePreview}
                    alt="Receipt preview"
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-semibold">Extracted Amount</h3>
                  {extractedData.confidence > 0.7 ? (
                    <CheckCircle className="h-5 w-5 text-green-500" />
                  ) : (
                    <AlertCircle className="h-5 w-5 text-yellow-500" />
                  )}
                </div>

                {extractedData.amount > 0 ? (
                  <div className="space-y-4">
                    <div className="bg-primary/10 rounded-lg p-4">
                      <p className="text-sm text-muted-foreground mb-1">
                        Detected Total (
                        {Math.round(extractedData.confidence * 100)}% confidence)
                      </p>
                      <p className="text-3xl font-bold">
                        ${extractedData.amount.toFixed(2)}
                      </p>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => confirmAmount(extractedData.amount)}
                      className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                      Use This Amount
                    </motion.button>

                    {/* Show other detected amounts */}
                    {extractedData.allAmounts.length > 1 && (
                      <div className="mt-4">
                        <p className="text-sm font-medium text-muted-foreground mb-2">
                          Other amounts found:
                        </p>
                        <div className="grid grid-cols-4 gap-2">
                          {extractedData.allAmounts
                            .filter(a => a.value !== extractedData.amount)
                            .slice(0, 8)
                            .map((amount, index) => (
                              <button
                                key={index}
                                onClick={() => confirmAmount(amount.value)}
                                className="p-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-center"
                                title={amount.context}
                              >
                                ${amount.value.toFixed(2)}
                              </button>
                            ))}
                        </div>
                        <button
                          onClick={() => {
                            const manual = prompt('Enter amount manually:')
                            const amount = parseFloat(manual || '0')
                            if (amount > 0) confirmAmount(amount)
                          }}
                          className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                        >
                          Enter amount manually
                        </button>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto" />
                    <p className="text-muted-foreground">
                      Could not detect a total amount. Please try again with a clearer image.
                    </p>
                  </div>
                )}

                <button
                  onClick={() => {
                    setExtractedData(null)
                    setImagePreview(null)
                    setError(null)
                  }}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Try Another Image
                </button>
              </div>
            </div>
          )}

          {/* Error state */}
          {error && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-destructive">{error}</p>
              
              {/* Show clickable amounts if available */}
              {extractedData && extractedData.allAmounts.length > 0 && (
                <div className="mt-4">
                  <p className="text-sm font-medium text-muted-foreground mb-2">
                    {extractedData.allAmounts.length === 1 ? "Use this amount:" : "Other amounts found:"}
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {extractedData.allAmounts
                      .slice(0, 8)
                      .map((amount, index) => (
                        <button
                          key={index}
                          onClick={() => confirmAmount(amount.value)}
                          className="p-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-center"
                          title={amount.context}
                        >
                          ${amount.value.toFixed(2)}
                        </button>
                      ))}
                  </div>
                  <button
                    onClick={() => {
                      const manual = prompt('Enter amount manually:')
                      const amount = parseFloat(manual || '0')
                      if (amount > 0) confirmAmount(amount)
                    }}
                    className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Enter amount manually
                  </button>
                </div>
              )}
              
              <button
                onClick={() => {
                  setError(null)
                  setImagePreview(null)
                  setExtractedData(null)
                }}
                className="text-sm underline"
              >
                Try Again
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}