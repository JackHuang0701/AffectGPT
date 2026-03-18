/**
 * Dashboard 数据可视化大屏组件
 * 
 * 核心功能：
 *  1. 时间序列情绪折线图（ECharts Smooth Line）
 *  2. 离散标签→连续维度映射雷达图（ECharts Radar）
 *  3. AIGC 智能心理健康评估报告（LLM 生成）
 *  4. PDF 离线导出（html2canvas + jsPDF 前端直出）
 */
import React, { useState, useEffect, useRef, useCallback } from 'react'
import ReactEChartsCore from 'echarts-for-react/lib/core'
import * as echarts from 'echarts/core'
import { LineChart, RadarChart } from 'echarts/charts'
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
} from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import {
  BarChart3,
  Users,
  Loader2,
  AlertCircle,
  Calendar,
  TrendingUp,
  Activity,
  Heart,
  Brain,
  FileDown,
  RefreshCw,
  Sparkles,
  Clock,
  SmilePlus,
  Frown,
  Zap,
} from 'lucide-react'
import axios from 'axios'

// 注册 ECharts 组件（按需引入，减少包体积）
echarts.use([
  LineChart,
  RadarChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  RadarComponent,
  TitleComponent,
  CanvasRenderer,
])

const API_BASE = '/api'

// 情绪标签颜色映射（用于折线图 series）
const EMOTION_LINE_COLORS = {
  Happy: '#facc15',
  Sad: '#60a5fa',
  Angry: '#f87171',
  Surprise: '#c084fc',
  Fear: '#94a3b8',
  Disgust: '#4ade80',
  Neutral: '#cbd5e1',
  Fatigued: '#fb923c',
}

// 家庭成员头像颜色映射
const AVATAR_COLORS = {
  elder: 'from-amber-400 to-orange-500',
  child: 'from-cyan-400 to-blue-500',
  adult: 'from-emerald-400 to-teal-500',
}
const AVATAR_EMOJI = {
  elder: '👵',
  child: '👦',
  adult: '👨',
}
const ROLE_LABEL = {
  elder: '长辈',
  child: '儿童',
  adult: '成年人',
}


