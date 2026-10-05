import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { SceneProps } from '../types'

type IslandDef = {
  key: string
  no: string
  name: string
  role: string
  pos: [number, number, number]
  r: number
  grass: string
  status?: string
}

// Extending the site = add an entry here + a small "props" component below.
export const islands: IslandDef[] = [
  { key: 'home', no: '00', name: '主岛', role: '关于我', pos: [0, 0, 0], r: 2.1, grass: '#9ccf7a' },
  { key: 'books', no: '01', name: '书岛', role: '文章 · 9 篇', pos: [-5.2, 0.9, -2.2], r: 1.7, grass: '#b7d77a' },
  { key: 'forge', no: '02', name: '工坊岛', role: '作品集', pos: [4.8, 1.4, -3], r: 1.4, grass: '#d9c27a', status: '即将开放' },
  { key: 'light', no: '03', name: '灯塔岛', role: '联系我', pos: [3.6, -0.6, 3.4], r: 1.1, grass: '#8fcf9c' },
  { key: 'lab', no: '04', name: '实验岛', role: '交互实验', pos: [-3.8, -0.4, 3.8], r: 1.2, grass: '#c3a8e8', status: '预留' },
]

/* ---------- island base: grassy top + jagged rock root ---------- */
function useRock(r: number, seed: number) {
  return useMemo(() => {
    const g = new THREE.ConeGeometry(r * 0.98, r * 1.9, 9, 4)
    g.rotateX(Math.PI)
    const p = g.attributes.position
    for (let i = 0; i < p.count; i++) {
      const y = p.getY(i)
      if (y > r * 0.9) continue
      const n = Math.sin(i * 12.9898 + seed) * 43758.5453
      const j = (n - Math.floor(n) - 0.5) * r * 0.35
      p.setX(i, p.getX(i) + j)
      p.setZ(i, p.getZ(i) + j * 0.8)
    }
    g.computeVertexNormals()
    return g
  }, [r, seed])
}

function IslandBase({ r, grass, seed }: { r: number; grass: string; seed: number }) {
  const rock = useRock(r, seed)
  return (
    <group>
      <mesh geometry={rock} position={[0, -r * 0.95 - 0.12, 0]} castShadow>
        <meshStandardMaterial color="#a88b74" flatShading roughness={1} />
      </mesh>
      <mesh position={[0, -0.18, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[r * 1.02, r * 0.98, 0.22, 9]} />
        <meshStandardMaterial color="#8a6e5a" flatShading />
      </mesh>
      <mesh position={[0, -0.02, 0]} receiveShadow>
        <cylinderGeometry args={[r, r * 1.03, 0.14, 9]} />
        <meshStandardMaterial color={grass} flatShading roughness={0.9} />
      </mesh>
    </group>
  )
}

function Tree({ p, s = 1, c = '#4f9a63' }: { p: [number, number, number]; s?: number; c?: string }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.2, 0]} castShadow><cylinderGeometry args={[0.04, 0.06, 0.4, 6]} /><meshStandardMaterial color="#7a5640" /></mesh>
      <mesh position={[0, 0.55, 0]} castShadow><icosahedronGeometry args={[0.3, 0]} /><meshStandardMaterial color={c} flatShading /></mesh>
      <mesh position={[0.1, 0.78, 0.05]} castShadow><icosahedronGeometry args={[0.2, 0]} /><meshStandardMaterial color={c} flatShading /></mesh>
    </group>
  )
}

