import { articles, tagColors, type Article } from '../data/articles'

type Props = {
  open: boolean
  selected: Article | null
  onSelect: (a: Article | null) => void
  onClose: () => void
  heading: string
  tone: 'light' | 'dark'
}

export default function ArticlePanel({ open, selected, onSelect, onClose, heading, tone }: Props) {
  const light = tone === 'light'
  const surface = light ? 'bg-[#fbf4e8]/92 text-[#2b2118] border-[#2b2118]/10' : 'bg-[#120f1c]/88 text-[#efe8ff] border-white/10'
  const sub = light ? 'text-[#2b2118]/55' : 'text-white/50'
  const rule = light ? 'border-[#2b2118]/10' : 'border-white/10'

  return (
    <aside
      className={`fixed top-0 right-0 z-30 h-full w-full max-w-[460px] border-l backdrop-blur-xl transition-transform duration-500 ease-[cubic-bezier(.2,.8,.2,1)] ${surface} ${open ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div className={`flex items-center justify-between border-b px-8 py-6 ${rule}`}>
        <button
          onClick={() => (selected ? onSelect(null) : onClose())}
          className={`font-mono text-xs uppercase tracking-[0.2em] ${sub} hover:opacity-100 transition`}
        >
          {selected ? '← 返回列表' : '× 关闭'}
        </button>
        <span className={`font-mono text-xs tracking-[0.2em] ${sub}`}>{heading}</span>
      </div>

      <div className="scroll-quiet h-[calc(100%-73px)] overflow-y-auto px-8 py-8">
        {selected ? (
          <article>
            <div className="mb-6 flex items-center gap-3 font-mono text-xs">
              <span className="h-2 w-2 rounded-full" style={{ background: tagColors[selected.tag] }} />
              <span className={sub}>{selected.tag} · {selected.date} · {selected.minutes} 分钟</span>
            </div>
            <h2 className="mb-6 text-3xl font-black leading-tight">{selected.title}</h2>
            <p className="mb-5 text-lg italic leading-relaxed opacity-80">{selected.excerpt}</p>
            <p className={`leading-8 ${light ? 'text-[#2b2118]/80' : 'text-white/75'}`}>
              这里是文章正文的阅读区域。3D 场景只作为入口与氛围，进入阅读后切换为安静的二维排版，保证字号、行距与对比度都适合长时间阅读，也便于后续接入 Markdown / CMS。
            </p>
            <p className={`mt-5 leading-8 ${light ? 'text-[#2b2118]/80' : 'text-white/75'}`}>
              下一版会在这里加入目录、代码高亮、图片放大与评论。
            </p>
          </article>
        ) : (
          <>
            <h2 className="mb-2 font-display text-5xl">Writing</h2>
            <p className={`mb-8 text-sm ${sub}`}>共 {articles.length} 篇 · 点击阅读</p>
            <ul>
              {articles.map((a, i) => (
                <li key={a.id}>
                  <button
                    onClick={() => onSelect(a)}
                    className={`group grid w-full grid-cols-[2rem_1fr] gap-3 border-t py-5 text-left ${rule}`}
                  >
                    <span className={`font-mono text-xs pt-1 ${sub}`}>{String(i + 1).padStart(2, '0')}</span>
                    <span>
                      <span className="block font-semibold leading-snug transition group-hover:translate-x-1">{a.title}</span>
                      <span className={`mt-1 flex items-center gap-2 font-mono text-[11px] ${sub}`}>
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: tagColors[a.tag] }} />
                        {a.tag} · {a.date}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}
      </div>
    </aside>
  )
}
