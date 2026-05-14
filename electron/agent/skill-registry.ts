import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import { parse } from 'yaml'

const DEFAULT_SKILL_ROOT = join(homedir(), '.agents', 'skills')

export interface AgentSkillEntrypoint {
  runner: 'node' | 'python' | 'shell'
  command: string
}

export interface AgentSkillSummary {
  id: string
  name: string
  description: string
  rootDir: string
  tags: string[]
  isExecutable: boolean
  allowedMcpTools: string[]
  entrypoints: AgentSkillEntrypoint[]
}

export interface AgentSkillContent {
  id: string
  content: string
}

interface ParsedSkillFrontmatter {
  name: string
  description: string
}

interface ParsedAiBoxMetadata {
  tags?: string[]
  allowed_mcp_tools?: string[]
  entrypoints?: AgentSkillEntrypoint[]
}

export class SkillRegistry {
  private rootDir: string

  constructor(rootDir = DEFAULT_SKILL_ROOT) {
    this.rootDir = rootDir
  }

  async load(): Promise<AgentSkillSummary[]> {
    if (!existsSync(this.rootDir)) {
      return []
    }

    return readdirSync(this.rootDir)
      .map((entry) => join(this.rootDir, entry))
      .filter((fullPath) => statSync(fullPath).isDirectory())
      .flatMap((skillDir) => this.loadSkill(skillDir))
  }

  async loadContent(skillId: string): Promise<AgentSkillContent | null> {
    const skills = await this.load()
    const skill = skills.find((item) => item.id === skillId)
    if (!skill) {
      return null
    }

    return {
      id: skill.id,
      content: readFileSync(join(skill.rootDir, 'SKILL.md'), 'utf8'),
    }
  }

  private loadSkill(skillDir: string): AgentSkillSummary[] {
    const skillFile = join(skillDir, 'SKILL.md')
    if (!existsSync(skillFile)) {
      return []
    }

    const { name, description } = this.parseFrontmatter(readFileSync(skillFile, 'utf8'))
    const aiBoxFile = join(skillDir, 'agents', 'ai-box.yaml')
    const aiBoxConfig = existsSync(aiBoxFile)
      ? (parse(readFileSync(aiBoxFile, 'utf8')) as ParsedAiBoxMetadata)
      : {}
    const entrypoints = Array.isArray(aiBoxConfig.entrypoints) ? aiBoxConfig.entrypoints : []

    return [
      {
        id: name,
        name,
        description,
        rootDir: skillDir,
        tags: Array.isArray(aiBoxConfig.tags) ? aiBoxConfig.tags : [],
        isExecutable: entrypoints.length > 0,
        allowedMcpTools: Array.isArray(aiBoxConfig.allowed_mcp_tools)
          ? aiBoxConfig.allowed_mcp_tools
          : [],
        entrypoints,
      },
    ]
  }

  private parseFrontmatter(content: string): ParsedSkillFrontmatter {
    const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
    if (!match) {
      throw new Error('SKILL.md must start with YAML frontmatter')
    }

    const data = parse(match[1]) as ParsedSkillFrontmatter
    if (!data?.name || !data?.description) {
      throw new Error('Skill frontmatter must include name and description')
    }

    return data
  }
}
