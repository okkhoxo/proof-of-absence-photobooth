import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { put } from '@vercel/blob'

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
    const analyzeModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-exp' })

    // 이미지를 base64로 변환
    const base64Image = buffer.toString('base64')

    // 1단계: 성별 분석
    const analyzePrompt = `Analyze this portrait photo and determine the gender of the person.
    Respond with only one word: "female", "male", or "unknown".`

    const analyzeResult = await analyzeModel.generateContent([
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

    // 2단계: 이미지 생성 모델로 전환
    const imageModel = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-latest',
      generationConfig: {
        temperature: 0.7,
        topP: 0.8,
      }
    })

    // 성별에 따른 이미지 생성 프롬프트
    let imagePrompt = ''
    if (gender.includes('female')) {
      imagePrompt = `Generate a professionally retouched portrait photograph based on this reference image.

Requirements for the enhanced portrait:
- Face contour: Slim, refined V-shaped face with elegant jawline
- Skin: Flawless, radiant complexion with perfect even tone, smooth texture, natural glow
- Eyes: Beautifully enlarged by 10-15%, bright and expressive with natural sparkle
- Nose: Refined, slightly elevated bridge with elegant shape
- Overall: Enhanced feminine beauty with graceful features
- Lighting: Professional studio lighting, soft and flattering
- Makeup: Natural but polished - subtle enhancement
- Quality: High-resolution professional photo quality
- Style: Keep the same pose, similar background, natural and elegant

Create a beautiful, professionally retouched portrait that looks natural and stunning.`
    } else if (gender.includes('male')) {
      imagePrompt = `Generate a professionally retouched portrait photograph based on this reference image.

Requirements for the enhanced portrait:
- Shoulders: Broader by 10-15%, athletic and strong appearance
- Skin: Clear, healthy masculine complexion with even tone
- Face: Strong jawline, defined facial features, masculine charm
- Body: Athletic build with natural muscle definition
- Overall: Enhanced masculine features with confidence
- Lighting: Professional studio lighting with dramatic shadows
- Quality: High-resolution professional photo quality
- Style: Keep the same pose, similar background, natural and powerful

Create a handsome, professionally retouched portrait that looks natural and confident.`
    } else {
      imagePrompt = `Generate a professionally retouched portrait photograph based on this reference image.

Requirements:
- Flawless skin with perfect complexion
- Natural enhancement of facial features
- Professional lighting and composition
- High-resolution quality
- Keep the same pose and similar background
- Natural, professional appearance

Create a beautiful, professionally retouched portrait.`
    }

    // Gemini로 이미지 생성 시도
    const imageResult = await imageModel.generateContent([
      {
        inlineData: {
          mimeType: 'image/jpeg',
          data: base64Image
        }
      },
      imagePrompt
    ])

    // 생성된 이미지가 있는지 확인
    if (imageResult.response.candidates && imageResult.response.candidates[0].content.parts) {
      for (const part of imageResult.response.candidates[0].content.parts) {
        if (part.inlineData && part.inlineData.data) {
          console.log('Successfully generated image with Gemini')
          // base64 데이터를 Buffer로 변환
          const generatedBuffer = Buffer.from(part.inlineData.data, 'base64')
          return generatedBuffer
        }
      }
    }

    console.log('No image generated, falling back to Sharp')
    return null
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

    // Vercel Blob에 이미지 업로드
    const filename = `proof-of-absence-${Date.now()}.jpg`
    const blob = await put(filename, enhancedBuffer, {
      access: 'public',
      contentType: 'image/jpeg',
    })

    console.log(`Image uploaded to Vercel Blob: ${blob.url}`)

    return NextResponse.json({
      downloadUrl: blob.url,
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
