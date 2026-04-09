import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class DietService {
  // 1. 여기에 사용할 속성을 미리 선언해야 합니다! (중요)
  private genAI: GoogleGenerativeAI;

  constructor() {
    // 2. 이제 this.genAI를 사용할 수 있습니다.
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  async analyzeFoodImage(imageBuffer: Buffer) {
    try {
      // 3. 이제 'this.genAI'가 존재하지 않는다는 에러가 사라집니다.
      const model = this.genAI.getGenerativeModel(
        { model: 'gemini-2.5-flash-lite' },
      );

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg',
        },
      };

      const prompt = "사진 속의 음식이 무엇인지 알려줘. 대답은 '음식명'만 짧게 해줘. 예: 제육볶음";

      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const foodName = response.text().trim();

      return {
        success: true,
        foodName: foodName,
        message: '분석에 성공했습니다!',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 에러 발생';
      return {
        success: false,
        message: `AI 분석 실패: ${errorMessage}`
      };
    }
  }
}