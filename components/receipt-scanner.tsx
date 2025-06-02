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
  const extractAmounts = (text: string): ExtractedData => {
    const lines = text.split('\n')
    const amounts: Array<{ value: number; context: string }> = []
    
    // Common patterns for total amounts
    const totalPatterns = [
      /TOTAL[:\s]+[$€£¥]?\s*(\d+[.,]\d{2})/i,
      /AMOUNT DUE[:\s]+[$€£¥]?\s*(\d+[.,]\d{2})/i,
      /BALANCE[:\s]+[$€£¥]?\s*(\d+[.,]\d{2})/i,
      /GRAND TOTAL[:\s]+[$€£¥]?\s*(\d+[.,]\d{2})/i,
      /TO PAY[:\s]+[$€£¥]?\s*(\d+[.,]\d{2})/i,
      /[$€£¥]\s*(\d+[.,]\d{2})\s*(?:TOTAL|DUE)/i,
    ]

    // General amount pattern
    const amountPattern = /[$€£¥]?\s*(\d+[.,]\d{2})/g

    // Extract all amounts with context
    lines.forEach((line, index) => {
      const matches = line.matchAll(amountPattern)
      for (const match of matches) {
        const value = parseFloat(match[1].replace(',', '.'))
        if (!isNaN(value) && value > 0) {
          const context = lines.slice(Math.max(0, index - 1), Math.min(lines.length, index + 2)).join(' ')
          amounts.push({ value, context })
        }
      }
    })

    // Try to find total using patterns
    let totalAmount = 0
    let confidence = 0

    for (const pattern of totalPatterns) {
      const match = text.match(pattern)
      if (match) {
        totalAmount = parseFloat(match[1].replace(',', '.'))
        confidence = 0.9 // High confidence if pattern matched
        break
      }
    }

    // If no pattern matched, use heuristics
    if (totalAmount === 0 && amounts.length > 0) {
      // Sort amounts by value
      const sortedAmounts = [...amounts].sort((a, b) => b.value - a.value)
      
      // Check if the largest amount appears near the end of the receipt
      const largestAmount = sortedAmounts[0]
      const largestIndex = amounts.findIndex(a => a.value === largestAmount.value)
      
      if (largestIndex > amounts.length * 0.6) {
        // Largest amount is in the bottom 40% of the receipt
        totalAmount = largestAmount.value
        confidence = 0.7
      } else {
        // Look for amounts near keywords
        const keywordAmount = amounts.find(a => 
          a.context.match(/total|due|balance|pay|amount/i)
        )
        if (keywordAmount) {
          totalAmount = keywordAmount.value
          confidence = 0.6
        } else {
          // Fallback to largest amount
          totalAmount = largestAmount.value
          confidence = 0.4
        }
      }
    }

    return {
      amount: totalAmount,
      confidence,
      allAmounts: amounts,
      rawText: text
    }
  }

  // Image preprocessing
  const preprocessImage = (img: HTMLImageElement): string => {
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
    
    // Convert to grayscale and increase contrast
    for (let i = 0; i < data.length; i += 4) {
      // Grayscale
      const gray = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114
      
      // Increase contrast
      const factor = 1.5
      const intercept = 128 * (1 - factor)
      const contrastedGray = gray * factor + intercept
      
      // Apply threshold for better OCR
      const threshold = contrastedGray > 128 ? 255 : contrastedGray < 50 ? 0 : contrastedGray
      
      data[i] = threshold
      data[i + 1] = threshold
      data[i + 2] = threshold
    }
    
    ctx.putImageData(imageData, 0, 0)
    return canvas.toDataURL()
  }

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

      // Load and preprocess image
      const img = new Image()
      const imageUrl = URL.createObjectURL(file)
      
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = imageUrl
      })

      const processedImageUrl = preprocessImage(img)

      // Perform OCR
      const result = await Tesseract.recognize(processedImageUrl, 'eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            setProgress(Math.round(m.progress * 100))
          }
        },
      })

      // Extract amounts from text
      const extractedData = extractAmounts(result.data.text)
      setExtractedData(extractedData)

      // Clean up
      URL.revokeObjectURL(imageUrl)
    } catch (err) {
      console.error('OCR Error:', err)
      setError('Failed to process receipt. Please try again with a clearer image.')
    } finally {
      setIsProcessing(false)
    }
  }, [])

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
                      <div className="space-y-2">
                        <p className="text-sm font-medium text-muted-foreground">
                          Other amounts found:
                        </p>
                        <div className="grid grid-cols-3 gap-2">
                          {extractedData.allAmounts
                            .filter(a => a.value !== extractedData.amount)
                            .slice(0, 6)
                            .map((amount, index) => (
                              <button
                                key={index}
                                onClick={() => confirmAmount(amount.value)}
                                className="p-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors"
                              >
                                ${amount.value.toFixed(2)}
                              </button>
                            ))}
                        </div>
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
              <button
                onClick={() => {
                  setError(null)
                  setImagePreview(null)
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