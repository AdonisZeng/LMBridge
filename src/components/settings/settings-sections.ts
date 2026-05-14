export const SETTINGS_SECTIONS = [
  { id: 'provider', label: '提供商' },
  { id: 'mcp', label: 'MCP' },
  { id: 'knowledge-base', label: '知识库' },
  { id: 'web-search', label: '联网搜索' },
] as const

export type SettingsSectionId = (typeof SETTINGS_SECTIONS)[number]['id']
