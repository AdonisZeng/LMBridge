import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  DefaultPlanner,
  buildPlannerMessages,
  parsePlannerDecision,
} from './default-planner.ts'

test('serializes task context, skills, tools, and observations into prompt messages', () => {
  const messages = buildPlannerMessages({
    prompt: 'Find the active provider',
    mode: 'confirm-external',
    skills: [
      {
        id: 'repo-summary',
        name: 'repo-summary',
        description: 'Summarize repos',
        rootDir: 'C:/skills/repo-summary',
        tags: ['code'],
        isExecutable: false,
        allowedMcpTools: [],
        entrypoints: [],
      },
    ],
    tools: [{ name: 'filesystem.read_file', description: 'Read a file', inputSchema: {} }],
    memories: [
      {
        id: 'prefer-concise',
        name: 'Prefer concise',
        type: 'user',
        description: 'User prefers concise answers.',
        content: 'Keep final answers concise.',
      },
    ],
    planning: {
      roundsSinceUpdate: 3,
      items: [
        {
          content: 'Inspect package.json',
          status: 'in_progress',
          activeForm: 'Inspecting package.json',
        },
      ],
    },
    loop: {
      turnCount: 2,
      transitionReason: 'tool_result',
      compactionCount: 1,
      messages: [
        { role: 'user', content: 'Find the active provider', timestamp: 1 },
        {
          role: 'assistant',
          content: { type: 'call_tool', toolName: 'filesystem.read_file' },
          timestamp: 2,
        },
        {
          role: 'user',
          content: [
            {
              type: 'tool_result',
              tool_use_id: 'step-2',
              content: '{"name":"ai-box"}',
            },
          ],
          timestamp: 3,
        },
      ],
    },
    observations: [
      {
        type: 'tool_result',
        actionId: 'step-2',
        name: 'filesystem.read_file',
        status: 'success',
        summary: 'Read package.json',
        data: {},
        rawExcerpt: '{"name":"ai-box"}',
        artifacts: [],
      },
    ],
  })

  assert.equal(messages[0]?.role, 'system')
  assert.match(messages[1]?.content ?? '', /filesystem\.read_file/)
  assert.match(messages[1]?.content ?? '', /repo-summary/)
  assert.match(messages[1]?.content ?? '', /confirm-external/)
  assert.match(messages[1]?.content ?? '', /"turnCount": 2/)
  assert.match(messages[1]?.content ?? '', /"transitionReason": "tool_result"/)
  assert.match(messages[0]?.content ?? '', /agent\.update_plan/)
  assert.match(messages[0]?.content ?? '', /agent\.task/)
  assert.match(messages[0]?.content ?? '', /agent\.load_skill/)
  assert.match(messages[1]?.content ?? '', /"planningState"/)
  assert.match(messages[1]?.content ?? '', /"planningReminder"/)
  assert.match(messages[1]?.content ?? '', /"contextBudget"/)
  assert.match(messages[1]?.content ?? '', /"availableMemories"/)
  assert.match(messages[1]?.content ?? '', /Prefer concise/)
})

test('parses JSON planner output into a normalized action', () => {
  const decision = parsePlannerDecision(
    JSON.stringify({
      type: 'call_tool',
      toolName: 'filesystem.read_file',
      arguments: { path: 'package.json' },
      summary: 'Read package metadata',
      plan: ['Inspect package.json', 'Summarize findings'],
    })
  )

  assert.equal(decision.type, 'call_tool')
  assert.equal(decision.toolName, 'filesystem.read_file')
  assert.deepEqual(decision.plan, ['Inspect package.json', 'Summarize findings'])
})

test('accepts action field and summary-only finish output from local models', () => {
  const decision = parsePlannerDecision(`
    {
      "action": "finish",
      "summary": "你好！我是 AI Box agent planner。"
    }
  `)

  assert.equal(decision.type, 'finish')
  assert.equal(decision.summary, '你好！我是 AI Box agent planner。')
  assert.equal(decision.finalMessage, '你好！我是 AI Box agent planner。')
})

