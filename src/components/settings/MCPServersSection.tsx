import { useState } from 'react'
import { Bot, Plus, Plug, Trash2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useMCPStore } from '@/lib/store/mcp'
import { cn } from '@/lib/utils'

export function MCPServersSection() {
  const { serverConfigs, addServer, removeServer, connectServer, disconnectServer } =
    useMCPStore()
  const [showAddModal, setShowAddModal] = useState(false)
  const [newServerName, setNewServerName] = useState('')
  const [newServerUrl, setNewServerUrl] = useState('')

  const handleAddServer = async () => {
    if (!newServerName.trim() || !newServerUrl.trim()) return

    await addServer({
      id: Date.now().toString(),
      name: newServerName.trim(),
      url: newServerUrl.trim(),
    })

    setNewServerName('')
    setNewServerUrl('')
    setShowAddModal(false)
  }

  const handleToggleConnection = async (serverId: string, currentlyConnected: boolean) => {
    if (currentlyConnected) {
      disconnectServer(serverId)
    } else {
      await connectServer(serverId)
    }
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between rounded-xl border border-[#1E293B] bg-[#1E293B]/40 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#1E293B] border border-[#334155] flex items-center justify-center">
            <Bot size={18} className="text-[#4a9eff]" />
          </div>
          <div>
            <div className="text-sm font-medium text-[#F8FAFC]">MCP 服务器</div>
            <div className="text-xs text-[#64748b]">
              {serverConfigs.filter((s) => s.connected).length} / {serverConfigs.length} 个已连接
            </div>
          </div>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 text-xs gap-1 text-[#ccc] hover:text-white hover:bg-[#334155]"
          onClick={() => setShowAddModal(true)}
        >
          <Plus size={14} />
          添加服务器
        </Button>
      </div>

      {/* Server List */}
      <div className="space-y-3">
        {serverConfigs.map((server) => (
          <div
            key={server.id}
            className="rounded-xl border border-[#334155] bg-[#1E293B]/60 p-4 transition-all duration-200"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div
                  className={cn(
                    'w-2 h-2 rounded-full',
                    server.connected ? 'bg-green-500' : 'bg-[#666]'
                  )}
                />
                <span className="text-[#ccc] font-medium text-sm">{server.name}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleToggleConnection(server.id, server.connected)}
                  className={cn(
                    'p-1.5 rounded hover:bg-[#3c3c3c] transition-colors',
                    server.connected
                      ? 'text-green-500 hover:text-green-400'
                      : 'text-[#666] hover:text-[#aaa]'
                  )}
                  title={server.connected ? '断开连接' : '连接'}
                >
                  <Plug size={14} />
                </button>
                <button
                  onClick={() => removeServer(server.id)}
                  className="p-1.5 rounded hover:bg-[#3c3c3c] text-[#666] hover:text-[#aaa] transition-colors"
                  title="删除服务器"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="text-[#666] text-xs mb-2">{server.url}</div>
            <div className="text-[#858585] text-xs">
              {server.connected
                ? server.tools.length > 0
                  ? `${server.tools.length} 个工具已注册`
                  : '已连接，暂无工具'
                : '未连接'}
            </div>
            {server.connected && server.tools.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {server.tools.slice(0, 5).map((tool) => (
                  <span
                    key={tool.name}
                    className="px-2 py-0.5 bg-[#3c3c3c] rounded text-[10px] text-[#aaa]"
                  >
                    {tool.name}
                  </span>
                ))}
                {server.tools.length > 5 && (
                  <span className="px-2 py-0.5 text-[10px] text-[#666]">
                    +{server.tools.length - 5} more
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {serverConfigs.length === 0 && (
          <div className="text-center py-12 rounded-xl border border-dashed border-[#334155] bg-[#0F172A]/40">
            <Bot size={32} className="text-[#3c3c3c] mx-auto mb-3" />
            <p className="text-[#666] text-sm">暂无 MCP 服务器</p>
            <p className="text-[#555] text-xs mt-1">点击上方按钮添加服务器</p>
          </div>
        )}
      </div>

      {/* Add Server Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-[#252526] rounded-lg w-[400px] border border-[#3c3c3c]">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#3c3c3c]">
              <span className="text-[#ccc] font-medium">添加 MCP 服务器</span>
              <button
                onClick={() => setShowAddModal(false)}
                className="p-1 rounded hover:bg-[#333] text-[#666] hover:text-[#aaa]"
              >
                <X size={16} />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-[#858585] text-xs mb-2">服务器名称</label>
                <input
                  type="text"
                  value={newServerName}
                  onChange={(e) => setNewServerName(e.target.value)}
                  placeholder="例如: Filesystem"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] placeholder-[#666] focus:outline-none focus:border-[#4a9eff]"
                />
              </div>
              <div>
                <label className="block text-[#858585] text-xs mb-2">服务器 URL</label>
                <input
                  type="text"
                  value={newServerUrl}
                  onChange={(e) => setNewServerUrl(e.target.value)}
                  placeholder="例如: http://localhost:3001"
                  className="w-full bg-[#1e1e1e] border border-[#3c3c3c] rounded px-3 py-2 text-sm text-[#ccc] placeholder-[#666] focus:outline-none focus:border-[#4a9eff]"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 px-4 py-3 border-t border-[#3c3c3c]">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddModal(false)}
                className="text-[#ccc]"
              >
                取消
              </Button>
              <Button
                size="sm"
                onClick={handleAddServer}
                disabled={!newServerName.trim() || !newServerUrl.trim()}
                className="bg-[#4a9eff] hover:bg-[#3d8bdb]"
              >
                添加
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
