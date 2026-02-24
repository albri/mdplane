'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import * as THREE from 'three'

import { DitherShader } from '@/components/ui/dither-shader'

const vertexShader = `
varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

void main() {
  vUv = uv;
  vNormal = normalize(normalMatrix * normal);
  vec4 worldPosition = modelMatrix * vec4(position, 1.0);
  vWorldPosition = worldPosition.xyz;
  gl_Position = projectionMatrix * viewMatrix * worldPosition;
}
`

const fragmentShader = `
uniform float uTime;
uniform vec3 uBaseColor;
uniform vec3 uDarkColor;
uniform vec3 uLightColor;

varying vec3 vNormal;
varying vec3 vWorldPosition;
varying vec2 vUv;

float hash(vec3 p) {
  return fract(sin(dot(p, vec3(127.1, 311.7, 213.2))) * 43758.5453123);
}

float noise(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);

  float n000 = hash(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash(i + vec3(1.0, 1.0, 1.0));

  float nx00 = mix(n000, n100, f.x);
  float nx10 = mix(n010, n110, f.x);
  float nx01 = mix(n001, n101, f.x);
  float nx11 = mix(n011, n111, f.x);

  float nxy0 = mix(nx00, nx10, f.y);
  float nxy1 = mix(nx01, nx11, f.y);

  return mix(nxy0, nxy1, f.z);
}

float fbm(vec3 p) {
  float value = 0.0;
  float amplitude = 0.55;
  float frequency = 1.0;

  for (int i = 0; i < 5; i++) {
    value += amplitude * noise(p * frequency);
    frequency *= 1.95;
    amplitude *= 0.5;
  }

  return value;
}

void main() {
  vec3 n = normalize(vNormal);
  vec3 viewDir = normalize(cameraPosition - vWorldPosition);
  vec3 lightDir = normalize(vec3(-0.35, 0.75, 0.8));

  vec3 flowCoord = n * 2.8 + vec3(uTime * 0.2, -uTime * 0.13, uTime * 0.08);
  float turbulence = fbm(flowCoord);
  float marble = sin((n.y + turbulence * 1.65 + uTime * 0.24) * 11.0);
  float marbleMask = smoothstep(-0.82, 0.92, marble);

  vec3 baseMarble = mix(uDarkColor, uBaseColor, marbleMask);
  vec3 marbleTint = mix(baseMarble, uLightColor, turbulence * 0.42);

  float diffuse = max(dot(n, lightDir), 0.0);
  float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 2.2);
  vec3 halfVector = normalize(lightDir + viewDir);
  float specular = pow(max(dot(n, halfVector), 0.0), 42.0);

  vec3 lit = marbleTint * (0.34 + diffuse * 0.86);
  lit += uLightColor * specular * 0.3;
  lit += uLightColor * fresnel * 0.14;
  gl_FragColor = vec4(lit, 1.0);
}
`

const PLANE_PATH =
  'M231.4,44.34s0,.1,0,.15l-58.2,191.94a15.88,15.88,0,0,1-14,11.51q-.69.06-1.38.06a15.86,15.86,0,0,1-14.42-9.15L107,164.15a4,4,0,0,1,.77-4.58l57.92-57.92a8,8,0,0,0-11.31-11.31L96.43,148.26a4,4,0,0,1-4.58.77L17.08,112.64a16,16,0,0,1,2.49-29.8l191.94-58.2.15,0A16,16,0,0,1,231.4,44.34Z'
const CAPTURE_FRAME_INTERVAL_MS = 75
const SAFARI_OR_MOBILE_CAPTURE_FRAME_INTERVAL_MS = 140

const NETWORK_NODE_COLOR = '#ffffff'
const NETWORK_LINE_COLOR_LIGHT = '#d4d4d4'
const NETWORK_LINE_COLOR_DARK = '#a3a3a3'
const NETWORK_LINE_OPACITY_LIGHT = 0.25
const NETWORK_LINE_OPACITY_DARK = 0.33
const PACKET_COLORS = ['#ec4899', '#f97316', '#38bdf8', '#a78bfa'] as const

const NODE_COUNT = 40

