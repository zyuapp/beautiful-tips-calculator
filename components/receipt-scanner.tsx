"use client"

import { useCallback, useRef, useState } from "react"
import { motion } from "framer-motion"
import { AlertCircle, Camera, CheckCircle, Loader2, Upload, X } from "lucide-react"
import NextImage from "next/image"

import {
  getNoAmountErrorMessage,
  scanReceiptImage,
  type ExtractedData,
  type ReceiptAmountOption,
} from "@/lib/receipt-ocr"

interface ReceiptScannerProps {
  onAmountExtracted: (amount: number) => void
  onClose: () => void
}

interface AmountChoicesProps {
  title: string
  amounts: ReceiptAmountOption[]
  onAmountSelect: (amount: number) => void
  onManualEntry: () => void
}

const AmountChoices = ({
  title,
  amounts,
  onAmountSelect,
  onManualEntry,
}: AmountChoicesProps) => {
  if (amounts.length === 0) {
    return null
  }

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-muted-foreground mb-2">{title}</p>
      <div className="grid grid-cols-4 gap-2">
        {amounts.map((amount, index) => (
          <button
            key={`${amount.value}-${amount.lineIndex}-${index}`}
            onClick={() => onAmountSelect(amount.value)}
            className="p-2 text-sm rounded-lg bg-secondary hover:bg-secondary/80 transition-colors text-center"
            title={amount.context}
          >
            ${amount.value.toFixed(2)}
          </button>
        ))}
      </div>
      <button
        onClick={onManualEntry}
        className="w-full mt-2 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        Enter amount manually
      </button>
    </div>
  )
}

export default function ReceiptScanner({ onAmountExtracted, onClose }: ReceiptScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)

  const resetScanState = useCallback(() => {
    setExtractedData(null)
    setImagePreview(null)
    setError(null)
    setProgress(0)
  }, [])

  const confirmAmount = useCallback(
    (amount: number) => {
      onAmountExtracted(amount)
      onClose()
    },
    [onAmountExtracted, onClose]
  )

  const handleManualAmountEntry = useCallback(() => {
    const manualValue = prompt("Enter amount manually:")
    const manualAmount = Number.parseFloat(manualValue || "0")
    if (manualAmount > 0) {
      confirmAmount(manualAmount)
    }
  }, [confirmAmount])

  const processImage = useCallback(async (file: File) => {
    const requestId = ++requestIdRef.current
    let imageUrl: string | null = null

    setIsProcessing(true)
    setError(null)
    setProgress(0)

    const reader = new FileReader()
    reader.onload = (event) => {
      if (requestId !== requestIdRef.current) {
        return
      }

      const { result } = event.target || {}
      if (typeof result === "string") {
        setImagePreview(result)
      }
    }
    reader.readAsDataURL(file)

    try {
      const img = new Image()
      const localImageUrl = URL.createObjectURL(file)
      imageUrl = localImageUrl

      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve()
        img.onerror = () => reject(new Error("Could not load image"))
        img.src = localImageUrl
      })

      const result = await scanReceiptImage(img, {
        shouldContinue: () => requestId === requestIdRef.current,
        onProgress: (nextProgress) => {
          if (requestId !== requestIdRef.current) {
            return
          }

          setProgress(nextProgress)
        },
      })

      if (!result || requestId !== requestIdRef.current) {
        return
      }

      setExtractedData(result)
      setProgress(100)

      const errorMessage = getNoAmountErrorMessage(result)
      if (errorMessage) {
        setError(errorMessage)
      }
    } catch (scanError) {
      console.error("OCR Error:", scanError)
      if (requestId === requestIdRef.current) {
        setError("Could not process image. Try a different photo.")
      }
    } finally {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl)
      }

      if (requestId === requestIdRef.current) {
        setIsProcessing(false)
      }
    }
  }, [])

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      processImage(file)
      event.target.value = ""
    },
    [processImage]
  )

  const handlePaste = useCallback(
    (event: React.ClipboardEvent) => {
      const items = event.clipboardData?.items
      if (!items) {
        return
      }

      for (const item of items) {
        if (!item.type.startsWith("image/")) {
          continue
        }

        const imageFile = item.getAsFile()
        if (imageFile) {
          processImage(imageFile)
        }

        return
      }
    },
    [processImage]
  )

  const alternativeAmounts =
    extractedData?.allAmounts
      .filter((amount) => amount.value !== extractedData.amount)
      .slice(0, 8) || []

  const suggestedAmounts = extractedData?.allAmounts.slice(0, 8) || []

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
        onClick={(event) => event.stopPropagation()}
        onPaste={handlePaste}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-2xl font-bold">Scan Receipt</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-accent transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto max-h-[calc(90vh-80px)]">
          {!imagePreview && !isProcessing && (
            <div className="space-y-4">
              <p className="text-muted-foreground text-center">
                Take a photo or upload an image of your receipt
              </p>

              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <svg
                    className="h-5 w-5 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                  <div className="text-sm text-green-700 dark:text-green-300">
                    <p className="font-medium">100% Private & Secure</p>
                    <p className="text-xs mt-1 opacity-90">
                      All processing happens in your browser. No images are uploaded to any server.
                    </p>
                  </div>
                </div>
              </div>

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

              <p className="text-sm text-muted-foreground text-center">
                or press ⌘V / Ctrl+V to paste an image
              </p>

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
                        Detected Total ({Math.round(extractedData.confidence * 100)}% confidence)
                      </p>
                      <p className="text-3xl font-bold">${extractedData.amount.toFixed(2)}</p>
                    </div>

                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => confirmAmount(extractedData.amount)}
                      className="w-full py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
                    >
                      Use This Amount
                    </motion.button>

                    {alternativeAmounts.length > 0 && (
                      <AmountChoices
                        title="Other amounts found:"
                        amounts={alternativeAmounts}
                        onAmountSelect={confirmAmount}
                        onManualEntry={handleManualAmountEntry}
                      />
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
                  onClick={resetScanState}
                  className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
                >
                  Try Another Image
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-destructive">{error}</p>

              {extractedData && suggestedAmounts.length > 0 && (
                <AmountChoices
                  title={suggestedAmounts.length === 1 ? "Use this amount:" : "Other amounts found:"}
                  amounts={suggestedAmounts}
                  onAmountSelect={confirmAmount}
                  onManualEntry={handleManualAmountEntry}
                />
              )}

              <button onClick={resetScanState} className="text-sm underline">
                Try Again
              </button>
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  )
}
