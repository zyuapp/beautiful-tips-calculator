"use client"

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
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

const AmountChoices = memo(({
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
      <p className="mb-2 text-sm font-semibold text-muted-foreground">{title}</p>
      <div className="grid grid-cols-4 gap-2">
        {amounts.map((amount, index) => (
          <button
            key={`${amount.value}-${amount.lineIndex}-${index}`}
            onClick={() => onAmountSelect(amount.value)}
            className="rounded-md border border-border bg-background p-2 text-center text-sm font-semibold font-mono tabular-nums transition-colors hover:bg-secondary"
            title={amount.context}
            type="button"
          >
            ${amount.value.toFixed(2)}
          </button>
        ))}
      </div>
      <button
        onClick={onManualEntry}
        className="mt-2 w-full rounded-md border border-border bg-secondary py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
        type="button"
      >
        Enter amount manually
      </button>
    </div>
  )
})

AmountChoices.displayName = "AmountChoices"

export default function ReceiptScanner({ onAmountExtracted, onClose }: ReceiptScannerProps) {
  const [isProcessing, setIsProcessing] = useState(false)
  const [extractedData, setExtractedData] = useState<ExtractedData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)
  const requestIdRef = useRef(0)

  useEffect(() => {
    return () => {
      requestIdRef.current += 1
    }
  }, [])

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

  const openCameraInput = useCallback(() => {
    cameraInputRef.current?.click()
  }, [])

  const openFileInput = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const suggestedAmounts = useMemo(() => {
    if (!extractedData) {
      return []
    }

    return extractedData.allAmounts.slice(0, 8)
  }, [extractedData])

  const alternativeAmounts = useMemo(() => {
    if (!extractedData) {
      return []
    }

    return extractedData.allAmounts
      .filter((amount) => amount.value !== extractedData.amount)
      .slice(0, 8)
  }, [extractedData])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="max-h-[90vh] w-full max-w-2xl overflow-hidden rounded-lg border border-border bg-card shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onPaste={handlePaste}
      >
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-xl font-semibold tracking-tight">Scan Receipt</h2>
          <button
            onClick={onClose}
            className="rounded-md border border-border p-2 transition-colors hover:bg-secondary"
            type="button"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="max-h-[calc(90vh-80px)] space-y-6 overflow-y-auto p-5 sm:p-6">
          {!imagePreview && !isProcessing ? (
            <div className="space-y-4">
              <p className="text-muted-foreground text-center">
                Take a photo or upload an image of your receipt
              </p>

              <div className="rounded-md border border-border bg-secondary p-3">
                <div className="flex items-start gap-2">
                  <svg
                    className="mt-0.5 h-5 w-5 flex-shrink-0 text-foreground"
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
                  <div className="text-sm text-foreground">
                    <p className="font-medium">100% Private & Secure</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      All processing happens in your browser. No images are uploaded to any server.
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <motion.button
                  onClick={openCameraInput}
                  className="flex flex-col items-center gap-3 rounded-md border border-border bg-background p-6 transition-colors hover:bg-secondary"
                  type="button"
                >
                  <Camera className="h-10 w-10 text-foreground" />
                  <span className="font-semibold">Take Photo</span>
                </motion.button>

                <motion.button
                  onClick={openFileInput}
                  className="flex flex-col items-center gap-3 rounded-md border border-border bg-background p-6 transition-colors hover:bg-secondary"
                  type="button"
                >
                  <Upload className="h-10 w-10 text-foreground" />
                  <span className="font-semibold">Upload Image</span>
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
          ) : null}

          {isProcessing ? (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-lg font-semibold">Processing receipt...</p>
                <div className="w-full max-w-xs">
                  <div className="flex justify-between text-sm text-muted-foreground mb-1">
                    <span>Extracting text</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <motion.div
                      className="h-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                </div>
              </div>
              {imagePreview ? (
                <div className="relative w-full h-64">
                  <NextImage
                    src={imagePreview}
                    alt="Receipt preview"
                    fill
                    className="rounded-md border border-border object-contain opacity-50"
                  />
                </div>
              ) : null}
            </div>
          ) : null}

          {extractedData && !isProcessing ? (
            <div className="space-y-6">
              {imagePreview ? (
                <div className="relative w-full h-96">
                  <NextImage
                    src={imagePreview}
                    alt="Receipt preview"
                    fill
                    className="object-contain rounded-lg"
                  />
                </div>
              ) : null}

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
                    <div className="rounded-md border border-border bg-secondary p-4">
                      <p className="text-sm text-muted-foreground mb-1">
                        Detected Total ({Math.round(extractedData.confidence * 100)}% confidence)
                      </p>
                      <p className="font-mono text-3xl font-semibold tabular-nums">${extractedData.amount.toFixed(2)}</p>
                    </div>

                    <motion.button
                      onClick={() => confirmAmount(extractedData.amount)}
                      className="w-full rounded-md border border-primary bg-primary py-3 font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
                      type="button"
                    >
                      Use This Amount
                    </motion.button>

                    {alternativeAmounts.length > 0 ? (
                      <AmountChoices
                        title="Other amounts found:"
                        amounts={alternativeAmounts}
                        onAmountSelect={confirmAmount}
                        onManualEntry={handleManualAmountEntry}
                      />
                    ) : null}
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
                  className="w-full rounded-md border border-border bg-background py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                  type="button"
                >
                  Try Another Image
                </button>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="text-center space-y-4">
              <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
              <p className="text-destructive">{error}</p>

              {extractedData && suggestedAmounts.length > 0 ? (
                <AmountChoices
                  title={suggestedAmounts.length === 1 ? "Use this amount:" : "Other amounts found:"}
                  amounts={suggestedAmounts}
                  onAmountSelect={confirmAmount}
                  onManualEntry={handleManualAmountEntry}
                />
              ) : null}

              <button
                onClick={resetScanState}
                className="rounded-md border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-secondary"
                type="button"
              >
                Try Again
              </button>
            </div>
          ) : null}
        </div>
      </motion.div>
    </motion.div>
  )
}