const NODES = Array.from({ length: NODE_COUNT }, () =>
  new THREE.Vector3(
    Math.random() - 0.5,
    Math.random() - 0.5,
    Math.random() - 0.5
  ).normalize()
)

const CONNECTIONS: {
  start: THREE.Vector3
  end: THREE.Vector3
  delay: number
  packetColor: string
}[] = []

const pickPacketColor = (): string =>
  PACKET_COLORS[Math.floor(Math.random() * PACKET_COLORS.length)] ?? PACKET_COLORS[0]

NODES.forEach((startNode, i) => {
  const neighbors = NODES
    .map((node, index) => ({ node, index, distance: startNode.distanceTo(node) }))
    .filter((neighbor) => neighbor.index !== i)
    .sort((a, b) => a.distance - b.distance)

  CONNECTIONS.push({
    start: startNode,
    end: neighbors[0].node,
    delay: Math.random() * 3,
    packetColor: pickPacketColor(),
  })

  if (Math.random() > 0.6) {
    CONNECTIONS.push({
      start: startNode,
      end: neighbors[1].node,
      delay: Math.random() * 3,
      packetColor: pickPacketColor(),
    })
  }
})

function NetworkNode({ position }: { position: THREE.Vector3 }) {
  return (
    <group position={position}>
      <mesh>
        <sphereGeometry args={[0.027, 16, 16]} />
        <meshBasicMaterial color={NETWORK_NODE_COLOR} />
      </mesh>
    </group>
  )
}

