import { useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Html, ContactShadows, RoundedBox, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { articles, type Article } from '../../data/articles'
import type { SceneProps } from '../types'

const INK = '#2b2118'
const CREAM = '#fbf4e8'
const bookColors = ['#c8553d', '#2d6a6a', '#e0a458', '#5b4b8a', '#8aa29e', '#d17a5a', '#3e5641', '#b5838d', '#f2c14e']
const ROOM_Y = -1.2

type SpotDef = {
  key: string
  no: string
  name: string
  role: string
  /** world-space focus point */
  pos: [number, number, number]
  zoom: number
  note: string
  /** custom content shown when the object is clicked — edit freely */
  story?: { title: string; meta: string; body: string[] }
}

const spots: SpotDef[] = [
  { key: 'shelf', no: '01', name: '书架', role: `文章 · ${articles.length} 篇`, pos: [-1.2, 0.1, -2.6], zoom: 150, note: '正在打开文章列表…' },
  { key: 'desk', no: '02', name: '书桌', role: '作品集', pos: [1.1, 0.25, -2.2], zoom: 165, note: '即将开放 — 屏幕里会放进作品集', story: { title: '这张桌子上诞生过的东西', meta: '作品集 · 3 件进行中', body: ['左边那台显示器陪我做完了这个网站的第一版：一个会呼吸的房间。', '现在桌上摊着三件事：一套 3D 场景模块协议、一个给猫做的喂食提醒小程序，还有一本没写完的配色笔记。', '作品集会在这里展开——每个作品都是屏幕里的一扇窗。'] } },
  { key: 'vinyl', no: '03', name: '唱片机', role: '最近在听', pos: [2.2, -0.6, 0.6], zoom: 190, note: '正在播放：坂本龙一《Aqua》', story: { title: '坂本龙一《Aqua》', meta: '最近在听 · 1999 · BTTB', body: ['写东西卡住的时候就放这张。钢琴很干净，没有多余的情绪，像一杯温水。', '唱片机是在下北泽的二手店淘的，转速有点不稳，反而让每次播放都不太一样。', '下一版：这里会接入真正的播放列表。'] } },
  { key: 'window', no: '04', name: '窗', role: '此刻 · 东京 18:42', pos: [-2.9, 1.1, 0.6], zoom: 170, note: '傍晚，天快黑了，云很慢', story: { title: '此刻窗外', meta: '东京 · 18:42 · 晴 · 21°C', body: ['傍晚，天快黑了，云走得很慢。对面楼的灯一盏一盏亮起来。', '这扇窗以后会接真实的时间与天气：清晨是淡蓝，雨天会有水珠划过玻璃。'] } },
  { key: 'about', no: '05', name: '猫与植物', role: '关于我', pos: [0.2, -0.9, 0.9], zoom: 200, note: '写代码、做设计、养一只叫年糕的猫', story: { title: '你好，我是林', meta: '设计师 / 前端 · 养一只叫年糕的猫', body: ['白天写代码，晚上做设计，周末骑车去海边。', '相信好的界面应该像一个房间——你走进来，自然知道东西放在哪。', '年糕是一只橘猫，三岁，最喜欢睡在地毯正中间。'] } },
]
const spotOf = (k: string) => spots.find((s) => s.key === k)!

const hoverOn = (set: (v: boolean) => void) => (e: { stopPropagation: () => void }) => {
  e.stopPropagation(); set(true); document.body.style.cursor = 'pointer'
}

/* ---------- pill label (IslandsScene style) ---------- */
function Pill({ d, lit }: { d: SpotDef; lit: boolean }) {
  return (
    <Html zIndexRange={[20, 0]} center style={{ pointerEvents: 'none' }}>
      <div className={`flex flex-col items-center transition-all duration-300 ${lit ? '-translate-y-1' : ''}`}>
        <div className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3 py-1 shadow-lg transition-colors ${lit ? 'bg-[#2b2118] text-[#fbf4e8]' : 'bg-[#fbf4e8]/90 text-[#2b2118]'}`}>
          <span className="font-mono text-[9px] opacity-60">{d.no}</span>
          <span className="text-[12px] font-semibold">{d.name}</span>
        </div>
        <div className={`mt-1 whitespace-nowrap font-mono text-[9px] text-[#2b2118]/80 transition-opacity ${lit ? 'opacity-100' : 'opacity-0'}`}>{d.role}</div>
        <div className="h-4 w-px bg-[#2b2118]/30" />
      </div>
    </Html>
  )
}

function Hotspot({ k, children, labelAt, active, onPick }: { k: string; children: React.ReactNode; labelAt: [number, number, number]; active: boolean; onPick: (k: string) => void }) {
  const [hover, setHover] = useState(false)
  return (
    <group
      onPointerOver={hoverOn(setHover)}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); onPick(k) }}
    >
      {children}
      <group position={labelAt}><Pill d={spotOf(k)} lit={hover || active} /></group>
    </group>
  )
}

