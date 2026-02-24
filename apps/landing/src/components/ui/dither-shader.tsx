'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@mdplane/ui/lib/utils'

type DitheringMode = 'bayer' | 'halftone' | 'noise' | 'crosshatch'
type ColorMode = 'original' | 'grayscale' | 'duotone' | 'custom'

interface DitherShaderProps {
  src?: string
  sourceCanvas?: HTMLCanvasElement | null
  gridSize?: number
  ditherMode?: DitheringMode
  colorMode?: ColorMode
  invert?: boolean
  pixelRatio?: number
  primaryColor?: string
  secondaryColor?: string
  customPalette?: string[]
  brightness?: number
  contrast?: number
  backgroundColor?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none'
  threshold?: number
  animated?: boolean
  animationSpeed?: number
  className?: string
}

const BAYER_MATRIX_4x4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
]

const BAYER_MATRIX_8x8 = [
  [0, 32, 8, 40, 2, 34, 10, 42],
  [48, 16, 56, 24, 50, 18, 58, 26],
  [12, 44, 4, 36, 14, 46, 6, 38],
  [60, 28, 52, 20, 62, 30, 54, 22],
  [3, 35, 11, 43, 1, 33, 9, 41],
  [51, 19, 59, 27, 49, 17, 57, 25],
  [15, 47, 7, 39, 13, 45, 5, 37],
  [63, 31, 55, 23, 61, 29, 53, 21],
]

function parseColor(color: string): [number, number, number] {
  if (color.startsWith('#')) {
    const hex = color.slice(1)
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
      ]
    }
    return [
      parseInt(hex.slice(0, 2), 16),
      parseInt(hex.slice(2, 4), 16),
      parseInt(hex.slice(4, 6), 16),
    ]
  }
  const match = color.match(/rgb\((\d+)\s*,\s*(\d+)\s*,\s*(\d+)\)/i)
  if (match) {
    return [parseInt(match[1], 10), parseInt(match[2], 10), parseInt(match[3], 10)]
  }
  return [0, 0, 0]
}

