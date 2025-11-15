import { NextRequest, NextResponse } from 'next/server'
import sharp from 'sharp'

// 메모리에 이미지 임시 저장 (실제 배포 시에는 DB나 스토리지 사용)
const imageStore = new Map<string, Buffer>()

// 이미지 자동 정리 (10분 후 삭제)
function scheduleImageCleanup(id: string) {
  setTimeout(() => {
    imageStore.delete(id)
    console.log(`Image ${id} deleted from memory`)
  }, 10 * 60 * 1000) // 10분
}

// AI 스타일 이미지 보정
async function enhanceImage(buffer: Buffer): Promise<Buffer> {
  try {
    const enhancedBuffer = await sharp(buffer)
      // 밝기 증가 (5% 밝게)
      .modulate({
        brightness: 1.05,
        saturation: 1.1,  // 채도 10% 증가
      })
      // 대비 증가
      .linear(1.1, -(128 * 0.1))
      // 선명도 증가
      .sharpen({
        sigma: 1,
        flat: 1,
        jagged: 2
      })
      // 노이즈 제거
      .median(3)
      // JPEG으로 변환 (고품질)
      .jpeg({ quality: 95 })
      .toBuffer()

    return enhancedBuffer
  } catch (error) {
    console.error('Image enhancement failed:', error)
    // 실패 시 원본 반환
    return buffer
  }
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

// 저장된 이미지를 가져오는 함수 (다운로드 API에서 사용)
export { imageStore }
