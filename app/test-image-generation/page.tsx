'use client';

import { useState } from 'react';

export default function TestImageGeneration() {
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [loading, setLoading] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [textResponse, setTextResponse] = useState<string | null>(null);
  const [metadata, setMetadata] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    const timestamp = new Date().toLocaleTimeString('ko-KR');
    setLogs((prev) => [...prev, `[${timestamp}] ${message}`]);
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      alert('프롬프트를 입력해주세요!');
      return;
    }

    setLoading(true);
    setError(null);
    setGeneratedImage(null);
    setTextResponse(null);
    setMetadata(null);
    setLogs([]);

    addLog('🚀 이미지 생성 시작');
    addLog(`📝 프롬프트: ${prompt}`);
    addLog(`📐 가로세로 비율: ${aspectRatio}`);

    try {
      addLog('📡 API 요청 전송 중...');
      const startTime = Date.now();

      const response = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          aspectRatio,
        }),
      });

      const endTime = Date.now();
      const duration = ((endTime - startTime) / 1000).toFixed(2);
      addLog(`⏱️  API 응답 수신 (${duration}초)`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '이미지 생성 실패');
      }

      const data = await response.json();
      addLog('✅ 응답 데이터 파싱 완료');

      if (data.success && data.image) {
        setGeneratedImage(data.image);
        setTextResponse(data.text);
        setMetadata(data.metadata);

        addLog('🖼️  이미지 데이터 수신 성공');
        if (data.text) {
          addLog(`✏️  텍스트 응답: ${data.text.substring(0, 100)}${data.text.length > 100 ? '...' : ''}`);
        }
        if (data.metadata) {
          addLog(`📊 메타데이터: ${JSON.stringify(data.metadata)}`);
        }
        addLog('✨ 이미지 생성 완료!');
      } else {
        throw new Error('이미지 데이터를 받지 못했습니다.');
      }
    } catch (err: any) {
      console.error('에러 발생:', err);
      setError(err.message || '알 수 없는 에러가 발생했습니다.');
      addLog(`❌ 에러: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!generatedImage) return;

    const link = document.createElement('a');
    link.href = `data:image/png;base64,${generatedImage}`;
    link.download = `gemini-generated-${Date.now()}.png`;
    link.click();
    addLog('💾 이미지 다운로드 시작');
  };

  const samplePrompts = [
    'A photorealistic close-up portrait of an elderly Japanese ceramicist with deep, sun-etched wrinkles and a warm, knowing smile. He is carefully inspecting a freshly glazed tea bowl.',
    'A kawaii-style sticker of a happy red panda wearing a tiny bamboo hat. It\'s munching on a green bamboo leaf.',
    'Create a modern, minimalist logo for a coffee shop called "The Daily Grind". The text should be in a clean, bold, sans-serif font.',
    'Create a picture of a nano banana dish in a fancy restaurant with a Gemini theme',
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
      <div className="max-w-6xl mx-auto">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">
          🎨 Gemini 이미지 생성 테스트
        </h1>
        <p className="text-center text-gray-600 mb-8">
          Gemini 2.5 Flash Image 모델을 사용한 이미지 생성 테스트
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* 왼쪽: 입력 영역 */}
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                입력 설정
              </h2>

              {/* 프롬프트 입력 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  프롬프트
                </label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="생성하고 싶은 이미지를 상세하게 설명해주세요..."
                  className="w-full h-32 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                  disabled={loading}
                />
              </div>

              {/* 샘플 프롬프트 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  샘플 프롬프트
                </label>
                <div className="space-y-2">
                  {samplePrompts.map((sample, index) => (
                    <button
                      key={index}
                      onClick={() => setPrompt(sample)}
                      className="w-full text-left px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
                      disabled={loading}
                    >
                      {sample.substring(0, 80)}...
                    </button>
                  ))}
                </div>
              </div>

              {/* 가로세로 비율 */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  가로세로 비율
                </label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={loading}
                >
                  <option value="1:1">1:1 (정사각형)</option>
                  <option value="16:9">16:9 (와이드)</option>
                  <option value="9:16">9:16 (세로)</option>
                  <option value="4:3">4:3 (가로)</option>
                  <option value="3:4">3:4 (세로)</option>
                  <option value="21:9">21:9 (울트라 와이드)</option>
                </select>
              </div>

              {/* 생성 버튼 */}
              <button
                onClick={handleGenerate}
                disabled={loading || !prompt.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                {loading ? '생성 중...' : '이미지 생성하기'}
              </button>
            </div>

            {/* 로그 영역 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                실시간 로그
              </h2>
              <div className="bg-gray-900 text-green-400 p-4 rounded-lg h-64 overflow-y-auto font-mono text-sm">
                {logs.length === 0 ? (
                  <p className="text-gray-500">로그가 여기에 표시됩니다...</p>
                ) : (
                  logs.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* 오른쪽: 결과 영역 */}
          <div className="space-y-6">
            {/* 생성된 이미지 */}
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-semibold mb-4 text-gray-800">
                생성된 이미지
              </h2>

              {loading && (
                <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                  <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">이미지 생성 중...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <p className="text-red-800 font-semibold">에러 발생</p>
                  <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
              )}

              {generatedImage && !loading && (
                <div className="space-y-4">
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <img
                      src={`data:image/png;base64,${generatedImage}`}
                      alt="Generated"
                      className="w-full h-auto"
                    />
                  </div>

                  <button
                    onClick={handleDownload}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-4 rounded-lg transition-colors"
                  >
                    다운로드
                  </button>

                  {textResponse && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-blue-800 mb-1">
                        텍스트 응답:
                      </p>
                      <p className="text-sm text-blue-900">{textResponse}</p>
                    </div>
                  )}

                  {metadata && (
                    <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                      <p className="text-sm font-semibold text-gray-800 mb-2">
                        메타데이터:
                      </p>
                      <div className="space-y-1 text-sm text-gray-700">
                        <p>⏱️ 소요 시간: {metadata.duration}</p>
                        <p>🤖 모델: {metadata.model}</p>
                        <p>📐 비율: {metadata.aspectRatio}</p>
                        <p>🕐 생성 시각: {new Date(metadata.timestamp).toLocaleString('ko-KR')}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {!generatedImage && !loading && !error && (
                <div className="flex items-center justify-center h-96 bg-gray-100 rounded-lg">
                  <p className="text-gray-500">
                    생성된 이미지가 여기에 표시됩니다
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