/* ---------- books ---------- */
function Book({ a, i, onOpen }: { a: Article; i: number; onOpen: (a: Article) => void }) {
  const [hover, setHover] = useState(false)
  const ref = useRef<THREE.Group>(null)
  const h = 0.55 + ((i * 37) % 5) * 0.05
  const tilt = i === 4 ? -0.18 : 0
  useFrame(() => {
    if (ref.current) ref.current.position.z = THREE.MathUtils.lerp(ref.current.position.z, hover ? 0.25 : 0, 0.2)
  })
  return (
    <group position={[-0.75 + (i % 5) * 0.3 + (i >= 5 ? 0.15 : 0), (i < 5 ? 0.6 : 1.5) + h / 2, 0]} rotation-z={tilt}>
    {/* static hit area: prevents hover flicker when the book slides out */}
    <mesh
      position={[0, 0, 0.12]}
      onPointerOver={hoverOn(setHover)}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); onOpen(a) }}
    >
      <boxGeometry args={[0.27, h, 0.74]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
    <group ref={ref}>
      <RoundedBox args={[0.24, h, 0.48]} radius={0.025} smoothness={2} castShadow raycast={() => null}>
        <meshStandardMaterial color={bookColors[i % bookColors.length]} roughness={0.7} emissive={hover ? '#ffb867' : '#000'} emissiveIntensity={hover ? 0.15 : 0} />
      </RoundedBox>
      <mesh position={[0, h * 0.2, 0.242]}><planeGeometry args={[0.16, 0.03]} /><meshBasicMaterial color={CREAM} /></mesh>
      <mesh position={[0, -h * 0.2, 0.242]}><planeGeometry args={[0.16, 0.015]} /><meshBasicMaterial color={CREAM} /></mesh>
      {hover && (
        <Html zIndexRange={[20, 0]} center position={[0, h / 2 + 0.3, 0]} style={{ pointerEvents: 'none' }}>
          <div className="w-44 rounded-lg bg-[#2b2118] px-3 py-2 text-[11px] leading-snug text-[#fbf4e8] shadow-xl">
            <div className="mb-0.5 font-mono text-[9px] opacity-60">{a.tag} · {a.minutes} 分钟</div>
            {a.title}
          </div>
        </Html>
      )}
    </group>
    </group>
  )
}

function Bookshelf({ active, onPick, onOpenArticle }: { active: boolean; onPick: (k: string) => void; onOpenArticle: (a: Article) => void }) {
  const wood = '#7a4e2d', dark = '#5e3a20'
  return (
    <group position={[-1.2, 0, -2.65]}>
      <Hotspot k="shelf" labelAt={[0, 3.0, 0]} active={active} onPick={onPick}>
        <RoundedBox args={[2.05, 2.5, 0.06]} radius={0.02} position={[0, 1.25, -0.3]} castShadow><meshStandardMaterial color={dark} /></RoundedBox>
        {[0.06, 0.56, 1.46, 2.42].map((y) => (
          <RoundedBox key={y} args={[2.05, 0.08, 0.64]} radius={0.03} smoothness={2} position={[0, y, 0]} castShadow receiveShadow><meshStandardMaterial color={wood} /></RoundedBox>
        ))}
        {[-0.99, 0.99].map((x) => (
          <RoundedBox key={x} args={[0.08, 2.5, 0.64]} radius={0.03} smoothness={2} position={[x, 1.25, 0]} castShadow><meshStandardMaterial color={dark} /></RoundedBox>
        ))}
      </Hotspot>
      {articles.map((a, i) => <Book key={a.id} a={a} i={i} onOpen={onOpenArticle} />)}
      {/* shelf props */}
      <mesh position={[0.65, 1.6, 0]} castShadow><cylinderGeometry args={[0.09, 0.07, 0.16, 8]} /><meshStandardMaterial color="#e9d5b7" flatShading /></mesh>
      <mesh position={[0.65, 1.78, 0]} castShadow><icosahedronGeometry args={[0.13, 0]} /><meshStandardMaterial color="#5f8a5a" flatShading /></mesh>
      <mesh position={[0.82, 0.68, 0]} castShadow><dodecahedronGeometry args={[0.1, 0]} /><meshStandardMaterial color="#b5838d" flatShading /></mesh>
      <mesh position={[-0.4, 2.58, 0]} castShadow><icosahedronGeometry args={[0.15, 0]} /><meshStandardMaterial color="#8aa29e" flatShading /></mesh>
      <mesh position={[0.4, 2.53, 0.05]} rotation-y={0.4} castShadow><boxGeometry args={[0.4, 0.14, 0.3]} /><meshStandardMaterial color="#d17a5a" /></mesh>
    </group>
  )
}

/* ---------- lamp with flicker + dust ---------- */
function Lamp() {
  const light = useRef<THREE.PointLight>(null)
  const shade = useRef<THREE.MeshStandardMaterial>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    const f = 1 + Math.sin(t * 1.2) * 0.04
    if (light.current) light.current.intensity = 6 * f
    if (shade.current) shade.current.emissiveIntensity = 0.6 * f
  })
  return (
    <group position={[0.75, 1.04, 0.1]}>
      <mesh position={[0, 0.02, 0]} castShadow><cylinderGeometry args={[0.14, 0.16, 0.04, 24]} /><meshStandardMaterial color={INK} /></mesh>
      <mesh position={[0, 0.25, 0]} rotation-z={0.15}><cylinderGeometry args={[0.015, 0.015, 0.46]} /><meshStandardMaterial color={INK} /></mesh>
      <mesh position={[-0.05, 0.5, 0]}><sphereGeometry args={[0.03, 10, 10]} /><meshStandardMaterial color={INK} /></mesh>
      <mesh position={[-0.12, 0.62, 0]} rotation-z={-0.4} castShadow>
        <coneGeometry args={[0.2, 0.22, 24, 1, true]} />
        <meshStandardMaterial ref={shade} color="#f2c14e" side={THREE.DoubleSide} emissive="#f2a33a" emissiveIntensity={0.6} />
      </mesh>
      <mesh position={[-0.12, 0.55, 0]}><sphereGeometry args={[0.05, 12, 12]} /><meshBasicMaterial color="#fff3d6" /></mesh>
      <pointLight ref={light} position={[-0.12, 0.45, 0.05]} color="#ffb867" distance={4.5} castShadow shadow-mapSize={[512, 512]} shadow-bias={-0.002} shadow-normalBias={0.03} />
      <Sparkles count={28} scale={[1.2, 1.1, 1]} position={[-0.2, 0.1, 0.3]} size={2.2} speed={0.25} color="#ffd9a0" opacity={0.8} />
    </group>
  )
}

