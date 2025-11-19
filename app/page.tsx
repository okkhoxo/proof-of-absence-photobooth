'use client'

import { useState, useRef, useEffect } from 'react'
import QRCode from 'qrcode'

type Stage = 'idle' | 'countdown' | 'preview' | 'processing' | 'result'

export default function Photobooth() {
  const [stage, setStage] = useState<Stage>('idle')
  const [countdown, setCountdown] = useState(3)
  const [capturedImage, setCapturedImage] = useState('')
  const [aiImage, setAiImage] = useState('')
  const [qrCodeUrl, setQrCodeUrl] = useState('')
  const [downloadUrl, setDownloadUrl] = useState('')
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    // 컴포넌트 마운트 시 카메라 시작
    startCamera()
    return () => {
      // 클린업: 카메라 정지
      stopCamera()
    }
  }, [])

  const startCamera = async () => {
    try {
      console.log('🎥 카메라 시작 중...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 },
        audio: false
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream

        // 비디오 메타데이터가 로드될 때까지 대기
        await new Promise((resolve) => {
          if (videoRef.current) {
            videoRef.current.onloadedmetadata = () => {
              console.log('✅ 카메라 준비 완료')
              console.log('  Video 크기:', videoRef.current?.videoWidth, 'x', videoRef.current?.videoHeight)
              resolve(true)
            }
          }
        })
      }
    } catch (err) {
      console.error('❌ 카메라 접근 실패:', err)
      alert('카메라에 접근할 수 없습니다. 권한을 확인해주세요.')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
  }

  const handleCapture = () => {
    setStage('countdown')
    setCountdown(3)

    const countdownInterval = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          clearInterval(countdownInterval)
          capturePhoto()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const capturePhoto = () => {
    // 캔버스에 비디오 프레임 캡처
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) {
      console.error('❌ Video or canvas not found')
      return
    }

    // 비디오 스트림이 준비되었는지 확인
    if (video.videoWidth === 0 || video.videoHeight === 0) {
      console.error('❌ Video stream not ready')
      alert('카메라가 준비되지 않았습니다. 잠시 후 다시 시도해주세요.')
      setStage('idle')
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0)

    // Canvas를 Data URL로 변환하여 저장
    const imageUrl = canvas.toDataURL('image/jpeg', 0.9)
    setCapturedImage(imageUrl)

    console.log('📸 Frontend: Photo captured')
    console.log('  Video 크기:', video.videoWidth, 'x', video.videoHeight)
    console.log('  Canvas 크기:', canvas.width, 'x', canvas.height)
    console.log('  Image URL 길이:', imageUrl.length)

    // preview 단계로 전환
    setStage('preview')
  }

  const applyAiFilter = async () => {
    setStage('processing')

    const canvas = canvasRef.current
    if (!canvas) return

    try {
      // Canvas를 Blob으로 변환
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((blob) => {
          if (blob) resolve(blob)
        }, 'image/jpeg', 0.9)
      })

      console.log('📸 Frontend: Sending to AI')
      console.log('  크기:', (blob.size / 1024).toFixed(2), 'KB')
      console.log('  타입:', blob.type)

      // FormData로 서버에 전송
      const formData = new FormData()
      formData.append('image', blob, 'photo.jpg')

      const response = await fetch('/api/enhance', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (data.downloadUrl) {
        // AI 변형된 이미지 저장
        setAiImage(data.downloadUrl)

        // QR 코드 생성 (다운로드 URL로)
        const qr = await QRCode.toDataURL(data.downloadUrl, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff'
          }
        })

        setQrCodeUrl(qr)
        setDownloadUrl(data.downloadUrl)
        setStage('result')
      }
    } catch (error) {
      console.error('처리 실패:', error)
      alert('이미지 처리 중 오류가 발생했습니다.')
      setStage('preview')
    }
  }

  const reset = () => {
    setStage('idle')
    setCapturedImage('')
    setAiImage('')
    setQrCodeUrl('')
    setDownloadUrl('')
    startCamera()
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4">
      {/* Hidden video and canvas */}
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        className="hidden"
      />
      <canvas ref={canvasRef} className="hidden" />

      {/* Main UI */}
      <div className="w-full max-w-2xl">
        {/* Title */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-300 mb-2">
            부재의 증명사진
          </h1>
          <p className="text-xl md:text-2xl text-gray-500 italic">
            Proof of Absence
          </p>
        </div>

        {/* Content Area */}
        <div className="bg-gradient-to-br from-gray-900/60 to-gray-800/60 backdrop-blur-sm border border-gray-700/50 rounded-3xl p-8 md:p-12 min-h-[500px] flex flex-col items-center justify-center">

          {stage === 'idle' && (
            <div className="text-center space-y-8">
              <p className="text-2xl md:text-3xl text-gray-300">
                준비되셨습니까?
              </p>
              <button
                onClick={handleCapture}
                className="bg-gray-700 hover:bg-gray-600 text-white text-xl md:text-2xl px-12 py-6 rounded-2xl transition-colors font-semibold"
              >
                촬영 시작
              </button>
              <p className="text-sm md:text-base text-gray-500 italic">
                원본은 저장되지 않습니다
              </p>
            </div>
          )}

          {stage === 'countdown' && (
            <div className="text-center">
              <p className="text-9xl md:text-[200px] font-bold text-white">
                {countdown}
              </p>
            </div>
          )}

          {stage === 'preview' && (
            <div className="text-center space-y-6">
              <p className="text-2xl md:text-3xl text-gray-300 mb-4">
                촬영된 사진
              </p>
              {capturedImage && (
                <div className="bg-gray-800 p-4 rounded-2xl inline-block">
                  <img
                    src={capturedImage}
                    alt="Captured"
                    className="max-w-full max-h-96 rounded-lg"
                  />
                </div>
              )}
              <div className="flex gap-4 justify-center mt-6">
                <button
                  onClick={reset}
                  className="bg-gray-600 hover:bg-gray-500 text-white text-lg md:text-xl px-8 py-4 rounded-2xl transition-colors"
                >
                  다시 찍기
                </button>
                <button
                  onClick={applyAiFilter}
                  className="bg-blue-600 hover:bg-blue-500 text-white text-lg md:text-xl px-8 py-4 rounded-2xl transition-colors"
                >
                  AI 필터 적용하기
                </button>
              </div>
            </div>
          )}

          {stage === 'processing' && (
            <div className="text-center space-y-6">
              <div className="animate-spin rounded-full h-24 w-24 border-b-4 border-gray-400 mx-auto"></div>
              <p className="text-2xl md:text-3xl text-gray-300">
                AI 필터 적용 중...
              </p>
              <p className="text-base md:text-lg text-gray-500">
                원본은 삭제되었습니다
              </p>
            </div>
          )}

          {stage === 'result' && (
            <div className="text-center space-y-8">
              <p className="text-2xl md:text-3xl text-gray-300 mb-6">
                AI 필터가 적용된 이미지
              </p>

              {/* AI 변형 이미지 */}
              {aiImage && (
                <div className="bg-gray-800 p-4 rounded-2xl inline-block mb-6">
                  <img
                    src={aiImage}
                    alt="AI Enhanced"
                    className="max-w-full max-h-96 rounded-lg"
                  />
                </div>
              )}

              {/* QR 코드 */}
              {qrCodeUrl && (
                <div>
                  <p className="text-base md:text-lg text-gray-400 mb-4">
                    QR 코드를 스캔하여 다운로드하세요
                  </p>
                  <div className="bg-white p-6 rounded-2xl inline-block">
                    <img src={qrCodeUrl} alt="QR Code" className="w-64 h-64 md:w-80 md:h-80" />
                  </div>
                </div>
              )}

              <button
                onClick={reset}
                className="bg-gray-700 hover:bg-gray-600 text-white text-lg md:text-xl px-8 py-4 rounded-2xl transition-colors mt-6"
              >
                다시 촬영
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="text-center mt-8 text-gray-600 text-sm md:text-base">
          <p className="italic">
            "원본은 이미 죽었다. 당신이 죽였고, 우리 모두가 공범이다."
          </p>
        </div>
      </div>
    </div>
  )
}
