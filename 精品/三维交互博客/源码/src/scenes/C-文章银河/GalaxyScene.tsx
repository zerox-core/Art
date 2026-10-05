import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, Stars, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { articles, tagColors, type Article } from '../../data/articles'
import type { SceneProps } from '../types'

type Tag = Article['tag']

const tags = Object.keys(tagColors) as Tag[]
const tagEn: Record<Tag, string> = { 技术: 'CODE', 设计: 'DESIGN', 生活: 'LIFE', 阅读: 'READING' }

/* ---------- shared spiral formula ---------- */
const ARMS = 4
const armAngle = (k: number) => (k / ARMS) * Math.PI * 2
const spin = (r: number) => r * 0.75
const R_MIN = 1.4
const R_MAX = 9.4

/* ---------- deterministic random ---------- */
function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/* ---------- procedural archive ---------- */
const words: Record<Tag, { a: string[]; b: string[]; c: string[] }> = {
  技术: {
    a: ['重新理解', '从零实现', '深入浅出', '踩坑记录：', '一次性讲清', '性能优化：', '小记：', '实战'],
    b: ['WebGL', 'TypeScript', 'React 状态管理', 'Rust 所有权', '着色器', '构建工具链', '数据库索引', '并发模型', 'Vite 插件', '浏览器渲染'],
    c: ['的底层原理', '的十个细节', '与工程实践', '入门笔记', '的取舍', '在生产环境中', '的边界'],
  },
  设计: {
    a: ['关于', '重新设计', '谈谈', '笔记：', '一次改版：', '观察：'],
    b: ['留白', '字体排印', '配色系统', '交互动效', '图标网格', '信息层级', '空状态', '品牌语言', '设计系统'],
    c: ['的温度', '与克制', '的秩序感', '背后的逻辑', '的五个原则', '与情绪'],
  },
  生活: {
    a: ['在', '记', '又一次', '那年', '冬天的', '一个人去'],
    b: ['大理', '东京', '老家', '西湖', '冰岛', '菜市场', '山里', '海边', '旧书店', '夜车上'],
    c: ['的三天', '散步', '的早晨', '小住', '的雨', '慢慢走', '随想'],
  },
  阅读: {
    a: ['读', '重读', '摘抄', '书评：', '再谈'],
    b: ['《百年孤独》', '《人类简史》', '《看不见的城市》', '《禅与摩托车维修艺术》', '《三体》', '《瓦尔登湖》', '《思考，快与慢》', '《局外人》', '《小王子》'],
    c: ['', '的一些想法', '：时间与记忆', '与孤独', '笔记', '里的隐喻'],
  },
}

const pad = (n: number) => String(n).padStart(2, '0')
const generated: Article[] = (() => {
  const rnd = mulberry32(20260403)
  const pick = <T,>(arr: T[]) => arr[Math.floor(rnd() * arr.length)]
  const out: Article[] = []
  for (let i = 0; i < 800; i++) {
    const tag = tags[Math.floor(rnd() * tags.length)]
    const w = words[tag]
    const title = `${pick(w.a)}${pick(w.b)}${pick(w.c)}`
    const y = 2019 + Math.floor(rnd() * 8)
    const m = y === 2026 ? 1 + Math.floor(rnd() * 9) : 1 + Math.floor(rnd() * 12)
    const d = 1 + Math.floor(rnd() * 28)
    out.push({
      id: `g${i}`,
      title,
      excerpt: `归档文章 · ${tag} · 这是一篇来自 ${y} 年的旧文，内容待整理。`,
      tag,
      date: `${y}.${pad(m)}.${pad(d)}`,
      minutes: 3 + Math.floor(rnd() * 18),
    })
  }
  return out
})()

const allArticles: Article[] = [...articles, ...generated]
const realCount = articles.length
const byId = new Map(allArticles.map((a) => [a.id, a]))
const counts: Record<Tag, number> = { 技术: 0, 设计: 0, 生活: 0, 阅读: 0 }
allArticles.forEach((a) => counts[a.tag]++)

const dateToR = (date: string) => {
  const [y, m, d] = date.split('.').map(Number)
  const yr = y + (m - 1) / 12 + d / 365
  return THREE.MathUtils.clamp(R_MIN + ((yr - 2019) / 8) * (R_MAX - R_MIN), R_MIN, R_MAX)
}

