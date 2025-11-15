import { NextRequest, NextResponse } from 'next/server'
import { imageStore } from '@/lib/imageStore'

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params

    if (!id) {
      return NextResponse.json(
        { error: 'No image ID provided' },
        { status: 400 }
      )
    }

    // 메모리에서 이미지 가져오기
    const imageBuffer = imageStore.get(id)

    if (!imageBuffer) {
      return NextResponse.json(
        { error: 'Image not found or expired' },
        { status: 404 }
      )
    }

    // 이미지 반환
    return new NextResponse(imageBuffer, {
      headers: {
        'Content-Type': 'image/jpeg',
        'Content-Disposition': `attachment; filename="proof-of-absence-${id}.jpg"`,
        'Cache-Control': 'no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('Download error:', error)
    return NextResponse.json(
      { error: 'Failed to download image' },
      { status: 500 }
    )
  }
}