function Dashboard() {
  // ===== 状态 =====
  const [members, setMembers] = useState([])
  const [selectedMemberId, setSelectedMemberId] = useState(null)
  const [selectedMember, setSelectedMember] = useState(null)
  const [days, setDays] = useState(7)

  // 数据
  const [timeSeries, setTimeSeries] = useState([])
  const [emotions, setEmotions] = useState([])
  const [radar, setRadar] = useState({})
  const [summary, setSummary] = useState(null)

  // AI 报告
  const [report, setReport] = useState('')
  const [reportLoading, setReportLoading] = useState(false)

  // UI
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Refs（用于 PDF 导出截图）
  const dashboardRef = useRef(null)
  const lineChartRef = useRef(null)
  const radarChartRef = useRef(null)

  // ===== 初始化：加载成员列表 =====
  useEffect(() => {
    fetchMembers()
  }, [])

  // ===== 成员或时间范围切换时重新拉取数据 =====
  useEffect(() => {
    if (selectedMemberId) {
      fetchDashboardData()
    }
  }, [selectedMemberId, days])

  const fetchMembers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/dashboard/members`)
      const list = res.data.members || []
      setMembers(list)
      // 默认选中第一个
      if (list.length > 0) {
        setSelectedMemberId(list[0].member_id)
        setSelectedMember(list[0])
      }
    } catch (e) {
      setError('无法加载家庭成员列表')
    }
  }

  const fetchDashboardData = async () => {
    if (!selectedMemberId) return
    setLoading(true)
    setError(null)
    try {
      const [tsRes, radarRes, summaryRes] = await Promise.all([
        axios.get(`${API_BASE}/dashboard/time-series`, {
          params: { member_id: selectedMemberId, days },
        }),
        axios.get(`${API_BASE}/dashboard/radar`, {
          params: { member_id: selectedMemberId, days },
        }),
        axios.get(`${API_BASE}/dashboard/summary`, {
          params: { member_id: selectedMemberId, days },
        }),
      ])
      setTimeSeries(tsRes.data.time_series || [])
      setEmotions(tsRes.data.emotions || [])
      setRadar(radarRes.data.radar || {})
      setSummary(summaryRes.data.summary || null)
    } catch (e) {
      setError('加载 Dashboard 数据失败，请确认后端服务已启动')
    } finally {
      setLoading(false)
    }
  }

  // ===== 生成 AI 报告 =====
  const generateReport = async () => {
    if (!selectedMemberId) return
    setReportLoading(true)
    setReport('')
    setError(null)
    try {
      const res = await axios.post(`${API_BASE}/dashboard/report`, {
        member_id: selectedMemberId,
        days,
      })
      setReport(res.data.report || '报告生成为空，请重试')
    } catch (e) {
      const msg = e.response?.data?.detail || 'AI 报告生成失败'
      setError(msg)
    } finally {
      setReportLoading(false)
    }
  }

  // ===== PDF 导出 =====
  const exportPDF = async () => {
    setExporting(true)
    try {
      // 动态导入以减少首屏包体积
      const html2canvas = (await import('html2canvas')).default
      const { jsPDF } = await import('jspdf')

      const target = dashboardRef.current
      if (!target) return

      const canvas = await html2canvas(target, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#0f172a', // 匹配深色背景
        logging: false,
      })

      const imgData = canvas.toDataURL('image/png')
      const pdf = new jsPDF({
        orientation: 'landscape',
        unit: 'px',
        format: [canvas.width, canvas.height],
      })
      pdf.addImage(imgData, 'PNG', 0, 0, canvas.width, canvas.height)

      const memberName = selectedMember?.nickname || '家庭成员'
      pdf.save(`${memberName}_心理健康报告_近${days}天.pdf`)
    } catch (e) {
      console.error('PDF 导出失败:', e)
      setError('PDF 导出失败，请重试')
    } finally {
      setExporting(false)
    }
  }

  // ===== 成员切换 =====
  const handleMemberChange = (memberId) => {
    setSelectedMemberId(memberId)
    const m = members.find((m) => m.member_id === memberId)
    setSelectedMember(m || null)
    setReport('') // 清除旧报告
  }

  // ================================================================
  //  ECharts 配置
  // ================================================================

  // 1. 多维情绪折线图 Option
  const getLineChartOption = useCallback(() => {
    if (!timeSeries.length || !emotions.length) {
      return { title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } } }
    }

    const xData = timeSeries.map((d) => d.date)

    const series = emotions.map((emo) => ({
      name: emo,
      type: 'line',
      smooth: true,
      symbol: 'circle',
      symbolSize: 6,
      lineStyle: { width: 2.5 },
      itemStyle: { color: EMOTION_LINE_COLORS[emo] || '#a78bfa' },
      areaStyle: {
        color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
          { offset: 0, color: (EMOTION_LINE_COLORS[emo] || '#a78bfa') + '40' },
          { offset: 1, color: (EMOTION_LINE_COLORS[emo] || '#a78bfa') + '05' },
        ]),
      },
      data: timeSeries.map((d) => d[emo] || 0),
    }))

    return {
      tooltip: {
        trigger: 'axis',
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
      },
      legend: {
        data: emotions,
        top: 8,
        textStyle: { color: '#94a3b8', fontSize: 11 },
        itemWidth: 14,
        itemHeight: 8,
      },
      grid: { left: 50, right: 20, top: 50, bottom: 30 },
      xAxis: {
        type: 'category',
        data: xData,
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.15)' } },
        axisLabel: {
          color: '#94a3b8',
          fontSize: 11,
          formatter: (v) => {
            const parts = v.split('-')
            return `${parts[1]}/${parts[2]}`
          },
        },
        splitLine: { show: false },
      },
      yAxis: {
        type: 'value',
        name: '频次',
        nameTextStyle: { color: '#64748b', fontSize: 11 },
        axisLine: { show: false },
        axisLabel: { color: '#64748b', fontSize: 11 },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      },
      series,
    }
  }, [timeSeries, emotions])

  // 2. 心理评估雷达图 Option
  const getRadarChartOption = useCallback(() => {
    const dims = Object.keys(radar)
    const vals = Object.values(radar)
    if (!dims.length) {
      return { title: { text: '暂无数据', left: 'center', top: 'center', textStyle: { color: '#94a3b8', fontSize: 14 } } }
    }

    return {
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        borderColor: 'rgba(255,255,255,0.1)',
        textStyle: { color: '#e2e8f0', fontSize: 12 },
      },
      radar: {
        indicator: dims.map((d) => ({ name: d, max: 100 })),
        shape: 'polygon',
        splitNumber: 5,
        axisName: {
          color: '#94a3b8',
          fontSize: 11,
        },
        splitLine: { lineStyle: { color: 'rgba(255,255,255,0.08)' } },
        splitArea: {
          areaStyle: {
            color: [
              'rgba(139, 92, 246, 0.02)',
              'rgba(139, 92, 246, 0.04)',
              'rgba(139, 92, 246, 0.06)',
              'rgba(139, 92, 246, 0.08)',
              'rgba(139, 92, 246, 0.10)',
            ],
          },
        },
        axisLine: { lineStyle: { color: 'rgba(255,255,255,0.1)' } },
      },
      series: [
        {
          type: 'radar',
          data: [
            {
              value: vals,
              name: '心理维度评分',
              symbol: 'circle',
              symbolSize: 6,
              lineStyle: {
                color: '#a78bfa',
                width: 2,
              },
              itemStyle: { color: '#a78bfa' },
              areaStyle: {
                color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
                  { offset: 0, color: 'rgba(167, 139, 250, 0.35)' },
                  { offset: 1, color: 'rgba(167, 139, 250, 0.05)' },
                ]),
              },
            },
          ],
        },
      ],
    }
  }, [radar])

  // ================================================================
  //  渲染
  // ================================================================

  return (
    <div className="space-y-6" ref={dashboardRef}>
      {/* ===== 顶部控制栏 ===== */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center shadow-lg shadow-violet-500/20">
            <BarChart3 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">心理健康数据大屏</h2>
            <p className="text-xs text-gray-400">基于 AffectGPT 情感引擎的多维数据可视化</p>
          </div>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {/* 成员选择器 */}
          <div className="flex items-center gap-2 px-3 py-2 bg-white/5 border border-white/10 rounded-xl">
            <Users className="w-4 h-4 text-purple-400" />
            <select
              value={selectedMemberId || ''}
              onChange={(e) => handleMemberChange(e.target.value)}
              className="bg-transparent text-white text-sm focus:outline-none cursor-pointer"
            >
              {members.map((m) => (
                <option key={m.member_id} value={m.member_id} className="bg-slate-800">
                  {m.nickname}（{ROLE_LABEL[m.role] || m.role}）
                </option>
              ))}
            </select>
          </div>

          {/* 时间范围切换 */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden">
            {[
              { label: '近7天', value: 7 },
              { label: '近14天', value: 14 },
              { label: '近30天', value: 30 },
            ].map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDays(opt.value)}
                className={`px-3 py-2 text-xs font-medium transition-all ${
                  days === opt.value
                    ? 'bg-purple-600 text-white shadow-inner'
                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* 刷新按钮 */}
          <button
            onClick={fetchDashboardData}
            disabled={loading}
            className="p-2 bg-white/5 border border-white/10 rounded-xl hover:bg-white/10 transition disabled:opacity-50"
            title="刷新数据"
          >
            <RefreshCw className={`w-4 h-4 text-gray-400 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* 导出 PDF */}
          <button
            onClick={exportPDF}
            disabled={exporting || loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700 text-white text-xs font-medium rounded-xl transition disabled:opacity-50 shadow-lg shadow-violet-500/20"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <FileDown className="w-3.5 h-3.5" />
            )}
            导出报告
          </button>
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 bg-red-500/15 border border-red-500/30 rounded-xl flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-red-200 font-medium text-sm">出错了</p>
            <p className="text-red-300 text-xs mt-0.5">{error}</p>
          </div>
        </div>
      )}

      {/* ===== 统计卡片 ===== */}
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard
            icon={Activity}
            label="总交互次数"
            value={summary.total_count}
            unit="次"
            color="purple"
          />
          <StatCard
            icon={SmilePlus}
            label="主导情绪"
            value={summary.dominant_emotion}
            sub={`出现 ${summary.dominant_count} 次`}
            color="yellow"
          />
          <StatCard
            icon={Frown}
            label="负面情绪占比"
            value={`${summary.negative_ratio}%`}
            color={summary.negative_ratio > 40 ? 'red' : 'green'}
            alert={summary.negative_ratio > 40}
          />
          <StatCard
            icon={Clock}
            label="累计互动时长"
            value={formatDuration(summary.total_duration)}
            color="blue"
          />
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex justify-center py-12">
          <div className="text-center">
            <Loader2 className="w-8 h-8 animate-spin text-purple-400 mx-auto mb-3" />
            <p className="text-gray-400 text-sm">正在加载 Dashboard 数据...</p>
          </div>
        </div>
      )}

      {/* ===== 图表区域 ===== */}
      {!loading && selectedMemberId && (
        <div className="grid lg:grid-cols-5 gap-6">
          {/* 左侧：折线图（占 3 列） */}
          <div className="lg:col-span-3 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-purple-400" />
                多维情绪趋势（近 {days} 天）
              </h3>
              <span className="text-xs text-gray-500">
                X 轴: 日期 · Y 轴: 情绪出现频次
              </span>
            </div>
            <ReactEChartsCore
              ref={lineChartRef}
              echarts={echarts}
              option={getLineChartOption()}
              style={{ height: 340 }}
              notMerge={true}
              theme="dark"
            />
          </div>

          {/* 右侧：雷达图（占 2 列） */}
          <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Brain className="w-4 h-4 text-fuchsia-400" />
                心理评估雷达图
              </h3>
              <span className="text-xs text-gray-500">0-100 分制</span>
            </div>
            <ReactEChartsCore
              ref={radarChartRef}
              echarts={echarts}
              option={getRadarChartOption()}
              style={{ height: 340 }}
              notMerge={true}
              theme="dark"
            />

            {/* 雷达图下方维度数值列表 */}
            {Object.keys(radar).length > 0 && (
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 mt-4 pt-4 border-t border-white/10">
                {Object.entries(radar).map(([dim, score]) => (
                  <div key={dim} className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{dim}</span>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 bg-white/10 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            score >= 70
                              ? dim.includes('开心') || dim.includes('稳定') || dim.includes('社交')
                                ? 'bg-green-400'
                                : 'bg-red-400'
                              : score >= 40
                              ? 'bg-yellow-400'
                              : dim.includes('开心') || dim.includes('稳定') || dim.includes('社交')
                              ? 'bg-red-400'
                              : 'bg-green-400'
                          }`}
                          style={{ width: `${score}%` }}
                        />
                      </div>
                      <span className="text-xs text-white font-mono w-7 text-right">{score}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ===== AI 智能评估报告 ===== */}
      {!loading && selectedMemberId && (
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-yellow-400" />
              AI 心理健康评估报告
              <span className="text-xs text-gray-500 font-normal ml-1">
                Powered by LLM · 基于{' '}
                {selectedMember?.nickname || '当前成员'} 近 {days} 天数据
              </span>
            </h3>
            <button
              onClick={generateReport}
              disabled={reportLoading}
              className="flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white text-xs font-medium rounded-xl transition disabled:opacity-50 shadow-lg shadow-amber-500/20"
            >
              {reportLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Brain className="w-3.5 h-3.5" />
                  生成 AI 报告
                </>
              )}
            </button>
          </div>

          {/* 报告内容 */}
          {report ? (
            <div className="prose prose-invert prose-sm max-w-none">
              <div className="bg-gradient-to-br from-violet-500/5 to-fuchsia-500/5 border border-white/5 rounded-xl p-5">
                {/* 简易 Markdown 渲染 */}
                {report.split('\n').map((line, idx) => {
                  // H1
                  if (line.startsWith('# ')) {
                    return (
                      <h2 key={idx} className="text-lg font-bold text-white mb-3 flex items-center gap-2">
                        <Heart className="w-5 h-5 text-pink-400" />
                        {line.replace('# ', '')}
                      </h2>
                    )
                  }
                  // H2
                  if (line.startsWith('## ')) {
                    return (
                      <h3 key={idx} className="text-sm font-semibold text-purple-300 mt-4 mb-2">
                        {line.replace('## ', '')}
                      </h3>
                    )
                  }
                  // 列表
                  if (/^\d+\.\s/.test(line)) {
                    return (
                      <p key={idx} className="text-gray-300 text-sm leading-relaxed pl-3 my-1">
                        {line}
                      </p>
                    )
                  }
                  // 普通文本
                  if (line.trim()) {
                    return (
                      <p key={idx} className="text-gray-300 text-sm leading-relaxed my-1">
                        {renderBold(line)}
                      </p>
                    )
                  }
                  return <div key={idx} className="h-2" />
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-10 bg-white/[0.02] rounded-xl border border-dashed border-white/10">
              <Brain className="w-10 h-10 text-gray-600 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">
                点击上方「生成 AI 报告」按钮，系统将分析近期数据并生成专业的心理健康评估
              </p>
              <p className="text-gray-600 text-xs mt-1">
                报告由大语言模型深度推理生成，包含情绪总览、风险提示和养育建议
              </p>
            </div>
          )}
        </div>
      )}

      {/* ===== 底部说明 ===== */}
      <div className="text-center">
        <p className="text-xs text-gray-600">
          数据来源：AffectGPT 多模态情感分析引擎 · 聚合周期：近 {days} 天 ·
          报告生成：qwen3.5-flash LLM · 导出格式：PDF
        </p>
      </div>
    </div>
  )
}


