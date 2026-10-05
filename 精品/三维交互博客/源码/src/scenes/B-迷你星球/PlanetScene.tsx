import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Html, Stars, Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import type { SceneProps } from '../types'

const R = 2
const SEA = 0 // water sphere sits at R + SEA

type PlaceDef = {
  key: string
  no: string
  name: string
  role: string
  lat: number
  lon: number
  status?: string
  desc: string
}

// Extending the planet = add an entry here + a props component below.
const places: PlaceDef[] = [
  { key: 'library', no: '01', name: '图书馆', role: '文章 · 9 篇', lat: 18, lon: 0, desc: '正在打开文章列表…' },
  { key: 'lighthouse', no: '02', name: '灯塔', role: '联系我', lat: -12, lon: 72, desc: '海边的灯一直亮着 — 欢迎来信' },
  { key: 'forge', no: '03', name: '工坊', role: '作品', lat: 32, lon: -74, status: '即将开放', desc: '即将开放 — 作品集正在打磨' },
  { key: 'lab', no: '04', name: '实验场', role: '小游戏', lat: -34, lon: -28, status: '预留', desc: '预留 — 后续在这里接入小游戏' },
  { key: 'cabin', no: '05', name: '小屋', role: '关于我', lat: 50, lon: 118, desc: '一个写代码、拍照、骑车的人' },
]

/* ---------- math helpers ---------- */
function dirOf(lat: number, lon: number) {
  const phi = THREE.MathUtils.degToRad(90 - lat)
  const theta = THREE.MathUtils.degToRad(lon)
  return new THREE.Vector3().setFromSphericalCoords(1, phi, theta)
}
const placeDirs = places.map((p) => dirOf(p.lat, p.lon))
const PLATEAU = 0.07

function rawNoise(v: THREE.Vector3) {
  const { x, y, z } = v
  let n = 0
  n += 0.11 * Math.sin(2.3 * x + 1.7) * Math.sin(2.1 * y + 0.3) * Math.sin(2.6 * z + 2.1)
  n += 0.07 * Math.sin(4.7 * x + 3.1 * y + 0.9) * Math.cos(4.1 * z - 1.3)
  n += 0.045 * Math.sin(8.3 * y + 2.2 * z + 4.0) * Math.cos(7.9 * x + 0.4)
  n += 0.025 * Math.sin(15.1 * x + 1.1) * Math.sin(14.3 * z + 2.8) * Math.cos(13.7 * y)
  return n * 1.6 + 0.02
}
function height(v: THREE.Vector3) {
  let h = rawNoise(v)
  for (const d of placeDirs) {
    const c = v.dot(d)
    const w = THREE.MathUtils.smoothstep(c, 0.955, 0.99)
    h = THREE.MathUtils.lerp(h, PLATEAU, w)
  }
  return h
}
function hash(i: number) {
  const n = Math.sin(i * 12.9898 + 78.233) * 43758.5453
  return n - Math.floor(n)
}
function surface(dir: THREE.Vector3, lift = 0, minH = -1) {
  const n = dir.clone().normalize()
  const h = Math.max(height(n), minH)
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
  return { position: n.clone().multiplyScalar(R + h + lift).toArray() as [number, number, number], quaternion: q, h }
}

/* ---------- terrain ---------- */
const C = {
  deep: new THREE.Color('#2b4d7a'),
  shallow: new THREE.Color('#3f7fa0'),
  beach: new THREE.Color('#e9d29a'),
  grass: new THREE.Color('#6fb66a'),
  grass2: new THREE.Color('#4f9a5c'),
  rock: new THREE.Color('#8a7a72'),
  snow: new THREE.Color('#f6f2ff'),
}
function Terrain({ onClick }: { onClick: () => void }) {
  const geo = useMemo(() => {
    const g = new THREE.IcosahedronGeometry(1, 22)
    const p = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i).normalize()
      v.multiplyScalar(R + height(v))
      p.setXYZ(i, v.x, v.y, v.z)
    }
    const colors = new Float32Array(p.count * 3)
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), col = new THREE.Color()
    for (let f = 0; f < p.count; f += 3) {
      a.fromBufferAttribute(p, f); b.fromBufferAttribute(p, f + 1); c.fromBufferAttribute(p, f + 2)
      const m = a.add(b).add(c).divideScalar(3)
      const h = m.length() - R
      const lat = Math.abs(Math.asin(m.y / m.length())) * 57.3
      const j = hash(f) * 0.06
      if (h < -0.06) col.copy(C.deep)
      else if (h < SEA + 0.005) col.copy(C.shallow)
      else if (h < 0.03) col.copy(C.beach)
      else if (h > 0.2 || (lat > 66 && h > 0.06)) col.copy(C.snow)
      else if (h > 0.14) col.copy(C.rock)
      else col.copy(hash(f + 1) > 0.5 ? C.grass : C.grass2)
      col.offsetHSL(0, 0, j - 0.03)
      for (let k = 0; k < 3; k++) col.toArray(colors, (f + k) * 3)
    }
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    g.computeVertexNormals()
    return g
  }, [])
  return (
    <mesh geometry={geo} receiveShadow castShadow onClick={(e) => { e.stopPropagation(); onClick() }}>
      <meshStandardMaterial vertexColors flatShading roughness={0.95} />
    </mesh>
  )
}