function Steam() {
  const ref = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    ref.current?.children.forEach((m, i) => {
      const t = (clock.elapsedTime * 0.35 + i / 3) % 1
      m.position.set(Math.sin(t * 6 + i) * 0.025, 0.1 + t * 0.35, 0)
      m.scale.setScalar(0.02 + t * 0.045)
      ;((m as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.55 * Math.sin(t * Math.PI)
    })
  })
  return (
    <group ref={ref}>
      {[0, 1, 2].map((i) => <mesh key={i}><sphereGeometry args={[1, 8, 8]} /><meshBasicMaterial color="#ffffff" transparent depthWrite={false} /></mesh>)}
    </group>
  )
}

function Desk({ active, onPick }: { active: boolean; onPick: (k: string) => void }) {
  const screen = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    if (screen.current) screen.current.color.setHSL(0.57, 0.6, 0.72 + Math.sin(clock.elapsedTime * 0.8) * 0.03)
  })
  return (
    <group position={[1.2, 0, -2.2]}>
      <RoundedBox args={[2.2, 0.08, 1]} radius={0.03} smoothness={3} position={[0, 1, 0]} castShadow receiveShadow><meshStandardMaterial color="#8b5a35" /></RoundedBox>
      {[[-1, -0.4], [1, -0.4], [-1, 0.4], [1, 0.4]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.48, z]} castShadow><cylinderGeometry args={[0.03, 0.025, 0.96, 8]} /><meshStandardMaterial color={INK} /></mesh>
      ))}
      {/* drawer */}
      <RoundedBox args={[0.6, 0.22, 0.85]} radius={0.03} position={[0.6, 0.83, 0]} castShadow><meshStandardMaterial color="#7a4e2d" /></RoundedBox>
      <mesh position={[0.6, 0.83, 0.43]}><boxGeometry args={[0.16, 0.03, 0.02]} /><meshStandardMaterial color={INK} /></mesh>
      <Hotspot k="desk" labelAt={[-0.2, 2.3, 0]} active={active} onPick={onPick}>
        <RoundedBox args={[1.05, 0.68, 0.06]} radius={0.03} position={[-0.2, 1.58, -0.15]} castShadow><meshStandardMaterial color={INK} /></RoundedBox>
        <mesh position={[-0.2, 1.6, -0.115]}><planeGeometry args={[0.93, 0.54]} /><meshBasicMaterial ref={screen} color="#a7d8ff" /></mesh>
        {[0, 1, 2, 3].map((r) => (
          <mesh key={r} position={[-0.5 + (r % 2) * 0.08, 1.75 - r * 0.09, -0.11]}><planeGeometry args={[0.3 - r * 0.04, 0.03]} /><meshBasicMaterial color={r === 0 ? '#2b2118' : '#5b7fa8'} /></mesh>
        ))}
        <mesh position={[0.08, 1.6, -0.11]}><planeGeometry args={[0.28, 0.3]} /><meshBasicMaterial color="#f2c14e" /></mesh>
        <mesh position={[-0.2, 1.15, -0.15]}><boxGeometry args={[0.08, 0.25, 0.08]} /><meshStandardMaterial color={INK} /></mesh>
        <mesh position={[-0.2, 1.05, -0.15]}><cylinderGeometry args={[0.16, 0.18, 0.02, 20]} /><meshStandardMaterial color={INK} /></mesh>
        <RoundedBox args={[0.7, 0.03, 0.22]} radius={0.01} position={[-0.2, 1.055, 0.2]}><meshStandardMaterial color="#f4e6cf" /></RoundedBox>
        <RoundedBox args={[0.1, 0.03, 0.14]} radius={0.012} position={[0.3, 1.055, 0.22]}><meshStandardMaterial color="#f4e6cf" /></RoundedBox>
      </Hotspot>
      {/* mug + steam */}
      <group position={[-0.85, 1.04, 0.2]}>
        <mesh position={[0, 0.07, 0]} castShadow><cylinderGeometry args={[0.065, 0.055, 0.14, 16]} /><meshStandardMaterial color="#e8f0ec" /></mesh>
        <mesh position={[0, 0.135, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.058, 16]} /><meshStandardMaterial color="#5a3420" /></mesh>
        <mesh position={[0.075, 0.07, 0]} rotation-y={Math.PI / 2}><torusGeometry args={[0.035, 0.012, 6, 12]} /><meshStandardMaterial color="#e8f0ec" /></mesh>
        <Steam />
      </group>
      {/* notebook */}
      <mesh position={[-0.75, 1.055, -0.15]} rotation-y={0.3} castShadow><boxGeometry args={[0.3, 0.025, 0.38]} /><meshStandardMaterial color="#c8553d" /></mesh>
      <Lamp />
      <Chair />
    </group>
  )
}