function NetworkArc({
  start,
  end,
  delay,
  lineColor,
  lineOpacity,
  packetColor,
  showPacket,
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  delay: number
  lineColor: string
  lineOpacity: number
  packetColor: string
  showPacket: boolean
}) {
  const curve = useMemo(() => {
    const mid = start.clone().add(end).multiplyScalar(0.5).normalize().multiplyScalar(1.25)
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [start, end])

  const packetRef = useRef<THREE.Mesh>(null)
  const destinationPulseRef = useRef<THREE.Mesh>(null)

  useFrame(({ clock }) => {
    if (!showPacket) {
      if (packetRef.current) {
        packetRef.current.visible = false
      }
      if (destinationPulseRef.current) {
        ;(destinationPulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0
      }
      return
    }

    const cycleDuration = 3.0
    const travelDuration = 1.5
    const pulseDuration = 0.55
    const t = (clock.elapsedTime + delay) % cycleDuration

    if (packetRef.current && t < travelDuration) {
      packetRef.current.visible = true
      const progress = t / travelDuration
      packetRef.current.position.copy(curve.getPoint(progress))
      packetRef.current.scale.setScalar(Math.sin(progress * Math.PI))
    } else if (packetRef.current) {
      packetRef.current.visible = false
    }

    if (!destinationPulseRef.current) return

    if (t >= travelDuration && t < travelDuration + pulseDuration) {
      const pulseProgress = (t - travelDuration) / pulseDuration
      destinationPulseRef.current.scale.setScalar(1 + pulseProgress * 4)
      ;(destinationPulseRef.current.material as THREE.MeshBasicMaterial).opacity = 1 - pulseProgress
    } else {
      ;(destinationPulseRef.current.material as THREE.MeshBasicMaterial).opacity = 0
    }
  })

  return (
    <group>
      <mesh>
        <tubeGeometry args={[curve, 32, 0.0075, 8, false]} />
        <meshBasicMaterial color={lineColor} transparent opacity={lineOpacity} depthWrite={false} />
      </mesh>
      {showPacket ? (
        <mesh ref={packetRef}>
          <sphereGeometry args={[0.05, 16, 16]} />
          <meshBasicMaterial color={packetColor} />
        </mesh>
      ) : null}
      {showPacket ? (
        <group position={end}>
          <mesh ref={destinationPulseRef}>
            <sphereGeometry args={[0.027, 16, 16]} />
            <meshBasicMaterial color={packetColor} transparent opacity={0} depthWrite={false} />
          </mesh>
        </group>
      ) : null}
    </group>
  )
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function shouldThrottleCaptureForBrowser(): boolean {
  if (typeof navigator === 'undefined') return false

  const userAgent = navigator.userAgent
  const isMobile = /iPhone|iPad|iPod|Android|Mobile/i.test(userAgent)
  const isSafari = /Safari/i.test(userAgent) && !/Chrome|CriOS|Edg|OPR|FxiOS|Firefox/i.test(userAgent)
  return isMobile || isSafari
}

function drawPlaneOverlay(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeMs: number,
  reducedMotion: boolean
) {
  const size = clamp(width * 0.48, 154, 226)
  const offsetX = -width * 0.085
  const offsetY = height * 0.08
  const oscillation = reducedMotion ? 0 : Math.sin(timeMs * 0.00165)
  const angleDeg = reducedMotion ? 16 : 13.5 + oscillation * 2.5
  const scale = reducedMotion ? 1 : 0.965 + oscillation * 0.035
  const driftY = reducedMotion ? 0 : oscillation * 5
  const x = width - size + offsetX
  const y = offsetY + driftY

  context.save()
  context.translate(x + size * 0.5, y + size * 0.5)
  context.rotate((angleDeg * Math.PI) / 180)
  context.scale(scale, scale)
  context.translate(-size * 0.5, -size * 0.5)
  context.scale(size / 256, size / 256)
  context.fillStyle = '#ffffff'
  context.fill(new Path2D(PLANE_PATH))
  context.restore()
}

interface PlanetMeshProps {
  reducedMotion: boolean
  lineColor: string
  lineOpacity: number
}

function PlanetMesh({ reducedMotion, lineColor, lineOpacity }: PlanetMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const materialRef = useRef<THREE.ShaderMaterial | null>(null)

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uBaseColor: { value: new THREE.Color('#84cc16') },
    uDarkColor: { value: new THREE.Color('#3f6a0a') },
    uLightColor: { value: new THREE.Color('#c6f66c') },
  }), [])

  const material = useMemo(() => new THREE.ShaderMaterial({
    uniforms,
    vertexShader,
    fragmentShader,
    transparent: false,
    toneMapped: false,
  }), [uniforms])

  useEffect(() => {
    materialRef.current = material
    return () => {
      material.dispose()
    }
  }, [material])

  useFrame((_, delta) => {
    const activeMaterial = materialRef.current
    if (!activeMaterial) return

    const timeStep = reducedMotion ? 0.07 : 1
    activeMaterial.uniforms.uTime.value += delta * timeStep

    if (!meshRef.current) return
    meshRef.current.rotation.y += delta * (reducedMotion ? 0.08 : 0.18)
    meshRef.current.rotation.x = Math.sin(activeMaterial.uniforms.uTime.value * 0.21) * 0.1
    meshRef.current.rotation.z = Math.sin(activeMaterial.uniforms.uTime.value * 0.12) * 0.045
  })

  return (
    <mesh ref={meshRef} scale={0.94}>
      <sphereGeometry args={[1, 128, 128]} />
      <primitive object={material} attach="material" />

      {NODES.map((node, i) => (
        <NetworkNode key={`node-${i}`} position={node} />
      ))}

      {CONNECTIONS.map((conn, i) => (
        <NetworkArc
          key={`arc-${i}`}
          start={conn.start}
          end={conn.end}
          delay={conn.delay}
          lineColor={lineColor}
          lineOpacity={lineOpacity}
          packetColor={conn.packetColor}
          showPacket={i % 2 === 0}
        />
      ))}
    </mesh>
  )
}

interface SceneProps {
  reducedMotion: boolean
  lineColor: string
  lineOpacity: number
  onCanvasReady: (canvas: HTMLCanvasElement) => void
  className?: string
}

function Scene({ reducedMotion, lineColor, lineOpacity, onCanvasReady, className }: SceneProps) {
  return (
    <Canvas
      className={className ?? 'hero-logo-canvas'}
      dpr={[1, 1.8]}
      camera={{ fov: 38, position: [0, 0, 3.4] }}
      gl={{
        antialias: true,
        alpha: true,
        preserveDrawingBuffer: true,
        powerPreference: 'high-performance',
      }}
      onCreated={({ gl }) => onCanvasReady(gl.domElement)}
    >
      <ambientLight intensity={0.35} />
      <directionalLight intensity={0.9} position={[2.4, 2.2, 2.8]} />
      <directionalLight intensity={0.35} position={[-2.2, -1.6, -2]} />
      <PlanetMesh reducedMotion={reducedMotion} lineColor={lineColor} lineOpacity={lineOpacity} />
    </Canvas>
  )
}

