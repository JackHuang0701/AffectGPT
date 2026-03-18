import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  MessageCircle,
  Send,
  Users,
  Heart,
  ShieldCheck,
  ShieldOff,
  Loader2,
  AlertCircle,
  Camera,
  CameraOff,
  Smile,
  User,
  RefreshCw,
  Trash2,
  Activity,
  Brain,
  Sparkles,
  Mic,
  MicOff,
  Volume2,
  VolumeX,
} from 'lucide-react'
import axios from 'axios'

const API_BASE = '/api'

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

// 情感标签颜色
const EMOTION_COLORS = {
  Happy: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
  Sad: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
  Angry: 'bg-red-500/20 text-red-300 border-red-500/30',
  Surprise: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
  Fear: 'bg-gray-500/20 text-gray-300 border-gray-500/30',
  Disgust: 'bg-green-500/20 text-green-300 border-green-500/30',
  Neutral: 'bg-slate-500/20 text-slate-300 border-slate-500/30',
}

// ============================================================
// WAV 编码工具 - 将浏览器录制的 PCM 数据编码为 WAV 格式
// ============================================================
function encodeWAV(chunks, sampleRate) {
  let totalLength = 0
  for (const chunk of chunks) totalLength += chunk.length
  const samples = new Float32Array(totalLength)
  let offset = 0
  for (const chunk of chunks) {
    samples.set(chunk, offset)
    offset += chunk.length
  }

  const buffer = new ArrayBuffer(44 + samples.length * 2)
  const view = new DataView(buffer)

  const writeStr = (off, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(off + i, str.charCodeAt(i))
    }
  }

  // WAV 文件头
  writeStr(0, 'RIFF')
  view.setUint32(4, 36 + samples.length * 2, true)
  writeStr(8, 'WAVE')
  writeStr(12, 'fmt ')
  view.setUint32(16, 16, true)       // fmt chunk size
  view.setUint16(20, 1, true)        // PCM format
  view.setUint16(22, 1, true)        // mono
  view.setUint32(24, sampleRate, true) // sample rate
  view.setUint32(28, sampleRate * 2, true) // byte rate
  view.setUint16(32, 2, true)        // block align
  view.setUint16(34, 16, true)       // bits per sample
  writeStr(36, 'data')
  view.setUint32(40, samples.length * 2, true)

  // PCM 数据
  let idx = 44
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]))
    view.setInt16(idx, s < 0 ? s * 0x8000 : s * 0x7fff, true)
    idx += 2
  }

  return new Blob([buffer], { type: 'audio/wav' })
}