function Chair() {
  const c = '#d17a5a'
  return (
    <group position={[-0.25, 0, 0.95]} rotation-y={0.35}>
      <RoundedBox args={[0.62, 0.1, 0.58]} radius={0.04} smoothness={3} position={[0, 0.6, 0]} castShadow><meshStandardMaterial color={c} /></RoundedBox>
      <RoundedBox args={[0.62, 0.6, 0.08]} radius={0.04} smoothness={3} position={[0, 0.95, 0.27]} rotation-x={-0.1} castShadow><meshStandardMaterial color={c} /></RoundedBox>
      {[[-0.25, -0.22], [0.25, -0.22], [-0.25, 0.22], [0.25, 0.22]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.28, z]} castShadow><cylinderGeometry args={[0.025, 0.02, 0.56, 6]} /><meshStandardMaterial color="#6a4226" /></mesh>
      ))}
    </group>
  )
}

/* ---------- record player ---------- */
function RecordPlayer({ active, onPick }: { active: boolean; onPick: (k: string) => void }) {
  const disc = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (disc.current) disc.current.rotation.y += d * 2.2 })
  return (
    <group position={[2.2, 0, 0.6]}>
      <Hotspot k="vinyl" labelAt={[0, 1.35, 0]} active={active} onPick={onPick}>
        <RoundedBox args={[1.05, 0.55, 0.85]} radius={0.06} smoothness={3} position={[0, 0.28, 0]} castShadow><meshStandardMaterial color="#5b4b8a" /></RoundedBox>
        {[-0.25, 0.25].map((x) => (
          <mesh key={x} position={[x, 0.22, 0.43]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.13, 0.13, 0.02, 20]} /><meshStandardMaterial color="#3d3160" /></mesh>
        ))}
        <RoundedBox args={[0.95, 0.06, 0.75]} radius={0.02} position={[0, 0.58, 0]} castShadow><meshStandardMaterial color="#c49a6c" /></RoundedBox>
        <group ref={disc} position={[-0.08, 0.63, 0]}>
          <mesh><cylinderGeometry args={[0.31, 0.31, 0.02, 40]} /><meshStandardMaterial color="#1a1420" roughness={0.25} /></mesh>
          <mesh position={[0, 0.011, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.18, 0.19, 32]} /><meshBasicMaterial color="#3a3040" /></mesh>
          <mesh position={[0, 0.012, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.09, 24]} /><meshBasicMaterial color="#e0a458" /></mesh>
          <mesh position={[0.05, 0.013, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.02, 8]} /><meshBasicMaterial color="#c8553d" /></mesh>
        </group>
        <mesh position={[0.33, 0.68, -0.22]}><cylinderGeometry args={[0.04, 0.04, 0.08, 10]} /><meshStandardMaterial color="#d8d0c4" metalness={0.6} roughness={0.3} /></mesh>
        <mesh position={[0.2, 0.7, -0.05]} rotation-y={0.5} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.01, 0.01, 0.42, 6]} /><meshStandardMaterial color="#d8d0c4" metalness={0.6} roughness={0.3} /></mesh>
      </Hotspot>
      {/* record crate */}
      <group position={[0.15, 0, 0.85]}>
        <RoundedBox args={[0.6, 0.35, 0.4]} radius={0.03} position={[0, 0.18, 0]} castShadow><meshStandardMaterial color="#c49a6c" /></RoundedBox>
        {['#c8553d', '#2d6a6a', '#f2c14e', '#b5838d'].map((c, i) => (
          <mesh key={c} position={[-0.2 + i * 0.13, 0.42, 0]} rotation-z={-0.15}><boxGeometry args={[0.02, 0.36, 0.34]} /><meshStandardMaterial color={c} /></mesh>
        ))}
      </group>
    </group>
  )
}

/* ---------- window with evening sky ---------- */
function useSkyTexture() {
  return useMemo(() => {
    const c = document.createElement('canvas')
    c.width = 4; c.height = 128
    const g = c.getContext('2d')!
    const gr = g.createLinearGradient(0, 0, 0, 128)
    gr.addColorStop(0, '#3f3a6b'); gr.addColorStop(0.45, '#b06a8a'); gr.addColorStop(0.75, '#f59a6a'); gr.addColorStop(1, '#ffd08a')
    g.fillStyle = gr; g.fillRect(0, 0, 4, 128)
    const t = new THREE.CanvasTexture(c)
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }, [])
}