function getLuminance(r: number, g: number, b: number): number {
  return 0.299 * r + 0.587 * g + 0.114 * b
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function getElementDimensions(element: HTMLImageElement | HTMLCanvasElement) {
  if ('naturalWidth' in element) {
    return {
      width: element.naturalWidth,
      height: element.naturalHeight,
    }
  }

  return {
    width: element.width,
    height: element.height,
  }
}

function drawSourceToOffscreen(
  offscreenContext: CanvasRenderingContext2D,
  source: HTMLImageElement | HTMLCanvasElement,
  objectFit: 'cover' | 'contain' | 'fill' | 'none',
  displayWidth: number,
  displayHeight: number
) {
  const sourceSize = getElementDimensions(source)
  const sourceWidth = sourceSize.width || displayWidth
  const sourceHeight = sourceSize.height || displayHeight

  let drawWidth = displayWidth
  let drawHeight = displayHeight
  let drawX = 0
  let drawY = 0

  if (objectFit === 'cover') {
    const scale = Math.max(displayWidth / sourceWidth, displayHeight / sourceHeight)
    drawWidth = Math.ceil(sourceWidth * scale)
    drawHeight = Math.ceil(sourceHeight * scale)
    drawX = Math.floor((displayWidth - drawWidth) / 2)
    drawY = Math.floor((displayHeight - drawHeight) / 2)
  } else if (objectFit === 'contain') {
    const scale = Math.min(displayWidth / sourceWidth, displayHeight / sourceHeight)
    drawWidth = Math.ceil(sourceWidth * scale)
    drawHeight = Math.ceil(sourceHeight * scale)
    drawX = Math.floor((displayWidth - drawWidth) / 2)
    drawY = Math.floor((displayHeight - drawHeight) / 2)
  } else if (objectFit === 'fill') {
    drawWidth = displayWidth
    drawHeight = displayHeight
  } else {
    drawWidth = sourceWidth
    drawHeight = sourceHeight
    drawX = Math.floor((displayWidth - drawWidth) / 2)
    drawY = Math.floor((displayHeight - drawHeight) / 2)
  }

  offscreenContext.clearRect(0, 0, displayWidth, displayHeight)
  offscreenContext.drawImage(source, drawX, drawY, drawWidth, drawHeight)
}

const LIVE_SOURCE_FPS = 30

export function DitherShader({
  src,
  sourceCanvas,
  gridSize = 4,
  ditherMode = 'bayer',
  colorMode = 'original',
  invert = false,
  pixelRatio = 1,
  primaryColor = '#000000',
  secondaryColor = '#ffffff',
  customPalette = ['#000000', '#ffffff'],
  brightness = 0,
  contrast = 1,
  backgroundColor = 'transparent',
  objectFit = 'cover',
  threshold = 0.5,
  animated = false,
  animationSpeed = 0.02,
  className,
}: DitherShaderProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animationRef = useRef<number | null>(null)
  const timeRef = useRef(0)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const imageDataRef = useRef<ImageData | null>(null)
  const offscreenRef = useRef<HTMLCanvasElement | null>(null)
  const lastLiveFrameAtRef = useRef(0)

  const [dimensions, setDimensions] = useState({ width: 0, height: 0 })

  const parsedPrimaryColor = useMemo(() => parseColor(primaryColor), [primaryColor])
  const parsedSecondaryColor = useMemo(() => parseColor(secondaryColor), [secondaryColor])
  const parsedCustomPalette = useMemo(() => customPalette.map(parseColor), [customPalette])

  const applyDithering = useCallback(
    (
      ctx: CanvasRenderingContext2D,
      displayWidth: number,
      displayHeight: number,
      time = 0
    ) => {
      const imageData = imageDataRef.current
      if (!imageData) return

      if (backgroundColor !== 'transparent') {
        ctx.fillStyle = backgroundColor
        ctx.fillRect(0, 0, displayWidth, displayHeight)
      } else {
        ctx.clearRect(0, 0, displayWidth, displayHeight)
      }

      const sourceData = imageData.data
      const sourceWidth = imageData.width
      const sourceHeight = imageData.height

      const safeGridSize = Math.max(1, Math.floor(gridSize))
      const effectivePixelSize = Math.max(1, Math.floor(safeGridSize * pixelRatio))
      const matrixSize = safeGridSize <= 4 ? 4 : 8
      const bayerMatrix = safeGridSize <= 4 ? BAYER_MATRIX_4x4 : BAYER_MATRIX_8x8
      const matrixScale = matrixSize === 4 ? 16 : 64

      for (let y = 0; y < displayHeight; y += effectivePixelSize) {
        for (let x = 0; x < displayWidth; x += effectivePixelSize) {
          const srcX = Math.floor((x / displayWidth) * sourceWidth)
          const srcY = Math.floor((y / displayHeight) * sourceHeight)
          const srcIdx = (srcY * sourceWidth + srcX) * 4

          let r = sourceData[srcIdx] || 0
          let g = sourceData[srcIdx + 1] || 0
          let b = sourceData[srcIdx + 2] || 0
          const a = sourceData[srcIdx + 3] || 0

          if (a < 10) continue

          r = clamp((r - 128) * contrast + 128 + brightness * 255, 0, 255)
          g = clamp((g - 128) * contrast + 128 + brightness * 255, 0, 255)
          b = clamp((b - 128) * contrast + 128 + brightness * 255, 0, 255)

          const luminance = getLuminance(r, g, b) / 255

          let ditherThreshold: number
          const matrixX = Math.floor(x / safeGridSize) % matrixSize
          const matrixY = Math.floor(y / safeGridSize) % matrixSize

          switch (ditherMode) {
            case 'bayer':
              ditherThreshold = bayerMatrix[matrixY][matrixX] / matrixScale
              break
            case 'halftone': {
              const angle = Math.PI / 4
              const scale = safeGridSize * 2
              const rotX = x * Math.cos(angle) + y * Math.sin(angle)
              const rotY = -x * Math.sin(angle) + y * Math.cos(angle)
              const pattern = (Math.sin(rotX / scale) + Math.sin(rotY / scale) + 2) / 4
              ditherThreshold = pattern
              break
            }
            case 'noise': {
              const noiseValue =
                Math.sin(x * 12.9898 + y * 78.233 + time * 100) * 43758.5453
              ditherThreshold = noiseValue - Math.floor(noiseValue)
              break
            }
            case 'crosshatch': {
              const line1 = (x + y) % (safeGridSize * 2) < safeGridSize ? 1 : 0
              const line2 =
                (x - y + safeGridSize * 4) % (safeGridSize * 2) < safeGridSize ? 1 : 0
              ditherThreshold = (line1 + line2) / 2
              break
            }
            default:
              ditherThreshold = bayerMatrix[matrixY][matrixX] / matrixScale
          }

          ditherThreshold = ditherThreshold * (1 - threshold) + threshold * 0.5

          let outputColor: [number, number, number]

          switch (colorMode) {
            case 'grayscale': {
              const shouldBeDark = luminance < ditherThreshold
              outputColor = shouldBeDark ? [0, 0, 0] : [255, 255, 255]
              break
            }
            case 'duotone': {
              const shouldBeDark = luminance < ditherThreshold
              outputColor = shouldBeDark ? parsedPrimaryColor : parsedSecondaryColor
              break
            }
            case 'custom': {
              if (parsedCustomPalette.length === 2) {
                const shouldBeDark = luminance < ditherThreshold
                outputColor = shouldBeDark ? parsedCustomPalette[0] : parsedCustomPalette[1]
              } else {
                const adjustedLuminance = luminance + (ditherThreshold - 0.5) * 0.5
                const paletteIndex = Math.floor(
                  clamp(adjustedLuminance, 0, 1) * (parsedCustomPalette.length - 1)
                )
                outputColor = parsedCustomPalette[paletteIndex]
              }
              break
            }
            case 'original':
            default: {
              const ditherAmount = ditherThreshold - 0.5
              const adjustedR = clamp(r + ditherAmount * 64, 0, 255)
              const adjustedG = clamp(g + ditherAmount * 64, 0, 255)
              const adjustedB = clamp(b + ditherAmount * 64, 0, 255)
              const levels = 4
              outputColor = [
                Math.round(adjustedR / (255 / levels)) * (255 / levels),
                Math.round(adjustedG / (255 / levels)) * (255 / levels),
                Math.round(adjustedB / (255 / levels)) * (255 / levels),
              ]
            }
          }

          if (invert) {
            outputColor = [255 - outputColor[0], 255 - outputColor[1], 255 - outputColor[2]]
          }

          ctx.fillStyle = `rgb(${outputColor[0]}, ${outputColor[1]}, ${outputColor[2]})`
          ctx.fillRect(x, y, effectivePixelSize, effectivePixelSize)
        }
      }
    },
    [
      backgroundColor,
      brightness,
      colorMode,
      contrast,
      ditherMode,
      gridSize,
      invert,
      parsedCustomPalette,
      parsedPrimaryColor,
      parsedSecondaryColor,
      pixelRatio,
      threshold,
    ]
  )

  const updateImageData = useCallback(
    (source: HTMLImageElement | HTMLCanvasElement, displayWidth: number, displayHeight: number) => {
      let offscreen = offscreenRef.current
      if (!offscreen) {
        offscreen = document.createElement('canvas')
        offscreenRef.current = offscreen
      }

      offscreen.width = displayWidth
      offscreen.height = displayHeight

      const offscreenContext = offscreen.getContext('2d')
      if (!offscreenContext) return

      drawSourceToOffscreen(offscreenContext, source, objectFit, displayWidth, displayHeight)

      try {
        imageDataRef.current = offscreenContext.getImageData(0, 0, displayWidth, displayHeight)
      } catch {
        imageDataRef.current = null
      }
    },
    [objectFit]
  )

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        if (width > 0 && height > 0) {
          setDimensions({ width, height })
        }
      }
    })

    resizeObserver.observe(container)

    return () => {
      resizeObserver.disconnect()
    }
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || dimensions.width === 0 || dimensions.height === 0) return

    let isCancelled = false

    const dpr = typeof window !== 'undefined' ? window.devicePixelRatio || 1 : 1
    const displayWidth = dimensions.width
    const displayHeight = dimensions.height

    canvas.width = Math.floor(displayWidth * dpr)
    canvas.height = Math.floor(displayHeight * dpr)

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    const shouldAnimate = animated || sourceCanvas != null

    const renderFrame = (timestamp: number) => {
      if (isCancelled) return

      if (sourceCanvas) {
        const minIntervalMs = 1000 / LIVE_SOURCE_FPS
        if (timestamp - lastLiveFrameAtRef.current >= minIntervalMs) {
          updateImageData(sourceCanvas, displayWidth, displayHeight)
          timeRef.current += animationSpeed
          applyDithering(ctx, displayWidth, displayHeight, timeRef.current)
          lastLiveFrameAtRef.current = timestamp
        }
      } else {
        timeRef.current += animationSpeed
        applyDithering(ctx, displayWidth, displayHeight, timeRef.current)
      }

      animationRef.current = requestAnimationFrame(renderFrame)
    }

    if (sourceCanvas) {
      updateImageData(sourceCanvas, displayWidth, displayHeight)
      applyDithering(ctx, displayWidth, displayHeight, 0)

      animationRef.current = requestAnimationFrame(renderFrame)

      return () => {
        isCancelled = true
        if (animationRef.current !== null) {
          cancelAnimationFrame(animationRef.current)
        }
      }
    }

    if (!src) {
      imageDataRef.current = null
      return
    }

    const processImage = (image: HTMLImageElement) => {
      if (isCancelled) return

      updateImageData(image, displayWidth, displayHeight)
      applyDithering(ctx, displayWidth, displayHeight, 0)

      if (shouldAnimate) {
        animationRef.current = requestAnimationFrame(renderFrame)
      }
    }

    if (imageRef.current && imageRef.current.complete && imageRef.current.src === src) {
      processImage(imageRef.current)
    } else {
      const image = new Image()
      image.crossOrigin = 'anonymous'
      image.src = src
      image.onload = () => {
        if (isCancelled) return
        imageRef.current = image
        processImage(image)
      }
      image.onerror = () => {
        imageDataRef.current = null
      }
    }

    return () => {
      isCancelled = true
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [
    animated,
    animationSpeed,
    applyDithering,
    dimensions,
    sourceCanvas,
    src,
    updateImageData,
  ])

  return (
    <div ref={containerRef} className={cn('relative h-full w-full', className)}>
      <canvas
        ref={canvasRef}
        className='absolute inset-0 h-full w-full'
        style={{ imageRendering: 'pixelated' }}
        aria-label='Dithered image'
        role='img'
      />
    </div>
  )
}

export default DitherShader
