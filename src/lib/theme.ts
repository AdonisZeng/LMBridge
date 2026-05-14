export type AppTheme = 'light' | 'dark'

type ClassListLike = {
  add: (...tokens: string[]) => void
  remove: (...tokens: string[]) => void
}

type ElementLike = {
  classList: ClassListLike
}

type DocumentLike = {
  documentElement: ElementLike
  body?: ElementLike
}

const THEME_CLASS_NAMES: AppTheme[] = ['light', 'dark']

function syncThemeClassList(classList: ClassListLike, theme: AppTheme): void {
  classList.remove(...THEME_CLASS_NAMES)
  classList.add(theme)
}

export function applyThemeToDocument(theme: AppTheme, doc: DocumentLike = document): void {
  syncThemeClassList(doc.documentElement.classList, theme)

  if (doc.body) {
    syncThemeClassList(doc.body.classList, theme)
  }
}
