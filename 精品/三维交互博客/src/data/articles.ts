export type Article = {
  id: string
  title: string
  excerpt: string
  tag: '技术' | '设计' | '生活' | '阅读'
  date: string
  minutes: number
}

export const tagColors: Record<Article['tag'], string> = {
  技术: '#7cc6ff',
  设计: '#f2b880',
  生活: '#9fe0a8',
  阅读: '#d8a6ff',
}

export const articles: Article[] = [
  { id: 'a1', title: '用 React Three Fiber 搭一个会呼吸的房间', excerpt: '从一个立方体开始，到灯光、阴影和交互——记录这个网站的第一版是怎么长出来的。', tag: '技术', date: '2026.09.21', minutes: 12 },
  { id: 'a2', title: '为什么我不再用"卡片列表"做博客', excerpt: '信息罗列让人高效，但也让人遗忘。我想要一个可以"走进去"的地方。', tag: '设计', date: '2026.09.08', minutes: 7 },
  { id: 'a3', title: '着色器入门：把噪声变成云', excerpt: 'fbm、域扭曲与一点点耐心。附可交互示例。', tag: '技术', date: '2026.08.30', minutes: 15 },
  { id: 'a4', title: '在京都住了十四天', excerpt: '清晨的鸭川、雨后的苔寺，以及一家只有六个座位的咖啡馆。', tag: '生活', date: '2026.08.12', minutes: 9 },
  { id: 'a5', title: '读《设计中的设计》', excerpt: '原研哉说"空"不是没有，而是等待被填满的可能。', tag: '阅读', date: '2026.07.27', minutes: 6 },
  { id: 'a6', title: '一套可扩展的 3D 场景模块协议', excerpt: '每个物件只需声明位置、模型和点击行为，场景就能自己组装。', tag: '技术', date: '2026.07.10', minutes: 11 },
  { id: 'a7', title: '颜色的温度：给界面调一杯热可可', excerpt: '暖色系配色的六条经验，和三次失败。', tag: '设计', date: '2026.06.22', minutes: 8 },
  { id: 'a8', title: '周末去海边骑车', excerpt: '风很大，路很长，脑子终于安静下来。', tag: '生活', date: '2026.06.03', minutes: 4 },
  { id: 'a9', title: '《沙丘》里的生态学', excerpt: '一颗星球如何塑造一种文明，以及反过来。', tag: '阅读', date: '2026.05.18', minutes: 10 },
]
