import type { Article } from '../data/articles'

export type SceneProps = {
  onOpenArticle: (a: Article) => void
  onOpenList: () => void
}