function Water() {
  const ref = useRef<THREE.Mesh>(null)
  const geo = useMemo(() => new THREE.IcosahedronGeometry(R + SEA, 12), [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  useFrame(({ clock }) => {
    const p = geo.attributes.position
    const t = clock.elapsedTime
    for (let i = 0; i < p.count; i++) {
      const x = base[i * 3], y = base[i * 3 + 1], z = base[i * 3 + 2]
      const s = 1 + 0.006 * Math.sin(t * 1.4 + x * 5 + z * 3) + 0.004 * Math.cos(t * 1.1 + y * 6)
      p.setXYZ(i, x * s, y * s, z * s)
    }
    p.needsUpdate = true
    geo.computeVertexNormals()
  })
  return (
    <mesh ref={ref} geometry={geo} raycast={() => null}>
      <meshStandardMaterial color="#4aa3c8" transparent opacity={0.72} flatShading roughness={0.25} metalness={0.1} />
    </mesh>
  )
}

const atmoVert = `varying vec3 vN; varying vec3 vV;
void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0); vN = normalize(normalMatrix*normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix*mv; }`
const atmoFrag = `varying vec3 vN; varying vec3 vV; uniform vec3 uColor;
void main(){ float f = pow(1.0 - abs(dot(vN, vV)), 2.5); gl_FragColor = vec4(uColor, f * 0.9); }`
function Atmosphere() {
  const uniforms = useMemo(() => ({ uColor: { value: new THREE.Color('#ffb08a') } }), [])
  return (
    <mesh scale={1.18} raycast={() => null}>
      <sphereGeometry args={[R, 48, 48]} />
      <shaderMaterial vertexShader={atmoVert} fragmentShader={atmoFrag} uniforms={uniforms} side={THREE.BackSide} transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}

/* ---------- shared bits ---------- */
const M = {
  trunk: new THREE.MeshStandardMaterial({ color: '#6b4a3a' }),
  pine: new THREE.MeshStandardMaterial({ color: '#2f7f5f', flatShading: true }),
  pine2: new THREE.MeshStandardMaterial({ color: '#3d9468', flatShading: true }),
  round: new THREE.MeshStandardMaterial({ color: '#7cbf5a', flatShading: true }),
  wall: new THREE.MeshStandardMaterial({ color: '#fbf1e2' }),
  roofs: ['#d9644a', '#3f7f8c', '#e7b25a', '#8a5aa0'].map((c) => new THREE.MeshStandardMaterial({ color: c, flatShading: true })),
  win: new THREE.MeshBasicMaterial({ color: '#ffd27a' }),
  cloud: new THREE.MeshStandardMaterial({ color: '#fff6f0', flatShading: true, transparent: true, opacity: 0.92 }),
}
const G = {
  trunk: new THREE.CylinderGeometry(0.018, 0.024, 0.12, 5),
  cone: new THREE.ConeGeometry(0.09, 0.2, 6),
  ball: new THREE.IcosahedronGeometry(0.09, 0),
  box: new THREE.BoxGeometry(1, 1, 1),
  roof: new THREE.ConeGeometry(0.11, 0.08, 4),
  puff: new THREE.IcosahedronGeometry(1, 1),
}

function OnSurface({ dir, lift = 0, s = 1, yaw = 0, children }: { dir: THREE.Vector3; lift?: number; s?: number; yaw?: number; children: React.ReactNode }) {
  const t = useMemo(() => surface(dir, lift), [dir, lift])
  return (
    <group position={t.position} quaternion={t.quaternion}>
      <group rotation-y={yaw} scale={s}>{children}</group>
    </group>
  )
}

function Pine() {
  return (
    <group>
      <mesh geometry={G.trunk} material={M.trunk} position={[0, 0.05, 0]} />
      <mesh geometry={G.cone} material={M.pine} position={[0, 0.17, 0]} castShadow />
      <mesh geometry={G.cone} material={M.pine2} position={[0, 0.26, 0]} scale={0.7} castShadow />
    </group>
  )
}
function RoundTree() {
  return (
    <group>
      <mesh geometry={G.trunk} material={M.trunk} position={[0, 0.05, 0]} />
      <mesh geometry={G.ball} material={M.round} position={[0, 0.17, 0]} castShadow />
      <mesh geometry={G.ball} material={M.round} position={[0.05, 0.23, 0.02]} scale={0.6} castShadow />
    </group>
  )
}
function House({ roof = 0 }: { roof?: number }) {
  return (
    <group>
      <mesh geometry={G.box} material={M.wall} position={[0, 0.05, 0]} scale={[0.14, 0.1, 0.12]} castShadow />
      <mesh geometry={G.roof} material={M.roofs[roof % 4]} position={[0, 0.14, 0]} rotation-y={Math.PI / 4} castShadow />
      <mesh geometry={G.box} material={M.win} position={[0.03, 0.06, 0.061]} scale={[0.03, 0.03, 0.002]} />
    </group>
  )
}

function Forest() {
  const items = useMemo(() => {
    const out: { dir: THREE.Vector3; pine: boolean; s: number; yaw: number }[] = []
    for (let i = 0; out.length < 70 && i < 2000; i++) {
      const u = hash(i * 3.1) * 2 - 1, th = hash(i * 7.7) * Math.PI * 2
      const r = Math.sqrt(1 - u * u)
      const d = new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th))
      const h = height(d)
      if (h < 0.035 || h > 0.18) continue
      if (placeDirs.some((p) => p.dot(d) > 0.975)) continue
      out.push({ dir: d, pine: h > 0.1 || Math.abs(u) > 0.6 || hash(i) > 0.55, s: 0.7 + hash(i * 1.3) * 0.7, yaw: hash(i * 5) * 6 })
    }
    return out
  }, [])
  return <>{items.map((t, i) => <OnSurface key={i} dir={t.dir} s={t.s} yaw={t.yaw}>{t.pine ? <Pine /> : <RoundTree />}</OnSurface>)}</>
}

/* ---------- village + road + car ---------- */
const roadStops: [number, number][] = [[18, 0], [24, -22], [32, -50], [32, -74], [12, -60], [-12, -45], [-34, -28], [-26, 10], [-12, 40], [-12, 72], [10, 60], [8, 28]]
const villageAt: [number, number][] = [[22, -32], [27, -38], [19, -40], [-20, 22], [-15, 28], [12, 44], [6, 50], [30, -60]]

const roadDense = (() => {
  const pts = roadStops.map(([la, lo]) => {
    const d = dirOf(la, lo)
    return d.multiplyScalar(R + Math.max(height(d), 0.03) + 0.008)
  })
  const raw = new THREE.CatmullRomCurve3(pts, true, 'centripetal')
  // re-project onto terrain so the road hugs the ground
  return raw.getSpacedPoints(240).slice(0, -1).map((p) => {
    const d = p.clone().normalize()
    return d.multiplyScalar(R + Math.max(height(d), 0.03) + 0.008)
  })
})()
function useRoad() {
  return useMemo(() => new THREE.CatmullRomCurve3(roadDense, true), [])
}

/* ---------- bridges: wherever the road crosses water ---------- */
const DECK = 0.064
const BRIDGE_W = 0.11
const bridges: THREE.Vector3[][] = (() => {
  const dirs = roadDense.map((p) => p.clone().normalize())
  const N = dirs.length
  const wet = dirs.map((d) => height(d) < SEA + 0.006)
  const s0 = wet.findIndex((w) => !w)
  if (s0 < 0 || !wet.some(Boolean)) return []
  const runs: number[][] = []
  let cur: number[] | null = null
  for (let j = 1; j <= N; j++) {
    const i = (s0 + j) % N
    if (wet[i]) { if (!cur) cur = []; cur.push(i) }
    else if (cur) { runs.push(cur); cur = null }
  }
  return runs.sort((a, b) => a.length - b.length).slice(0, 3).map((run) => {
    const a = (run[0] - 1 + N) % N, b = (run[run.length - 1] + 1) % N
    return [a, ...run, b].map((i) => dirs[i])
  })
})()
const _ab = new THREE.Vector3(), _ap = new THREE.Vector3()
const BRIDGE_HALF = BRIDGE_W / 2 / (R + DECK)
function isOnBridge(n: THREE.Vector3) {
  for (const br of bridges) {
    for (let i = 0; i < br.length - 1; i++) {
      _ab.subVectors(br[i + 1], br[i]); _ap.subVectors(n, br[i])
      const t = THREE.MathUtils.clamp(_ap.dot(_ab) / _ab.lengthSq(), 0, 1)
      if (_ap.addScaledVector(_ab, -t).length() < BRIDGE_HALF) return true
    }
  }
  return false
}
const woodA = new THREE.MeshStandardMaterial({ color: '#b07a4f', flatShading: true })
const woodB = new THREE.MeshStandardMaterial({ color: '#94623f', flatShading: true })
function Bridges() {
  const segs = useMemo(() => {
    const out: { pos: [number, number, number]; q: THREE.Quaternion; len: number; post: boolean }[] = []
    const pa = new THREE.Vector3(), pb = new THREE.Vector3(), up = new THREE.Vector3(), fw = new THREE.Vector3(), x = new THREE.Vector3(), m = new THREE.Matrix4()
    for (const br of bridges) {
      for (let i = 0; i < br.length - 1; i++) {
        pa.copy(br[i]).multiplyScalar(R + DECK); pb.copy(br[i + 1]).multiplyScalar(R + DECK)
        const mid = pa.clone().add(pb).multiplyScalar(0.5)
        up.copy(mid).normalize()
        fw.subVectors(pb, pa); fw.addScaledVector(up, -fw.dot(up)).normalize()
        x.crossVectors(up, fw)
        out.push({ pos: mid.toArray() as [number, number, number], q: new THREE.Quaternion().setFromRotationMatrix(m.makeBasis(x, up, fw)), len: pa.distanceTo(pb) + 0.012, post: i % 2 === 0 })
      }
    }
    return out
  }, [])
  const stilt = DECK + 0.04
  return (
    <group>
      {segs.map((s, i) => (
        <group key={i} position={s.pos} quaternion={s.q}>
          <mesh material={i % 2 ? woodA : woodB} position={[0, -0.005, 0]} castShadow receiveShadow raycast={() => null}><boxGeometry args={[BRIDGE_W, 0.01, s.len]} /></mesh>
          {[-1, 1].map((sd) => (
            <group key={sd}>
              <mesh material={woodB} position={[sd * (BRIDGE_W / 2 - 0.004), 0.03, 0]} raycast={() => null}><boxGeometry args={[0.006, 0.006, s.len]} /></mesh>
              <mesh material={woodB} position={[sd * (BRIDGE_W / 2 - 0.004), 0.015, 0]} raycast={() => null}><boxGeometry args={[0.008, 0.03, 0.008]} /></mesh>
              {s.post && <mesh material={woodB} position={[sd * (BRIDGE_W / 2 - 0.01), -stilt / 2, 0]} raycast={() => null}><cylinderGeometry args={[0.007, 0.009, stilt, 5]} /></mesh>}
            </group>
          ))}
        </group>
      ))}
    </group>
  )
}

function Road({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geo = useMemo(() => new THREE.TubeGeometry(curve, 400, 0.022, 4, true), [curve])
  return (
    <mesh geometry={geo} scale={[1, 1, 1]} raycast={() => null} receiveShadow>
      <meshStandardMaterial color="#d8c3a0" flatShading roughness={1} />
    </mesh>
  )
}

function Car({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const ref = useRef<THREE.Group>(null)
  const tmp = useMemo(() => ({ p: new THREE.Vector3(), t: new THREE.Vector3(), up: new THREE.Vector3() }), [])
  useFrame(({ clock }) => {
    const g = ref.current
    if (!g) return
    const u = (clock.elapsedTime * 0.018) % 1
    curve.getPointAt(u, tmp.p)
    curve.getTangentAt(u, tmp.t)
    tmp.up.copy(tmp.p).normalize()
    g.position.copy(tmp.p).addScaledVector(tmp.up, 0.02)
    g.up.copy(tmp.up)
    g.lookAt(tmp.p.add(tmp.t).addScaledVector(tmp.up, 0.02))
  })
  return (
    <group ref={ref}>
      <mesh position={[0, 0.02, 0]} castShadow><boxGeometry args={[0.06, 0.035, 0.1]} /><meshStandardMaterial color="#e2574c" /></mesh>
      <mesh position={[0, 0.05, -0.01]}><boxGeometry args={[0.05, 0.03, 0.05]} /><meshStandardMaterial color="#cfe6ff" /></mesh>
      <mesh position={[0, 0.025, 0.051]}><boxGeometry args={[0.04, 0.012, 0.002]} /><meshBasicMaterial color="#fff2b0" /></mesh>
      {[[-0.032, 0.03], [0.032, 0.03], [-0.032, -0.03], [0.032, -0.03]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.005, z]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.012, 0.012, 0.01, 8]} /><meshStandardMaterial color="#2a2440" /></mesh>
      ))}
    </group>
  )
}