export function HeroLogoScene() {
  const [reducedMotion, setReducedMotion] = useState(false)
  const [isDarkMode, setIsDarkMode] = useState(false)
  const [ditherSourceCanvas, setDitherSourceCanvas] = useState<HTMLCanvasElement | null>(null)

  const sourceRef = useRef<HTMLDivElement>(null)
  const sourceCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef<number | null>(null)
  const lastCaptureMsRef = useRef(0)
  const captureIntervalMsRef = useRef(CAPTURE_FRAME_INTERVAL_MS)

  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)')
    const onChange = () => setReducedMotion(media.matches)
    onChange()
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [])

  useEffect(() => {
    captureIntervalMsRef.current = shouldThrottleCaptureForBrowser()
      ? SAFARI_OR_MOBILE_CAPTURE_FRAME_INTERVAL_MS
      : CAPTURE_FRAME_INTERVAL_MS
  }, [])

  useEffect(() => {
    const root = document.documentElement
    const syncTheme = () => {
      const rootTheme = root.getAttribute('data-theme')
      const hasDarkClass = root.classList.contains('dark')
      setIsDarkMode(hasDarkClass || rootTheme === 'dark')
    }

    syncTheme()

    const observer = new MutationObserver(syncTheme)
    observer.observe(root, {
      attributes: true,
      attributeFilter: ['class', 'data-theme'],
    })

    return () => {
      observer.disconnect()
    }
  }, [])

  useEffect(() => {
    const renderFrame = (timestamp: number) => {
      const sourceElement = sourceRef.current
      const sourceCanvas = sourceCanvasRef.current

      if (
        sourceElement &&
        sourceCanvas &&
        timestamp - lastCaptureMsRef.current >= captureIntervalMsRef.current
      ) {
        const rect = sourceElement.getBoundingClientRect()
        const width = Math.max(1, Math.floor(rect.width))
        const height = Math.max(1, Math.floor(rect.height))

        if (!captureCanvasRef.current) {
          captureCanvasRef.current = document.createElement('canvas')
          setDitherSourceCanvas(captureCanvasRef.current)
        }

        const captureCanvas = captureCanvasRef.current
        captureCanvas.width = width
        captureCanvas.height = height

        const context = captureCanvas.getContext('2d')
        if (context) {
          context.clearRect(0, 0, width, height)
          context.drawImage(sourceCanvas, 0, 0, width, height)
          drawPlaneOverlay(context, width, height, timestamp, reducedMotion)
          lastCaptureMsRef.current = timestamp
        }
      }

      rafRef.current = requestAnimationFrame(renderFrame)
    }

    rafRef.current = requestAnimationFrame(renderFrame)

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
      lastCaptureMsRef.current = 0
    }
  }, [reducedMotion])

  const lineColor = isDarkMode ? NETWORK_LINE_COLOR_DARK : NETWORK_LINE_COLOR_LIGHT
  const lineOpacity = isDarkMode ? NETWORK_LINE_OPACITY_DARK : NETWORK_LINE_OPACITY_LIGHT

  return (
    <div data-testid="hero-logo-scene" className="hero-logo-slot max-w-[325px] lg:max-w-none">
      <div className="hero-logo-frame">
        <div ref={sourceRef} className="hero-logo-source" aria-hidden>
          <Scene
            reducedMotion={reducedMotion}
            lineColor={lineColor}
            lineOpacity={lineOpacity}
            onCanvasReady={(canvas) => {
              sourceCanvasRef.current = canvas
            }}
          />
        </div>
        <div data-testid="hero-dither-shader" className="pointer-events-none absolute inset-0 z-10">
          <DitherShader
            sourceCanvas={ditherSourceCanvas}
            className="h-full w-full"
            gridSize={3}
            ditherMode="bayer"
            colorMode="original"
            threshold={0.45}
            pixelRatio={1}
          />
        </div>
      </div>
    </div>
  )
}
