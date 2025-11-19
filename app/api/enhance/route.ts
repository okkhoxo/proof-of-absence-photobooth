import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenAI } from '@google/genai'
import * as admin from 'firebase-admin'

// Firebase Admin 초기화
if (!admin.apps.length && process.env.FIREBASE_SERVICE_ACCOUNT) {
  const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    storageBucket: process.env.FIREBASE_STORAGE_BUCKET
  })
}

// Gemini를 사용한 고급 AI 보정 및 이미지 생성
async function enhanceWithGemini(buffer: Buffer): Promise<Buffer | null> {
  console.log('=== Gemini 이미지 보정 시작 ===')

  try {
    // API 키 확인
    const apiKey = process.env.GEMINI_API_KEY
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY가 설정되지 않음')
      return null
    }
    console.log('✅ API 키 확인 완료')

    // 이미지를 base64로 변환
    const base64Image = buffer.toString('base64')
    console.log('📦 Base64 변환 완료:')
    console.log('  원본 Buffer 크기:', (buffer.length / 1024).toFixed(2), 'KB')
    console.log('  Base64 문자열 길이:', base64Image.length)
    console.log('  예상 원본 크기:', (base64Image.length * 0.75 / 1024).toFixed(2), 'KB')
    console.log('  Base64 첫 50자:', base64Image.substring(0, 50))
    console.log('  Base64 끝 50자:', base64Image.substring(base64Image.length - 50))

    // GoogleGenAI 인스턴스 생성
    console.log('🔧 GoogleGenAI 인스턴스 생성 중...')
    const ai = new GoogleGenAI({ apiKey })
    console.log('✅ GoogleGenAI 인스턴스 생성 완료')

    // 이미지 편집 프롬프트 (지브리 스타일)
    const imagePrompt = `Transform this photo into a beautiful Studio Ghibli animation style portrait.

Apply Studio Ghibli aesthetic:
- Hand-drawn anime art style like Hayao Miyazaki films
- Soft, dreamy watercolor-like colors and lighting
- Characteristic Ghibli facial features (large expressive eyes, gentle expressions)
- Warm, nostalgic atmosphere with painterly quality
- Detailed hair with natural flow and movement
- Soft shading and highlights typical of Ghibli characters
- Magical, whimsical feeling

Keep the person's identity and features recognizable but transformed into enchanting Ghibli anime character.
Create a stunning, high-quality Studio Ghibli style illustration.`

    console.log('🎨 Gemini 2.5 Flash Image 모델로 이미지 생성 중...')
    console.log('📝 프롬프트:', imagePrompt)

    console.log('\n📤 Gemini API 요청 (이미지 생성):')
    console.log('  모델: gemini-2.5-flash-image')
    console.log('  입력 이미지: ✅ 포함됨 (같은 base64 이미지)')
    console.log('  contents 배열:')
    console.log('    [0]: text (프롬프트) ← TEXT FIRST')
    console.log('    [1]: inlineData (이미지) ← IMAGE SECOND')
    console.log('  ⚠️  중요: 공식 문서에 따라 TEXT를 IMAGE보다 먼저 배치!')

    const startTime = Date.now()

    const imageResponse = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        { text: imagePrompt },  // TEXT FIRST - 이미지 편집 지시사항
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: base64Image
          }
        }  // IMAGE SECOND - 편집할 원본 이미지
      ]
    })

    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    console.log(`⏱️  이미지 생성 완료 (소요 시간: ${duration}초)`)

    // 응답 파싱 (SDK 형식, camelCase 사용)
    console.log('\n📦 응답 파싱 중...')

    if (!imageResponse.candidates || imageResponse.candidates.length === 0) {
      console.error('❌ 응답에 candidates가 없음')
      console.error('응답 객체:', JSON.stringify(imageResponse, null, 2))
      return null
    }

    console.log('✅ candidates 개수:', imageResponse.candidates.length)

    const content = imageResponse.candidates[0]?.content
    if (!content || !content.parts || content.parts.length === 0) {
      console.error('❌ 응답에 parts가 없음')
      console.error('content:', JSON.stringify(content, null, 2))
      return null
    }

    console.log(`📊 응답 parts 개수: ${content.parts.length}`)
    console.log('각 part 타입:')
    content.parts.forEach((part: any, idx: number) => {
      console.log(`  Part ${idx}: text=${!!part.text}, inlineData=${!!part.inlineData}`)
    })

    for (let i = 0; i < content.parts.length; i++) {
      const part = content.parts[i]
      console.log(`📌 Part ${i + 1}:`, {
        hasText: !!part.text,
        hasInlineData: !!part.inlineData
      })

      // SDK 응답은 camelCase (inlineData)
      if (part.inlineData && part.inlineData.data) {
        console.log('✅ 이미지 데이터 발견')
        const sizeKB = (part.inlineData.data.length * 0.75 / 1024).toFixed(2)
        console.log(`📦 이미지 크기: 약 ${sizeKB} KB`)

        const generatedBuffer = Buffer.from(part.inlineData.data, 'base64')
        console.log('✅ Successfully enhanced with Gemini 2.5 Flash Image (SDK)')
        return generatedBuffer
      }
    }

    console.log('❌ 응답에 이미지가 없음')
    return null
  } catch (error: any) {
    console.error('=== Gemini Enhancement Error ===')
    console.error('에러 메시지:', error.message)
    console.error('에러 스택:', error.stack)

    return null
  }
}