/* ---------- per-island props ---------- */
function HomeProps() {
  return (
    <group>
      <group position={[0.2, 0.05, -0.3]}>
        <mesh position={[0, 0.4, 0]} castShadow><boxGeometry args={[1, 0.8, 0.85]} /><meshStandardMaterial color="#fbf1e2" /></mesh>
        <mesh position={[0, 1.0, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.85, 0.55, 4]} /><meshStandardMaterial color="#d9644a" flatShading /></mesh>
        <mesh position={[0, 0.25, 0.43]}><boxGeometry args={[0.22, 0.4, 0.02]} /><meshStandardMaterial color="#7a5640" /></mesh>
        <mesh position={[0.3, 0.5, 0.43]}><boxGeometry args={[0.2, 0.2, 0.02]} /><meshBasicMaterial color="#ffd27a" /></mesh>
        <mesh position={[0.3, 1.15, -0.1]} castShadow><boxGeometry args={[0.12, 0.35, 0.12]} /><meshStandardMaterial color="#8a6e5a" /></mesh>
      </group>
      <Tree p={[-1.1, 0.05, 0.4]} s={1.2} />
      <Tree p={[-0.8, 0.05, -0.9]} s={0.9} c="#6aae5c" />
      <Tree p={[1.3, 0.05, 0.7]} s={0.8} />
      {/* path stones */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0.25 + i * 0.05, 0.06, 0.4 + i * 0.35]} rotation-y={i}><cylinderGeometry args={[0.13, 0.13, 0.03, 6]} /><meshStandardMaterial color="#e8dcc8" /></mesh>
      ))}
      <Smoke />
    </group>
  )
}

function Smoke() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    ref.current?.children.forEach((m, i) => {
      const t = (clock.elapsedTime * 0.4 + i / 3) % 1
      m.position.set(0.5 + t * 0.2, 1.45 + t * 0.9, -0.4)
      m.scale.setScalar(0.06 + t * 0.14)
      ;((m as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - t)
    })
  })
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => <mesh key={i}><sphereGeometry args={[1, 10, 10]} /><meshStandardMaterial color="#ffffff" transparent /></mesh>)}
    </group>
  )
}

function BooksProps() {
  const colors = ['#d9644a', '#3f7f8c', '#e7b25a', '#6a5aa0', '#5a8a5e']
  return (
    <group>
      {/* little library with columns */}
      <mesh position={[0, 0.08, -0.2]} receiveShadow><boxGeometry args={[1.5, 0.12, 1.1]} /><meshStandardMaterial color="#efe4d2" /></mesh>
      {[-0.55, -0.2, 0.15, 0.5].map((x) => (
        <mesh key={x} position={[x + 0.02, 0.5, 0.25]} castShadow><cylinderGeometry args={[0.06, 0.06, 0.75, 10]} /><meshStandardMaterial color="#fbf6ec" /></mesh>
      ))}
      <mesh position={[0, 0.5, -0.35]} castShadow><boxGeometry args={[1.3, 0.75, 0.5]} /><meshStandardMaterial color="#f3e9d8" /></mesh>
      <mesh position={[0, 0.95, -0.05]} castShadow><boxGeometry args={[1.5, 0.12, 1.05]} /><meshStandardMaterial color="#e7d9c2" /></mesh>
      <mesh position={[0, 1.15, -0.05]} rotation-z={Math.PI / 2} rotation-y={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 1.5, 3]} /><meshStandardMaterial color="#3f7f8c" flatShading />
      </mesh>
      {/* floating open books */}
      {colors.map((c, i) => (
        <Float key={i} speed={1.5 + i * 0.3} rotationIntensity={0.6} floatIntensity={0.8}>
          <group position={[Math.cos(i * 1.25) * 1.1, 1.6 + (i % 2) * 0.35, Math.sin(i * 1.25) * 1.1]} rotation-y={i}>
            <mesh rotation-z={0.35} position={[-0.09, 0, 0]}><boxGeometry args={[0.18, 0.015, 0.24]} /><meshStandardMaterial color={c} /></mesh>
            <mesh rotation-z={-0.35} position={[0.09, 0, 0]}><boxGeometry args={[0.18, 0.015, 0.24]} /><meshStandardMaterial color={c} /></mesh>
            <mesh position={[0, 0.02, 0]}><boxGeometry args={[0.3, 0.01, 0.2]} /><meshStandardMaterial color="#fffaf0" /></mesh>
          </group>
        </Float>
      ))}
      <Tree p={[1.05, 0.05, 0.6]} s={0.7} c="#6aae5c" />
    </group>
  )
}