// ================================================================
//  辅助组件与工具函数
// ================================================================

/** 统计卡片 */
function StatCard({ icon: Icon, label, value, unit, sub, color, alert }) {
  const colorMap = {
    purple: { bg: 'from-purple-500/10 to-purple-600/5', border: 'border-purple-500/20', icon: 'text-purple-400', text: 'text-purple-300' },
    yellow: { bg: 'from-yellow-500/10 to-yellow-600/5', border: 'border-yellow-500/20', icon: 'text-yellow-400', text: 'text-yellow-300' },
    red: { bg: 'from-red-500/10 to-red-600/5', border: 'border-red-500/20', icon: 'text-red-400', text: 'text-red-300' },
    green: { bg: 'from-green-500/10 to-green-600/5', border: 'border-green-500/20', icon: 'text-green-400', text: 'text-green-300' },
    blue: { bg: 'from-blue-500/10 to-blue-600/5', border: 'border-blue-500/20', icon: 'text-blue-400', text: 'text-blue-300' },
  }
  const c = colorMap[color] || colorMap.purple

  return (
    <div className={`bg-gradient-to-br ${c.bg} backdrop-blur-sm rounded-2xl border ${c.border} p-4 relative overflow-hidden`}>
      {alert && (
        <div className="absolute top-2 right-2">
          <span className="flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
          </span>
        </div>
      )}
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${c.icon}`} />
        <span className="text-xs text-gray-400">{label}</span>
      </div>
      <p className={`text-2xl font-bold ${c.text}`}>
        {value}
        {unit && <span className="text-xs font-normal text-gray-500 ml-1">{unit}</span>}
      </p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

/** 时长格式化 */
function formatDuration(seconds) {
  if (!seconds || seconds <= 0) return '0秒'
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  if (h > 0) return `${h}小时${m}分`
  if (m > 0) return `${m}分${s}秒`
  return `${s}秒`
}

/** 简易 **粗体** 渲染 */
function renderBold(text) {
  const parts = text.split(/\*\*(.*?)\*\*/g)
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="text-white font-semibold">
        {part}
      </strong>
    ) : (
      <span key={i}>{part}</span>
    )
  )
}

export default Dashboard