function CompanionChat({ modelLoaded }) {
  // 成员数据
  const [members, setMembers] = useState([])
  const [selectedMember, setSelectedMember] = useState(null)
  const [memberDetail, setMemberDetail] = useState(null)

  // 聊天数据
  const [messages, setMessages] = useState([])
  const [inputText, setInputText] = useState('')
  const [isSending, setIsSending] = useState(false)

  // 情感检测
  const [emotionLabel, setEmotionLabel] = useState('Neutral')
  const [privacyMode, setPrivacyMode] = useState(false)

  // 摄像头（用于情感检测）
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)

  // 语音交互
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessingVoice, setIsProcessingVoice] = useState(false)
  const [ttsEnabled, setTtsEnabled] = useState(true)
  const [isPlayingAudio, setIsPlayingAudio] = useState(false)

  // UI
  const [error, setError] = useState(null)
  const [loadingMembers, setLoadingMembers] = useState(true)

  // Refs
  const chatWindowRef = useRef(null)
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const inputRef = useRef(null)

  // 录音相关 Refs
  const audioContextRef = useRef(null)
  const audioStreamRef = useRef(null)
  const recorderNodeRef = useRef(null)
  const audioSourceRef = useRef(null)
  const audioChunksRef = useRef([])
  const currentAudioRef = useRef(null)

  // 加载家庭成员列表
  useEffect(() => {
    fetchMembers()
  }, [])

  // 自动滚动到底部
  useEffect(() => {
    if (chatWindowRef.current) {
      chatWindowRef.current.scrollTop = chatWindowRef.current.scrollHeight
    }
  }, [messages])

  // 清理
  useEffect(() => {
    return () => {
      stopCamera()
      stopRecordingCleanup()
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
      }
    }
  }, [])

  const fetchMembers = async () => {
    setLoadingMembers(true)
    try {
      const res = await axios.get(`${API_BASE}/members`)
      setMembers(res.data.members || [])
    } catch (e) {
      setError('无法加载家庭成员列表，请确认后端服务已启动')
    } finally {
      setLoadingMembers(false)
    }
  }

  const selectMember = async (memberId) => {
    try {
      setError(null)
      const res = await axios.get(`${API_BASE}/member/${memberId}`)
      setSelectedMember(memberId)
      setMemberDetail(res.data)
      setMessages([])
      setEmotionLabel('Neutral')

      const m = res.data
      const greetingText = `你好呀${m.nickname}！我是你的家庭陪伴助手 🤗 有什么想聊的吗？可以打字，也可以点麦克风跟我语音聊天哦~`
      
      setMessages([
        {
          role: 'assistant',
          content: greetingText,
        },
      ])

      // 自动播放开场白语音
      if (ttsEnabled) {
        try {
          const ttsRes = await axios.post(`${API_BASE}/tts-url`, { text: greetingText })
          if (ttsRes.data.audio_url) {
            playAudio(ttsRes.data.audio_url)
          }
        } catch (e) {
          console.error('开场白TTS生成失败:', e)
        }
      }
    } catch (e) {
      if (e.response?.status === 404) {
        setError('未找到该家庭成员，请重新选择或注册')
      } else {
        setError('加载成员信息失败')
      }
    }
  }

  const backToMemberSelect = () => {
    stopCamera()
    stopRecordingCleanup()
    setSelectedMember(null)
    setMemberDetail(null)
    setMessages([])
    setError(null)
  }

  // ========== 摄像头 & 情感检测 ==========
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 320 }, height: { ideal: 240 }, facingMode: 'user' },
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsCameraOn(true)
      setPrivacyMode(false)
    } catch (err) {
      console.error('摄像头启动失败:', err)
      setError('无法访问摄像头，请检查权限设置')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
  }

  const togglePrivacyMode = () => {
    if (!privacyMode) {
      stopCamera()
      setPrivacyMode(true)
    } else {
      setPrivacyMode(false)
    }
  }

  const captureAndDetectEmotion = useCallback(async () => {
    if (!videoRef.current || !canvasRef.current || !modelLoaded) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    const frameData = canvas.toDataURL('image/jpeg', 0.8)

    setIsDetecting(true)
    try {
      const res = await axios.post(`${API_BASE}/analyze-frame`, { frame: frameData })
      const resultText = res.data.result || ''
      const detectedEmotion = extractEmotionFromResult(resultText)
      setEmotionLabel(detectedEmotion)
    } catch (e) {
      console.error('情感检测失败:', e)
    } finally {
      setIsDetecting(false)
    }
  }, [modelLoaded])

  const extractEmotionFromResult = (text) => {
    const emotions = ['Happy', 'Sad', 'Angry', 'Surprise', 'Fear', 'Disgust', 'Neutral']
    const lowerText = text.toLowerCase()
    for (const e of emotions) {
      if (lowerText.includes(e.toLowerCase())) {
        return e
      }
    }
    return 'Neutral'
  }

  // ========== 语音录制 ==========
  const startRecording = async () => {
    try {
      setError(null)
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: { ideal: 16000 },
          echoCancellation: true,
          noiseSuppression: true,
        },
      })
      audioStreamRef.current = stream

      // 创建 AudioContext（尝试 16kHz，浏览器可能回退到默认值）
      const audioContext = new (window.AudioContext || window.webkitAudioContext)({
        sampleRate: 16000,
      })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      audioSourceRef.current = source

      // ScriptProcessor 录制原始 PCM 数据
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      recorderNodeRef.current = processor

      audioChunksRef.current = []

      processor.onaudioprocess = (e) => {
        const channelData = e.inputBuffer.getChannelData(0)
        audioChunksRef.current.push(new Float32Array(channelData))
      }

      source.connect(processor)
      processor.connect(audioContext.destination)

      setIsRecording(true)
      console.log(`🎙️ 开始录音 (采样率: ${audioContext.sampleRate}Hz)`)
    } catch (err) {
      console.error('麦克风启动失败:', err)
      setError('无法访问麦克风，请检查浏览器权限')
    }
  }

  const stopRecordingCleanup = () => {
    if (recorderNodeRef.current) {
      recorderNodeRef.current.disconnect()
      recorderNodeRef.current = null
    }
    if (audioSourceRef.current) {
      audioSourceRef.current.disconnect()
      audioSourceRef.current = null
    }
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((t) => t.stop())
      audioStreamRef.current = null
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {})
      audioContextRef.current = null
    }
  }

  const stopRecordingAndProcess = async () => {
    if (!isRecording) return

    const sampleRate = audioContextRef.current?.sampleRate || 16000
    const chunks = [...audioChunksRef.current]

    // 停止录音硬件
    stopRecordingCleanup()
    setIsRecording(false)

    // 检查是否有录音数据
    if (chunks.length === 0) {
      setError('未录到有效音频，请重试')
      return
    }

    // 编码为 WAV
    const wavBlob = encodeWAV(chunks, sampleRate)
    console.log(`📦 WAV 编码完成: ${(wavBlob.size / 1024).toFixed(1)}KB, ${sampleRate}Hz`)

    // 开始处理语音流水线
    setIsProcessingVoice(true)
    setIsSending(true)

    try {
      // ===== Step 1: STT - 语音转文本 =====
      const formData = new FormData()
      formData.append('audio', wavBlob, 'recording.wav')

      const sttRes = await axios.post(`${API_BASE}/stt`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })

      const userText = sttRes.data.text
      if (!userText) {
        setMessages((prev) => [
          ...prev,
          { role: 'user', content: '🎙️ （未识别到有效语音，请重试）', isVoice: true },
        ])
        return
      }

      // ===== Step 2: 显示用户消息 =====
      setMessages((prev) => [...prev, { role: 'user', content: userText, isVoice: true }])

      // ===== Step 3: Chat - 发送给大模型 =====
      const chatRes = await axios.post(`${API_BASE}/chat`, {
        member_id: selectedMember,
        user_text: userText,
        emotion_label: emotionLabel,
        privacy_mode: privacyMode,
        enable_tts: ttsEnabled,
      })

      const botText = chatRes.data.response
      const audioUrl = chatRes.data.audio_url

      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: botText, audioUrl: audioUrl, isVoice: true },
      ])

      // ===== Step 4: TTS - 播放语音回复 =====
      if (ttsEnabled && audioUrl) {
        playAudio(audioUrl)
      } else if (ttsEnabled && !audioUrl) {
        // 备用：单独请求 TTS
        try {
          const ttsRes = await axios.post(`${API_BASE}/tts-url`, { text: botText })
          if (ttsRes.data.audio_url) {
            playAudio(ttsRes.data.audio_url)
            // 更新消息的 audioUrl
            setMessages((prev) => {
              const updated = [...prev]
              if (updated.length > 0 && updated[updated.length - 1].role === 'assistant') {
                updated[updated.length - 1].audioUrl = ttsRes.data.audio_url
              }
              return updated
            })
          }
        } catch (e) {
          console.error('TTS 备用请求失败:', e)
        }
      }
    } catch (e) {
      const detail = e.response?.data?.detail || '语音处理失败，请稍后再试'
      setMessages((prev) => [...prev, { role: 'error', content: `🎙️ ${detail}` }])
    } finally {
      setIsProcessingVoice(false)
      setIsSending(false)
    }
  }

  // 切换录音状态
  const toggleRecording = () => {
    if (isRecording) {
      stopRecordingAndProcess()
    } else {
      startRecording()
    }
  }

  // ========== TTS 音频播放 ==========
  const playAudio = (url) => {
    // 停止当前播放
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }

    const audio = new Audio(url)
    currentAudioRef.current = audio
    setIsPlayingAudio(true)

    audio.onended = () => {
      setIsPlayingAudio(false)
      currentAudioRef.current = null
    }
    audio.onerror = () => {
      setIsPlayingAudio(false)
      currentAudioRef.current = null
      console.error('音频播放失败')
    }

    audio.play().catch((err) => {
      console.error('播放被阻止:', err)
      setIsPlayingAudio(false)
    })
  }

  const stopAudio = () => {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
      setIsPlayingAudio(false)
    }
  }

  // 为消息请求 TTS 并播放
  const playMessageTTS = async (text) => {
    try {
      setIsPlayingAudio(true)
      const res = await axios.post(`${API_BASE}/tts-url`, { text })
      if (res.data.audio_url) {
        playAudio(res.data.audio_url)
      } else {
        setIsPlayingAudio(false)
      }
    } catch (e) {
      console.error('TTS 请求失败:', e)
      setIsPlayingAudio(false)
    }
  }

  // ========== 文字聊天 ==========
  const sendMessage = async () => {
    const text = inputText.trim()
    if (!text || isSending || !selectedMember) return

    setMessages((prev) => [...prev, { role: 'user', content: text }])
    setInputText('')
    setIsSending(true)
    setError(null)

    try {
      const res = await axios.post(`${API_BASE}/chat`, {
        member_id: selectedMember,
        user_text: text,
        emotion_label: emotionLabel,
        privacy_mode: privacyMode,
        enable_tts: false, // 文字发送不默认 TTS
      })
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: res.data.response },
      ])
    } catch (e) {
      const detail = e.response?.data?.detail || '发送失败，请稍后再试'
      setMessages((prev) => [...prev, { role: 'error', content: detail }])
    } finally {
      setIsSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const clearChat = () => {
    if (!memberDetail) return
    stopAudio()
    setMessages([
      {
        role: 'assistant',
        content: `你好呀${memberDetail.nickname}！我是你的家庭陪伴助手 🤗 有什么想聊的吗？可以打字，也可以点麦克风跟我语音聊天哦~`,
      },
    ])
  }

  // ========== 快捷提问 ==========
  const quickQuestions = memberDetail
    ? {
        elder: ['今天身体怎么样？', '兰花开得好看吗？', '有没有想看的京剧？', '想孙子了吗？'],
        child: ['今天在幼儿园开心吗？', '想听什么故事呀？', '你最喜欢哪个奥特曼？', '积木搭好了吗？'],
        adult: ['今天工作顺利吗？', '周末有什么安排？', '最近身体怎么样？', '足球赛看了吗？'],
      }[memberDetail.role] || ['你好！', '最近怎么样？']
    : []

  // ==================== 渲染 ====================

  // 成员选择面板
  if (!selectedMember) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-8 border border-white/10">
          {/* 标题 */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Heart className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">家庭陪伴问答助手</h2>
            <p className="text-gray-400">请选择要对话的家庭成员，支持语音和文字交互</p>
          </div>

          {/* 错误 */}
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* 加载中 */}
          {loadingMembers ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-purple-400" />
            </div>
          ) : (
            <div className="grid gap-4">
              {members.map((m) => (
                <button
                  key={m.member_id}
                  onClick={() => selectMember(m.member_id)}
                  className="flex items-center gap-4 p-5 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 hover:border-purple-500/50 transition-all group text-left"
                >
                  <div
                    className={`w-14 h-14 rounded-full bg-gradient-to-br ${
                      AVATAR_COLORS[m.role] || 'from-gray-400 to-gray-500'
                    } flex items-center justify-center text-2xl shrink-0 shadow-lg group-hover:scale-110 transition-transform`}
                  >
                    {AVATAR_EMOJI[m.role] || '👤'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-semibold text-white">{m.nickname}</span>
                      <span className="px-2 py-0.5 rounded-full text-xs bg-white/10 text-gray-300">
                        {ROLE_LABEL[m.role] || m.role}
                      </span>
                    </div>
                    <p className="text-sm text-gray-400 truncate mt-1">{m.personal_profile}</p>
                    {m.last_interaction_time && (
                      <p className="text-xs text-gray-500 mt-1">上次交互: {m.last_interaction_time}</p>
                    )}
                  </div>
                  <div className="text-gray-500 group-hover:text-purple-400 transition">
                    <MessageCircle className="w-6 h-6" />
                  </div>
                </button>
              ))}

              {members.length === 0 && (
                <div className="text-center py-12">
                  <Users className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                  <p className="text-gray-400">暂无家庭成员数据</p>
                  <button
                    onClick={fetchMembers}
                    className="mt-4 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm transition flex items-center gap-2 mx-auto"
                  >
                    <RefreshCw className="w-4 h-4" />
                    刷新
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  // 聊天界面
  return (
    <div className="grid lg:grid-cols-3 gap-6">
      {/* 左侧面板：成员信息 + 情感检测 */}
      <div className="lg:col-span-1 space-y-4">
        {/* 当前成员卡片 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-medium text-gray-400">当前对话</h3>
            <button
              onClick={backToMemberSelect}
              className="text-xs text-purple-400 hover:text-purple-300 transition"
            >
              切换成员
            </button>
          </div>

          {memberDetail && (
            <div className="flex items-center gap-3 mb-4">
              <div
                className={`w-12 h-12 rounded-full bg-gradient-to-br ${
                  AVATAR_COLORS[memberDetail.role] || 'from-gray-400 to-gray-500'
                } flex items-center justify-center text-xl shrink-0`}
              >
                {AVATAR_EMOJI[memberDetail.role] || '👤'}
              </div>
              <div>
                <p className="text-white font-semibold">{memberDetail.nickname}</p>
                <p className="text-xs text-gray-400">
                  {ROLE_LABEL[memberDetail.role] || memberDetail.role}
                </p>
              </div>
            </div>
          )}

          {memberDetail && (
            <div className="space-y-2 text-xs">
              <div className="p-2.5 bg-white/5 rounded-lg">
                <span className="text-gray-400">📋 画像：</span>
                <span className="text-gray-300">{memberDetail.personal_profile}</span>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg">
                <span className="text-gray-400">🏥 健康：</span>
                <span className="text-gray-300">{memberDetail.health_info}</span>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg">
                <span className="text-gray-400">💭 近况：</span>
                <span className="text-gray-300">{memberDetail.recent_context}</span>
              </div>
              <div className="p-2.5 bg-white/5 rounded-lg">
                <span className="text-gray-400">📝 记忆：</span>
                <span className="text-gray-300">{memberDetail.long_term_memory}</span>
              </div>
            </div>
          )}
        </div>

        {/* 情感检测面板 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-purple-400" />
            情感状态
          </h3>

          {/* 当前情感标签 */}
          <div className="flex items-center justify-between mb-4">
            <span
              className={`px-3 py-1.5 rounded-full text-sm font-medium border ${
                EMOTION_COLORS[emotionLabel] || EMOTION_COLORS['Neutral']
              }`}
            >
              <Smile className="w-4 h-4 inline mr-1" />
              {emotionLabel}
            </span>

            <select
              value={emotionLabel}
              onChange={(e) => setEmotionLabel(e.target.value)}
              className="text-xs bg-white/10 border border-white/10 rounded-lg px-2 py-1.5 text-gray-300 focus:outline-none focus:ring-1 focus:ring-purple-500"
            >
              {Object.keys(EMOTION_COLORS).map((e) => (
                <option key={e} value={e} className="bg-gray-800">
                  {e}
                </option>
              ))}
            </select>
          </div>

          {/* 摄像头预览 */}
          <div className="relative aspect-video bg-black/50 rounded-xl overflow-hidden mb-3">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover ${!isCameraOn ? 'hidden' : ''}`}
            />
            <canvas ref={canvasRef} className="hidden" />

            {!isCameraOn && (
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <CameraOff className="w-8 h-8 text-gray-500 mb-2" />
                <p className="text-gray-500 text-xs">
                  {privacyMode ? '隐私保护模式' : '摄像头已关闭'}
                </p>
              </div>
            )}

            {isDetecting && (
              <div className="absolute top-2 right-2 px-2 py-1 bg-purple-600/80 rounded-full flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin text-white" />
                <span className="text-xs text-white">检测中</span>
              </div>
            )}
          </div>

          {/* 摄像头控制 */}
          <div className="flex gap-2">
            {!isCameraOn && !privacyMode ? (
              <button
                onClick={startCamera}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600/80 hover:bg-green-600 text-white rounded-lg text-xs transition"
              >
                <Camera className="w-3.5 h-3.5" />
                开启摄像头
              </button>
            ) : isCameraOn ? (
              <button
                onClick={stopCamera}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600/80 hover:bg-red-600 text-white rounded-lg text-xs transition"
              >
                <CameraOff className="w-3.5 h-3.5" />
                关闭
              </button>
            ) : null}

            {isCameraOn && (
              <button
                onClick={captureAndDetectEmotion}
                disabled={isDetecting || !modelLoaded}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-purple-600/80 hover:bg-purple-600 text-white rounded-lg text-xs transition disabled:opacity-50"
              >
                <Brain className="w-3.5 h-3.5" />
                检测情感
              </button>
            )}

            <button
              onClick={togglePrivacyMode}
              className={`flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs transition ${
                privacyMode
                  ? 'bg-amber-600/80 hover:bg-amber-600 text-white'
                  : 'bg-white/10 hover:bg-white/20 text-gray-300'
              }`}
              title={privacyMode ? '关闭隐私保护模式' : '开启隐私保护模式'}
            >
              {privacyMode ? (
                <ShieldCheck className="w-3.5 h-3.5" />
              ) : (
                <ShieldOff className="w-3.5 h-3.5" />
              )}
              隐私
            </button>
          </div>

          {privacyMode && (
            <p className="text-xs text-amber-400/80 mt-2">
              🔒 隐私保护模式已开启，摄像头已断开。情感识别将仅基于语音与文本。
            </p>
          )}
        </div>

        {/* 语音设置面板 */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-5 border border-white/10">
          <h3 className="text-sm font-medium text-gray-400 mb-3 flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-purple-400" />
            语音设置
          </h3>
          <div className="flex items-center justify-between">
            <span className="text-xs text-gray-300">语音回复 (TTS)</span>
            <button
              onClick={() => setTtsEnabled(!ttsEnabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                ttsEnabled ? 'bg-purple-600' : 'bg-gray-600'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  ttsEnabled ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            {ttsEnabled
              ? '✅ 语音回复已开启，机器人会朗读回复内容'
              : '🔇 语音回复已关闭，仅显示文字'}
          </p>
        </div>
      </div>

      {/* 右侧面板：聊天窗口 */}
      <div
        className="lg:col-span-2 flex flex-col bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden"
        style={{ minHeight: '600px' }}
      >
        {/* 头部 */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-white/10">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-purple-400" />
            <span className="text-white font-medium">
              与{memberDetail?.nickname || ''}的对话
            </span>
            {isRecording && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-red-500/20 border border-red-500/30 rounded-full text-xs text-red-300 animate-pulse">
                <span className="w-2 h-2 bg-red-500 rounded-full" />
                录音中...
              </span>
            )}
            {isProcessingVoice && (
              <span className="flex items-center gap-1.5 px-2.5 py-1 bg-purple-500/20 border border-purple-500/30 rounded-full text-xs text-purple-300">
                <Loader2 className="w-3 h-3 animate-spin" />
                语音处理中...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {isPlayingAudio && (
              <button
                onClick={stopAudio}
                className="p-2 hover:bg-white/10 rounded-lg transition"
                title="停止播放"
              >
                <VolumeX className="w-4 h-4 text-purple-400 animate-pulse" />
              </button>
            )}
            <button
              onClick={clearChat}
              className="p-2 hover:bg-white/10 rounded-lg transition"
              title="清除聊天"
            >
              <Trash2 className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* 错误提示 */}
        {error && (
          <div className="mx-4 mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{error}</p>
          </div>
        )}

        {/* 聊天消息区 */}
        <div ref={chatWindowRef} className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {/* 助手头像 */}
              {msg.role !== 'user' && (
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm shrink-0 mr-2 mt-1">
                  🤖
                </div>
              )}

              <div className="max-w-[75%]">
                <div
                  className={`px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-br-md'
                      : msg.role === 'error'
                      ? 'bg-red-500/20 text-red-300 border border-red-500/30 rounded-bl-md'
                      : 'bg-white/10 text-gray-200 rounded-bl-md'
                  }`}
                >
                  {/* 语音消息标识 */}
                  {msg.isVoice && msg.role === 'user' && (
                    <span className="inline-flex items-center gap-1 mr-1 opacity-70">
                      <Mic className="w-3 h-3" />
                    </span>
                  )}
                  {msg.content}
                </div>

                {/* 助手消息的播放按钮 */}
                {msg.role === 'assistant' && msg.content && (
                  <button
                    onClick={() =>
                      msg.audioUrl
                        ? playAudio(msg.audioUrl)
                        : playMessageTTS(msg.content)
                    }
                    className="mt-1 flex items-center gap-1 text-xs text-gray-500 hover:text-purple-400 transition"
                    title="朗读此消息"
                  >
                    <Volume2 className="w-3 h-3" />
                    <span>朗读</span>
                  </button>
                )}
              </div>

              {/* 用户头像 */}
              {msg.role === 'user' && (
                <div
                  className={`w-8 h-8 rounded-full bg-gradient-to-br ${
                    AVATAR_COLORS[memberDetail?.role] || 'from-gray-400 to-gray-500'
                  } flex items-center justify-center text-sm shrink-0 ml-2 mt-1`}
                >
                  {AVATAR_EMOJI[memberDetail?.role] || '👤'}
                </div>
              )}
            </div>
          ))}

          {/* 正在输入指示器 */}
          {isSending && !isProcessingVoice && (
            <div className="flex justify-start">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-sm shrink-0 mr-2 mt-1">
                🤖
              </div>
              <div className="bg-white/10 rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex gap-1">
                  <span
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '0ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '150ms' }}
                  />
                  <span
                    className="w-2 h-2 bg-purple-400 rounded-full animate-bounce"
                    style={{ animationDelay: '300ms' }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 快捷提问 */}
        {messages.length <= 1 && quickQuestions.length > 0 && (
          <div className="px-5 pb-3">
            <p className="text-xs text-gray-400 mb-2">试试这样问：</p>
            <div className="flex flex-wrap gap-2">
              {quickQuestions.map((q, i) => (
                <button
                  key={i}
                  onClick={() => {
                    setInputText(q)
                    inputRef.current?.focus()
                  }}
                  className="px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/30 rounded-full text-xs text-gray-300 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* 输入区域 */}
        <div className="border-t border-white/10 px-4 py-3">
          <div className="flex items-end gap-2">
            {/* 麦克风按钮 */}
            <button
              onClick={toggleRecording}
              disabled={isSending && !isRecording}
              className={`px-3 py-3 rounded-xl transition shrink-0 ${
                isRecording
                  ? 'bg-red-500 hover:bg-red-600 text-white animate-pulse shadow-lg shadow-red-500/30'
                  : 'bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
              title={isRecording ? '点击停止录音并发送' : '点击开始语音输入'}
            >
              {isRecording ? (
                <MicOff className="w-5 h-5" />
              ) : isProcessingVoice ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Mic className="w-5 h-5" />
              )}
            </button>

            {/* 文字输入框 */}
            <textarea
              ref={inputRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={
                isRecording
                  ? '🎙️ 正在录音，点击麦克风按钮停止...'
                  : `对${memberDetail?.nickname || ''}说点什么...（或点击🎤语音输入）`
              }
              disabled={isRecording}
              className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none text-sm disabled:opacity-50"
              rows={1}
              style={{ minHeight: '44px', maxHeight: '120px' }}
              onInput={(e) => {
                e.target.style.height = 'auto'
                e.target.style.height = Math.min(e.target.scrollHeight, 120) + 'px'
              }}
            />

            {/* 发送按钮 */}
            <button
              onClick={sendMessage}
              disabled={!inputText.trim() || isSending}
              className="px-4 py-3 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl transition disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isSending && !isProcessingVoice ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </button>
          </div>

          {/* 录音提示 */}
          {isRecording && (
            <div className="mt-2 flex items-center gap-2 text-xs text-red-300">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              正在录音... 点击麦克风按钮停止并发送
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default CompanionChat