/* ---------- article positions (galaxy-local, same spiral as dust) ---------- */
const positions = new Float32Array(allArticles.length * 3)
;(() => {
  const rnd = mulberry32(77)
  allArticles.forEach((a, i) => {
    const r = dateToR(a.date) + (rnd() - 0.5) * 0.15
    const th = armAngle(tags.indexOf(a.tag)) + spin(r) + (rnd() - 0.5) * 0.22
    const t = (r - 0.2) / 10
    positions[i * 3] = Math.cos(th) * r + (rnd() - 0.5) * 0.35
    positions[i * 3 + 1] = (rnd() - 0.5) * 0.3 * (1.2 - t)
    positions[i * 3 + 2] = Math.sin(th) * r + (rnd() - 0.5) * 0.35
  })
})()
const posOf = (i: number, out: THREE.Vector3) => out.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2])
const indexOf = new Map(allArticles.map((a, i) => [a.id, i]))

/* ---------- uniform spatial grid (xz) ---------- */
const CELL = 1.2
const cellKey = (cx: number, cz: number) => (cx + 512) * 1024 + (cz + 512)
const grid = new Map<number, number[]>()
for (let i = 0; i < allArticles.length; i++) {
  const k = cellKey(Math.floor(positions[i * 3] / CELL), Math.floor(positions[i * 3 + 2] / CELL))
  const arr = grid.get(k)
  if (arr) arr.push(i)
  else grid.set(k, [i])
}
function queryNearby(x: number, y: number, z: number, R: number, cap: number): number[] {
  const c0x = Math.floor((x - R) / CELL), c1x = Math.floor((x + R) / CELL)
  const c0z = Math.floor((z - R) / CELL), c1z = Math.floor((z + R) / CELL)
  const R2 = R * R
  const found: { i: number; d: number }[] = []
  for (let cx = c0x; cx <= c1x; cx++)
    for (let cz = c0z; cz <= c1z; cz++) {
      const arr = grid.get(cellKey(cx, cz))
      if (!arr) continue
      for (const i of arr) {
        const dx = positions[i * 3] - x, dy = positions[i * 3 + 1] - y, dz = positions[i * 3 + 2] - z
        const d = dx * dx + dy * dy + dz * dz
        if (d < R2) found.push({ i, d })
      }
    }
  found.sort((p, q) => p.d - q.d)
  return found.slice(0, cap).map((f) => f.i)
}

/* ---------- shared runtime state (no React re-renders) ---------- */
const shared = {
  group: null as THREE.Group | null,
  points: null as THREE.Points | null,
  near: 0,
  starClickAt: 0,
}
const NEAR_IN = 9
const NEAR_OUT = 9.8

type Focus = { kind: 'star'; id: string } | { kind: 'point'; id: string } | { kind: 'tag'; tag: Tag } | null

/* ---------- canvas textures ---------- */
function radialTexture(stops: [number, string][], size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2)
  stops.forEach(([o, col]) => grad.addColorStop(o, col))
  g.fillStyle = grad
  g.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function flareTexture(size = 128) {
  const c = document.createElement('canvas')
  c.width = c.height = size
  const g = c.getContext('2d')!
  const h = size / 2
  const spike = (horizontal: boolean) => {
    const grad = horizontal ? g.createLinearGradient(0, 0, size, 0) : g.createLinearGradient(0, 0, 0, size)
    grad.addColorStop(0, 'rgba(255,255,255,0)')
    grad.addColorStop(0.5, 'rgba(255,255,255,1)')
    grad.addColorStop(1, 'rgba(255,255,255,0)')
    g.fillStyle = grad
    if (horizontal) g.fillRect(0, h - 1.2, size, 2.4)
    else g.fillRect(h - 1.2, 0, 2.4, size)
  }
  spike(true)
  spike(false)
  const glow = g.createRadialGradient(h, h, 0, h, h, h * 0.35)
  glow.addColorStop(0, 'rgba(255,255,255,1)')
  glow.addColorStop(1, 'rgba(255,255,255,0)')
  g.fillStyle = glow
  g.fillRect(0, 0, size, size)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function useTextures() {
  return useMemo(
    () => ({
      glow: radialTexture([[0, 'rgba(255,255,255,1)'], [0.2, 'rgba(255,255,255,0.6)'], [0.5, 'rgba(255,255,255,0.12)'], [1, 'rgba(255,255,255,0)']]),
      nebula: radialTexture([[0, 'rgba(255,255,255,0.55)'], [0.35, 'rgba(255,255,255,0.22)'], [0.7, 'rgba(255,255,255,0.05)'], [1, 'rgba(255,255,255,0)']], 256),
      flare: flareTexture(),
    }),
    [],
  )
}
type Tex = ReturnType<typeof useTextures>

/* ---------- galaxy dust (custom shader) ---------- */
const galaxyVert = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vTw;
  varying float vNearFade;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float tw = 0.65 + 0.35 * sin(uTime * (1.0 + aSeed * 2.0) + aSeed * 40.0);
    vTw = tw;
    vColor = aColor;
    gl_PointSize = min(aSize * uPixelRatio * (28.0 / -mv.z) * (0.8 + 0.4 * tw), 9.0);
    vNearFade = clamp(-mv.z / 5.0, 0.2, 1.0);
  }