/* ---------- place props ---------- */
function LibraryProps() {
  const colors = ['#d9644a', '#3f7f8c', '#e7b25a', '#6a5aa0']
  return (
    <group scale={0.32}>
      <mesh position={[0, 0.06, 0]} receiveShadow><boxGeometry args={[1.5, 0.12, 1.1]} /><meshStandardMaterial color="#efe4d2" /></mesh>
      {[-0.55, -0.2, 0.15, 0.5].map((x) => (
        <mesh key={x} position={[x + 0.02, 0.5, 0.4]} castShadow><cylinderGeometry args={[0.06, 0.06, 0.75, 10]} /><meshStandardMaterial color="#fbf6ec" /></mesh>
      ))}
      <mesh position={[0, 0.5, -0.15]} castShadow><boxGeometry args={[1.3, 0.75, 0.7]} /><meshStandardMaterial color="#f3e9d8" /></mesh>
      <mesh position={[0, 0.5, 0.2]}><boxGeometry args={[0.28, 0.45, 0.02]} /><meshBasicMaterial color="#ffd27a" /></mesh>
      <mesh position={[0, 0.93, 0.05]} castShadow><boxGeometry args={[1.5, 0.12, 1.05]} /><meshStandardMaterial color="#e7d9c2" /></mesh>
      <mesh position={[0, 1.13, 0.05]} rotation-z={Math.PI / 2} rotation-y={Math.PI / 2} castShadow>
        <cylinderGeometry args={[0.28, 0.28, 1.5, 3]} /><meshStandardMaterial color="#3f7f8c" flatShading />
      </mesh>
      {colors.map((c, i) => (
        <Float key={i} speed={1.5 + i * 0.3} rotationIntensity={0.6} floatIntensity={0.6}>
          <group position={[Math.cos(i * 1.6) * 1.0, 1.6 + (i % 2) * 0.3, Math.sin(i * 1.6) * 1.0]} rotation-y={i}>
            <mesh rotation-z={0.35} position={[-0.09, 0, 0]}><boxGeometry args={[0.18, 0.015, 0.24]} /><meshStandardMaterial color={c} /></mesh>
            <mesh rotation-z={-0.35} position={[0.09, 0, 0]}><boxGeometry args={[0.18, 0.015, 0.24]} /><meshStandardMaterial color={c} /></mesh>
          </group>
        </Float>
      ))}
      <pointLight position={[0, 0.6, 0.8]} color="#ffd27a" intensity={1.2} distance={2} />
    </group>
  )
}

function LighthouseProps() {
  const beam = useRef<THREE.Group>(null)
  useFrame((_, d) => { if (beam.current) beam.current.rotation.y += d * 0.9 })
  return (
    <group scale={0.3}>
      <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.55, 0.65, 0.16, 8]} /><meshStandardMaterial color="#8a7a72" flatShading /></mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[0, 0.32 + i * 0.32, 0]} castShadow>
          <cylinderGeometry args={[0.24 - i * 0.03, 0.27 - i * 0.03, 0.32, 14]} />
          <meshStandardMaterial color={i % 2 ? '#d9644a' : '#fbf6ec'} />
        </mesh>
      ))}
      <mesh position={[0, 1.62, 0]}><cylinderGeometry args={[0.14, 0.14, 0.2, 10]} /><meshBasicMaterial color="#fff2b0" /></mesh>
      <mesh position={[0, 1.79, 0]}><coneGeometry args={[0.19, 0.18, 10]} /><meshStandardMaterial color="#3a3550" /></mesh>
      <group ref={beam} position={[0, 1.62, 0]}>
        <mesh position={[1.4, 0, 0]} rotation-z={Math.PI / 2}>
          <coneGeometry args={[0.35, 2.8, 16, 1, true]} />
          <meshBasicMaterial color="#fff2b0" transparent opacity={0.2} depthWrite={false} side={THREE.DoubleSide} blending={THREE.AdditiveBlending} />
        </mesh>
      </group>
      <mesh position={[0.6, 0.2, 0.3]} castShadow><boxGeometry args={[0.35, 0.28, 0.3]} /><meshStandardMaterial color="#fbf1e2" /></mesh>
      <mesh position={[0.6, 0.42, 0.3]} rotation-y={Math.PI / 4}><coneGeometry args={[0.28, 0.18, 4]} /><meshStandardMaterial color="#3f7f8c" flatShading /></mesh>
      {/* mailbox */}
      <mesh position={[-0.5, 0.3, 0.4]}><boxGeometry args={[0.03, 0.3, 0.03]} /><meshStandardMaterial color="#5a4a42" /></mesh>
      <mesh position={[-0.5, 0.48, 0.4]}><boxGeometry args={[0.14, 0.1, 0.18]} /><meshStandardMaterial color="#d9644a" /></mesh>
      <pointLight position={[0, 1.62, 0]} color="#ffe28a" intensity={2.5} distance={2.5} />
    </group>
  )
}

function ForgeProps() {
  const gear = useRef<THREE.Mesh>(null)
  const smoke = useRef<THREE.Group>(null)
  useFrame(({ clock }, d) => {
    if (gear.current) gear.current.rotation.z += d * 0.8
    smoke.current?.children.forEach((m, i) => {
      const t = (clock.elapsedTime * 0.4 + i / 3) % 1
      m.position.set(0.3 + t * 0.15, 1.35 + t * 0.7, -0.15)
      m.scale.setScalar(0.06 + t * 0.12)
      ;((m as THREE.Mesh).material as THREE.MeshStandardMaterial).opacity = 0.7 * (1 - t)
    })
  })
  return (
    <group scale={0.32}>
      <mesh position={[0, 0.35, 0]} castShadow><boxGeometry args={[0.9, 0.6, 0.7]} /><meshStandardMaterial color="#c98a5a" /></mesh>
      <mesh position={[0, 0.75, 0]} castShadow><boxGeometry args={[1, 0.15, 0.8]} /><meshStandardMaterial color="#5a4a42" /></mesh>
      <mesh position={[0, 0.3, 0.351]}><boxGeometry args={[0.3, 0.35, 0.01]} /><meshBasicMaterial color="#ff9a4a" /></mesh>
      <mesh ref={gear} position={[0.3, 0.55, 0.37]}><torusGeometry args={[0.13, 0.04, 6, 8]} /><meshStandardMaterial color="#f2c14e" metalness={0.6} roughness={0.3} /></mesh>
      <mesh position={[0.3, 1.05, -0.15]} castShadow><cylinderGeometry args={[0.07, 0.09, 0.5, 8]} /><meshStandardMaterial color="#5a4a42" /></mesh>
      <mesh position={[-0.65, 0.12, 0.3]}><boxGeometry args={[0.25, 0.24, 0.18]} /><meshStandardMaterial color="#3a3550" /></mesh>
      <mesh position={[-0.65, 0.12, -0.05]}><boxGeometry args={[0.2, 0.2, 0.2]} /><meshStandardMaterial color="#a77a55" /></mesh>
      <group ref={smoke}>
        {[0, 1, 2].map((i) => <mesh key={i}><sphereGeometry args={[1, 8, 8]} /><meshStandardMaterial color="#ffffff" transparent /></mesh>)}
      </group>
      <pointLight position={[0, 0.4, 0.7]} color="#ff9a4a" intensity={1.5} distance={1.5} />
    </group>
  )
}