function Sky() {
  const tex = useSkyTexture()
  const clouds = useRef<THREE.Group>(null)
  const sun = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    clouds.current?.children.forEach((c, i) => { c.position.z = ((t * (0.05 + i * 0.02) + i * 1.1) % 3.2) - 1.0 })
    if (sun.current) sun.current.position.y = 1.85 + Math.sin(t * 0.05) * 0.06
  })
  return (
    <group>
      <mesh position={[-3.7, 2.3, 0.6]} rotation-y={Math.PI / 2}><planeGeometry args={[3.2, 2.6]} /><meshBasicMaterial map={tex} /></mesh>
      <mesh ref={sun} position={[-3.6, 1.85, 0.25]} rotation-y={Math.PI / 2}><circleGeometry args={[0.2, 32]} /><meshBasicMaterial color="#fff1d0" /></mesh>
      <mesh position={[-3.62, 1.85, 0.25]} rotation-y={Math.PI / 2}><circleGeometry args={[0.34, 32]} /><meshBasicMaterial color="#ffd8a0" transparent opacity={0.35} /></mesh>
      {/* distant rooftops */}
      {[[-0.4, 0.5], [0.1, 0.32], [0.55, 0.62], [1.0, 0.4], [1.45, 0.55]].map(([z, h], i) => (
        <mesh key={i} position={[-3.5, 1.5 + h / 2, z]} rotation-y={Math.PI / 2}><planeGeometry args={[0.45, h]} /><meshBasicMaterial color="#4a3a5a" /></mesh>
      ))}
      <group ref={clouds}>
        {[2.75, 2.45, 2.9].map((y, i) => (
          <group key={i} position={[-3.4 + i * 0.05, y, 0]}>
            {[0, 0.12, -0.11].map((z, k) => (
              <mesh key={k} position={[0, k === 0 ? 0.04 : 0, z]} scale={[0.04, k === 0 ? 0.08 : 0.06, k === 0 ? 0.12 : 0.09]}>
                <icosahedronGeometry args={[1, 1]} /><meshBasicMaterial color={i === 1 ? '#ffc8a8' : '#fbe2d6'} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    </group>
  )
}

function Window({ active, onPick }: { active: boolean; onPick: (k: string) => void }) {
  const frame = '#fbf4e8'
  return (
    <Hotspot k="window" labelAt={[-2.9, 3.4, 0.6]} active={active} onPick={onPick}>
      <group position={[-2.98, 2.3, 0.6]}>
        {[[0, 0.82, 0.08, 1.7], [0, -0.82, 0.08, 1.7], [0, 0, 1.72, 0.08]].map(([y, z0, h, w], i) => (
          i < 2
            ? <mesh key={i} position={[0, z0, 0]}><boxGeometry args={[0.12, h, w]} /><meshStandardMaterial color={frame} /></mesh>
            : <mesh key={i} position={[0, y, 0]}><boxGeometry args={[0.06, h, 0.05]} /><meshStandardMaterial color={frame} /></mesh>
        ))}
        {[-0.84, 0.84].map((z) => <mesh key={z} position={[0, 0, z]}><boxGeometry args={[0.12, 1.72, 0.08]} /><meshStandardMaterial color={frame} /></mesh>)}
        <mesh><boxGeometry args={[0.04, 0.05, 1.7]} /><meshStandardMaterial color={frame} /></mesh>
        {/* sill */}
        <RoundedBox args={[0.32, 0.06, 1.95]} radius={0.02} position={[0.14, -0.88, 0]} castShadow><meshStandardMaterial color={frame} /></RoundedBox>
        <mesh position={[0.15, -0.76, 0.55]} castShadow><cylinderGeometry args={[0.07, 0.055, 0.14, 8]} /><meshStandardMaterial color="#c8553d" flatShading /></mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={i} position={[0.15 + Math.cos(i * 2) * 0.03, -0.62 + i * 0.04, 0.55 + Math.sin(i * 2) * 0.03]}><coneGeometry args={[0.04, 0.16, 5]} /><meshStandardMaterial color="#5f8a5a" flatShading /></mesh>
        ))}
        {/* curtains */}
        {[-1.05, 1.05].map((z) => (
          <mesh key={z} position={[0.12, 0.05, z]} castShadow><boxGeometry args={[0.05, 1.9, 0.28]} /><meshStandardMaterial color="#e0a458" roughness={1} /></mesh>
        ))}
        <mesh position={[0.14, 1.02, 0]} rotation-x={Math.PI / 2}><cylinderGeometry args={[0.02, 0.02, 2.5, 8]} /><meshStandardMaterial color={INK} /></mesh>
      </group>
    </Hotspot>
  )
}

/* ---------- walls (left wall has a window opening) ---------- */
function Walls() {
  const lw = '#efdcc0'
  // opening: z in [-0.25, 1.45], y in [1.45, 3.15]
  return (
    <group>
      <mesh position={[0, 2, -3.05]} receiveShadow><boxGeometry args={[6, 4, 0.1]} /><meshStandardMaterial color="#f4e6cf" /></mesh>
      <mesh position={[-3.05, 0.725, 0]} receiveShadow><boxGeometry args={[0.1, 1.45, 6]} /><meshStandardMaterial color={lw} /></mesh>
      <mesh position={[-3.05, 3.575, 0]} receiveShadow><boxGeometry args={[0.1, 0.85, 6]} /><meshStandardMaterial color={lw} /></mesh>
      <mesh position={[-3.05, 2.3, -1.625]} receiveShadow><boxGeometry args={[0.1, 1.7, 2.75]} /><meshStandardMaterial color={lw} /></mesh>
      <mesh position={[-3.05, 2.3, 2.225]} receiveShadow><boxGeometry args={[0.1, 1.7, 1.55]} /><meshStandardMaterial color={lw} /></mesh>
      {/* skirting */}
      <mesh position={[0, 0.08, -2.98]}><boxGeometry args={[6, 0.16, 0.04]} /><meshStandardMaterial color="#d9bf98" /></mesh>
      <mesh position={[-2.98, 0.08, 0]}><boxGeometry args={[0.04, 0.16, 6]} /><meshStandardMaterial color="#d9bf98" /></mesh>
    </group>
  )
}

/* ---------- wall shelf, frames, fairy lights ---------- */
function WallDecor() {
  return (
    <group>
      <group position={[1.5, 2.85, -2.85]}>
        <RoundedBox args={[1.5, 0.06, 0.3]} radius={0.02} castShadow><meshStandardMaterial color="#8b5a35" /></RoundedBox>
        {[-0.6, 0.6].map((x) => <mesh key={x} position={[x, -0.08, -0.08]}><boxGeometry args={[0.04, 0.14, 0.1]} /><meshStandardMaterial color={INK} /></mesh>)}
        <mesh position={[-0.45, 0.1, 0]} castShadow><cylinderGeometry args={[0.08, 0.06, 0.14, 8]} /><meshStandardMaterial color="#fbf4e8" flatShading /></mesh>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i} position={[-0.45 + Math.cos(i * 1.6) * 0.06, 0.22 - i * 0.07, 0.05 + Math.sin(i * 1.6) * 0.05]} castShadow>
            <icosahedronGeometry args={[0.07, 0]} /><meshStandardMaterial color={i % 2 ? '#5f8a5a' : '#79a36e'} flatShading />
          </mesh>
        ))}
        <mesh position={[0.05, 0.13, 0]} castShadow><cylinderGeometry args={[0.07, 0.07, 0.2, 10]} /><meshStandardMaterial color="#c8553d" /></mesh>
        <mesh position={[0.45, 0.06, 0]} rotation-z={0.1}><boxGeometry args={[0.3, 0.08, 0.2]} /><meshStandardMaterial color="#2d6a6a" /></mesh>
        <mesh position={[0.42, 0.13, 0]} rotation-z={-0.05}><boxGeometry args={[0.28, 0.06, 0.2]} /><meshStandardMaterial color="#e0a458" /></mesh>
      </group>
      {/* frames */}
      {[
        { p: [0.35, 2.55, -2.98], s: [0.45, 0.6], c: '#8aa29e' },
        { p: [2.5, 2.1, -2.98], s: [0.4, 0.4], c: '#f2c14e' },
        { p: [-2.98, 2.55, -1.8], s: [0.5, 0.38], c: '#b5838d', side: true },
        { p: [-2.98, 2.0, -2.35], s: [0.3, 0.4], c: '#2d6a6a', side: true },
      ].map((f, i) => (
        <group key={i} position={f.p as [number, number, number]} rotation-y={f.side ? Math.PI / 2 : 0}>
          <mesh castShadow><boxGeometry args={[f.s[0] + 0.08, f.s[1] + 0.08, 0.04]} /><meshStandardMaterial color={INK} /></mesh>
          <mesh position={[0, 0, 0.021]}><planeGeometry args={f.s as [number, number]} /><meshBasicMaterial color={CREAM} /></mesh>
          <mesh position={[0, -f.s[1] * 0.1, 0.022]}><circleGeometry args={[Math.min(f.s[0], f.s[1]) * 0.28, 5]} /><meshBasicMaterial color={f.c} /></mesh>
        </group>
      ))}
      <FairyLights />
    </group>
  )
}

