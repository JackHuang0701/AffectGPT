import React, { useState, useEffect } from 'react'
import { 
  Loader2, 
  CheckCircle2, 
  Brain,
  RefreshCw,
  Upload,
  Camera,
  AlertCircle,
  MessageCircle,
  Settings,
  LogOut,
  User,
  Shield,
  ChevronDown,
  BarChart3,
} from 'lucide-react'
import axios from 'axios'
import UploadAnalysis from './components/UploadAnalysis'
import RealtimeAnalysis from './components/RealtimeAnalysis'
import CompanionChat from './components/CompanionChat'
import LoginPage from './components/LoginPage'
import SystemSettings from './components/SystemSettings'
import Dashboard from './components/Dashboard'

const API_BASE = '/api'

function App() {
  // ===== 认证状态 =====
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [currentUser, setCurrentUser] = useState(null)
  const [authLoading, setAuthLoading] = useState(true)   // 初始化时检查 Token
  const [showUserMenu, setShowUserMenu] = useState(false)

  // ===== 页面状态 =====
  const [activePage, setActivePage] = useState('upload')
  const [modelLoaded, setModelLoaded] = useState(false)
  const [isLoadingModel, setIsLoadingModel] = useState(false)
  const [error, setError] = useState(null)

  // ===== 初始化：检查已保存的 Token =====
  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem('token')
      const savedUser = localStorage.getItem('user')

      if (savedToken && savedUser) {
        // 恢复 axios 默认 Header
        axios.defaults.headers.common['Authorization'] = `Bearer ${savedToken}`

        try {
          // 验证 Token 是否仍然有效
          const res = await axios.get(`${API_BASE}/auth/me`)
          const user = res.data
          setCurrentUser(user)
          setIsAuthenticated(true)

          // 根据角色设置默认页面
          if (user.role_key === 'ROLE_NORMAL') {
            setActivePage('companion')
          }
        } catch (e) {
          // Token 过期或无效，清除本地存储
          console.warn('Token 已失效，需要重新登录')
          localStorage.removeItem('token')
          localStorage.removeItem('user')
          delete axios.defaults.headers.common['Authorization']
        }
      }

      setAuthLoading(false)
    }

    initAuth()
  }, [])

  // ===== 检查模型状态 =====
  useEffect(() => {
    if (isAuthenticated) {
      checkModelStatus()
    }
  }, [isAuthenticated])

  // ===== 点击外部关闭用户菜单 =====
  useEffect(() => {
    const handleClickOutside = () => setShowUserMenu(false)
    if (showUserMenu) {
      document.addEventListener('click', handleClickOutside)
      return () => document.removeEventListener('click', handleClickOutside)
    }
  }, [showUserMenu])

  const checkModelStatus = async () => {
    try {
      const response = await axios.get('/health')
      setModelLoaded(response.data.model_loaded)
    } catch (e) {
      console.error('Failed to check model status:', e)
    }
  }

  const loadModel = async () => {
    setIsLoadingModel(true)
    setError(null)
    try {
      await axios.post(`${API_BASE}/load-model`)
      setModelLoaded(true)
    } catch (e) {
      setError('Failed to load model. Please check the server.')
    } finally {
      setIsLoadingModel(false)
    }
  }

  // ===== 登录成功回调 =====
  const handleLoginSuccess = (user, token) => {
    setCurrentUser(user)
    setIsAuthenticated(true)
    // 根据角色设置默认页面
    if (user.role_key === 'ROLE_NORMAL') {
      setActivePage('companion')
    }
  }

  // ===== 注销 =====
  const handleLogout = async () => {
    try {
      await axios.post(`${API_BASE}/auth/logout`)
    } catch (e) {
      // 即使后端调用失败也继续清理本地状态
      console.warn('注销接口调用失败:', e)
    }

    localStorage.removeItem('token')
    localStorage.removeItem('user')
    delete axios.defaults.headers.common['Authorization']

    setCurrentUser(null)
    setIsAuthenticated(false)
    setActivePage('upload')
    setShowUserMenu(false)
  }

  // 权限判断
  const isAdmin = currentUser?.role_key === 'ROLE_ADMIN'

  // 普通用户可见的页面（仅问答助手）
  const normalUserPages = ['companion']

  // 管理员可见的全部页面
  const allPages = ['upload', 'realtime', 'companion', 'dashboard', 'settings']

  const visiblePages = isAdmin ? allPages : normalUserPages

  // ===== 全局 Loading =====
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-purple-400 mx-auto mb-4" />
          <p className="text-gray-400">正在验证登录状态...</p>
        </div>
      </div>
    )
  }

  // ===== 未登录 → 显示登录页 =====
  if (!isAuthenticated) {
    return <LoginPage onLoginSuccess={handleLoginSuccess} />
  }

  // ===== 已登录 → 主应用 =====
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <header className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
                <Brain className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">AffectGPT</h1>
                <p className="text-xs text-purple-300">家庭陪伴多模态情感分析平台</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* 模型状态 */}
              {isAdmin && (
                modelLoaded ? (
                  <span className="flex items-center gap-2 text-sm text-green-400">
                    <CheckCircle2 className="w-4 h-4" />
                    Model Ready
                  </span>
                ) : (
                  <button
                    onClick={loadModel}
                    disabled={isLoadingModel}
                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition disabled:opacity-50"
                  >
                    {isLoadingModel ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Loading...
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Load Model
                      </>
                    )}
                  </button>
                )
              )}

              {/* 用户菜单 */}
              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setShowUserMenu(!showUserMenu) }}
                  className="flex items-center gap-2 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl transition"
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                    isAdmin ? 'bg-amber-500/20 text-amber-300' : 'bg-sky-500/20 text-sky-300'
                  }`}>
                    {(currentUser?.display_name || currentUser?.username || '?')[0].toUpperCase()}
                  </div>
                  <div className="text-left hidden sm:block">
                    <p className="text-sm text-white leading-tight">{currentUser?.display_name || currentUser?.username}</p>
                    <p className="text-xs text-gray-400 leading-tight">
                      {isAdmin ? '管理员' : '普通用户'}
                    </p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                </button>

                {/* 下拉菜单 */}
                {showUserMenu && (
                  <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-white/10 rounded-xl shadow-2xl z-50 overflow-hidden"
                    onClick={(e) => e.stopPropagation()}>
                    <div className="px-4 py-3 border-b border-white/10">
                      <p className="text-sm text-white font-medium">{currentUser?.display_name || currentUser?.username}</p>
                      <p className="text-xs text-gray-400">@{currentUser?.username}</p>
                      <span className={`inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs border ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                          : 'bg-sky-500/20 text-sky-300 border-sky-500/30'
                      }`}>
                        <Shield className="w-3 h-3" />
                        {isAdmin ? 'ROLE_ADMIN' : 'ROLE_NORMAL'}
                      </span>
                    </div>
                    <div className="p-1">
                      <button
                        onClick={handleLogout}
                        className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-400 hover:bg-red-500/10 rounded-lg transition"
                      >
                        <LogOut className="w-4 h-4" />
                        安全注销
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="border-b border-white/10">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex gap-1 overflow-x-auto">
            {visiblePages.includes('upload') && (
              <NavTab
                active={activePage === 'upload'}
                onClick={() => setActivePage('upload')}
                icon={Upload}
                label="文件上传分析"
              />
            )}
            {visiblePages.includes('realtime') && (
              <NavTab
                active={activePage === 'realtime'}
                onClick={() => setActivePage('realtime')}
                icon={Camera}
                label="实时摄像头分析"
              />
            )}
            {visiblePages.includes('companion') && (
              <NavTab
                active={activePage === 'companion'}
                onClick={() => setActivePage('companion')}
                icon={MessageCircle}
                label="问答助手"
              />
            )}
            {visiblePages.includes('dashboard') && (
              <NavTab
                active={activePage === 'dashboard'}
                onClick={() => setActivePage('dashboard')}
                icon={BarChart3}
                label="数据大屏"
              />
            )}
            {visiblePages.includes('settings') && (
              <NavTab
                active={activePage === 'settings'}
                onClick={() => setActivePage('settings')}
                icon={Settings}
                label="系统设置"
              />
            )}
          </div>
        </div>
      </nav>

      {/* Model Error */}
      {error && (
        <div className="max-w-6xl mx-auto px-6 mt-4">
          <div className="p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-red-200 font-medium">Error</p>
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activePage === 'upload' && isAdmin ? (
          <UploadAnalysis modelLoaded={modelLoaded} />
        ) : activePage === 'realtime' && isAdmin ? (
          <RealtimeAnalysis modelLoaded={modelLoaded} />
        ) : activePage === 'dashboard' && isAdmin ? (
          <Dashboard />
        ) : activePage === 'settings' && isAdmin ? (
          <SystemSettings currentUser={currentUser} />
        ) : (
          <CompanionChat modelLoaded={modelLoaded} />
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-white/10 mt-12">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <p className="text-center text-sm text-gray-500">
            AffectGPT - 家庭陪伴多模态情感分析系统
          </p>
        </div>
      </footer>
    </div>
  )
}


/** 导航栏 Tab 按钮 */
function NavTab({ active, onClick, icon: Icon, label }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 px-6 py-4 font-medium transition-all relative whitespace-nowrap ${
        active
          ? 'text-white'
          : 'text-gray-400 hover:text-white'
      }`}
    >
      <Icon className="w-5 h-5" />
      {label}
      {active && (
        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-purple-500 to-pink-500" />
      )}
    </button>
  )
}

export default App