function ForgeProps() {
  const gear = useRef<THREE.Mesh>(null)
  useFrame((_, d) => { if (gear.current) gear.current.rotation.z += d * 0.8 })
  return (
    <group>
      <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[0.9, 0.6, 0.7]} /><meshStandardMaterial color="#c98a5a" /></mesh>
      <mesh position={[0, 0.75, 0]} castShadow><boxGeometry args={[1, 0.15, 0.8]} /><meshStandardMaterial color="#5a4a42" /></mesh>
      <mesh ref={gear} position={[0, 0.45, 0.37]}><torusGeometry args={[0.18, 0.05, 6, 8]} /><meshStandardMaterial color="#f2c14e" metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0.3, 1.05, -0.15]} castShadow><cylinderGeometry args={[0.07, 0.09, 0.5, 8]} /><meshStandardMaterial color="#5a4a42" /></mesh>
      <pointLight position={[0, 0.5, 0.6]} color="#ff9a4a" intensity={2} distance={2} />
      <Tree p={[-0.85, 0.05, 0.3]} s={0.6} c="#8aa04f" />
    </group>
  )
}

function LightProps() {
  const beam = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (beam.current) beam.current.rotation.y += d * 0.9 })
  return (
    <group>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.2 + i * 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.24 - i * 0.03, 0.27 - i * 0.03, 0.32, 14]} />
          <meshStandardMaterial color={i % 2 ? '#d9644a' : '#fbf6ec'} />
        </mesh>
      ))}
      <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.14, 0.14, 0.2, 10]} /><meshBasicMaterial color="#fff2b0" /></mesh>
      <mesh position={[0, 1.67, 0]}><coneGeometry args={[0.19, 0.18, 10]} /><meshStandardMaterial color="#3a3550" /></mesh>
      <group ref={beam} position={[0, 1.5, 0]}>
        <mesh position={[1.4, 0, 0]} rotation-z={Math.PI / 2}>
          <coneGeometry args={[0.35, 2.8, 16, 1, true]} />
          <meshBasicMaterial color="#fff2b0" transparent opacity={0.18} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <pointLight position={[0, 1.5, 0]} color="#ffe28a" intensity={4} distance={4} />
    </group>
  )
}

function LabProps() {
  return (
    <group>
      <mesh position={[0, 0.06, 0]}><cylinderGeometry args={[0.7, 0.75, 0.08, 24]} /><meshStandardMaterial color="#efe6ff" /></mesh>
      <mesh position={[0, 0.11, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.5, 0.56, 32]} /><meshBasicMaterial color="#a77be0" /></mesh>
      {[0, 1, 2].map((i) => (
        <Float key={i} speed={2 + i} floatIntensity={1.2} rotationIntensity={2}>
          <mesh position={[Math.cos(i * 2.1) * 0.35, 0.8 + i * 0.2, Math.sin(i * 2.1) * 0.35]} castShadow>
            <octahedronGeometry args={[0.16 - i * 0.03]} />
            <meshStandardMaterial color="#ffffff" emissive="#a77be0" emissiveIntensity={0.7} flatShading />
          </mesh>
        </Float>
      ))}
      <Sparkles count={20} scale={[1.4, 1.4, 1.4]} position={[0, 0.9, 0]} size={3} color="#e3d1ff" speed={0.6} />
    </group>
  )
}

const propsFor: Record<string, () => React.JSX.Element> = {
  home: HomeProps, books: BooksProps, forge: ForgeProps, light: LightProps, lab: LabProps,
}

/* ---------- island w/ bob, hover, label ---------- */
function Island({ d, i, active, onPick }: { d: IslandDef; i: number; active: boolean; onPick: (k: string) => void }) {
  const ref = useRef<THREE.Group>(null)
  const [hover, setHover] = useState(false)
  const Props = propsFor[d.key]
  useFrame(({ clock }) => {
    if (!ref.current) return
    ref.current.position.y = d.pos[1] + Math.sin(clock.elapsedTime * 0.6 + i * 1.3) * 0.12
    ref.current.rotation.y = Math.sin(clock.elapsedTime * 0.2 + i) * 0.05
  })
  const lit = hover || active
  return (
    <group
      ref={ref}
      position={d.pos}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); onPick(d.key) }}
    >
      <IslandBase r={d.r} grass={d.grass} seed={i * 7.1} />
      <Props />
      <Html zIndexRange={[20, 0]} position={[0, d.key === 'light' ? 2.3 : 2.1, 0]} center distanceFactor={14} style={{ pointerEvents: 'none' }}>
        <div className={`flex flex-col items-center transition-all duration-300 ${lit ? '-translate-y-1' : ''}`}>
          <div className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 shadow-lg transition-colors ${lit ? 'bg-[#2a2440] text-white' : 'bg-white/85 text-[#2a2440]'}`}>
            <span className="font-mono text-[10px] opacity-60">{d.no}</span>
            <span className="text-[13px] font-semibold">{d.name}</span>
          </div>
          <div className={`mt-1.5 whitespace-nowrap font-mono text-[10px] text-[#2a2440]/80 transition-opacity ${lit ? 'opacity-100' : 'opacity-0'}`}>
            {d.role}{d.status ? ` · ${d.status}` : ''}
          </div>
          <div className="h-5 w-px bg-[#2a2440]/30" />
        </div>
      </Html>
    </group>
  )
}