function LabProps() {
  return (
    <group scale={0.32}>
      <mesh position={[0, 0.05, 0]}><cylinderGeometry args={[0.75, 0.8, 0.1, 24]} /><meshStandardMaterial color="#efe6ff" /></mesh>
      <mesh position={[0, 0.11, 0]} rotation-x={-Math.PI / 2}><ringGeometry args={[0.5, 0.58, 32]} /><meshBasicMaterial color="#a77be0" /></mesh>
      {/* arcade cabinet */}
      <mesh position={[-0.35, 0.4, -0.3]} castShadow><boxGeometry args={[0.3, 0.6, 0.25]} /><meshStandardMaterial color="#6a5aa0" /></mesh>
      <mesh position={[-0.35, 0.5, -0.17]} rotation-x={-0.2}><boxGeometry args={[0.22, 0.16, 0.01]} /><meshBasicMaterial color="#9ff0ff" /></mesh>
      {[0, 1, 2].map((i) => (
        <Float key={i} speed={2 + i} floatIntensity={1} rotationIntensity={2}>
          <mesh position={[Math.cos(i * 2.1) * 0.35 + 0.15, 0.8 + i * 0.2, Math.sin(i * 2.1) * 0.35]} castShadow>
            <octahedronGeometry args={[0.16 - i * 0.03]} />
            <meshStandardMaterial color="#ffffff" emissive="#a77be0" emissiveIntensity={0.8} flatShading />
          </mesh>
        </Float>
      ))}
      <Sparkles count={14} scale={[1.4, 1.4, 1.4]} position={[0, 0.9, 0]} size={2.5} color="#e3d1ff" speed={0.6} />
    </group>
  )
}

function CabinProps() {
  return (
    <group scale={0.32}>
      <mesh position={[0, 0.3, 0]} castShadow><boxGeometry args={[0.8, 0.6, 0.65]} /><meshStandardMaterial color="#a77a55" /></mesh>
      <mesh position={[0, 0.78, 0]} rotation-y={Math.PI / 4} castShadow><coneGeometry args={[0.68, 0.45, 4]} /><meshStandardMaterial color="#d9644a" flatShading /></mesh>
      <mesh position={[0, 0.2, 0.33]}><boxGeometry args={[0.18, 0.34, 0.01]} /><meshStandardMaterial color="#5a4a42" /></mesh>
      <mesh position={[0.25, 0.38, 0.33]}><boxGeometry args={[0.16, 0.16, 0.01]} /><meshBasicMaterial color="#ffd27a" /></mesh>
      <mesh position={[0.22, 0.95, -0.1]}><boxGeometry args={[0.1, 0.3, 0.1]} /><meshStandardMaterial color="#5a4a42" /></mesh>
      {/* bench + fence */}
      <mesh position={[-0.6, 0.12, 0.35]}><boxGeometry args={[0.3, 0.04, 0.1]} /><meshStandardMaterial color="#7a5640" /></mesh>
      {[-0.5, -0.25, 0, 0.25, 0.5].map((x) => (
        <mesh key={x} position={[x, 0.1, 0.65]}><boxGeometry args={[0.04, 0.2, 0.04]} /><meshStandardMaterial color="#fbf1e2" /></mesh>
      ))}
      <mesh position={[0, 0.15, 0.65]}><boxGeometry args={[1.05, 0.03, 0.02]} /><meshStandardMaterial color="#fbf1e2" /></mesh>
      <pointLight position={[0.3, 0.4, 0.6]} color="#ffd27a" intensity={1} distance={1.5} />
    </group>
  )
}

const propsFor: Record<string, () => React.JSX.Element> = {
  library: LibraryProps, lighthouse: LighthouseProps, forge: ForgeProps, lab: LabProps, cabin: CabinProps,
}

/* ---------- place w/ label ---------- */
const _n = new THREE.Vector3()
const _c = new THREE.Vector3()
function Place({ d, idx, active, near, onPick }: { d: PlaceDef; idx: number; active: boolean; near: boolean; onPick: (k: string) => void }) {
  const [hover, setHover] = useState(false)
  const t = useMemo(() => surface(placeDirs[idx], -0.005), [idx])
  const g = useRef<THREE.Group>(null)
  const label = useRef<HTMLDivElement>(null)
  const Props = propsFor[d.key]
  useFrame(({ camera }) => {
    if (!g.current || !label.current) return
    g.current.getWorldPosition(_n)
    const dist = camera.position.distanceTo(_n)
    _c.copy(camera.position).sub(_n).normalize()
    const facing = _n.normalize().dot(_c)
    label.current.style.opacity = String(THREE.MathUtils.clamp((facing - 0.15) * 3, 0, 1) * THREE.MathUtils.clamp((dist - 0.3) / 0.4, 0, 1))
    const s = THREE.MathUtils.lerp(g.current.scale.x, hover || active || near ? 1.15 : 1, 0.15)
    g.current.scale.setScalar(s)
  })
  const lit = hover || active || near
  return (
    <group
      ref={g}
      position={t.position}
      quaternion={t.quaternion}
      onPointerOver={(e) => { e.stopPropagation(); setHover(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHover(false); document.body.style.cursor = 'auto' }}
      onClick={(e) => { e.stopPropagation(); onPick(d.key) }}
    >
      <Props />
      {/* invisible hit target */}
      <mesh position={[0, 0.25, 0]} visible={false}><sphereGeometry args={[0.32, 8, 8]} /></mesh>
      <Html position={[0, d.key === 'lighthouse' ? 0.75 : 0.62, 0]} center distanceFactor={7} style={{ pointerEvents: 'none' }} zIndexRange={[20, 0]}>
        <div ref={label} className={`flex flex-col items-center transition-transform duration-300 ${lit ? '-translate-y-1' : ''}`}>
          <div className={`flex items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 shadow-lg transition-colors ${lit ? 'bg-[#ffcfa8] text-[#1d1a3a]' : 'bg-[#1d1a3a]/80 text-white'}`}>
            <span className="font-mono text-[10px] opacity-60">{d.no}</span>
            <span className="text-[13px] font-semibold">{d.name}</span>
          </div>
          <div className={`mt-1.5 whitespace-nowrap font-mono text-[10px] text-[#ffe3cf] transition-opacity ${lit ? 'opacity-100' : 'opacity-0'}`}>
            {d.role}{d.status ? ` · ${d.status}` : ''}
          </div>
          <div className="h-4 w-px bg-white/40" />
        </div>
      </Html>
    </group>
  )
}

/* ---------- sky things ---------- */
function Clouds() {
  const ref = useRef<THREE.Group>(null)
  const list = useMemo(() => Array.from({ length: 9 }, (_, i) => {
    const u = hash(i * 9.1) * 1.4 - 0.7, th = (i / 9) * Math.PI * 2
    const r = Math.sqrt(1 - u * u)
    const dir = new THREE.Vector3(r * Math.cos(th), u, r * Math.sin(th))
    return { dir, s: 0.09 + hash(i) * 0.06 }
  }), [])
  useFrame((_, d) => { if (ref.current) { ref.current.rotation.y += d * 0.05; ref.current.rotation.x += d * 0.01 } })
  return (
    <group ref={ref}>
      {list.map((c, i) => {
        const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), c.dir)
        return (
          <group key={i} position={c.dir.clone().multiplyScalar(R + 0.62).toArray() as [number, number, number]} quaternion={q} scale={c.s}>
            {[[0, 0.3, 0, 1], [1, 0, 0.2, 0.75], [-0.9, 0, -0.1, 0.7], [0.3, 0, -0.7, 0.6]].map(([x, y, z, s], k) => (
              <mesh key={k} geometry={G.puff} material={M.cloud} position={[x, y, z]} scale={[s, s * 0.7, s]} castShadow raycast={() => null} />
            ))}
          </group>
        )
      })}
    </group>
  )
}

