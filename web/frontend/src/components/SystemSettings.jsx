import React, { useState, useEffect, useCallback } from 'react'
import {
  Settings,
  Users,
  Shield,
  Camera,
  CameraOff,
  Brain,
  Key,
  Bell,
  Trash2,
  Edit3,
  Plus,
  Save,
  X,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  RefreshCw,
  Lock,
  User,
  Phone,
  UserCheck,
  UserX,
  ChevronRight,
  Clock,
  Database,
  Gauge,
  Globe,
  Sliders,
  ToggleLeft,
  ToggleRight,
  Info,
} from 'lucide-react'
import axios from 'axios'

const API_BASE = '/api'

// ================================================================
//  子Tab 定义
// ================================================================
const TABS = [
  { key: 'users', label: '用户管理', icon: Users, desc: '管理家庭成员账户与权限' },
  { key: 'roles', label: '角色权限', icon: Shield, desc: '查看系统角色定义' },
  { key: 'privacy', label: '隐私与安全', icon: Camera, desc: '摄像头调度 / 数据留存策略' },
  { key: 'ai', label: 'AI 引擎', icon: Brain, desc: 'API 密钥 / 模型配置 / 预警阈值' },
]

// 角色映射
const ROLE_BADGE = {
  ROLE_ADMIN: { label: '管理员', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  ROLE_NORMAL: { label: '普通用户', color: 'bg-sky-500/20 text-sky-300 border-sky-500/30' },
}

// ================================================================
//  主组件
// ================================================================
function SystemSettings({ currentUser }) {
  const [activeTab, setActiveTab] = useState('users')

  return (
    <div className="max-w-6xl mx-auto">
      {/* 顶部标题 */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-3">
          <Settings className="w-7 h-7 text-purple-400" />
          系统设置
        </h2>
        <p className="text-gray-400 text-sm mt-1">管理用户、角色、隐私配置及 AI 引擎参数</p>
      </div>

      {/* Tab 切换 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.key
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all text-center ${
                isActive
                  ? 'bg-purple-600/20 border-purple-500/50 text-white shadow-lg shadow-purple-500/10'
                  : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className={`w-6 h-6 ${isActive ? 'text-purple-400' : ''}`} />
              <span className="text-sm font-medium">{tab.label}</span>
              <span className="text-xs opacity-60 hidden md:block">{tab.desc}</span>
            </button>
          )
        })}
      </div>

      {/* 内容区域 */}
      <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6 min-h-[500px]">
        {activeTab === 'users' && <UserManagement currentUser={currentUser} />}
        {activeTab === 'roles' && <RoleManagement />}
        {activeTab === 'privacy' && <PrivacyConfig />}
        {activeTab === 'ai' && <AIEngineConfig />}
      </div>
    </div>
  )
}


// ================================================================
//  1. 用户管理子模块
// ================================================================
function UserManagement({ currentUser }) {
  const [users, setUsers] = useState([])
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // 创建用户表单
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [createForm, setCreateForm] = useState({
    username: '', password: '', display_name: '', phone: '', role_id: 2,
  })

  // 编辑用户
  const [editingUser, setEditingUser] = useState(null)
  const [editForm, setEditForm] = useState({})

  // 重置密码
  const [resetPwdUserId, setResetPwdUserId] = useState(null)
  const [newPassword, setNewPassword] = useState('')
  const [showNewPassword, setShowNewPassword] = useState(false)

  const [actionLoading, setActionLoading] = useState(false)

  // 加载数据
  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const [usersRes, rolesRes] = await Promise.all([
        axios.get(`${API_BASE}/admin/users`),
        axios.get(`${API_BASE}/admin/roles`),
      ])
      setUsers(usersRes.data.users || [])
      setRoles(rolesRes.data.roles || [])
      setError(null)
    } catch (e) {
      setError(e.response?.data?.detail || '加载用户数据失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const clearMessages = () => { setError(null); setSuccess(null) }

  // 创建用户
  const handleCreate = async (e) => {
    e.preventDefault()
    clearMessages()
    setActionLoading(true)
    try {
      await axios.post(`${API_BASE}/admin/users`, createForm)
      setSuccess('用户创建成功')
      setShowCreateForm(false)
      setCreateForm({ username: '', password: '', display_name: '', phone: '', role_id: 2 })
      fetchData()
    } catch (e) {
      setError(e.response?.data?.detail || '创建失败')
    } finally {
      setActionLoading(false)
    }
  }

  // 更新用户
  const handleUpdate = async (e) => {
    e.preventDefault()
    clearMessages()
    setActionLoading(true)
    try {
      await axios.put(`${API_BASE}/admin/users/${editingUser.id}`, editForm)
      setSuccess('用户信息已更新')
      setEditingUser(null)
      fetchData()
    } catch (e) {
      setError(e.response?.data?.detail || '更新失败')
    } finally {
      setActionLoading(false)
    }
  }

  // 删除用户
  const handleDelete = async (userId, username) => {
    if (!window.confirm(`确定要删除用户「${username}」吗？此操作不可撤销。`)) return
    clearMessages()
    try {
      await axios.delete(`${API_BASE}/admin/users/${userId}`)
      setSuccess(`用户「${username}」已删除`)
      fetchData()
    } catch (e) {
      setError(e.response?.data?.detail || '删除失败')
    }
  }

  // 重置密码
  const handleResetPassword = async (e) => {
    e.preventDefault()
    clearMessages()
    if (newPassword.length < 6) { setError('新密码长度不能少于6位'); return }
    setActionLoading(true)
    try {
      await axios.post(`${API_BASE}/admin/users/reset-password`, {
        user_id: resetPwdUserId, new_password: newPassword,
      })
      setSuccess('密码已重置')
      setResetPwdUserId(null)
      setNewPassword('')
    } catch (e) {
      setError(e.response?.data?.detail || '重置失败')
    } finally {
      setActionLoading(false)
    }
  }

  // 切换启用/禁用
  const toggleActive = async (user) => {
    clearMessages()
    try {
      await axios.put(`${API_BASE}/admin/users/${user.id}`, {
        is_active: user.is_active ? 0 : 1,
      })
      fetchData()
    } catch (e) {
      setError(e.response?.data?.detail || '操作失败')
    }
  }

  const startEdit = (user) => {
    setEditingUser(user)
    setEditForm({
      display_name: user.display_name || '',
      phone: user.phone || '',
      role_id: user.role_id,
      linked_member_id: user.linked_member_id || '',
    })
    clearMessages()
  }

  if (loading) {
    return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>
  }

  return (
    <div>
      {/* 消息提示 */}
      <MessageBanner error={error} success={success} onClear={clearMessages} />

      {/* 工具栏 */}
      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Users className="w-5 h-5 text-purple-400" />
          用户列表
          <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full text-gray-400">{users.length}</span>
        </h3>
        <div className="flex gap-2">
          <button onClick={fetchData} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition" title="刷新">
            <RefreshCw className="w-4 h-4 text-gray-300" />
          </button>
          <button
            onClick={() => { setShowCreateForm(true); clearMessages() }}
            className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition"
          >
            <Plus className="w-4 h-4" />
            新增用户
          </button>
        </div>
      </div>

      {/* ---- 创建用户弹窗 ---- */}
      {showCreateForm && (
        <ModalOverlay onClose={() => setShowCreateForm(false)} title="新增用户">
          <form onSubmit={handleCreate} className="space-y-4">
            <FormInput label="用户名" required value={createForm.username}
              onChange={(v) => setCreateForm({ ...createForm, username: v })} placeholder="登录账号" icon={User} />
            <FormInput label="密码" type="password" required value={createForm.password}
              onChange={(v) => setCreateForm({ ...createForm, password: v })} placeholder="至少6位" icon={Lock} />
            <FormInput label="显示名称" value={createForm.display_name}
              onChange={(v) => setCreateForm({ ...createForm, display_name: v })} placeholder="昵称（选填）" icon={User} />
            <FormInput label="手机号" value={createForm.phone}
              onChange={(v) => setCreateForm({ ...createForm, phone: v })} placeholder="选填" icon={Phone} />
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">角色</label>
              <select
                value={createForm.role_id}
                onChange={(e) => setCreateForm({ ...createForm, role_id: Number(e.target.value) })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {roles.map((r) => <option key={r.id} value={r.id} className="bg-gray-800">{r.role_name} ({r.role_key})</option>)}
              </select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowCreateForm(false)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-gray-300 transition">取消</button>
              <button type="submit" disabled={actionLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-1.5">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                创建
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* ---- 编辑用户弹窗 ---- */}
      {editingUser && (
        <ModalOverlay onClose={() => setEditingUser(null)} title={`编辑用户 - ${editingUser.username}`}>
          <form onSubmit={handleUpdate} className="space-y-4">
            <FormInput label="显示名称" value={editForm.display_name}
              onChange={(v) => setEditForm({ ...editForm, display_name: v })} icon={User} />
            <FormInput label="手机号" value={editForm.phone}
              onChange={(v) => setEditForm({ ...editForm, phone: v })} icon={Phone} />
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">角色</label>
              <select
                value={editForm.role_id}
                onChange={(e) => setEditForm({ ...editForm, role_id: Number(e.target.value) })}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                {roles.map((r) => <option key={r.id} value={r.id} className="bg-gray-800">{r.role_name}</option>)}
              </select>
            </div>
            <FormInput label="关联家庭成员 ID" value={editForm.linked_member_id}
              onChange={(v) => setEditForm({ ...editForm, linked_member_id: v })} placeholder="如 user_001" icon={UserCheck} />
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setEditingUser(null)}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-gray-300 transition">取消</button>
              <button type="submit" disabled={actionLoading}
                className="px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-1.5">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                保存
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* ---- 重置密码弹窗 ---- */}
      {resetPwdUserId && (
        <ModalOverlay onClose={() => { setResetPwdUserId(null); setNewPassword('') }} title="重置用户密码">
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">新密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="请输入新密码（至少6位）"
                  required minLength={6}
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                />
                <button type="button" onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => { setResetPwdUserId(null); setNewPassword('') }}
                className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg text-sm text-gray-300 transition">取消</button>
              <button type="submit" disabled={actionLoading}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition disabled:opacity-50 flex items-center gap-1.5">
                {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />}
                确认重置
              </button>
            </div>
          </form>
        </ModalOverlay>
      )}

      {/* 用户表格 */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-white/10">
              <th className="text-left py-3 px-4 text-gray-400 font-medium">用户</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium">角色</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium hidden md:table-cell">手机号</th>
              <th className="text-left py-3 px-4 text-gray-400 font-medium hidden lg:table-cell">关联成员</th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium">状态</th>
              <th className="text-center py-3 px-4 text-gray-400 font-medium">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => {
              const badge = ROLE_BADGE[u.role_key] || { label: u.role_key, color: 'bg-gray-500/20 text-gray-300 border-gray-500/30' }
              const isSelf = u.id === currentUser?.id
              return (
                <tr key={u.id} className="border-b border-white/5 hover:bg-white/5 transition">
                  <td className="py-3 px-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold ${
                        u.role_key === 'ROLE_ADMIN' ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                      }`}>
                        {(u.display_name || u.username || '?')[0].toUpperCase()}
                      </div>
                      <div>
                        <p className="text-white font-medium flex items-center gap-1.5">
                          {u.display_name || u.username}
                          {isSelf && <span className="text-xs bg-purple-500/30 text-purple-300 px-1.5 py-0.5 rounded">我</span>}
                        </p>
                        <p className="text-xs text-gray-500">@{u.username}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3 px-4">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium border ${badge.color}`}>
                      {badge.label}
                    </span>
                  </td>
                  <td className="py-3 px-4 hidden md:table-cell text-gray-400">{u.phone || '-'}</td>
                  <td className="py-3 px-4 hidden lg:table-cell text-gray-400 text-xs">{u.linked_member_id || '-'}</td>
                  <td className="py-3 px-4 text-center">
                    <button onClick={() => toggleActive(u)} disabled={isSelf} title={u.is_active ? '点击禁用' : '点击启用'}
                      className="disabled:cursor-not-allowed">
                      {u.is_active ? (
                        <span className="flex items-center justify-center gap-1 text-green-400 text-xs">
                          <UserCheck className="w-3.5 h-3.5" /> 启用
                        </span>
                      ) : (
                        <span className="flex items-center justify-center gap-1 text-red-400 text-xs">
                          <UserX className="w-3.5 h-3.5" /> 禁用
                        </span>
                      )}
                    </button>
                  </td>
                  <td className="py-3 px-4">
                    <div className="flex items-center justify-center gap-1">
                      <button onClick={() => startEdit(u)}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition" title="编辑">
                        <Edit3 className="w-4 h-4 text-gray-400 hover:text-white" />
                      </button>
                      <button onClick={() => { setResetPwdUserId(u.id); clearMessages() }}
                        className="p-1.5 hover:bg-white/10 rounded-lg transition" title="重置密码">
                        <Key className="w-4 h-4 text-gray-400 hover:text-amber-400" />
                      </button>
                      {!isSelf && (
                        <button onClick={() => handleDelete(u.id, u.display_name || u.username)}
                          className="p-1.5 hover:bg-red-500/20 rounded-lg transition" title="删除">
                          <Trash2 className="w-4 h-4 text-gray-400 hover:text-red-400" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-gray-500">暂无用户数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}


// ================================================================
//  2. 角色权限管理
// ================================================================
function RoleManagement() {
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    const fetch = async () => {
      try {
        const res = await axios.get(`${API_BASE}/admin/roles`)
        setRoles(res.data.roles || [])
      } catch (e) {
        setError(e.response?.data?.detail || '加载角色数据失败')
      } finally {
        setLoading(false)
      }
    }
    fetch()
  }, [])

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>

  const rolePermissions = {
    ROLE_ADMIN: [
      '查看情感健康可视化大屏',
      '管理所有家庭成员记忆档案',
      '增删系统用户与角色分配',
      '调整隐私级别与摄像头配置',
      '配置 AI 引擎 API 密钥与模型参数',
      '设置情感预警阈值与通知规则',
      '使用语音陪伴助手',
    ],
    ROLE_NORMAL: [
      '使用语音陪伴助手进行对话聊天',
      '通过人脸/声纹无感认证后交互',
      '查看个人对话历史',
    ],
  }

  return (
    <div>
      <MessageBanner error={error} onClear={() => setError(null)} />
      <h3 className="text-lg font-semibold text-white flex items-center gap-2 mb-5">
        <Shield className="w-5 h-5 text-purple-400" />
        角色与权限定义 (RBAC)
      </h3>
      <p className="text-sm text-gray-400 mb-6">
        系统内置两种基础角色类型，不同角色登录后看到的前端视图与可调用的后端接口完全不同。
      </p>

      <div className="grid md:grid-cols-2 gap-6">
        {roles.map((role) => {
          const perms = rolePermissions[role.role_key] || []
          const isAdmin = role.role_key === 'ROLE_ADMIN'
          return (
            <div key={role.id} className={`rounded-xl border p-5 ${
              isAdmin ? 'bg-amber-500/5 border-amber-500/20' : 'bg-sky-500/5 border-sky-500/20'
            }`}>
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                }`}>
                  {isAdmin ? <Shield className="w-5 h-5" /> : <User className="w-5 h-5" />}
                </div>
                <div>
                  <h4 className="text-white font-semibold">{role.role_name}</h4>
                  <p className="text-xs text-gray-400">{role.role_key}</p>
                </div>
              </div>
              <p className="text-sm text-gray-300 mb-4">{role.description}</p>
              <div className="space-y-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">权限列表</p>
                {perms.map((p, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm">
                    <ChevronRight className={`w-4 h-4 mt-0.5 shrink-0 ${isAdmin ? 'text-amber-400' : 'text-sky-400'}`} />
                    <span className="text-gray-300">{p}</span>
                  </div>
                ))}
              </div>
              <p className="text-xs text-gray-500 mt-4">创建时间：{role.created_at}</p>
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ================================================================
//  3. 隐私与安全配置中心
// ================================================================
function PrivacyConfig() {
  const [configs, setConfigs] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // 本地编辑的配置值
  const [localConfigs, setLocalConfigs] = useState({})
  const [hasChanges, setHasChanges] = useState(false)

  const privacyKeys = [
    'camera_default_status',
    'camera_schedule_enabled',
    'camera_off_start',
    'camera_off_end',
    'data_retention_days',
    'privacy_level',
  ]

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/admin/configs`)
      const all = {}
      for (const c of (res.data.configs || [])) {
        all[c.config_key] = c.config_value
      }
      setConfigs(all)
      // 初始化本地副本
      const local = {}
      for (const k of privacyKeys) {
        local[k] = all[k] || ''
      }
      setLocalConfigs(local)
      setHasChanges(false)
      setError(null)
    } catch (e) {
      setError(e.response?.data?.detail || '加载配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  const updateLocal = (key, value) => {
    setLocalConfigs((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      // 只提交发生变化的配置
      const changed = {}
      for (const k of privacyKeys) {
        if (localConfigs[k] !== (configs[k] || '')) {
          changed[k] = localConfigs[k]
        }
      }
      if (Object.keys(changed).length === 0) {
        setSuccess('没有需要保存的变更')
        setSaving(false)
        return
      }
      await axios.put(`${API_BASE}/admin/configs`, { configs: changed })
      setSuccess(`已保存 ${Object.keys(changed).length} 项配置`)
      fetchConfigs()
    } catch (e) {
      setError(e.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>

  const isCameraOn = localConfigs.camera_default_status === 'ON'
  const isScheduleEnabled = localConfigs.camera_schedule_enabled === 'true'

  return (
    <div>
      <MessageBanner error={error} success={success} onClear={() => { setError(null); setSuccess(null) }} />

      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Camera className="w-5 h-5 text-purple-400" />
          隐私与安全配置中心
        </h3>
        <button onClick={handleSave} disabled={saving || !hasChanges}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存配置
        </button>
      </div>

      <div className="space-y-6">
        {/* 摄像头配置 */}
        <ConfigSection title="全局隐私模式开关" icon={Camera}
          desc="控制摄像头默认状态。关闭后将强制触发 MissRAG 缺失补偿算法，仅基于语音与文本进行情感分析。">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-2">摄像头默认状态</label>
              <div className="flex gap-2">
                <button onClick={() => updateLocal('camera_default_status', 'ON')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm transition ${
                    isCameraOn ? 'bg-green-500/20 border-green-500/50 text-green-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}>
                  <Camera className="w-4 h-4" /> 开启
                </button>
                <button onClick={() => updateLocal('camera_default_status', 'OFF')}
                  className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl border text-sm transition ${
                    !isCameraOn ? 'bg-red-500/20 border-red-500/50 text-red-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                  }`}>
                  <CameraOff className="w-4 h-4" /> 关闭
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-2">定时自动关闭</label>
              <button onClick={() => updateLocal('camera_schedule_enabled', isScheduleEnabled ? 'false' : 'true')}
                className={`w-full flex items-center justify-between py-3 px-4 rounded-xl border text-sm transition ${
                  isScheduleEnabled ? 'bg-amber-500/20 border-amber-500/50 text-amber-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                }`}>
                <span className="flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  定时模式
                </span>
                {isScheduleEnabled
                  ? <ToggleRight className="w-6 h-6 text-amber-400" />
                  : <ToggleLeft className="w-6 h-6 text-gray-500" />}
              </button>
            </div>
          </div>

          {isScheduleEnabled && (
            <div className="grid grid-cols-2 gap-4 mt-4">
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">关闭时间（起始）</label>
                <input type="time" value={localConfigs.camera_off_start}
                  onChange={(e) => updateLocal('camera_off_start', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
              <div>
                <label className="block text-xs text-gray-400 mb-1.5">关闭时间（结束）</label>
                <input type="time" value={localConfigs.camera_off_end}
                  onChange={(e) => updateLocal('camera_off_end', e.target.value)}
                  className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>
          )}
        </ConfigSection>

        {/* 数据脱敏与留存策略 */}
        <ConfigSection title="数据脱敏与留存策略" icon={Database}
          desc="配置交互产生的音视频文件的留存方式。设为 0 天表示分析后立刻物理删除（'阅后即焚'级别）。">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">数据保留天数</label>
              <div className="flex items-center gap-3">
                <input type="range" min="0" max="30" step="1"
                  value={localConfigs.data_retention_days || '3'}
                  onChange={(e) => updateLocal('data_retention_days', e.target.value)}
                  className="flex-1 accent-purple-500" />
                <span className="w-16 text-center px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm font-mono">
                  {localConfigs.data_retention_days || '3'} 天
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                {Number(localConfigs.data_retention_days) === 0
                  ? '🔥 阅后即焚：音视频文件分析后立即删除'
                  : `📁 音视频文件将保留 ${localConfigs.data_retention_days} 天后自动清理`}
              </p>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">隐私级别</label>
              <div className="flex gap-2">
                {['minimal', 'standard', 'strict'].map((level) => (
                  <button key={level}
                    onClick={() => updateLocal('privacy_level', level)}
                    className={`flex-1 py-2.5 rounded-xl border text-xs font-medium transition ${
                      localConfigs.privacy_level === level
                        ? level === 'strict' ? 'bg-red-500/20 border-red-500/50 text-red-300'
                          : level === 'standard' ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                          : 'bg-green-500/20 border-green-500/50 text-green-300'
                        : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                    }`}>
                    {level === 'minimal' ? '最低' : level === 'standard' ? '标准' : '严格'}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </ConfigSection>
      </div>
    </div>
  )
}


// ================================================================
//  4. AI 引擎与模型配置
// ================================================================
function AIEngineConfig() {
  const [configs, setConfigs] = useState({})
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)
  const [localConfigs, setLocalConfigs] = useState({})
  const [hasChanges, setHasChanges] = useState(false)
  const [showApiKey, setShowApiKey] = useState(false)

  const aiKeys = [
    'llm_provider', 'llm_model_name', 'llm_api_key', 'llm_base_url', 'llm_enable_search',
    'emotion_alert_enabled', 'emotion_alert_threshold', 'emotion_alert_emotions', 'emotion_alert_phone',
  ]

  const fetchConfigs = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${API_BASE}/admin/configs`)
      const all = {}
      for (const c of (res.data.configs || [])) {
        all[c.config_key] = c.config_value
      }
      setConfigs(all)
      const local = {}
      for (const k of aiKeys) {
        local[k] = all[k] || ''
      }
      setLocalConfigs(local)
      setHasChanges(false)
      setError(null)
    } catch (e) {
      setError(e.response?.data?.detail || '加载配置失败')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchConfigs() }, [fetchConfigs])

  const updateLocal = (key, value) => {
    setLocalConfigs((prev) => ({ ...prev, [key]: value }))
    setHasChanges(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    setSuccess(null)
    try {
      const changed = {}
      for (const k of aiKeys) {
        if (localConfigs[k] !== (configs[k] || '')) {
          changed[k] = localConfigs[k]
        }
      }
      if (Object.keys(changed).length === 0) {
        setSuccess('没有需要保存的变更')
        setSaving(false)
        return
      }
      await axios.put(`${API_BASE}/admin/configs`, { configs: changed })
      setSuccess(`已保存 ${Object.keys(changed).length} 项配置（支持热更新）`)
      fetchConfigs()
    } catch (e) {
      setError(e.response?.data?.detail || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-8 h-8 animate-spin text-purple-400" /></div>

  const isAlertEnabled = localConfigs.emotion_alert_enabled === 'true'
  const isSearchEnabled = localConfigs.llm_enable_search === 'true'

  return (
    <div>
      <MessageBanner error={error} success={success} onClear={() => { setError(null); setSuccess(null) }} />

      <div className="flex items-center justify-between mb-5">
        <h3 className="text-lg font-semibold text-white flex items-center gap-2">
          <Brain className="w-5 h-5 text-purple-400" />
          AI 引擎与模型配置
        </h3>
        <button onClick={handleSave} disabled={saving || !hasChanges}
          className="flex items-center gap-1.5 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition disabled:opacity-50">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          保存配置
        </button>
      </div>

      <div className="space-y-6">
        {/* 模型 API 密钥管理 */}
        <ConfigSection title="模型 API 密钥管理" icon={Key}
          desc="动态配置大语言模型的 API Key 和 Base URL。系统支持热更新，保存后立即生效。">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">LLM 服务提供商</label>
              <select value={localConfigs.llm_provider}
                onChange={(e) => updateLocal('llm_provider', e.target.value)}
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm focus:outline-none focus:ring-2 focus:ring-purple-500">
                <option value="dashscope" className="bg-gray-800">DashScope (通义千问)</option>
                <option value="openai" className="bg-gray-800">OpenAI / DeepSeek</option>
                <option value="custom" className="bg-gray-800">自定义 API</option>
              </select>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">模型名称</label>
              <input type="text" value={localConfigs.llm_model_name}
                onChange={(e) => updateLocal('llm_model_name', e.target.value)}
                placeholder="如 qwen3.5-flash / deepseek-chat"
                className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-4 mt-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">API Key</label>
              <div className="relative">
                <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type={showApiKey ? 'text' : 'password'}
                  value={localConfigs.llm_api_key}
                  onChange={(e) => updateLocal('llm_api_key', e.target.value)}
                  placeholder="留空则使用环境变量 DASHSCOPE_API_KEY"
                  className="w-full pl-10 pr-10 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                <button type="button" onClick={() => setShowApiKey(!showApiKey)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300">
                  {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Base URL（可选）</label>
              <div className="relative">
                <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input type="text" value={localConfigs.llm_base_url}
                  onChange={(e) => updateLocal('llm_base_url', e.target.value)}
                  placeholder="自定义端点 URL（留空使用默认）"
                  className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <button onClick={() => updateLocal('llm_enable_search', isSearchEnabled ? 'false' : 'true')}
              className={`flex items-center justify-between w-full py-3 px-4 rounded-xl border text-sm transition ${
                isSearchEnabled ? 'bg-green-500/20 border-green-500/50 text-green-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}>
              <span className="flex items-center gap-2">
                <Globe className="w-4 h-4" />
                联网搜索增强
              </span>
              {isSearchEnabled
                ? <ToggleRight className="w-6 h-6 text-green-400" />
                : <ToggleLeft className="w-6 h-6 text-gray-500" />}
            </button>
          </div>
        </ConfigSection>

        {/* 情感预警阈值调节 */}
        <ConfigSection title="情感预警阈值调节" icon={Bell}
          desc="当 AffectGPT 输出负面情绪的置信度超过设定阈值时，系统将向指定手机号发送报警通知。">
          <div className="mb-4">
            <button onClick={() => updateLocal('emotion_alert_enabled', isAlertEnabled ? 'false' : 'true')}
              className={`flex items-center justify-between w-full py-3 px-4 rounded-xl border text-sm transition ${
                isAlertEnabled ? 'bg-red-500/20 border-red-500/50 text-red-300' : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
              }`}>
              <span className="flex items-center gap-2">
                <Bell className="w-4 h-4" />
                启用情感预警
              </span>
              {isAlertEnabled
                ? <ToggleRight className="w-6 h-6 text-red-400" />
                : <ToggleLeft className="w-6 h-6 text-gray-500" />}
            </button>
          </div>

          {isAlertEnabled && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-gray-400 mb-2">
                  预警置信度阈值：<span className="text-white font-mono text-sm">{localConfigs.emotion_alert_threshold || '85'}%</span>
                </label>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500">0%</span>
                  <input type="range" min="0" max="100" step="5"
                    value={localConfigs.emotion_alert_threshold || '85'}
                    onChange={(e) => updateLocal('emotion_alert_threshold', e.target.value)}
                    className="flex-1 accent-red-500" />
                  <span className="text-xs text-gray-500">100%</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  当负面情绪置信度 ≥ {localConfigs.emotion_alert_threshold || '85'}% 时触发预警
                </p>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">触发预警的情绪类型</label>
                <div className="flex flex-wrap gap-2">
                  {['Sad', 'Angry', 'Fear', 'Disgust'].map((emotion) => {
                    const selected = (localConfigs.emotion_alert_emotions || '').split(',').map(s => s.trim()).includes(emotion)
                    return (
                      <button key={emotion}
                        onClick={() => {
                          const current = (localConfigs.emotion_alert_emotions || '').split(',').map(s => s.trim()).filter(Boolean)
                          const next = selected ? current.filter(e => e !== emotion) : [...current, emotion]
                          updateLocal('emotion_alert_emotions', next.join(','))
                        }}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                          selected
                            ? 'bg-red-500/20 border-red-500/50 text-red-300'
                            : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                        }`}>
                        {emotion}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs text-gray-400 mb-1.5">预警通知手机号</label>
                <div className="relative">
                  <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input type="tel" value={localConfigs.emotion_alert_phone}
                    onChange={(e) => updateLocal('emotion_alert_phone', e.target.value)}
                    placeholder="接收预警通知的手机号"
                    className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" />
                </div>
              </div>
            </div>
          )}
        </ConfigSection>
      </div>
    </div>
  )
}


// ================================================================
//  公共子组件
// ================================================================

/** 配置区块容器 */
function ConfigSection({ title, icon: Icon, desc, children }) {
  return (
    <div className="bg-white/5 rounded-xl border border-white/10 p-5">
      <div className="flex items-start gap-3 mb-4">
        <div className="w-9 h-9 rounded-lg bg-purple-500/20 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-purple-400" />
        </div>
        <div>
          <h4 className="text-white font-semibold text-sm">{title}</h4>
          {desc && <p className="text-xs text-gray-400 mt-0.5">{desc}</p>}
        </div>
      </div>
      {children}
    </div>
  )
}


/** 消息横幅 */
function MessageBanner({ error, success, onClear }) {
  if (!error && !success) return null
  return (
    <div className="mb-5 space-y-2">
      {error && (
        <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
          <p className="text-red-300 text-sm flex-1">{error}</p>
          <button onClick={onClear} className="text-red-400 hover:text-red-300"><X className="w-4 h-4" /></button>
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-500/20 border border-green-500/50 rounded-xl flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />
          <p className="text-green-300 text-sm flex-1">{success}</p>
          <button onClick={onClear} className="text-green-400 hover:text-green-300"><X className="w-4 h-4" /></button>
        </div>
      )}
    </div>
  )
}


/** 模态弹窗遮罩 */
function ModalOverlay({ onClose, title, children }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-slate-800 rounded-2xl border border-white/10 p-6 w-full max-w-md shadow-2xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
          <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}


/** 表单输入框 */
function FormInput({ label, value, onChange, placeholder, type = 'text', required = false, icon: Icon }) {
  return (
    <div>
      <label className="block text-xs text-gray-400 mb-1.5">{label}</label>
      <div className="relative">
        {Icon && <Icon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />}
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          required={required}
          minLength={type === 'password' ? 6 : undefined}
          className={`w-full ${Icon ? 'pl-10' : 'pl-4'} pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white text-sm placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500`}
        />
      </div>
    </div>
  )
}


export default SystemSettings