/* ---------- rope bridges ---------- */
function Bridge({ a, b }: { a: IslandDef; b: IslandDef }) {
  const { planks, ropes } = useMemo(() => {
    const A = new THREE.Vector3(...a.pos), B = new THREE.Vector3(...b.pos)
    const dir = B.clone().sub(A).setY(0).normalize()
    const s = A.clone().add(dir.clone().multiplyScalar(a.r * 0.92))
    const e = B.clone().sub(dir.clone().multiplyScalar(b.r * 0.92))
    const mid = s.clone().lerp(e, 0.5)
    mid.y -= 0.45
    const curve = new THREE.QuadraticBezierCurve3(s, mid, e)
    const n = Math.floor(s.distanceTo(e) / 0.2)
    const planks = Array.from({ length: n }, (_, k) => {
      const t = (k + 0.5) / n
      const p = curve.getPoint(t)
      const tan = curve.getTangent(t)
      const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), tan.normalize())
      return { p, q }
    })
    const side = new THREE.Vector3(-dir.z, 0, dir.x)
    const ropes = [-0.22, 0.22].map((o) => {
      const off = side.clone().multiplyScalar(o).setY(0.2)
      const c = new THREE.QuadraticBezierCurve3(s.clone().add(off), mid.clone().add(off), e.clone().add(off))
      return new THREE.TubeGeometry(c, 40, 0.015, 4)
    })
    return { planks, ropes }
  }, [a, b])
  return (
    <group>
      {planks.map(({ p, q }, k) => (
        <mesh key={k} position={p} quaternion={q} castShadow><boxGeometry args={[0.12, 0.03, 0.42]} /><meshStandardMaterial color={k % 2 ? '#a77a55' : '#b98a62'} /></mesh>
      ))}
      {ropes.map((g, k) => (
        <mesh key={k} geometry={g}><meshStandardMaterial color="#5a4a42" /></mesh>
      ))}
    </group>
  )
}

/* ---------- cloud sea ---------- */
function CloudSea() {
  const puffs = useMemo(() => Array.from({ length: 70 }, (_, i) => {
    const a = i * 2.399, r = 2 + Math.sqrt(i) * 1.6
    return { p: [Math.cos(a) * r, -3.6 + Math.sin(i * 3.1) * 0.35, Math.sin(a) * r] as [number, number, number], s: 0.9 + ((i * 13) % 7) * 0.2 }
  }), [])
  const ref = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (ref.current) ref.current.rotation.y += d * 0.01 })
  return (
    <group ref={ref}>
      {puffs.map((c, i) => (
        <mesh key={i} position={c.p} scale={[c.s * 1.6, c.s * 0.7, c.s * 1.6]}>
          <icosahedronGeometry args={[1, 1]} />
          <meshStandardMaterial color="#fff6f0" flatShading roughness={1} />
        </mesh>
      ))}
    </group>
  )
}