function FairyLights() {
  const { tube, bulbs } = useMemo(() => {
    const pts: THREE.Vector3[] = []
    // along back wall then onto left wall
    for (let i = 0; i <= 8; i++) pts.push(new THREE.Vector3(2.8 - i * 0.7, 3.6 - Math.abs(Math.sin(i * 1.57)) * 0.22, -2.97))
    for (let i = 1; i <= 4; i++) pts.push(new THREE.Vector3(-2.97, 3.6 - Math.abs(Math.sin(i * 1.57)) * 0.22, -3 + i * 0.7))
    const curve = new THREE.CatmullRomCurve3(pts)
    const tube = new THREE.TubeGeometry(curve, 120, 0.008, 4)
    const bulbs = Array.from({ length: 24 }, (_, i) => curve.getPoint((i + 0.5) / 24).add(new THREE.Vector3(0, -0.04, 0)))
    return { tube, bulbs }
  }, [])
  const mats = useRef<(THREE.MeshBasicMaterial | null)[]>([])
  const palette = ['#ffd27a', '#ffb3a0', '#fff1c4', '#ffc46b']
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    mats.current.forEach((m, i) => {
      if (!m) return
      const k = 0.65 + 0.35 * Math.sin(t * 2.2 + i * 1.7)
      m.color.set(palette[i % 4]).multiplyScalar(k)
    })
  })
  return (
    <group>
      <mesh geometry={tube}><meshStandardMaterial color="#4a3a2a" /></mesh>
      {bulbs.map((p, i) => (
        <mesh key={i} position={p}><sphereGeometry args={[0.035, 8, 8]} /><meshBasicMaterial ref={(m) => { mats.current[i] = m }} color={palette[i % 4]} toneMapped={false} /></mesh>
      ))}
    </group>
  )
}

