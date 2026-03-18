import React, { useState } from 'react'
import {
  Brain,
  LogIn,
  UserPlus,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Phone,
  User,
  Lock,
  ArrowLeft,
} from 'lucide-react'
import axios from 'axios'

const API_BASE = '/api'

/**
 * 登录 / 注册页面组件
 * 支持账号密码登录和新用户注册
 */
function LoginPage({ onLoginSuccess }) {
  const [isRegisterMode, setIsRegisterMode] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)

  // 表单字段
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [phone, setPhone] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError(null)
    setIsLoading(true)

    try {
      const res = await axios.post(`${API_BASE}/auth/login`, {
        username,
        password,
      })
      const { token, user } = res.data

      // 持久化 Token 和用户信息
      localStorage.setItem('token', token)
      localStorage.setItem('user', JSON.stringify(user))

      // 设置 axios 默认 Header
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`

      onLoginSuccess(user, token)
    } catch (e) {
      const detail = e.response?.data?.detail || '登录失败，请检查用户名和密码'
      setError(detail)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)

    if (password !== confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    if (password.length < 6) {
      setError('密码长度不能少于6位')
      return
    }

    setIsLoading(true)

    try {
      await axios.post(`${API_BASE}/auth/register`, {
        username,
        password,
        display_name: displayName || undefined,
        phone: phone || undefined,
      })
      setSuccess('注册成功！请使用新账号登录')
      setIsRegisterMode(false)
      // 清空注册表单中的额外字段
      setConfirmPassword('')
      setDisplayName('')
      setPhone('')
    } catch (e) {
      const detail = e.response?.data?.detail || '注册失败'
      setError(detail)
    } finally {
      setIsLoading(false)
    }
  }

  const switchMode = () => {
    setIsRegisterMode(!isRegisterMode)
    setError(null)
    setSuccess(null)
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo & Title */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center shadow-2xl shadow-purple-500/30">
            <Brain className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">AffectGPT</h1>
          <p className="text-purple-300 text-sm">家庭陪伴多模态情感分析平台</p>
        </div>

        {/* Form Card */}
        <div className="bg-white/5 backdrop-blur-xl rounded-2xl p-8 border border-white/10 shadow-2xl">
          <h2 className="text-xl font-semibold text-white mb-6 text-center">
            {isRegisterMode ? '创建新账户' : '欢迎回来'}
          </h2>

          {/* Error */}
          {error && (
            <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-4 p-3 bg-green-500/20 border border-green-500/50 rounded-xl">
              <p className="text-green-300 text-sm">✅ {success}</p>
            </div>
          )}

          <form onSubmit={isRegisterMode ? handleRegister : handleLogin}>
            {/* 用户名 */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">用户名</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="请输入用户名"
                  required
                  className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
              </div>
            </div>

            {/* 密码 */}
            <div className="mb-4">
              <label className="block text-xs text-gray-400 mb-1.5">密码</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="请输入密码（至少6位）"
                  required
                  minLength={6}
                  className="w-full pl-10 pr-10 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* 注册额外字段 */}
            {isRegisterMode && (
              <>
                {/* 确认密码 */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1.5">确认密码</label>
                  <div className="relative">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="请再次输入密码"
                      required
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* 显示名称 */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1.5">显示名称（选填）</label>
                  <div className="relative">
                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="设置显示名称"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>

                {/* 手机号 */}
                <div className="mb-4">
                  <label className="block text-xs text-gray-400 mb-1.5">手机号（选填）</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                      type="tel"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="绑定手机号"
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent text-sm"
                    />
                  </div>
                </div>
              </>
            )}

            {/* 提交按钮 */}
            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 mt-2 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white font-medium rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {isRegisterMode ? '注册中...' : '登录中...'}
                </>
              ) : isRegisterMode ? (
                <>
                  <UserPlus className="w-4 h-4" />
                  注册
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  登录
                </>
              )}
            </button>
          </form>

          {/* 切换模式 */}
          <div className="mt-6 text-center">
            <button
              onClick={switchMode}
              className="text-sm text-purple-400 hover:text-purple-300 transition"
            >
              {isRegisterMode ? (
                <span className="flex items-center justify-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  已有账号？返回登录
                </span>
              ) : (
                '没有账号？立即注册'
              )}
            </button>
          </div>
        </div>

        {/* 提示 */}
        <p className="text-center text-xs text-gray-500 mt-6">
          默认管理员账户：admin / admin123
        </p>
      </div>
    </div>
  )
}

export default LoginPage