`
const galaxyFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vTw;
  varying float vNearFade;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float a = pow(1.0 - d * 2.0, 2.2);
    gl_FragColor = vec4(vColor * (0.6 + 0.6 * vTw), a * 0.9 * vNearFade);
  }
`

function Dust() {
  const { geo, mat } = useMemo(() => {
    const rnd = mulberry32(1234)
    const n = 16000
    const pos = new Float32Array(n * 3)
    const col = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const seed = new Float32Array(n)
    const core = new THREE.Color('#ffd9a0')
    const mid = new THREE.Color('#ff8fb0')
    const outer = new THREE.Color('#6a7cff')
    const edge = new THREE.Color('#9b6bff')
    const tagCols = tags.map((t) => new THREE.Color(tagColors[t]))
    const c = new THREE.Color()
    for (let i = 0; i < n; i++) {
      const t = Math.pow(rnd(), 1.6)
      const r = 0.2 + t * 10
      const k = i % ARMS
      const spread = Math.pow(rnd(), 3) * (rnd() < 0.5 ? 1 : -1) * (0.35 + r * 0.12)
      const th = armAngle(k) + spin(r) + spread * 0.6
      const off = () => Math.pow(rnd(), 3) * (rnd() < 0.5 ? 1 : -1) * 0.5 * (1 + r * 0.08)
      pos[i * 3] = Math.cos(th) * r + off()
      pos[i * 3 + 1] = off() * (1.2 - t) * 0.9
      pos[i * 3 + 2] = Math.sin(th) * r + off()
      if (t < 0.25) c.copy(core).lerp(mid, t / 0.25)
      else if (t < 0.6) c.copy(mid).lerp(outer, (t - 0.25) / 0.35)
      else c.copy(outer).lerp(edge, (t - 0.6) / 0.4)
      // subtle arm tint by tag colour (fades in away from the core, stronger near the arm spine)
      const tint = THREE.MathUtils.smoothstep(r, 1, 3) * 0.32 * (1 - Math.min(1, Math.abs(spread) / 0.8))
      c.lerp(tagCols[k], tint)
      col.set([c.r, c.g, c.b], i * 3)
      size[i] = (rnd() < 0.03 ? 2.4 : 0.6 + rnd() * 0.9) * (1.3 - t * 0.5)
      seed[i] = rnd()
    }
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    const mat = new THREE.ShaderMaterial({
      vertexShader: galaxyVert,
      fragmentShader: galaxyFrag,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [])
  useEffect(() => () => { geo.dispose(); mat.dispose() }, [geo, mat])
  useFrame(({ clock }) => { mat.uniforms.uTime.value = clock.elapsedTime })
  return <points geometry={geo} material={mat} />
}

/* ---------- article points (tier 0, one draw call) ---------- */
const articleVert = /* glsl */ `
  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uNear;
  attribute float aSize;
  attribute float aSeed;
  attribute vec3 aColor;
  varying vec3 vColor;
  varying float vB;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float pulse = 0.8 + 0.2 * sin(uTime * 1.6 + aSeed * 30.0);
    vColor = aColor;
    vB = pulse * mix(1.35, 0.45, uNear);
    gl_PointSize = clamp(aSize * uPixelRatio * (40.0 / -mv.z) * pulse * mix(1.0, 0.35, uNear), 1.5, 14.0);
  }
`
const articleFrag = /* glsl */ `
  varying vec3 vColor;
  varying float vB;
  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float core = smoothstep(0.18, 0.0, d);
    float halo = pow(1.0 - d * 2.0, 2.0);
    vec3 c = mix(vColor, vec3(1.0), core * 0.7);
    gl_FragColor = vec4(c * vB, (halo * 0.85 + core) * min(vB, 1.0));
  }
`

function ArticlePoints() {
  const ref = useRef<THREE.Points>(null)
  const { geo, mat } = useMemo(() => {
    const n = allArticles.length
    const col = new Float32Array(n * 3)
    const size = new Float32Array(n)
    const seed = new Float32Array(n)
    const c = new THREE.Color()
    allArticles.forEach((a, i) => {
      c.set(tagColors[a.tag])
      col.set([c.r, c.g, c.b], i * 3)
      size[i] = i < realCount ? 3.4 : 1.7 + (a.minutes / 20) * 0.8
      seed[i] = (i * 0.6180339) % 1
    })
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3))
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1))
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1))
    geo.computeBoundingSphere()
    const mat = new THREE.ShaderMaterial({
      vertexShader: articleVert,
      fragmentShader: articleFrag,
      uniforms: { uTime: { value: 0 }, uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) }, uNear: { value: 0 } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geo, mat }
  }, [])
  useEffect(() => {
    shared.points = ref.current
    return () => { shared.points = null; geo.dispose(); mat.dispose() }
  }, [geo, mat])
  useFrame(({ clock }) => {
    mat.uniforms.uTime.value = clock.elapsedTime
    mat.uniforms.uNear.value = shared.near
  })
  // raycast disabled for R3F's pointer system; we raycast manually on click only
  return <points ref={ref} geometry={geo} material={mat} raycast={() => null} />
}

