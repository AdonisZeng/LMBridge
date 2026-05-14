import * as assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  BUILT_IN_AGENT_TOOLS,
  AGENT_UPDATE_PLAN_TOOL_NAME,
  AGENT_TASK_TOOL_NAME,
  isTaskGraphTool,
  isBackgroundTool,
  isScheduleTool,
  isBuiltInTool,
} from './built-in-tool-registry.ts'

test('exports 13 built-in tools', () => {
  assert.equal(BUILT_IN_AGENT_TOOLS.length, 13)
})

test('includes expected tool names', () => {
  const names = BUILT_IN_AGENT_TOOLS.map((t) => t.name)
  assert.ok(names.includes(AGENT_UPDATE_PLAN_TOOL_NAME))
  assert.ok(names.includes(AGENT_TASK_TOOL_NAME))
  assert.ok(names.includes('agent.load_skill'))
  assert.ok(names.includes('agent.save_memory'))
  assert.ok(names.includes('agent.task_create'))
  assert.ok(names.includes('agent.task_update'))
  assert.ok(names.includes('agent.task_get'))
  assert.ok(names.includes('agent.task_list'))
  assert.ok(names.includes('agent.background_run'))
  assert.ok(names.includes('agent.background_check'))
  assert.ok(names.includes('agent.schedule_create'))
  assert.ok(names.includes('agent.schedule_list'))
  assert.ok(names.includes('agent.schedule_check'))
})

test('classifies task graph tools correctly', () => {
  assert.equal(isTaskGraphTool('agent.task_create'), true)
  assert.equal(isTaskGraphTool('agent.task_update'), true)
  assert.equal(isTaskGraphTool('agent.task_get'), true)
  assert.equal(isTaskGraphTool('agent.task_list'), true)
  assert.equal(isTaskGraphTool('agent.update_plan'), false)
  assert.equal(isTaskGraphTool('unknown'), false)
})

test('classifies background tools correctly', () => {
  assert.equal(isBackgroundTool('agent.background_run'), true)
  assert.equal(isBackgroundTool('agent.background_check'), true)
  assert.equal(isBackgroundTool('agent.schedule_create'), false)
  assert.equal(isBackgroundTool('unknown'), false)
})

test('classifies schedule tools correctly', () => {
  assert.equal(isScheduleTool('agent.schedule_create'), true)
  assert.equal(isScheduleTool('agent.schedule_list'), true)
  assert.equal(isScheduleTool('agent.schedule_check'), true)
  assert.equal(isScheduleTool('agent.background_run'), false)
  assert.equal(isScheduleTool('unknown'), false)
})

test('identifies all built-in tools', () => {
  for (const tool of BUILT_IN_AGENT_TOOLS) {
    assert.equal(isBuiltInTool(tool.name), true)
  }
  assert.equal(isBuiltInTool('unknown.tool'), false)
})
