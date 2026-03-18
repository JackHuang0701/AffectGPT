import React, { useState, useCallback, useRef, useEffect } from 'react'
import { 
  Upload, 
  Video, 
  Music, 
  FileText, 
  Loader2, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  Brain,
  Sparkles,
  Trash2
} from 'lucide-react'
import axios from 'axios'

const API_BASE = '/api'

function UploadAnalysis({ modelLoaded }) {
  const [videoFile, setVideoFile] = useState(null)
  const [audioFile, setAudioFile] = useState(null)
  const [subtitle, setSubtitle] = useState('')
  const [question, setQuestion] = useState('')
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [taskId, setTaskId] = useState(null)
  const [dragOver, setDragOver] = useState({ video: false, audio: false })
  
  const videoInputRef = useRef(null)
  const audioInputRef = useRef(null)
  const pollIntervalRef = useRef(null)

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
      }
    }
  }, [])

  const handleFileDrop = useCallback((e, type) => {
    e.preventDefault()
    setDragOver(prev => ({ ...prev, [type]: false }))
    
    const files = e.dataTransfer?.files || e.target.files
    if (files && files.length > 0) {
      const file = files[0]
      if (type === 'video') {
        setVideoFile(file)
      } else {
        setAudioFile(file)
      }
    }
  }, [])

  const handleDragOver = (e, type) => {
    e.preventDefault()
    setDragOver(prev => ({ ...prev, [type]: true }))
  }

  const handleDragLeave = (e, type) => {
    e.preventDefault()
    setDragOver(prev => ({ ...prev, [type]: false }))
  }

  const clearFile = (type) => {
    if (type === 'video') {
      setVideoFile(null)
      if (videoInputRef.current) videoInputRef.current.value = ''
    } else {
      setAudioFile(null)
      if (audioInputRef.current) audioInputRef.current.value = ''
    }
  }

  const pollForResult = (taskId) => {
    pollIntervalRef.current = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE}/result/${taskId}`)
        if (response.data.status === 'completed') {
          setResult(response.data.result)
          setIsAnalyzing(false)
          clearInterval(pollIntervalRef.current)
        } else if (response.data.status === 'failed') {
          setError(response.data.error || 'Analysis failed')
          setIsAnalyzing(false)
          clearInterval(pollIntervalRef.current)
        }
      } catch (e) {
        console.error('Error polling for result:', e)
      }
    }, 2000)
  }

  const handleAnalyze = async () => {
    if (!videoFile && !audioFile) {
      setError('Please upload at least a video or audio file')
      return
    }

    setIsAnalyzing(true)
    setResult(null)
    setError(null)

    const formData = new FormData()
    if (videoFile) formData.append('video', videoFile)
    if (audioFile) formData.append('audio', audioFile)
    formData.append('subtitle', subtitle)
    formData.append('question', question)

    try {
      const response = await axios.post(`${API_BASE}/analyze`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      
      setTaskId(response.data.task_id)
      pollForResult(response.data.task_id)
    } catch (e) {
      setError(e.response?.data?.detail || 'Analysis failed. Please try again.')
      setIsAnalyzing(false)
    }
  }

  const resetAll = () => {
    setVideoFile(null)
    setAudioFile(null)
    setSubtitle('')
    setQuestion('')
    setResult(null)
    setError(null)
    setTaskId(null)
    if (videoInputRef.current) videoInputRef.current.value = ''
    if (audioInputRef.current) audioInputRef.current.value = ''
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current)
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Left Panel - Input */}
      <div className="space-y-6">
        {/* File Upload Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Upload className="w-5 h-5 text-purple-400" />
            Upload Media
          </h2>
          
          {/* Video Upload */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Video File
            </label>
            <div
              className={`file-drop-zone relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                ${dragOver.video ? 'drag-over border-purple-400 bg-purple-500/10' : 'border-white/20 hover:border-purple-400'}
                ${videoFile ? 'bg-green-500/10 border-green-400' : ''}`}
              onDrop={(e) => handleFileDrop(e, 'video')}
              onDragOver={(e) => handleDragOver(e, 'video')}
              onDragLeave={(e) => handleDragLeave(e, 'video')}
              onClick={() => videoInputRef.current?.click()}
            >
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => handleFileDrop(e, 'video')}
              />
              {videoFile ? (
                <div className="flex items-center justify-center gap-3">
                  <Video className="w-8 h-8 text-green-400" />
                  <div className="text-left">
                    <p className="text-white font-medium">{videoFile.name}</p>
                    <p className="text-xs text-gray-400">
                      {(videoFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearFile('video'); }}
                    className="ml-2 p-1 hover:bg-white/10 rounded-full transition"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <Video className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                  <p className="text-purple-200">Drop video here or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">MP4, AVI, MOV, etc.</p>
                </>
              )}
            </div>
          </div>

          {/* Audio Upload */}
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Audio File (Optional)
            </label>
            <div
              className={`file-drop-zone relative border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition-all
                ${dragOver.audio ? 'drag-over border-purple-400 bg-purple-500/10' : 'border-white/20 hover:border-purple-400'}
                ${audioFile ? 'bg-green-500/10 border-green-400' : ''}`}
              onDrop={(e) => handleFileDrop(e, 'audio')}
              onDragOver={(e) => handleDragOver(e, 'audio')}
              onDragLeave={(e) => handleDragLeave(e, 'audio')}
              onClick={() => audioInputRef.current?.click()}
            >
              <input
                ref={audioInputRef}
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(e) => handleFileDrop(e, 'audio')}
              />
              {audioFile ? (
                <div className="flex items-center justify-center gap-3">
                  <Music className="w-8 h-8 text-green-400" />
                  <div className="text-left">
                    <p className="text-white font-medium">{audioFile.name}</p>
                    <p className="text-xs text-gray-400">
                      {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); clearFile('audio'); }}
                    className="ml-2 p-1 hover:bg-white/10 rounded-full transition"
                  >
                    <X className="w-4 h-4 text-gray-400" />
                  </button>
                </div>
              ) : (
                <>
                  <Music className="w-10 h-10 text-purple-400 mx-auto mb-2" />
                  <p className="text-purple-200">Drop audio here or click to browse</p>
                  <p className="text-xs text-gray-500 mt-1">WAV, MP3, etc.</p>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Text Input Section */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-purple-400" />
            Additional Information
          </h2>
          
          {/* Subtitle */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Subtitle / Transcript (Optional)
            </label>
            <textarea
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
              placeholder="Enter the transcript or subtitle of the video..."
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
              rows={3}
            />
          </div>

          {/* Custom Question */}
          <div>
            <label className="block text-sm font-medium text-purple-200 mb-2">
              Custom Question (Optional)
            </label>
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              placeholder="e.g., What emotion is the person expressing?"
              className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-2">
              Leave empty to use default: "Please infer the person's emotional state and provide your reasoning process."
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button
            onClick={handleAnalyze}
            disabled={isAnalyzing || (!videoFile && !audioFile) || !modelLoaded}
            className="flex-1 flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isAnalyzing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Sparkles className="w-5 h-5" />
                Analyze Sentiment
              </>
            )}
          </button>
          <button
            onClick={resetAll}
            className="px-6 py-4 bg-white/10 hover:bg-white/20 text-white rounded-xl font-semibold transition flex items-center gap-2"
          >
            <Trash2 className="w-5 h-5" />
            Reset
          </button>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 min-h-[500px]">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Analysis Result
          </h2>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-red-200 font-medium">Error</p>
                <p className="text-red-300 text-sm">{error}</p>
              </div>
            </div>
          )}

          {/* Loading State */}
          {isAnalyzing && (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="relative">
                <div className="w-16 h-16 rounded-full border-4 border-purple-500/30 border-t-purple-500 animate-spin" />
                <div className="absolute inset-0 flex items-center justify-center">
                  <Brain className="w-6 h-6 text-purple-400" />
                </div>
              </div>
              <p className="mt-4 text-purple-200 font-medium">Analyzing your media...</p>
              <p className="text-sm text-gray-500 mt-1">This may take a moment</p>
            </div>
          )}

          {/* Result Display */}
          {result && !isAnalyzing && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-400">
                <CheckCircle2 className="w-5 h-5" />
                <span className="font-medium">Analysis Complete</span>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                <h3 className="text-purple-200 font-medium mb-2">Emotional Analysis:</h3>
                <p className="text-white leading-relaxed whitespace-pre-wrap">{result}</p>
              </div>
            </div>
          )}

          {/* Empty State */}
          {!result && !isAnalyzing && !error && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-20 h-20 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                <Sparkles className="w-10 h-10 text-purple-400" />
              </div>
              <h3 className="text-white font-medium mb-2">Ready to Analyze</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Upload a video or audio file to analyze the emotional content using AffectGPT
              </p>
            </div>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
          <h3 className="text-white font-semibold mb-3">About AffectGPT</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            AffectGPT is a state-of-the-art multimodal sentiment analysis model that processes 
            video, audio, and text to understand emotional expressions. It uses advanced 
            deep learning techniques to provide detailed emotional analysis and reasoning.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-purple-500/20 rounded-full text-xs text-purple-200">Video</span>
            <span className="px-3 py-1 bg-pink-500/20 rounded-full text-xs text-pink-200">Audio</span>
            <span className="px-3 py-1 bg-blue-500/20 rounded-full text-xs text-blue-200">Text</span>
            <span className="px-3 py-1 bg-green-500/20 rounded-full text-xs text-green-200">Multimodal</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default UploadAnalysis