function Core({ tex }: { tex: Tex }) {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.elapsedTime * 0.8) * 0.06
    ref.current?.scale.setScalar(s)
  })
  return (
    <group ref={ref} position={[0, -0.6, 0]}>
      <sprite scale={[7, 7, 1]} raycast={() => null}>
        <spriteMaterial map={tex.glow} color="#ff9a6a" transparent opacity={0.35} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={[3.2, 3.2, 1]} raycast={() => null}>
        <spriteMaterial map={tex.glow} color="#ffd9a0" transparent opacity={0.8} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite scale={[1.1, 1.1, 1]} raycast={() => null}>
        <spriteMaterial map={tex.glow} color="#ffffff" transparent depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
    </group>
  )
}

/* ---------- nebulae anchored on the arms ---------- */
function ArmNebula({ tag, tex, active }: { tag: Tag; tex: Tex; active: boolean }) {
  const refs = useRef<(THREE.Sprite | null)[]>([])
  const puffs = useMemo(() => {
    const k = tags.indexOf(tag)
    return [3.4, 5.4, 7.6].map((r, i) => {
      const th = armAngle(k) + spin(r)
      return { p: [Math.cos(th) * r, 0, Math.sin(th) * r] as [number, number, number], s: 3 + r * 0.35, seed: i * 1.7 + k }
    })
  }, [tag])
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    refs.current.forEach((s, i) => {
      if (!s) return
      const target = (active ? 0.3 : 0.14) * (1 - shared.near * 0.6) * (0.85 + 0.15 * Math.sin(t * 0.4 + puffs[i].seed))
      s.material.opacity += (target - s.material.opacity) * 0.05
      s.material.rotation = puffs[i].seed + t * 0.02 * (i % 2 ? 1 : -1)
    })
  })
  return (
    <group>
      {puffs.map((p, i) => (
        <sprite key={i} ref={(r) => { refs.current[i] = r }} position={p.p} scale={[p.s, p.s, 1]} raycast={() => null}>
          <spriteMaterial map={tex.nebula} color={tagColors[tag]} transparent opacity={0.14} depthWrite={false} blending={THREE.AdditiveBlending} />
        </sprite>
      ))}
    </group>
  )
}