// 통합 이미지 보정 함수 - Gemini만 사용
async function enhanceImage(buffer: Buffer): Promise<Buffer> {
  const geminiResult = await enhanceWithGemini(buffer)
  if (geminiResult) {
    console.log('Successfully enhanced with Gemini')
    return geminiResult
  }

  // Gemini 실패 시 에러 발생
  throw new Error('Image enhancement failed: Gemini API is unavailable')
}

export async function POST(request: NextRequest) {
  try {
    console.log('\n🔵 === POST /api/enhance 요청 수신 ===')

    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      console.error('❌ 이미지 파일이 없음')
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    console.log('📥 받은 이미지 파일:')
    console.log('  이름:', imageFile.name)
    console.log('  타입:', imageFile.type)
    console.log('  크기:', (imageFile.size / 1024).toFixed(2), 'KB')

    // 이미지를 Buffer로 변환
    const arrayBuffer = await imageFile.arrayBuffer()
    const originalBuffer = Buffer.from(arrayBuffer)

    console.log('📦 Buffer 변환 완료:', (originalBuffer.length / 1024).toFixed(2), 'KB')
    console.log('  Buffer 첫 10 바이트:', originalBuffer.slice(0, 10).toString('hex'))

    // JPEG 파일 시그니처 확인 (FFD8FF로 시작해야 함)
    const isValidJPEG = originalBuffer[0] === 0xFF && originalBuffer[1] === 0xD8 && originalBuffer[2] === 0xFF
    console.log('  JPEG 시그니처 유효:', isValidJPEG ? '✅' : '❌')

    // AI 보정 적용
    const enhancedBuffer = await enhanceImage(originalBuffer)

    console.log('Enhanced image size:', (enhancedBuffer.length / 1024).toFixed(2), 'KB')

    // Firebase Storage에 이미지 업로드
    if (!admin.apps.length) {
      return NextResponse.json(
        { error: 'Firebase not configured' },
        { status: 500 }
      )
    }

    const bucket = admin.storage().bucket()
    const filename = `proof-of-absence/${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`
    const file = bucket.file(filename)

    await file.save(enhancedBuffer, {
      metadata: {
        contentType: 'image/jpeg',
      },
      public: true,
    })

    // 공개 URL 생성
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filename}`

    console.log(`Image uploaded to Firebase: ${publicUrl}`)

    return NextResponse.json({
      downloadUrl: publicUrl,
      success: true
    })
  } catch (error) {
    console.error('Enhancement error:', error)
    return NextResponse.json(
      { error: 'Failed to enhance image' },
      { status: 500 }
    )
  }
}