function Moon() {
  const ref = useRef<THREE.Group>(null)
  const sat = useRef<THREE.Group>(null)
  useFrame((_, d) => {
    if (ref.current) ref.current.rotation.y += d * 0.12
    if (sat.current) sat.current.rotation.y -= d * 0.35
  })
  return (
    <>
      <group rotation={[0.35, 0, 0.25]}>
        <group ref={ref}>
          <mesh position={[4.4, 0, 0]} castShadow>
            <icosahedronGeometry args={[0.32, 1]} />
            <meshStandardMaterial color="#d9d2e9" flatShading roughness={1} />
          </mesh>
        </group>
      </group>
      <group rotation={[-0.6, 0, -0.3]}>
        <group ref={sat}>
          <group position={[0, 0, 3.0]} rotation-y={Math.PI / 2}>
            <mesh><boxGeometry args={[0.08, 0.08, 0.12]} /><meshStandardMaterial color="#e7b25a" metalness={0.6} roughness={0.3} /></mesh>
            <mesh position={[0.15, 0, 0]}><boxGeometry args={[0.2, 0.005, 0.08]} /><meshStandardMaterial color="#3f5fa0" metalness={0.4} /></mesh>
            <mesh position={[-0.15, 0, 0]}><boxGeometry args={[0.2, 0.005, 0.08]} /><meshStandardMaterial color="#3f5fa0" metalness={0.4} /></mesh>
            <mesh position={[0, 0.07, 0]}><sphereGeometry args={[0.015, 6, 6]} /><meshBasicMaterial color="#ff6a6a" /></mesh>
          </group>
        </group>
      </group>
      {/* dust ring */}
      <mesh rotation={[Math.PI / 2 - 0.35, 0.2, 0]} raycast={() => null}>
        <ringGeometry args={[2.9, 3.5, 96]} />
        <meshBasicMaterial color="#ffcfa8" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <mesh rotation={[Math.PI / 2 - 0.35, 0.2, 0]} raycast={() => null}>
        <ringGeometry args={[3.55, 3.6, 96]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.2} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </>
  )
}

function ShootingStar() {
  const ref = useRef<THREE.Mesh>(null)
  const mat = useRef<THREE.MeshBasicMaterial>(null)
  useFrame(({ clock }) => {
    const m = ref.current
    if (!m || !mat.current) return
    const period = 6
    const cycle = Math.floor(clock.elapsedTime / period)
    const t = (clock.elapsedTime % period) / 1.1
    if (t > 1) { m.visible = false; return }
    m.visible = true
    const sx = (hash(cycle) - 0.5) * 16, sy = 4 + hash(cycle + 1) * 3
    m.position.set(sx - t * 7, sy - t * 3.5, -8)
    mat.current.opacity = Math.sin(t * Math.PI)
  })
  return (
    <mesh ref={ref} rotation-z={Math.atan2(3.5, 7) + Math.PI / 2} raycast={() => null}>
      <coneGeometry args={[0.03, 1.6, 4, 1, true]} />
      <meshBasicMaterial ref={mat} color="#ffe9d6" transparent blending={THREE.AdditiveBlending} depthWrite={false} />
    </mesh>
  )
}

/* ---------- hero: tiny low-poly walker (third-person chase cam in char mode) ---------- */
type Mode = 'orbit' | 'char'
const NEAR_COS = Math.cos(0.2)
const CAM_EL = THREE.MathUtils.degToRad(32) // default chase elevation
const CAM_YAW = THREE.MathUtils.degToRad(50)
const DIST_MIN = 0.25, DIST_MAX = 1.1
const hero = (() => {
  const n = dirOf(0, 0)
  const f = placeDirs[0].clone().addScaledVector(n, -placeDirs[0].dot(n)).normalize()
  return { n, f, phase: 0, moving: false, water: 0, gh: Math.max(height(n), SEA), bob: 0 }
})()

// simple circular collision (angular radius on the unit sphere)
const placeR: Record<string, number> = { library: 0.13, lighthouse: 0.1, forge: 0.1, lab: 0.12, cabin: 0.1 }
const obstacles = [
  ...places.map((p, i) => ({ d: placeDirs[i], r: placeR[p.key] ?? 0.1 })),
  ...villageAt.map(([la, lo], i) => ({ d: dirOf(la, lo), r: 0.05 * (0.9 + hash(i + 3) * 0.4) })),
]
const _t = new THREE.Vector3()
function pushOut(n: THREE.Vector3) {
  for (const o of obstacles) {
    const c = n.dot(o.d), cr = Math.cos(o.r)
    if (c <= cr) continue
    _t.copy(n).addScaledVector(o.d, -c)
    if (_t.lengthSq() < 1e-12) continue
    _t.normalize()
    n.copy(o.d).multiplyScalar(cr).addScaledVector(_t, Math.sin(o.r))
  }
}

const RIPPLES = 8
const rippleGeo = new THREE.RingGeometry(0.8, 1, 24).rotateX(-Math.PI / 2)