/* ---------- interactive article star (tier 1) ---------- */
const tmpScale = new THREE.Vector3()
function ArticleStar({ index, tex, active, dim, label, onPick }: { index: number; tex: Tex; active: boolean; dim: boolean; label: boolean; onPick: (a: Article) => void }) {
  const a = allArticles[index]
  const [hover, setHover] = useState(false)
  const halo = useRef<THREE.Sprite>(null)
  const flare = useRef<THREE.Sprite>(null)
  const fade = useRef(0)
  const pos = useMemo(() => posOf(index, new THREE.Vector3()), [index])
  const seed = index * 1.37
  const color = tagColors[a.tag]
  const base = (index < realCount ? 0.11 : 0.07) + a.minutes * 0.003
  const lit = hover || active
  useEffect(() => () => { if (hover) document.body.style.cursor = 'auto' }, [hover])
  const coreDot = useRef<THREE.Sprite>(null)
  useFrame(({ clock }, dt) => {
    const t = clock.elapsedTime
    fade.current = Math.min(1, fade.current + dt * 2.5)
    const vis = fade.current * shared.near
    const k = lit ? 1.6 : dim ? 0.7 : 1
    if (coreDot.current) {
      const s = base * (lit ? 1.5 : 1.1)
      coreDot.current.scale.lerp(tmpScale.set(s, s, 1), 0.2)
      coreDot.current.material.opacity = vis * (dim ? 0.35 : 0.95)
    }
    if (halo.current) {
      const s = base * 3.6 * k * (1 + Math.sin(t * 1.8 + seed) * 0.08)
      halo.current.scale.lerp(tmpScale.set(s, s, 1), 0.12)
      halo.current.material.opacity = vis * (lit ? 0.55 : dim ? 0.12 : 0.28)
    }
    if (flare.current) {
      const s = base * (lit ? 6 : 3.2) * k * (0.9 + Math.sin(t * 2.6 + seed) * 0.1)
      flare.current.scale.lerp(tmpScale.set(s, s, 1), 0.12)
      flare.current.material.rotation = Math.sin(t * 0.3 + seed) * 0.2
      flare.current.material.opacity = vis * (lit ? 0.6 : dim ? 0.05 : 0.14)
    }
  })
  const showFull = lit
  return (
    <group position={pos}>
      <mesh
        onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
        onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
        onClick={(e) => { e.stopPropagation(); shared.starClickAt = performance.now(); onPick(a) }}
      >
        <sphereGeometry args={[Math.max(0.16, base * 2.2), 10, 10]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <sprite ref={coreDot} scale={[0.001, 0.001, 1]} raycast={() => null}>
        <spriteMaterial map={tex.glow} color="#ffffff" transparent opacity={0} depthWrite={false} />
      </sprite>
      <sprite ref={halo} scale={[0.001, 0.001, 1]} raycast={() => null}>
        <spriteMaterial map={tex.glow} color={color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      <sprite ref={flare} scale={[0.001, 0.001, 1]} raycast={() => null}>
        <spriteMaterial map={tex.flare} color={color} transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
      </sprite>
      {(label || showFull) && (
        <Html zIndexRange={[20, 0]} center position={[0, base * 3 + 0.12, 0]} style={{ pointerEvents: 'none' }}>
          <div className="w-52 -translate-y-3 text-center">
            {showFull && <div className="font-mono text-[10px] tracking-widest" style={{ color }}>{a.tag} · {a.date} · {a.minutes} 分钟</div>}
            <div className={`mt-0.5 leading-snug text-white [text-shadow:0_0_10px_rgba(0,0,0,0.9)] ${showFull ? 'text-sm font-semibold' : 'truncate text-[11px] opacity-75'}`}>{a.title}</div>
          </div>
        </Html>
      )}
    </group>
  )
}

/* ---------- tier 1 manager: grid query, mounts nearest N ---------- */
const NEAR_R = 3.2
const NEAR_CAP = 40
const LABEL_CAP = 8
function NearbyStars({ tex, nearMode, focus, focusTag, onPick, onCount }: { tex: Tex; nearMode: boolean; focus: Focus; focusTag: Tag | null; onPick: (a: Article) => void; onCount: (n: number) => void }) {
  const { controls } = useThree() as unknown as { controls: { target: THREE.Vector3 } | null }
  const [ids, setIds] = useState<number[]>([])
  const lastQ = useRef(new THREE.Vector3(1e9, 0, 0))
  const lastT = useRef(0)
  const local = useRef(new THREE.Vector3())
  useEffect(() => { if (!nearMode) { setIds([]); lastQ.current.set(1e9, 0, 0) } }, [nearMode])
  useEffect(() => onCount(ids.length), [ids, onCount])
  useFrame(() => {
    if (!nearMode || !controls || !shared.group) return
    const now = performance.now()
    const l = shared.group.worldToLocal(local.current.copy(controls.target))
    if (l.distanceToSquared(lastQ.current) < 0.04 && now - lastT.current < 200) return
    if (now - lastT.current < 200 && l.distanceToSquared(lastQ.current) < 0.25) return
    lastT.current = now
    lastQ.current.copy(l)
    const next = queryNearby(l.x, l.y, l.z, NEAR_R, NEAR_CAP)
    // keep focused star mounted
    if (focus && (focus.kind === 'star' || focus.kind === 'point')) {
      const fi = indexOf.get(focus.id)
      if (fi !== undefined && !next.includes(fi)) next.push(fi)
    }
    setIds((prev) => (prev.length === next.length && prev.every((v, i) => v === next[i]) ? prev : next))
  })
  const focusId = focus && (focus.kind === 'star' || focus.kind === 'point') ? focus.id : null
  return (
    <group>
      {ids.map((i, rank) => (
        <ArticleStar
          key={i}
          index={i}
          tex={tex}
          active={allArticles[i].id === focusId}
          dim={!!focusTag && focusTag !== allArticles[i].tag}
          label={rank < LABEL_CAP}
          onPick={onPick}
        />
      ))}
    </group>
  )
}

/* ---------- LOD controller ---------- */
function LodController({ nearMode, onNearMode }: { nearMode: boolean; onNearMode: (b: boolean) => void }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.Camera; controls: { target: THREE.Vector3 } | null }
  useFrame(() => {
    if (!controls) return
    const d = camera.position.distanceTo(controls.target)
    shared.near = 1 - THREE.MathUtils.smoothstep(d, 7, NEAR_OUT)
    if (!nearMode && d < NEAR_IN) onNearMode(true)
    else if (nearMode && d > NEAR_OUT) onNearMode(false)
  })
  return null
}

/* ---------- click-to-pick on article points (tier 0 only, click only) ---------- */
function PointPicker({ nearMode, onPoint, onEmpty }: { nearMode: boolean; onPoint: (a: Article) => void; onEmpty: () => void }) {
  const { gl, camera } = useThree()
  const cb = useRef({ nearMode, onPoint, onEmpty })
  cb.current = { nearMode, onPoint, onEmpty }
  useEffect(() => {
    const el = gl.domElement
    const ray = new THREE.Raycaster()
    ray.params.Points = { threshold: 0.25 }
    const ndc = new THREE.Vector2()
    const down = { x: 0, y: 0 }
    const hits: THREE.Intersection[] = []
    const onDown = (e: PointerEvent) => { down.x = e.clientX; down.y = e.clientY }
    const onClick = (e: MouseEvent) => {
      if (Math.hypot(e.clientX - down.x, e.clientY - down.y) > 5) return
      if (performance.now() - shared.starClickAt < 80) return // an interactive star handled it
      const { nearMode: nm, onPoint: op, onEmpty: oe } = cb.current
      const pts = shared.points
      if (pts) {
        const rect = el.getBoundingClientRect()
        ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
        ray.setFromCamera(ndc, camera)
        ray.params.Points = { threshold: nm ? 0.12 : 0.25 }
        hits.length = 0
        THREE.Points.prototype.raycast.call(pts, ray, hits)
        let best: THREE.Intersection | null = null
        for (const h of hits) if (h.index !== undefined && (!best || (h.distanceToRay ?? 0) < (best.distanceToRay ?? 0))) best = h
        if (best && best.index !== undefined) { op(allArticles[best.index]); return }
      }
      oe()
    }
    el.addEventListener('pointerdown', onDown)
    el.addEventListener('click', onClick)
    return () => { el.removeEventListener('pointerdown', onDown); el.removeEventListener('click', onClick) }
  }, [gl, camera])
  return null
}

/* ---------- shooting stars ---------- */
function ShootingStars() {
  const groups = useRef<(THREE.Group | null)[]>([])
  const meshes = useRef<(THREE.Mesh | null)[]>([])
  const state = useMemo(() => Array.from({ length: 3 }, (_, i) => ({ t: -i * 3.5 - 2, from: new THREE.Vector3(0, 8, -12), dir: new THREE.Vector3(-0.8, -0.45, 0.1).normalize(), ang: 0 })), [])
  useFrame((_, d) => {
    for (let i = 0; i < state.length; i++) {
      const s = state[i]
      const g = groups.current[i]
      const m = meshes.current[i]
      s.t += d
      if (s.t > 1.4) {
        s.t = -3 - Math.random() * 6
        s.from.set((Math.random() - 0.5) * 30, 6 + Math.random() * 6, -8 - Math.random() * 10)
        s.dir.set(-0.6 - Math.random() * 0.4, -0.45, 0.1).normalize()
        s.ang = Math.atan2(s.dir.y, s.dir.x)
      }
      if (!g || !m) continue
      const mat = m.material as THREE.MeshBasicMaterial
      if (s.t < 0) { mat.opacity = 0; continue }
      g.position.copy(s.from).addScaledVector(s.dir, s.t * 14)
      m.rotation.z = s.ang
      mat.opacity = Math.sin((s.t / 1.4) * Math.PI) * 0.9
    }
  })
  return (
    <group>
      {state.map((_, i) => (
        <Billboard key={i} ref={(r) => { groups.current[i] = r as THREE.Group | null }}>
          <mesh ref={(r) => { meshes.current[i] = r }} raycast={() => null}>
            <planeGeometry args={[2.6, 0.03]} />
            <meshBasicMaterial color="#e8e0ff" transparent opacity={0} depthWrite={false} blending={THREE.AdditiveBlending} />
          </mesh>
        </Billboard>
      ))}
    </group>
  )
}

/* ---------- camera rig ---------- */
const armMid = (t: Tag, out: THREE.Vector3) => {
  const r = 5.4
  const th = armAngle(tags.indexOf(t)) + spin(r)
  return out.set(Math.cos(th) * r, 0, Math.sin(th) * r)
}
function Rig({ focus }: { focus: Focus }) {
  const { camera, controls, pointer } = useThree() as unknown as {
    camera: THREE.PerspectiveCamera
    pointer: THREE.Vector2
    controls: { target: THREE.Vector3; update: () => void } | null
  }
  const flying = useRef(false)
  const parallax = useRef(new THREE.Vector2())
  const v = useMemo(() => ({ target: new THREE.Vector3(), cam: new THREE.Vector3(), tmp: new THREE.Vector3() }), [])
  useEffect(() => { flying.current = true }, [focus])
  useFrame(() => {
    if (!controls) return
    const px = parallax.current
    const nx = pointer.x * 0.15, ny = pointer.y * 0.1
    controls.target.x += nx - px.x
    controls.target.y += ny - px.y
    px.set(nx, ny)
    if (!flying.current) { controls.update(); return }
    const { target, cam, tmp } = v
    if ((focus?.kind === 'star' || focus?.kind === 'point') && shared.group) {
      const i = indexOf.get(focus.id) ?? 0
      shared.group.localToWorld(posOf(i, target))
      cam.copy(target).add(tmp.set(0.6, 0.9, 2.6))
    } else if (focus?.kind === 'tag' && shared.group) {
      shared.group.localToWorld(armMid(focus.tag, target))
      tmp.set(target.x, 0, target.z).normalize().multiplyScalar(3.5)
      cam.copy(target).add(tmp).add(tmp.set(0, 3.2, 0))
    } else {
      target.set(0, 0, 0)
      cam.set(0, 6, 15)
    }
    target.x += px.x
    target.y += px.y
    controls.target.lerp(target, 0.07)
    camera.position.lerp(cam, 0.06)
    controls.update()
    if (camera.position.distanceTo(cam) < 0.05) flying.current = false
  })
  return null
}

/* ---------- rotating galaxy group ---------- */
function GalaxyGroup({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null)
  useEffect(() => {
    shared.group = ref.current
    return () => { shared.group = null }
  }, [])
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.02 * (1 - shared.near * 0.9)
  })
  return (
    <group position={[0, -0.6, 0]} rotation-x={0.28}>
      <group ref={ref}>{children}</group>
    </group>
  )
}

