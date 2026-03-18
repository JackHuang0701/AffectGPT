import React, { useState, useRef, useCallback, useEffect } from 'react'
import { 
  Camera, 
  CameraOff, 
  Loader2, 
  Brain,
  AlertCircle,
  Play,
  Square,
  Zap,
  Activity
} from 'lucide-react'
import axios from 'axios'

const API_BASE = '/api'

function RealtimeAnalysis({ modelLoaded }) {
  const [isCameraOn, setIsCameraOn] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [autoAnalyze, setAutoAnalyze] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState(null)
  const [cameraError, setCameraError] = useState(null)
  const [analysisHistory, setAnalysisHistory] = useState([])
  
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const autoAnalyzeIntervalRef = useRef(null)

  useEffect(() => {
    return () => {
      stopCamera()
      if (autoAnalyzeIntervalRef.current) {
        clearInterval(autoAnalyzeIntervalRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (autoAnalyze && isCameraOn && modelLoaded) {
      autoAnalyzeIntervalRef.current = setInterval(() => {
        if (!isAnalyzing) {
          captureAndAnalyze()
        }
      }, 5000)
    } else {
      if (autoAnalyzeIntervalRef.current) {
        clearInterval(autoAnalyzeIntervalRef.current)
      }
    }
    return () => {
      if (autoAnalyzeIntervalRef.current) {
        clearInterval(autoAnalyzeIntervalRef.current)
      }
    }
  }, [autoAnalyze, isCameraOn, modelLoaded, isAnalyzing])

  const startCamera = async () => {
    try {
      setCameraError(null)
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { 
          width: { ideal: 640 },
          height: { ideal: 480 },
          facingMode: 'user'
        } 
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
      }
      setIsCameraOn(true)
    } catch (err) {
      console.error('Error accessing camera:', err)
      setCameraError('Unable to access camera. Please check permissions.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null
    }
    setIsCameraOn(false)
    setAutoAnalyze(false)
  }

  const captureFrame = useCallback(() => {
    if (!videoRef.current || !canvasRef.current) return null
    
    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)
    
    return canvas.toDataURL('image/jpeg', 0.8)
  }, [])

  const captureAndAnalyze = async () => {
    if (!isCameraOn || isAnalyzing || !modelLoaded) return
    
    const frameData = captureFrame()
    if (!frameData) return

    setIsAnalyzing(true)
    setError(null)

    try {
      const response = await axios.post(`${API_BASE}/analyze-frame`, {
        frame: frameData
      })
      
      const newResult = {
        timestamp: new Date().toLocaleTimeString(),
        emotion: response.data.result
      }
      
      setResult(newResult)
      setAnalysisHistory(prev => [newResult, ...prev.slice(0, 9)])
    } catch (e) {
      setError(e.response?.data?.detail || 'Analysis failed. Please try again.')
    } finally {
      setIsAnalyzing(false)
    }
  }

  return (
    <div className="grid lg:grid-cols-2 gap-8">
      {/* Left Panel - Camera */}
      <div className="space-y-6">
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Camera className="w-5 h-5 text-purple-400" />
            Camera Feed
          </h2>
          
          {/* Camera Preview */}
          <div className="relative aspect-video bg-black/50 rounded-xl overflow-hidden mb-4">
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
                <CameraOff className="w-16 h-16 text-gray-500 mb-4" />
                <p className="text-gray-400">Camera is off</p>
              </div>
            )}

            {isAnalyzing && (
              <div className="absolute top-4 right-4 flex items-center gap-2 px-3 py-1.5 bg-purple-600/80 rounded-full">
                <Loader2 className="w-4 h-4 animate-spin text-white" />
                <span className="text-sm text-white">Analyzing...</span>
              </div>
            )}

            {autoAnalyze && isCameraOn && (
              <div className="absolute top-4 left-4 flex items-center gap-2 px-3 py-1.5 bg-green-600/80 rounded-full">
                <Activity className="w-4 h-4 text-white animate-pulse" />
                <span className="text-sm text-white">Auto Mode</span>
              </div>
            )}
          </div>

          {/* Camera Error */}
          {cameraError && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{cameraError}</p>
            </div>
          )}

          {/* Camera Controls */}
          <div className="flex flex-wrap gap-3">
            {!isCameraOn ? (
              <button
                onClick={startCamera}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-green-600 hover:bg-green-700 text-white rounded-xl font-medium transition"
              >
                <Camera className="w-5 h-5" />
                Start Camera
              </button>
            ) : (
              <button
                onClick={stopCamera}
                className="flex-1 flex items-center justify-center gap-2 px-4 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-medium transition"
              >
                <CameraOff className="w-5 h-5" />
                Stop Camera
              </button>
            )}
          </div>
        </div>

        {/* Analysis Controls */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-400" />
            Analysis Controls
          </h2>

          <div className="space-y-4">
            {/* Manual Capture Button */}
            <button
              onClick={captureAndAnalyze}
              disabled={!isCameraOn || isAnalyzing || !modelLoaded}
              className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white rounded-xl font-semibold transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isAnalyzing ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Analyzing...
                </>
              ) : (
                <>
                  <Brain className="w-5 h-5" />
                  Capture & Analyze
                </>
              )}
            </button>

            {/* Auto Analyze Toggle */}
            <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
              <div>
                <p className="text-white font-medium">Auto Analyze</p>
                <p className="text-xs text-gray-400">Analyze every 5 seconds</p>
              </div>
              <button
                onClick={() => setAutoAnalyze(!autoAnalyze)}
                disabled={!isCameraOn || !modelLoaded}
                className={`relative w-14 h-7 rounded-full transition-colors disabled:opacity-50 ${
                  autoAnalyze ? 'bg-purple-600' : 'bg-gray-600'
                }`}
              >
                <div className={`absolute top-1 w-5 h-5 bg-white rounded-full transition-transform ${
                  autoAnalyze ? 'translate-x-8' : 'translate-x-1'
                }`} />
              </button>
            </div>

            {!modelLoaded && (
              <p className="text-center text-yellow-400 text-sm">
                Please load the model first to enable analysis
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Results */}
      <div className="space-y-6">
        {/* Current Result */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10 min-h-[300px]">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Brain className="w-5 h-5 text-purple-400" />
            Current Analysis
          </h2>

          {/* Error Display */}
          {error && (
            <div className="mb-4 p-4 bg-red-500/20 border border-red-500/50 rounded-xl flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-300 text-sm">{error}</p>
            </div>
          )}

          {/* Result Display */}
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-purple-300 text-sm">{result.timestamp}</span>
                <span className="px-2 py-1 bg-green-500/20 rounded text-xs text-green-300">Latest</span>
              </div>
              <div className="p-4 bg-gradient-to-br from-purple-500/10 to-pink-500/10 rounded-xl border border-purple-500/20">
                <h3 className="text-purple-200 font-medium mb-2">Detected Emotion:</h3>
                <p className="text-white leading-relaxed whitespace-pre-wrap">{result.emotion}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-16 h-16 rounded-full bg-purple-500/10 flex items-center justify-center mb-4">
                <Camera className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-white font-medium mb-2">Ready for Analysis</h3>
              <p className="text-gray-400 text-sm max-w-xs">
                Start the camera and click "Capture & Analyze" to detect emotions in real-time
              </p>
            </div>
          )}
        </div>

        {/* Analysis History */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-purple-400" />
            Analysis History
          </h2>

          {analysisHistory.length > 0 ? (
            <div className="space-y-3 max-h-[300px] overflow-y-auto">
              {analysisHistory.map((item, index) => (
                <div 
                  key={index}
                  className={`p-3 rounded-xl border ${
                    index === 0 
                      ? 'bg-purple-500/10 border-purple-500/30' 
                      : 'bg-white/5 border-white/10'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-purple-300 text-xs">{item.timestamp}</span>
                    {index === 0 && (
                      <span className="text-xs text-purple-400">Current</span>
                    )}
                  </div>
                  <p className="text-white text-sm line-clamp-2">{item.emotion}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 py-8">
              No analysis history yet
            </p>
          )}
        </div>

        {/* Info Card */}
        <div className="bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-2xl p-6 border border-purple-500/20">
          <h3 className="text-white font-semibold mb-3">Real-time Analysis</h3>
          <p className="text-gray-300 text-sm leading-relaxed">
            This mode uses your camera to capture frames and analyze emotions in real-time. 
            Enable "Auto Analyze" for continuous monitoring or manually capture specific moments.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="px-3 py-1 bg-purple-500/20 rounded-full text-xs text-purple-200">Camera</span>
            <span className="px-3 py-1 bg-pink-500/20 rounded-full text-xs text-pink-200">Real-time</span>
            <span className="px-3 py-1 bg-blue-500/20 rounded-full text-xs text-blue-200">Facial Analysis</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default RealtimeAnalysis