function Hero({ mode, keys, ctl, onNear, onBoat }: {
  mode: Mode; keys: React.RefObject<Set<string>>; ctl: React.RefObject<Ctl>; onNear: (k: string | null) => void; onBoat: (b: boolean) => void
}) {
  const ref = useRef<THREE.Group>(null)
  const boat = useRef<THREE.Group>(null)
  const legL = useRef<THREE.Group>(null)
  const legR = useRef<THREE.Group>(null)
  const scarf = useRef<THREE.Mesh>(null)
  const bodyInner = useRef<THREE.Group>(null)
  const ripRefs = useRef<(THREE.Mesh | null)[]>([])
  const near = useRef<string | null>(null)
  const boating = useRef(false)
  const rip = useMemo(() => ({ timer: 0, i: 0, items: Array.from({ length: RIPPLES }, () => ({ n: new THREE.Vector3(), age: 99 })) }), [])
  const tmp = useMemo(() => ({
    axis: new THREE.Vector3(), r: new THREE.Vector3(), v: new THREE.Vector3(), x: new THREE.Vector3(), m: new THREE.Matrix4(),
    q: new THREE.Quaternion(), q2: new THREE.Quaternion(), e: new THREE.Euler(), eye: new THREE.Vector3(), nW: new THREE.Vector3(),
    back: new THREE.Vector3(), cam: new THREE.Vector3(), look: new THREE.Vector3(), up: new THREE.Vector3(), s: new THREE.Vector3(),
    camS: new THREE.Vector3(), lookS: new THREE.Vector3(), upS: new THREE.Vector3(0, 1, 0),
  }), [])
  useFrame(({ camera, clock, pointer }, delta) => {
    const g = ref.current
    const c = ctl.current
    if (!g || !c) return
    const dt = Math.min(delta, 0.05)
    const t = clock.elapsedTime
    const fp = mode === 'char'
    const k = keys.current
    if (fp) c.dx = c.dy = 0
    let fw = 0, turn = 0
    if (fp && k) {
      if (k.has('w') || k.has('arrowup')) fw += 1
      if (k.has('s') || k.has('arrowdown')) fw -= 1
      if (k.has('a') || k.has('arrowleft')) turn += 1
      if (k.has('d') || k.has('arrowright')) turn -= 1
    }
    if (turn) hero.f.applyAxisAngle(hero.n, turn * 2.2 * dt)
    hero.moving = fw !== 0
    if (hero.moving) {
      tmp.v.copy(hero.f).multiplyScalar(fw)
      tmp.axis.crossVectors(hero.n, tmp.v).normalize()
      const speed = (fw < 0 ? 0.28 : 0.42) * (1 - 0.3 * hero.water)
      const ang = (speed * dt) / R
      hero.n.applyAxisAngle(tmp.axis, ang)
      hero.f.applyAxisAngle(tmp.axis, ang)
      pushOut(hero.n)
    }
    hero.n.normalize()
    hero.f.addScaledVector(hero.n, -hero.f.dot(hero.n)).normalize()

    // land / bridge / water state, smoothed (~0.4s)
    const bridge = isOnBridge(hero.n)
    const th = height(hero.n)
    const wet = !bridge && th < SEA + 0.004
    hero.water += ((wet ? 1 : 0) - hero.water) * (1 - Math.exp(-dt / 0.13))
    hero.gh += ((bridge ? DECK : Math.max(th, SEA)) - hero.gh) * (1 - Math.exp(-dt / 0.08))
    if (wet !== boating.current) { boating.current = wet; onBoat(wet) }
    const w = hero.water
    hero.phase += dt * (hero.moving ? 11 : 0)
    hero.bob += ((hero.moving ? Math.abs(Math.sin(hero.phase)) * 0.004 * (1 - w) : 0) - hero.bob) * 0.3
    const wb = Math.sin(t * 1.8) * 0.003
    const roll = Math.sin(t * 1.3) * 0.06
    const bp = Math.sin(t * 1.1 + 1) * 0.03

    // body pose: up = surface normal, +z = heading
    tmp.x.crossVectors(hero.n, hero.f)
    tmp.q.setFromRotationMatrix(tmp.m.makeBasis(tmp.x, hero.n, hero.f))
    g.visible = true
    // in the boat: sit lower, roll/pitch with the hull
    g.position.copy(hero.n).multiplyScalar(R + THREE.MathUtils.lerp(hero.gh + 0.002, SEA + wb - 0.012, w))
    g.quaternion.copy(tmp.q)
    if (w > 0.01) g.quaternion.multiply(tmp.q2.setFromEuler(tmp.e.set(bp * w, 0, roll * w)))
    const swing = hero.moving ? Math.sin(hero.phase) * 0.7 : 0
    if (legL.current) legL.current.rotation.x = THREE.MathUtils.lerp(legL.current.rotation.x, swing, 0.4)
    if (legR.current) legR.current.rotation.x = THREE.MathUtils.lerp(legR.current.rotation.x, -swing, 0.4)
    if (bodyInner.current) bodyInner.current.position.y = hero.moving ? Math.abs(Math.sin(hero.phase)) * 0.006 : 0
    if (scarf.current) scarf.current.rotation.x = -0.4 - (hero.moving ? 0.5 + Math.sin(hero.phase * 1.3) * 0.15 : 0)

    // boat
    const bt = boat.current
    if (bt) {
      bt.visible = w > 0.02
      bt.position.copy(hero.n).multiplyScalar(R + SEA + wb - (1 - w) * 0.03)
      bt.quaternion.copy(tmp.q).multiply(tmp.q2.setFromEuler(tmp.e.set(bp, 0, roll)))
      bt.scale.setScalar(Math.max(0.001, 0.4 + 0.6 * w))
    }

    // ripple trail
    rip.timer -= dt
    if (hero.moving && w > 0.6 && rip.timer <= 0) {
      rip.timer = 0.22
      const s = rip.items[rip.i++ % RIPPLES]
      s.age = 0
      s.n.copy(hero.n).addScaledVector(hero.f, -0.012).normalize()
    }
    rip.items.forEach((s, i) => {
      const m = ripRefs.current[i]
      if (!m) return
      s.age += dt
      const life = 1.4
      if (s.age >= life) { m.visible = false; return }
      m.visible = true
      m.position.copy(s.n).multiplyScalar(R + SEA + 0.004)
      m.quaternion.setFromUnitVectors(yAxis, s.n)
      m.scale.setScalar(0.02 + s.age * 0.06)
      const mat = m.material as THREE.MeshBasicMaterial
      if (mat) mat.opacity = 0.55 * (1 - s.age / life)
    })

    // third-person chase camera (computed in planet-local space)
    const cam = camera as THREE.PerspectiveCamera
    const planetQ = g.parent?.quaternion
    if (fp && planetQ) {
      const first = c.fp === 0
      c.fp = Math.min(1, c.fp + dt * 1.1)
      const kk = 1 - Math.pow(0.02, dt)
      c.yaw += (THREE.MathUtils.clamp(pointer.x, -1, 1) * CAM_YAW - c.yaw) * kk
      c.py += (THREE.MathUtils.clamp(pointer.y, -1, 1) - c.py) * kk
      const base = tmp.v.copy(hero.n).multiplyScalar(R + hero.gh + 0.05) // look target (chest height)
      // occlusion: sample the segment target->desired camera against building circles
      const el0 = CAM_EL - c.py * 0.18
      const occCheck = (dist: number, el: number) => {
        tmp.back.copy(hero.f).negate().applyAxisAngle(hero.n, c.yaw)
        tmp.cam.copy(base).addScaledVector(tmp.back, dist * Math.cos(el)).addScaledVector(hero.n, dist * Math.sin(el))
        for (let i = 1; i <= 10; i++) {
          tmp.s.lerpVectors(base, tmp.cam, i / 10)
          const len = tmp.s.length()
          tmp.s.divideScalar(len)
          for (const o of obstacles) {
            if (tmp.s.dot(o.d) > Math.cos(o.r * 1.05) && len < R + PLATEAU + o.r * 2.6) return true
          }
        }
        return false
      }
      const blocked = occCheck(c.dist, el0)
      c.occ += ((blocked ? 1 : 0) - c.occ) * (1 - Math.pow(0.05, dt))
      const dist = c.dist * (1 - 0.45 * c.occ)
      const el = el0 + c.occ * THREE.MathUtils.degToRad(26)
      tmp.back.copy(hero.f).negate().applyAxisAngle(hero.n, c.yaw)
      tmp.cam.copy(base).addScaledVector(tmp.back, dist * Math.cos(el)).addScaledVector(hero.n, dist * Math.sin(el))
      // never dip under terrain
      tmp.s.copy(tmp.cam).normalize()
      const minR = R + Math.max(height(tmp.s), SEA) + 0.04
      if (tmp.cam.length() < minR) tmp.cam.setLength(minR)
      tmp.cam.applyQuaternion(planetQ)
      tmp.look.copy(base).applyQuaternion(planetQ)
      tmp.up.copy(hero.n).applyQuaternion(planetQ)
      if (first) { tmp.camS.copy(cam.position); tmp.lookS.copy(cam.position).add(cam.getWorldDirection(tmp.s)); tmp.upS.copy(cam.up) }
      const a = THREE.MathUtils.lerp(1 - Math.pow(0.02, dt), 1 - Math.pow(0.0006, dt), c.fp ** 2)
      tmp.camS.lerp(tmp.cam, a)
      tmp.lookS.lerp(tmp.look, Math.min(1, a * 1.4))
      tmp.upS.lerp(tmp.up, a).normalize()
      cam.position.copy(tmp.camS)
      cam.up.copy(tmp.upS)
      cam.lookAt(tmp.lookS)
      let dirty = false
      if (Math.abs(cam.fov - 50) > 0.01) { cam.fov = THREE.MathUtils.lerp(cam.fov, 50, 1 - Math.pow(0.001, dt)); dirty = true }
      if (cam.near !== 0.02) { cam.near = 0.02; dirty = true }
      if (dirty) cam.updateProjectionMatrix()
    } else { c.fp = 0; c.occ = 0 }

    // proximity
    let best: string | null = null, bestC = NEAR_COS
    placeDirs.forEach((d, i) => { const cc = d.dot(hero.n); if (cc > bestC) { bestC = cc; best = places[i].key } })
    if (best !== near.current) { near.current = best; onNear(best) }
  })
  return (
    <>
      <group ref={ref}>
      <group scale={0.55}>
        <group ref={bodyInner} position={[0, 0.06, 0]}>
          {/* body */}
          <mesh position={[0, 0.045, 0]} castShadow><cylinderGeometry args={[0.032, 0.042, 0.075, 7]} /><meshStandardMaterial color="#ffcfa8" flatShading /></mesh>
          {/* head */}
          <mesh position={[0, 0.115, 0]} castShadow><icosahedronGeometry args={[0.042, 1]} /><meshStandardMaterial color="#fff1e4" flatShading /></mesh>
          <mesh position={[-0.015, 0.12, 0.038]}><sphereGeometry args={[0.006, 6, 6]} /><meshBasicMaterial color="#1d1a3a" /></mesh>
          <mesh position={[0.015, 0.12, 0.038]}><sphereGeometry args={[0.006, 6, 6]} /><meshBasicMaterial color="#1d1a3a" /></mesh>
          {/* hat */}
          <mesh position={[0, 0.162, 0]} castShadow><coneGeometry args={[0.036, 0.05, 6]} /><meshStandardMaterial color="#3f7f8c" flatShading /></mesh>
          {/* scarf */}
          <mesh position={[0, 0.082, 0]}><torusGeometry args={[0.034, 0.009, 5, 10]} /><meshStandardMaterial color="#d9644a" flatShading /></mesh>
          <mesh ref={scarf} position={[0.012, 0.08, -0.034]}><boxGeometry args={[0.014, 0.05, 0.006]} /><meshStandardMaterial color="#d9644a" /></mesh>
        </group>
        {[[-0.016, legL], [0.016, legR]].map(([x, r], i) => (
          <group key={i} ref={r as React.RefObject<THREE.Group>} position={[x as number, 0.062, 0]}>
            <mesh position={[0, -0.03, 0]} castShadow><boxGeometry args={[0.016, 0.06, 0.018]} /><meshStandardMaterial color="#3a3550" /></mesh>
          </group>
        ))}
      </group>
      </group>
      {/* rowboat: bow points +z (heading) */}
      <group ref={boat} visible={false}>
        <mesh position={[0, 0.006, 0.0]} castShadow raycast={() => null}><boxGeometry args={[0.064, 0.022, 0.12]} /><meshStandardMaterial color="#a8683f" flatShading /></mesh>
        <mesh position={[0, 0.006, 0.085]} rotation-x={Math.PI / 2} rotation-y={Math.PI / 4} scale={[1, 1, 0.5]} raycast={() => null}><coneGeometry args={[0.045, 0.05, 4]} /><meshStandardMaterial color="#a8683f" flatShading /></mesh>
        <mesh position={[0, 0.018, 0.0]} raycast={() => null}><boxGeometry args={[0.07, 0.004, 0.124]} /><meshStandardMaterial color="#e9d29a" flatShading /></mesh>
        <mesh position={[0, 0.019, 0.0]} raycast={() => null}><boxGeometry args={[0.054, 0.006, 0.108]} /><meshStandardMaterial color="#6b4a3a" flatShading /></mesh>
        <mesh position={[0, 0.022, 0.03]} raycast={() => null}><boxGeometry args={[0.058, 0.004, 0.014]} /><meshStandardMaterial color="#d9644a" /></mesh>
        {[-1, 1].map((sd) => (
          <mesh key={sd} position={[sd * 0.045, 0.02, -0.01]} rotation-z={sd * 0.9} raycast={() => null}><boxGeometry args={[0.004, 0.06, 0.008]} /><meshStandardMaterial color="#e7b25a" /></mesh>
        ))}
      </group>
      {Array.from({ length: RIPPLES }, (_, i) => (
        <mesh key={i} ref={(m) => { ripRefs.current[i] = m }} geometry={rippleGeo} visible={false} raycast={() => null}>
          <meshBasicMaterial color="#e8f7ff" transparent opacity={0} depthWrite={false} />
        </mesh>
      ))}
    </>
  )
}