/* ---------- cat ---------- */
function Cat() {
  const body = useRef<THREE.Group>(null)
  const tail = useRef<THREE.Group>(null)
  const fur = '#e8a35c'
  useFrame(({ clock }) => {
    const t = clock.elapsedTime
    if (body.current) { const b = 1 + Math.sin(t * 1.6) * 0.04; body.current.scale.set(1, b, 1 + (b - 1) * 0.5) }
    if (tail.current) tail.current.rotation.y = Math.sin(t * 0.9) * 0.35
  })
  return (
    <group rotation-y={-0.6}>
      {/* cushion */}
      <RoundedBox args={[0.9, 0.12, 0.75]} radius={0.06} smoothness={3} position={[0, 0.06, 0]} castShadow receiveShadow><meshStandardMaterial color="#2d6a6a" /></RoundedBox>
      <group ref={body} position={[0, 0.13, 0]}>
        <mesh position={[0, 0.1, 0]} scale={[0.32, 0.17, 0.24]} castShadow><sphereGeometry args={[1, 20, 14]} /><meshStandardMaterial color={fur} roughness={0.9} /></mesh>
        <mesh position={[-0.08, 0.2, 0]} scale={[0.14, 0.04, 0.16]}><sphereGeometry args={[1, 12, 8]} /><meshStandardMaterial color="#c97f3c" /></mesh>
      </group>
      <group position={[0.28, 0.2, 0.08]}>
        <mesh scale={[0.13, 0.11, 0.13]} castShadow><sphereGeometry args={[1, 16, 12]} /><meshStandardMaterial color={fur} roughness={0.9} /></mesh>
        {[-0.06, 0.06].map((z) => (
          <mesh key={z} position={[0.01, 0.1, z]} rotation-x={z * 4}><coneGeometry args={[0.035, 0.07, 4]} /><meshStandardMaterial color={fur} flatShading /></mesh>
        ))}
        {[-0.045, 0.045].map((z) => (
          <mesh key={z} position={[0.11, 0.02, z]} rotation-y={Math.PI / 2}><planeGeometry args={[0.035, 0.008]} /><meshBasicMaterial color={INK} side={THREE.DoubleSide} /></mesh>
        ))}
        <mesh position={[0.125, -0.02, 0]}><sphereGeometry args={[0.012, 6, 6]} /><meshBasicMaterial color="#d17a7a" /></mesh>
      </group>
      <group ref={tail} position={[-0.28, 0.17, 0]}>
        <mesh position={[-0.02, 0, 0.16]} rotation-x={Math.PI / 2} castShadow><capsuleGeometry args={[0.035, 0.28, 4, 8]} /><meshStandardMaterial color="#c97f3c" /></mesh>
      </group>
    </group>
  )
}

function FloorPlant({ p, s = 1 }: { p: [number, number, number]; s?: number }) {
  return (
    <group position={p} scale={s}>
      <mesh position={[0, 0.25, 0]} castShadow><cylinderGeometry args={[0.3, 0.22, 0.5, 12]} /><meshStandardMaterial color="#c8553d" flatShading /></mesh>
      <mesh position={[0, 0.51, 0]} rotation-x={-Math.PI / 2}><circleGeometry args={[0.27, 12]} /><meshStandardMaterial color="#5a3420" /></mesh>
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <mesh key={i} position={[Math.cos(i * 1.3) * 0.16, 0.85 + (i % 3) * 0.22, Math.sin(i * 1.3) * 0.16]} castShadow>
          <icosahedronGeometry args={[0.3 - i * 0.03, 0]} /><meshStandardMaterial color={i % 2 ? '#3e5641' : '#557a52'} flatShading />
        </mesh>
      ))}
    </group>
  )
}

function Room({ onOpenArticle, focus, onPick }: { onOpenArticle: (a: Article) => void; focus: string | null; onPick: (k: string) => void }) {
  return (
    <group position={[0, ROOM_Y, 0]}>
      <RoundedBox args={[6, 0.3, 6]} radius={0.08} position={[0, -0.15, 0]} receiveShadow><meshStandardMaterial color="#e9d5b7" /></RoundedBox>
      {/* floor boards */}
      {Array.from({ length: 11 }, (_, i) => (
        <mesh key={i} position={[-2.75 + i * 0.55, 0.006, 0]} rotation-x={-Math.PI / 2}><planeGeometry args={[0.012, 5.9]} /><meshBasicMaterial color="#d6bd98" /></mesh>
      ))}
      {/* rug */}
      <RoundedBox args={[3.2, 0.03, 2.3]} radius={0.015} position={[0.3, 0.015, 0.7]} receiveShadow><meshStandardMaterial color="#c8553d" roughness={1} /></RoundedBox>
      <RoundedBox args={[2.8, 0.035, 1.9]} radius={0.015} position={[0.3, 0.03, 0.7]} receiveShadow><meshStandardMaterial color="#e0a458" roughness={1} /></RoundedBox>
      <RoundedBox args={[2.4, 0.04, 1.5]} radius={0.015} position={[0.3, 0.045, 0.7]} receiveShadow><meshStandardMaterial color="#c8553d" roughness={1} /></RoundedBox>

      <Walls />
      <Sky />
      <Window active={focus === 'window'} onPick={onPick} />
      <WallDecor />
      <Bookshelf active={focus === 'shelf'} onPick={onPick} onOpenArticle={onOpenArticle} />
      <Desk active={focus === 'desk'} onPick={onPick} />
      <RecordPlayer active={focus === 'vinyl'} onPick={onPick} />

      <group position={[0.2, 0, 0.9]}>
        <Hotspot k="about" labelAt={[0, 0.9, 0]} active={focus === 'about'} onPick={onPick}>
          <Cat />
        </Hotspot>
      </group>
      <FloorPlant p={[-2.3, 0, 2.2]} />
      <FloorPlant p={[-2.45, 0, -0.9]} s={0.7} />
      {/* floor cushion + stacked books */}
      <group position={[-1.3, 0, 1.6]} rotation-y={0.3}>
        {['#2d6a6a', '#f2c14e', '#b5838d'].map((c, i) => (
          <mesh key={c} position={[0, 0.04 + i * 0.07, 0]} rotation-y={i * 0.25} castShadow><boxGeometry args={[0.45, 0.07, 0.32]} /><meshStandardMaterial color={c} /></mesh>
        ))}
      </group>
    </group>
  )
}