function Drifters() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    ref.current?.children.forEach((c, i) => {
      c.position.x = ((clock.elapsedTime * (0.25 + i * 0.05) + i * 6) % 24) - 12
    })
  })
  return (
    <group ref={ref}>
      {[[3.5, -4], [5.2, 2], [2.8, 6]].map(([y, z], i) => (
        <group key={i} position={[0, y, z]}>
          {[0, 0.5, -0.45].map((x, k) => (
            <mesh key={k} position={[x, k === 0 ? 0.15 : 0, 0]} scale={k === 0 ? 0.5 : 0.35}><icosahedronGeometry args={[1, 1]} /><meshStandardMaterial color="#ffffff" flatShading transparent opacity={0.9} /></mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

/* ---------- camera flight ---------- */
function Rig({ focus }: { focus: string | null }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.PerspectiveCamera; controls: { target: THREE.Vector3; update: () => void } | null }
  const flying = useRef(false)
  const last = useRef<string | null>(null)
  useFrame(() => {
    if (!controls) return
    if (last.current !== focus) { last.current = focus; flying.current = true }
    if (!flying.current) return
    const d = islands.find((x) => x.key === focus)
    const target = d ? new THREE.Vector3(...d.pos).add(new THREE.Vector3(0, 0.6, 0)) : new THREE.Vector3(0, 0, 0)
    const camPos = d ? target.clone().add(new THREE.Vector3(2.2, 2.4, 4.6).multiplyScalar(d.r / 1.4)) : new THREE.Vector3(9, 8, 14)
    controls.target.lerp(target, 0.06)
    camera.position.lerp(camPos, 0.05)
    controls.update()
    if (camera.position.distanceTo(camPos) < 0.05) flying.current = false
  })
  return null
}

export default function IslandsScene({ onOpenList }: SceneProps) {
  const [focus, setFocus] = useState<string | null>(null)
  const pick = (k: string) => {
    setFocus(k)
    if (k === 'books') setTimeout(onOpenList, 700)
  }
  const bridges: [number, number][] = [[0, 1], [0, 2], [0, 3], [0, 4]]
  const current = islands.find((x) => x.key === focus)

  return (
    <div className="absolute inset-0 bg-[linear-gradient(180deg,#8fb8e8_0%,#c9c3ea_38%,#f6c9b8_68%,#fde6cf_100%)]">
      <Canvas shadows camera={{ position: [9, 8, 14], fov: 42 }} onPointerMissed={() => setFocus(null)}>
        <fog attach="fog" args={['#f3d2c4', 16, 34]} />
        <hemisphereLight args={['#dfe8ff', '#f6c9b8', 0.9]} />
        <directionalLight position={[8, 12, 6]} intensity={2} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-10} shadow-camera-right={10} shadow-camera-top={10} shadow-camera-bottom={-10} />
        {bridges.map(([a, b]) => <Bridge key={`${a}-${b}`} a={islands[a]} b={islands[b]} />)}
        {islands.map((d, i) => <Island key={d.key} d={d} i={i} active={focus === d.key} onPick={pick} />)}
        <CloudSea />
        <Drifters />
        <Sparkles count={60} scale={[20, 8, 20]} size={2} color="#ffffff" speed={0.2} opacity={0.6} />
        <OrbitControls makeDefault enablePan={false} minDistance={4} maxDistance={24} maxPolarAngle={1.45} />
        <Rig focus={focus} />
      </Canvas>

      {/* island index */}
      <ol className="absolute left-8 top-1/2 z-10 -translate-y-1/2 space-y-1 max-[900px]:hidden">
        {islands.map((d) => {
          const on = d.key === focus
          return (
            <li key={d.key}>
              <button onClick={() => pick(d.key)} className={`group flex items-center gap-3 py-1.5 text-left transition ${on ? 'text-[#2a2440]' : 'text-[#2a2440]/55 hover:text-[#2a2440]'}`}>
                <span className={`h-px bg-current transition-all ${on ? 'w-10' : 'w-4 group-hover:w-7'}`} />
                <span className="font-mono text-[10px]">{d.no}</span>
                <span className="text-sm font-semibold">{d.name}</span>
                <span className="font-mono text-[10px] opacity-70">{d.role}</span>
              </button>
            </li>
          )
        })}
      </ol>

      {current && (
        <div className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-2xl border border-white/60 bg-white/70 px-6 py-4 text-center text-[#2a2440] shadow-xl backdrop-blur-xl">
          <div className="font-mono text-[10px] tracking-[0.25em] opacity-60">ISLAND {current.no}</div>
          <div className="mt-1 text-lg font-black">{current.name} · {current.role}</div>
          <div className="mt-1 text-xs opacity-60">
            {current.key === 'books' ? '正在打开文章列表…' : current.status ? `${current.status} — 后续在这里接入模块` : '点击空白处返回全景'}
          </div>
        </div>
      )}
    </div>
  )
}
