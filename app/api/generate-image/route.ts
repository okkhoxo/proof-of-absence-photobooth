import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';

export async function POST(req: NextRequest) {
  console.log('=== Gemini 이미지 생성 API 시작 ===');

  try {
    // 1. 요청 본문 파싱
    const body = await req.json();
    const { prompt, aspectRatio } = body;

    console.log('📝 받은 프롬프트:', prompt);
    console.log('📐 가로세로 비율:', aspectRatio || '기본값(1:1)');

    if (!prompt) {
      console.error('❌ 에러: 프롬프트가 제공되지 않음');
      return NextResponse.json(
        { error: '프롬프트를 입력해주세요.' },
        { status: 400 }
      );
    }

    // 2. API 키 확인
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.error('❌ 에러: GEMINI_API_KEY가 설정되지 않음');
      return NextResponse.json(
        { error: 'API 키가 설정되지 않았습니다.' },
        { status: 500 }
      );
    }
    console.log('✅ API 키 확인 완료');

    // 3. GoogleGenAI 인스턴스 생성
    console.log('🔧 GoogleGenAI 인스턴스 생성 중...');
    const ai = new GoogleGenAI({ apiKey });
    console.log('✅ GoogleGenAI 인스턴스 생성 완료');

    // 4. 이미지 생성 요청
    console.log('🎨 Gemini 2.5 Flash Image 모델로 이미지 생성 중...');
    const startTime = Date.now();

    const config: any = {};
    if (aspectRatio) {
      config.imageConfig = { aspectRatio };
      console.log('📐 설정된 가로세로 비율:', aspectRatio);
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: prompt,
      ...(Object.keys(config).length > 0 && { config })
    });

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    console.log(`⏱️  생성 완료 (소요 시간: ${duration}초)`);

    // 5. 응답 파싱
    console.log('📦 응답 파싱 중...');

    let imageBase64: string | null = null;
    let textResponse: string | null = null;

    // Gemini API 응답 구조: response.candidates[0].content.parts
    if (!response.candidates || response.candidates.length === 0) {
      console.error('❌ 에러: 응답에 candidates가 없음');
      console.error('❌ 응답 객체 키:', Object.keys(response));
      return NextResponse.json(
        { error: '이미지 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    const content = response.candidates[0]?.content;
    if (!content || !content.parts || content.parts.length === 0) {
      console.error('❌ 에러: 응답에 parts가 없음');
      return NextResponse.json(
        { error: '이미지 생성에 실패했습니다.' },
        { status: 500 }
      );
    }

    const parts = content.parts;
    console.log(`📊 응답 parts 개수: ${parts.length}`);

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      console.log(`\n📌 Part ${i + 1}:`);

      if (part.text) {
        textResponse = part.text;
        console.log('  ✏️  텍스트 응답:', part.text.substring(0, 100) + (part.text.length > 100 ? '...' : ''));
      }

      if (part.inlineData && part.inlineData.data) {
        imageBase64 = part.inlineData.data;
        const sizeKB = (imageBase64.length * 0.75 / 1024).toFixed(2);
        console.log('  🖼️  이미지 데이터 발견');
        console.log(`  📦 이미지 크기: 약 ${sizeKB} KB`);
        console.log(`  🔧 MIME 타입: ${part.inlineData.mimeType || 'image/png'}`);
      }
    }

    if (!imageBase64) {
      console.error('❌ 에러: 응답에 이미지가 없음');
      return NextResponse.json(
        { error: '이미지가 생성되지 않았습니다.' },
        { status: 500 }
      );
    }

    console.log('\n✅ 이미지 생성 성공!');
    console.log('=== Gemini 이미지 생성 API 종료 ===\n');

    // 6. 성공 응답
    return NextResponse.json({
      success: true,
      image: imageBase64,
      text: textResponse,
      metadata: {
        duration: `${duration}초`,
        model: 'gemini-2.5-flash-image',
        aspectRatio: aspectRatio || '1:1',
        timestamp: new Date().toISOString()
      }
    });

  } catch (error: any) {
    console.error('\n❌ === 에러 발생 ===');
    console.error('에러 메시지:', error.message);
    console.error('에러 스택:', error.stack);
    console.error('===================\n');

    return NextResponse.json(
      {
        error: '이미지 생성 중 오류가 발생했습니다.',
        details: error.message
      },
      { status: 500 }
    );
  }
}