/* ---------- planet rig: drag/zoom, focus, follow camera ---------- */
const CAM_FAR = new THREE.Vector3(0, 0.9, 9)
const CAM_NEAR = new THREE.Vector3(0, 0.55, 5.2)
const FACE = new THREE.Vector3(0, 0.3, 1).normalize()
const yAxis = new THREE.Vector3(0, 1, 0)
const xAxis = new THREE.Vector3(1, 0, 0)
const SPIN = 0.07

type Ctl = { dragging: boolean; moved: boolean; x: number; y: number; dx: number; dy: number; busyAt: number; zoom: number; dist: number; yaw: number; py: number; occ: number; fp: number }

function World({ focus, mode, near, ctl, keys, pick, clear, onNear, onBoat }: {
  focus: string | null; mode: Mode; near: string | null; ctl: React.RefObject<Ctl>; keys: React.RefObject<Set<string>>
  pick: (k: string) => void; clear: () => void; onNear: (k: string | null) => void; onBoat: (b: boolean) => void
}) {
  const planet = useRef<THREE.Group>(null)
  const last = useRef<string>('')
  const target = useRef<THREE.Quaternion | null>(null)
  const spin = useRef(1)
  const tmp = useMemo(() => ({ q: new THREE.Quaternion(), n: new THREE.Vector3(), f: new THREE.Vector3(), p: new THREE.Vector3(), d: new THREE.Vector3(), up: new THREE.Vector3() }), [])
  const curve = useRoad()
  useFrame(({ camera, pointer, clock }, delta) => {
    const g = planet.current
    const c = ctl.current
    if (!g || !c) return
    const now = clock.elapsedTime * 1000
    const sig = `${mode}:${focus}`
    if (last.current !== sig) {
      last.current = sig
      const i = places.findIndex((p) => p.key === focus)
      const dir = mode === 'char' ? hero.n : i >= 0 ? placeDirs[i] : null
      if (dir) {
        const n = dir.clone().applyQuaternion(g.quaternion)
        target.current = new THREE.Quaternion().setFromUnitVectors(n, FACE).multiply(g.quaternion)
      } else target.current = null
    }
    if (mode === 'orbit' && (c.dx || c.dy)) {
      target.current = null // dragging cancels a focus turn
      g.quaternion.premultiply(tmp.q.setFromAxisAngle(yAxis, c.dx * 0.006))
      g.quaternion.premultiply(tmp.q.setFromAxisAngle(xAxis, c.dy * 0.006))
    }
    if (mode === 'orbit') c.dx = c.dy = 0 // char mode: drag ignored
    // auto-rotation: off while busy, eases back in 1.5s after
    const busy = c.dragging || !!target.current || mode === 'char'
    if (busy) { c.busyAt = now; spin.current = 0 }
    else if (now - c.busyAt > 1500) spin.current += (1 - spin.current) * (1 - Math.pow(0.35, delta))
    if (target.current) g.quaternion.slerp(target.current, 1 - Math.pow(0.02, delta))
    else g.quaternion.premultiply(tmp.q.setFromAxisAngle(yAxis, delta * SPIN * spin.current))

    const k = 1 - Math.pow(0.03, delta)
    if (mode === 'orbit') {
      const cam = camera as THREE.PerspectiveCamera
      let dirty = false
      if (Math.abs(cam.fov - 40) > 0.01) { cam.fov = THREE.MathUtils.lerp(cam.fov, 40, k); dirty = true }
      if (cam.near !== 0.02) { cam.near = 0.02; dirty = true }
      if (dirty) cam.updateProjectionMatrix()
      const dest = focus ? CAM_NEAR : tmp.d.copy(CAM_FAR).setLength(c.zoom)
      camera.position.lerp(tmp.p.set(dest.x + pointer.x * 0.4, dest.y + pointer.y * 0.25, dest.z), 1 - Math.pow(0.05, delta))
      camera.up.lerp(yAxis, k).normalize()
      camera.lookAt(0, 0, 0)
    }
  })
  return (
    <group ref={planet} rotation={[0.25, -0.4, 0]}>
      <Terrain onClick={clear} />
      <Water />
      <Road curve={curve} />
      <Bridges />
      <Car curve={curve} />
      <Forest />
      {villageAt.map(([la, lo], i) => (
        <OnSurface key={i} dir={dirOf(la, lo)} yaw={hash(i) * 6} s={0.9 + hash(i + 3) * 0.4}><House roof={i} /></OnSurface>
      ))}
      {places.map((d, i) => <Place key={d.key} d={d} idx={i} active={focus === d.key} near={mode === 'char' && near === d.key} onPick={pick} />)}
      <Hero mode={mode} keys={keys} ctl={ctl} onNear={onNear} onBoat={onBoat} />
      <Clouds />
    </group>
  )
}

