import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { imageStore, scheduleImageCleanup } from '@/lib/imageStore'

const genAI = process.env.GEMINI_API_KEY
  ? new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
  : null

// Gemini를 사용한 고급 AI 보정
async function enhanceWithGemini(buffer: Buffer): Promise<Buffer | null> {
  if (!genAI) {
    console.log('Gemini API key not found, skipping AI enhancement')
    return null
  }

  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // 이미지를 base64로 변환
    const base64Image = buffer.toString('base64')

    // 1단계: 성별 분석
    const analyzePrompt = `Analyze this portrait photo and determine the gender of the person.
    Respond with only one word: "female", "male", or "unknown".`

    const analyzeResult = await model.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      },
      analyzePrompt
    ])

    const gender = analyzeResult.response.text().trim().toLowerCase()
    console.log('Detected gender:', gender)

    // 2단계: 성별에 따른 이미지 편집 프롬프트
    let editPrompt = ''
    if (gender.includes('female')) {
      editPrompt = `Create a professionally retouched portrait photo with these natural enhancements:
      - Subtly slim and refine the face contour for a more V-shaped appearance
      - Perfect the skin with smooth, clear, radiant complexion (remove blemishes, even skin tone)
      - Gently enlarge the eyes by 10-15% for a more expressive look
      - Slightly elevate and refine the nose bridge
      - Enhance overall facial harmony and brightness
      - Maintain natural appearance - avoid over-editing
      - Keep the same pose, background, and lighting
      - Professional photo quality with subtle makeup enhancement`
    } else if (gender.includes('male')) {
      editPrompt = `Create a professionally retouched portrait photo with these natural enhancements:
      - Broaden shoulders by 10-15% for a more athletic appearance
      - Perfect the skin with clear, healthy complexion (remove blemishes, even skin tone)
      - Enhance facial definition and jawline
      - Slightly enhance muscle definition if visible
      - Improve overall masculine features naturally
      - Maintain natural appearance - avoid over-editing
      - Keep the same pose, background, and lighting
      - Professional photo quality`
    } else {
      editPrompt = `Create a professionally retouched portrait photo with these enhancements:
      - Perfect the skin with smooth, clear, radiant complexion
      - Enhance facial features naturally
      - Improve overall photo quality
      - Maintain natural appearance
      - Keep the same pose, background, and lighting
      - Professional photo quality`
    }

    // Gemini로 이미지 편집 (현재 Gemini는 이미지 생성을 직접 지원하지 않을 수 있음)
    // 이 경우 분석 결과를 기반으로 Sharp로 처리
    console.log('Image editing with Gemini requested, falling back to Sharp enhancement')

    return null // Gemini 이미지 편집이 준비되면 여기서 반환
  } catch (error) {
    console.error('Gemini enhancement failed:', error)
    return null
  }
}

// Sharp를 사용한 기본 보정
async function enhanceWithSharp(buffer: Buffer, enhancementLevel: 'light' | 'medium' | 'strong' = 'medium'): Promise<Buffer> {
  try {
    let pipeline = sharp(buffer)
      .modulate({
        brightness: 1.05,
        saturation: 1.1,
      })
      .linear(1.1, -(128 * 0.1))
      .sharpen(1, 1, 2)
      .median(3)

    // 추가 처리 레벨에 따라
    if (enhancementLevel === 'strong') {
      pipeline = pipeline
        .modulate({
          brightness: 1.08,
          saturation: 1.15,
        })
        .sharpen(1.5, 1, 2.5)
    }

    const enhancedBuffer = await pipeline
      .jpeg({ quality: 95 })
      .toBuffer()

    return enhancedBuffer
  } catch (error) {
    console.error('Sharp enhancement failed:', error)
    return buffer
  }
}

// 통합 이미지 보정 함수
async function enhanceImage(buffer: Buffer): Promise<Buffer> {
  // Gemini 시도
  const geminiResult = await enhanceWithGemini(buffer)
  if (geminiResult) {
    console.log('Enhanced with Gemini')
    return geminiResult
  }

  // Gemini 실패 시 Sharp 사용
  console.log('Enhanced with Sharp')
  return await enhanceWithSharp(buffer, 'medium')
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const imageFile = formData.get('image') as File

    if (!imageFile) {
      return NextResponse.json(
        { error: 'No image provided' },
        { status: 400 }
      )
    }

    // 이미지를 Buffer로 변환
    const arrayBuffer = await imageFile.arrayBuffer()
    const originalBuffer = Buffer.from(arrayBuffer)

    console.log('Original image size:', (originalBuffer.length / 1024).toFixed(2), 'KB')

    // AI 보정 적용
    const enhancedBuffer = await enhanceImage(originalBuffer)

    console.log('Enhanced image size:', (enhancedBuffer.length / 1024).toFixed(2), 'KB')

    // 고유 ID 생성
    const imageId = Date.now().toString(36) + Math.random().toString(36).substr(2)

    // 메모리에 보정된 이미지 저장 (원본은 즉시 버림)
    imageStore.set(imageId, enhancedBuffer)

    // 자동 정리 스케줄
    scheduleImageCleanup(imageId)

    console.log(`Image ${imageId} enhanced and stored in memory`)

    return NextResponse.json({
      imageId,
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