/* ---------- camera flight (orthographic) ---------- */
const HOME_OFFSET = new THREE.Vector3(9, 8, 9)
const HOME_ZOOM = 80

function Rig({ focus }: { focus: string | null }) {
  const { camera, controls } = useThree() as unknown as { camera: THREE.OrthographicCamera; controls: { target: THREE.Vector3; update: () => void } | null }
  const flying = useRef(false)
  const last = useRef<string | null>(null)
  const tmpT = useMemo(() => new THREE.Vector3(), [])
  const tmpP = useMemo(() => new THREE.Vector3(), [])
  useFrame(() => {
    if (!controls) return
    if (last.current !== focus) { last.current = focus; flying.current = true }
    if (!flying.current) return
    const d = focus ? spots.find((s) => s.key === focus) : undefined
    if (d) tmpT.set(...d.pos); else tmpT.set(0, 0, 0)
    // keep the current viewing direction, just slide toward the target
    const dir = camera.position.clone().sub(controls.target).normalize().multiplyScalar(HOME_OFFSET.length())
    tmpP.copy(tmpT).add(d ? dir : HOME_OFFSET)
    const zoom = d ? d.zoom : HOME_ZOOM
    controls.target.lerp(tmpT, 0.07)
    camera.position.lerp(tmpP, 0.07)
    camera.zoom = THREE.MathUtils.lerp(camera.zoom, zoom, 0.07)
    camera.updateProjectionMatrix()
    controls.update()
    if (controls.target.distanceTo(tmpT) < 0.01 && Math.abs(camera.zoom - zoom) < 0.5 && camera.position.distanceTo(tmpP) < 0.02) flying.current = false
  })
  return null
}

export default function RoomScene({ onOpenArticle, onOpenList }: SceneProps) {
  const [focus, setFocus] = useState<string | null>(null)
  const timer = useRef<number | undefined>(undefined)
  const pick = (k: string) => {
    window.clearTimeout(timer.current)
    // bookshelf is pure mouse interaction: no camera flight, open list directly
    if (k === 'shelf') { onOpenList(); return }
    setFocus(k)
  }
  const current = focus ? spotOf(focus) : undefined

  return (
    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_40%_30%,#fbe9cf_0%,#f1c9a0_45%,#d98f6a_100%)]">
      <Canvas shadows orthographic dpr={[1, 2]} camera={{ position: [9, 8, 9], zoom: HOME_ZOOM }} onPointerMissed={() => setFocus(null)}>
        <hemisphereLight args={['#fff1dc', '#e0a87a', 0.75]} />
        <directionalLight position={[5, 10, 4]} intensity={1.4} color="#ffe6c8" castShadow shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-camera-left={-6} shadow-camera-right={6} shadow-camera-top={6} shadow-camera-bottom={-6} />
        <pointLight position={[-2.6, 1.3, 0.6]} color="#ff9a6a" intensity={2.5} distance={4} />
        <Room onOpenArticle={onOpenArticle} focus={focus} onPick={pick} />
        <ContactShadows position={[0, -1.52, 0]} opacity={0.35} scale={14} blur={2.5} />
        <OrbitControls makeDefault enablePan={false} minZoom={50} maxZoom={240} minPolarAngle={0.5} maxPolarAngle={1.2} minAzimuthAngle={0.1} maxAzimuthAngle={1.45} />
        <Rig focus={focus} />
      </Canvas>

      {/* hotspot index */}
      <ol className="absolute left-8 top-1/2 z-10 -translate-y-1/2 space-y-1 max-[900px]:hidden">
        {spots.map((d) => {
          const on = d.key === focus
          return (
            <li key={d.key}>
              <button onClick={() => pick(d.key)} className={`group flex items-center gap-3 py-1.5 text-left transition ${on ? 'text-[#2b2118]' : 'text-[#2b2118]/55 hover:text-[#2b2118]'}`}>
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
        <div key={current.key} className="absolute bottom-28 left-1/2 z-10 w-[min(92vw,30rem)] -translate-x-1/2 animate-[rise_.45s_cubic-bezier(.2,.8,.2,1)] rounded-2xl border border-[#fbf4e8]/70 bg-[#fbf4e8]/88 px-7 py-6 text-[#2b2118] shadow-2xl backdrop-blur-xl">
          <div className="flex items-baseline justify-between gap-4">
            <span className="font-mono text-[10px] tracking-[0.25em] opacity-50">OBJECT {current.no} · {current.name}</span>
            <button onClick={() => setFocus(null)} className="font-mono text-[10px] tracking-widest opacity-50 transition hover:opacity-100">× 返回</button>
          </div>
          {current.story ? (
            <>
              <h3 className="mt-3 text-2xl font-black leading-tight">{current.story.title}</h3>
              <div className="mt-1 font-mono text-[11px] text-[#c8553d]">{current.story.meta}</div>
              <div className="scroll-quiet mt-4 max-h-44 space-y-3 overflow-y-auto border-t border-[#2b2118]/10 pt-4 text-sm leading-7 text-[#2b2118]/80">
                {current.story.body.map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </>
          ) : (
            <div className="mt-2 text-lg font-black">{current.role}</div>
          )}
        </div>
      )}
    </div>
  )
}
