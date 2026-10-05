import { useState } from 'react'
import RoomScene from './scenes/A-书房小屋/RoomScene'
import PlanetScene from './scenes/B-迷你星球/PlanetScene'
import GalaxyScene from './scenes/C-文章银河/GalaxyScene'
import IslandsScene from './scenes/E-浮空群岛/IslandsScene'
import ArticlePanel from './components/ArticlePanel'
import type { Article } from './data/articles'

const concepts = [
  { key: 'islands', code: 'E', name: '漂浮群岛', en: 'Floating Isles', hint: '点击浮岛飞过去 · 书岛是文章入口 · 点空白处返回', tone: 'light' as const, Scene: IslandsScene },
  { key: 'room', code: 'A', name: '小房间', en: 'The Room', hint: '拖动旋转视角 · 点击书架上的书阅读文章', tone: 'light' as const, Scene: RoomScene },
  { key: 'planet', code: 'B', name: '小星球', en: 'Tiny Planet', hint: '拖动转动星球 · 找到红顶图书馆进入文章', tone: 'dark' as const, Scene: PlanetScene },
  { key: 'galaxy', code: 'C', name: '文章星系', en: 'Galaxy', hint: '每颗星是一篇文章 · 同色星座为同一主题', tone: 'dark' as const, Scene: GalaxyScene },
]

export default function App() {
  const [idx, setIdx] = useState(0)
  const [panelOpen, setPanelOpen] = useState(false)
  const [selected, setSelected] = useState<Article | null>(null)
  const c = concepts[idx]
  const light = c.tone === 'light'
  const ink = light ? 'text-[#2b2118]' : 'text-[#efe8ff]'
  const sub = light ? 'text-[#2b2118]/60' : 'text-white/55'

  const openArticle = (a: Article) => { setSelected(a); setPanelOpen(true) }
  const openList = () => { setSelected(null); setPanelOpen(true) }

  return (
    <main className="relative h-full w-full overflow-hidden">
      <c.Scene key={c.key} onOpenArticle={openArticle} onOpenList={openList} />

      {/* brand */}
      <header className={`pointer-events-none absolute left-8 top-7 z-20 ${ink}`}>
        <div className="font-mono text-[11px] tracking-[0.3em] opacity-60">LIN · PERSONAL SITE</div>
        <h1 className="mt-2 font-display text-6xl leading-none max-[700px]:text-4xl">
          {c.en}<span className="italic opacity-50">.</span>
        </h1>
        <p className={`mt-3 max-w-xs text-sm ${sub}`}>{c.hint}</p>
      </header>

      <button
        onClick={openList}
        className={`absolute right-8 top-8 z-20 rounded-full border px-5 py-2 font-mono text-xs tracking-[0.2em] backdrop-blur transition hover:-translate-y-0.5 ${light ? 'border-[#2b2118]/20 bg-[#fbf4e8]/60 text-[#2b2118]' : 'border-white/15 bg-white/5 text-white'}`}
      >
        WRITING ↗
      </button>

      {/* concept switcher */}
      <nav className={`absolute bottom-8 left-1/2 z-20 flex -translate-x-1/2 gap-1 rounded-full border p-1.5 backdrop-blur-xl ${light ? 'border-[#2b2118]/15 bg-[#fbf4e8]/70' : 'border-white/10 bg-white/5'}`}>
        {concepts.map((k, i) => {
          const active = i === idx
          return (
            <button
              key={k.key}
              onClick={() => { setIdx(i); setPanelOpen(false) }}
              className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm transition ${
                active ? (light ? 'bg-[#2b2118] text-[#fbf4e8]' : 'bg-white text-[#120f1c]') : `${ink} opacity-60 hover:opacity-100`
              }`}
            >
              <span className="font-mono text-[11px]">{k.code}</span>
              <span>{k.name}</span>
            </button>
          )
        })}
      </nav>

      <div className={`pointer-events-none absolute bottom-10 left-8 z-20 font-mono text-[11px] tracking-widest max-[900px]:hidden ${sub}`}>
        MOCK 0{idx + 1} / 0{concepts.length}
      </div>

      <ArticlePanel
        open={panelOpen}
        selected={selected}
        onSelect={setSelected}
        onClose={() => setPanelOpen(false)}
        heading={`${c.code} · ${c.name}`}
        tone={c.tone}
      />
    </main>
  )
}