const MOVE_KEYS = ['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright']

export default function PlanetScene({ onOpenList }: SceneProps) {
  const [focus, setFocus] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('orbit')
  const [near, setNear] = useState<string | null>(null)
  const [boat, setBoat] = useState(false)
  const timer = useRef<number | undefined>(undefined)
  const keys = useRef(new Set<string>())
  const ctl = useRef<Ctl>({ dragging: false, moved: false, x: 0, y: 0, dx: 0, dy: 0, busyAt: 0, zoom: CAM_FAR.length(), dist: 0.55, yaw: 0, py: 0, occ: 0, fp: 0 })
  const pick = (k: string) => {
    if (ctl.current.moved) return
    setFocus(k)
    window.clearTimeout(timer.current)
    if (k === 'library') timer.current = window.setTimeout(onOpenList, 700)
  }
  const clear = () => { if (!ctl.current.moved) setFocus(null) }
  const current = places.find((x) => x.key === focus)
  const nearPlace = places.find((x) => x.key === near)

  const live = useRef({ mode, near, pick })
  live.current = { mode, near, pick }
  useEffect(() => {
    const typing = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null
      return !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)
    }
    const down = (e: KeyboardEvent) => {
      if (typing(e) || live.current.mode !== 'char') return
      const k = e.key.toLowerCase()
      if (MOVE_KEYS.includes(k)) { keys.current.add(k); e.preventDefault() }
      if (k === 'e' && live.current.near) live.current.pick(live.current.near)
    }
    const up = (e: KeyboardEvent) => keys.current.delete(e.key.toLowerCase())
    const blur = () => keys.current.clear()
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    window.addEventListener('blur', blur)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up); window.removeEventListener('blur', blur) }
  }, [])

  const switchMode = (m: Mode) => {
    if (m === mode) return
    keys.current.clear()
    setFocus(null)
    setMode(m)
  }
  const onNear = (k: string | null) => {
    setNear(k)
    if (!k) setFocus(null)
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (!(e.target instanceof HTMLCanvasElement)) return
    Object.assign(ctl.current, { dragging: true, moved: false, x: e.clientX, y: e.clientY })
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const c = ctl.current
    if (!c.dragging) return
    const dx = e.clientX - c.x, dy = e.clientY - c.y
    if (!c.moved && Math.hypot(dx, dy) < 5) return
    c.moved = true
    c.dx += dx; c.dy += dy; c.x = e.clientX; c.y = e.clientY
  }
  const onPointerUp = () => {
    ctl.current.dragging = false
    // let the click that ends a drag be ignored, then reset
    window.setTimeout(() => { ctl.current.moved = false }, 0)
  }
  const onWheel = (e: React.WheelEvent) => {
    if (!(e.target instanceof HTMLCanvasElement)) return
    const c = ctl.current
    const f = Math.exp(e.deltaY * 0.001)
    if (mode === 'char') c.dist = THREE.MathUtils.clamp(c.dist * f, DIST_MIN, DIST_MAX)
    else c.zoom = THREE.MathUtils.clamp(c.zoom * f, 5.5, 13)
  }

  return (
    <div
      className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_60%,#3a2f6b_0%,#1d1a3a_45%,#0d0b1f_100%)]"
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerLeave={onPointerUp} onWheel={onWheel}
    >
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: CAM_FAR.toArray() as [number, number, number], fov: 40, near: 0.02 }} onPointerMissed={clear}>
        <ambientLight intensity={0.35} color="#8f86c8" />
        <hemisphereLight args={['#c9c3ff', '#2a2440', 0.5]} />
        <directionalLight position={[6, 4, 6]} intensity={2.4} color="#ffd9b8" castShadow shadow-mapSize={[1024, 1024]}
          shadow-camera-left={-4} shadow-camera-right={4} shadow-camera-top={4} shadow-camera-bottom={-4} />
        <directionalLight position={[-6, -2, -4]} intensity={0.6} color="#7a8cff" />
        <Stars radius={60} depth={30} count={2500} factor={3} saturation={0} fade speed={0.5} />
        <World focus={focus} mode={mode} near={near} ctl={ctl} keys={keys} pick={pick} clear={clear} onNear={onNear} onBoat={setBoat} />
        <Atmosphere />
        <Moon />
        <ShootingStar />
        <Sparkles count={40} scale={[12, 8, 12]} size={2} color="#ffd9c2" speed={0.2} opacity={0.5} />
      </Canvas>

      <div className="absolute left-1/2 top-8 z-10 flex -translate-x-1/2 flex-col items-center gap-1.5">
        <div className="flex rounded-full border border-white/15 bg-[#1d1a3a]/70 p-1 shadow-lg backdrop-blur-xl">
          {([['orbit', '环绕视角'], ['char', '角色视角']] as const).map(([m, label]) => (
            <button key={m} onClick={() => switchMode(m)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition ${mode === m ? 'bg-[#ffcfa8] text-[#1d1a3a]' : 'text-white/60 hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className={`font-mono text-[10px] tracking-[0.2em] text-[#ffe3cf]/60 transition-opacity ${mode === 'char' ? 'opacity-100' : 'opacity-0'}`}>W/S 前进后退 · A/D 转向 · 移动鼠标环视 · E 进入</div>
        <div className={`rounded-full border border-white/15 bg-[#1d1a3a]/70 px-3 py-1 text-[11px] text-[#ffe3cf] shadow-lg backdrop-blur-xl transition-opacity duration-300 ${mode === 'char' && boat ? 'opacity-100' : 'opacity-0'}`}>⛵ 乘船中</div>
      </div>

      <ol className="absolute left-8 top-1/2 z-10 -translate-y-1/2 space-y-1 max-[900px]:hidden">
        <li className="mb-3 font-mono text-[10px] tracking-[0.3em] text-[#ffcfa8]/70">TINY PLANET</li>
        {places.map((d) => {
          const on = d.key === focus || (mode === 'char' && d.key === near)
          return (
            <li key={d.key}>
              <button onClick={() => pick(d.key)} className={`group flex items-center gap-3 py-1.5 text-left transition ${on ? 'text-[#ffcfa8]' : 'text-white/55 hover:text-white'}`}>
                <span className={`h-px bg-current transition-all ${on ? 'w-10' : 'w-4 group-hover:w-7'}`} />
                <span className="font-mono text-[10px]">{d.no}</span>
                <span className="text-sm font-semibold">{d.name}</span>
                <span className="font-mono text-[10px] opacity-70">{d.role}</span>
              </button>
            </li>
          )
        })}
        <li className="pt-4 text-[11px] leading-relaxed text-white/40">
          {mode === 'orbit'
            ? <>拖拽旋转星球 · 滚轮缩放<br />点击地点前往</>
            : <>W/S 前进后退 · A/D 转向<br />移动鼠标环视 · 滚轮调整距离 · 靠近地点按 E</>}
        </li>
      </ol>

      {current ? (
        <div className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-2xl border border-white/15 bg-[#1d1a3a]/75 px-6 py-4 text-center text-white shadow-xl backdrop-blur-xl">
          <div className="font-mono text-[10px] tracking-[0.25em] text-[#ffcfa8]/80">PLACE {current.no}</div>
          <div className="mt-1 text-lg font-black">{current.name} · {current.role}</div>
          <div className="mt-1 text-xs text-white/60">{current.desc}</div>
          {current.key !== 'library' && mode === 'orbit' && <div className="mt-1 text-[10px] text-white/40">点击空白处返回星球全景</div>}
        </div>
      ) : mode === 'char' && nearPlace && (
        <div className="absolute bottom-28 left-1/2 z-10 -translate-x-1/2 rounded-full border border-white/15 bg-[#1d1a3a]/75 px-5 py-2 text-sm text-white shadow-xl backdrop-blur-xl">
          按 <kbd className="mx-1 rounded bg-[#ffcfa8] px-1.5 py-0.5 font-mono text-xs font-bold text-[#1d1a3a]">E</kbd> 进入 · {nearPlace.name}
        </div>
      )}
    </div>
  )
}