test('accepts nested next_action finish output from local models', () => {
  const decision = parsePlannerDecision(`
    \`\`\`json
    {
      "summary": "Responding to user's inquiry about capabilities.",
      "next_action": {
        "type": "finish",
        "content": "你好！我是 AI Box agent planner。"
      }
    }
    \`\`\`
  `)

  assert.equal(decision.type, 'finish')
  assert.equal(decision.summary, "Responding to user's inquiry about capabilities.")
  assert.equal(decision.finalMessage, '你好！我是 AI Box agent planner。')
})

test('accepts nested action object finish output from local models', () => {
  const decision = parsePlannerDecision(`
    {
      "summary": "用户询问我能做什么。",
      "plan": [
        {
          "content": "回答用户关于能力的询问",
          "status": "completed"
        }
      ],
      "action": {
        "type": "finish",
        "result": "你好！我可以为你提供开发、AI 和项目管理帮助。"
      }
    }
  `)

  assert.equal(decision.type, 'finish')
  assert.equal(decision.summary, '用户询问我能做什么。')
  assert.equal(decision.finalMessage, '你好！我可以为你提供开发、AI 和项目管理帮助。')
  assert.deepEqual(decision.plan, ['[completed] 回答用户关于能力的询问'])
})

test('treats summary-only planner output as a finish decision', () => {
  const decision = parsePlannerDecision(`
    {
      "summary": "用户询问我能做什么。我将总结我的核心能力，包括开发、设计、搜索和任务管理等方面。",
      "plan": []
    }
  `)

  assert.equal(decision.type, 'finish')
  assert.equal(
    decision.finalMessage,
    '用户询问我能做什么。我将总结我的核心能力，包括开发、设计、搜索和任务管理等方面。'
  )
  assert.deepEqual(decision.plan, [])
})

test('uses the injected model caller to produce the next planner decision', async () => {
  const planner = new DefaultPlanner({
    callModel: async (messages) => {
      assert.equal(messages.length, 2)
      return JSON.stringify({
        type: 'finish',
        summary: 'done',
        finalMessage: 'All work is complete.',
      })
    },
  })

  const decision = await planner.next({
    prompt: 'Summarize the repository',
    mode: 'auto',
    skills: [],
    tools: [],
    memories: [],
    planning: {
      items: [],
      roundsSinceUpdate: 0,
    },
    loop: {
      turnCount: 1,
      transitionReason: null,
      compactionCount: 0,
      messages: [{ role: 'user', content: 'Summarize the repository', timestamp: 1 }],
    },
    observations: [],
  })

  assert.equal(decision.type, 'finish')
  assert.equal(decision.finalMessage, 'All work is complete.')
})

test('asks the model to repair invalid planner protocol output before falling back', async () => {
  const calls: string[][] = []
  const planner = new DefaultPlanner({
    callModel: async (messages) => {
      calls.push(messages.map((message) => String(message.content)))
      return calls.length === 1
        ? JSON.stringify({
            summary: '用户询问我能做什么。我将总结核心能力。',
            plan: [],
          })
        : JSON.stringify({
            type: 'finish',
            summary: 'answered',
            finalMessage: '我可以帮你完成开发、设计、搜索和任务管理。',
          })
    },
  })

  const decision = await planner.next({
    prompt: '你能为我做什么？',
    mode: 'auto',
    skills: [],
    tools: [],
    memories: [],
    planning: {
      items: [],
      roundsSinceUpdate: 0,
    },
    loop: {
      turnCount: 1,
      transitionReason: null,
      compactionCount: 0,
      messages: [{ role: 'user', content: '你能为我做什么？', timestamp: 1 }],
    },
    observations: [],
  })

  assert.equal(decision.type, 'finish')
  assert.equal(decision.finalMessage, '我可以帮你完成开发、设计、搜索和任务管理。')
  assert.equal(calls.length, 2)
  assert.match(calls[1]?.at(-1) ?? '', /previous planner response could not be parsed/i)
  assert.match(calls[1]?.at(-1) ?? '', /supported type or action field/i)
  assert.match(calls[1]?.at(-1) ?? '', /用户询问我能做什么/)
})