/* ---------- scene ---------- */
function World({ focus, nearMode, onStar, onPoint, onEmpty, onNearMode, onCount }: {
  focus: Focus
  nearMode: boolean
  onStar: (a: Article) => void
  onPoint: (a: Article) => void
  onEmpty: () => void
  onNearMode: (b: boolean) => void
  onCount: (n: number) => void
}) {
  const tex = useTextures()
  const focusTag: Tag | null = focus?.kind === 'tag' ? focus.tag : focus ? byId.get(focus.id)?.tag ?? null : null
  return (
    <group>
      <GalaxyGroup>
        <Dust />
        {tags.map((t) => <ArmNebula key={t} tag={t} tex={tex} active={focusTag === t} />)}
        <ArticlePoints />
        <NearbyStars tex={tex} nearMode={nearMode} focus={focus} focusTag={focusTag} onPick={onStar} onCount={onCount} />
      </GalaxyGroup>
      <Core tex={tex} />
      <ShootingStars />
      <LodController nearMode={nearMode} onNearMode={onNearMode} />
      <PointPicker nearMode={nearMode} onPoint={onPoint} onEmpty={onEmpty} />
    </group>
  )
}

export default function GalaxyScene({ onOpenArticle }: SceneProps) {
  const [focus, setFocus] = useState<Focus>(null)
  const [nearMode, setNearMode] = useState(false)
  const [nearCount, setNearCount] = useState(0)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  const pickStar = (a: Article) => {
    setFocus({ kind: 'star', id: a.id })
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => onOpenArticle(a), 600)
  }
  const pickPoint = (a: Article) => {
    window.clearTimeout(timer.current)
    setFocus({ kind: 'point', id: a.id })
  }
  const clearFocus = () => {
    window.clearTimeout(timer.current)
    setFocus(null)
  }
  const pickTag = (t: Tag) => {
    window.clearTimeout(timer.current)
    setFocus((f) => (f?.kind === 'tag' && f.tag === t ? null : { kind: 'tag', tag: t }))
  }

  const curStar = focus && focus.kind !== 'tag' ? byId.get(focus.id) : undefined
  const curTag: Tag | null = focus?.kind === 'tag' ? focus.tag : curStar?.tag ?? null

  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_55%,#1d1240_0%,#0b0818_55%,#040309_100%)]">
      <Canvas camera={{ position: [0, 6, 15], fov: 50 }} dpr={[1, 2]}>
        <fog attach="fog" args={['#07051a', 18, 40]} />
        <Stars radius={90} depth={40} count={3500} factor={3} fade speed={0.3} />
        <World focus={focus} nearMode={nearMode} onStar={pickStar} onPoint={pickPoint} onEmpty={clearFocus} onNearMode={setNearMode} onCount={setNearCount} />
        <OrbitControls makeDefault enablePan={false} minDistance={1.2} maxDistance={24} zoomToCursor />
        <Rig focus={focus} />
      </Canvas>

      {/* arm index */}
      <div className="absolute left-8 top-1/2 z-10 -translate-y-1/2 max-[900px]:hidden">
        <div className="mb-3 font-mono text-[10px] tracking-[0.3em] text-white/40">SPIRAL ARMS · 旋臂</div>
        <ol className="space-y-1">
          {tags.map((t) => {
            const on = curTag === t
            const color = tagColors[t]
            return (
              <li key={t}>
                <button onClick={() => pickTag(t)} className={`group flex items-center gap-3 py-1.5 text-left transition ${on ? 'text-white' : 'text-white/50 hover:text-white'}`}>
                  <span className={`h-px transition-all ${on ? 'w-10' : 'w-4 group-hover:w-7'}`} style={{ background: color }} />
                  <span className="h-2 w-2 rounded-full" style={{ background: color, boxShadow: `0 0 10px ${color}` }} />
                  <span className="text-sm font-semibold">{t}臂</span>
                  <span className="font-mono text-[10px] opacity-60">{tagEn[t]} · {counts[t]} 篇</span>
                </button>
              </li>
            )
          })}
        </ol>
        <div className="mt-4 text-[11px] leading-relaxed text-white/35">每颗星是一篇文章 · 越靠外越新<br />点击星星飞近 · 点击空白返回</div>
      </div>

      {/* LOD indicator */}
      <div className="pointer-events-none absolute left-1/2 top-6 z-10 -translate-x-1/2 text-center">
        <div className="rounded-full border border-white/10 bg-[#120d24]/60 px-4 py-1.5 font-mono text-[11px] tracking-widest text-white/80 backdrop-blur">
          {nearMode ? `近景 · 附近 ${nearCount} 篇可交互` : `远景 · ${allArticles.length} 颗星`}
        </div>
        <div className="mt-2 text-[11px] text-white/40">{nearMode ? '拖动旋转 · 点击星星阅读' : '滚轮放大以浏览附近文章'}</div>
      </div>

      {curTag && (
        <div className="absolute bottom-28 left-1/2 z-10 w-[min(90vw,26rem)] -translate-x-1/2 rounded-2xl border border-white/10 bg-[#120d24]/70 px-6 py-4 text-center text-white shadow-2xl backdrop-blur-xl">
          <div className="font-mono text-[10px] tracking-[0.25em]" style={{ color: tagColors[curTag] }}>
            {curStar ? `STAR · ${curStar.date}` : `SPIRAL ARM · ${tagEn[curTag]}`}
          </div>
          <div className="mt-1 text-lg font-black leading-snug">{curStar ? curStar.title : `${curTag}臂 · ${counts[curTag]} 篇文章`}</div>
          <div className="mt-1 text-xs text-white/55">
            {focus?.kind === 'star' ? '正在飞往这颗星，即将展开文章…' : focus?.kind === 'point' ? '已飞近 · 再次点击这颗星阅读' : '滚轮放大浏览这条旋臂上的文章 · 点击空白处返回全景'}
          </div>
        </div>
      )}
    </div>
  )
}
