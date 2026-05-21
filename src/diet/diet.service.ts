// src/diet/diet.service.ts
import { Injectable, NotFoundException } from '@nestjs/common'; // 💡 NotFoundException 임포트 추가!
import { GoogleGenerativeAI } from '@google/generative-ai';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { Food } from '../entities/food.entity';
import { MealLog } from '../entities/meal-log.entity';
import { SaveMealLogDto } from '../Dto/meal-log.dto';
import { User } from '../entities/user.entity';

@Injectable()
export class DietService {
  private genAI: GoogleGenerativeAI;

  constructor(
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Food) private foodRepository: Repository<Food>,
    @InjectRepository(MealLog) private mealLogRepository: Repository<MealLog>,
  ) {
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
  }

  // 기존 함수 기능 강화 (이미지 분석 + DB 매칭 + 후보군 추천)
  async analyzeFoodImage(imageBuffer: Buffer) {
    try {
      const model = this.genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });

      const imagePart = {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: 'image/jpeg',
        },
      };

      const prompt = "사진 속의 음식이 무엇인지 알려줘. 대답은 '음식명'만 짧게 해줘. 예: 제육볶음";
      const result = await model.generateContent([prompt, imagePart]);
      const response = await result.response;
      const aiFoodName = response.text().trim();

      // 🔍 CSV 데이터가 축적된 DB에서 AI가 인식한 음식명이 포함되어 있는지 검색
      const matchedFood = await this.foodRepository.createQueryBuilder('food')
        .where('food.name LIKE :name', { name: `%${aiFoodName}%` })
        .getOne();

      let finalFoodName = aiFoodName;
      let candidates: string[] = [];

      if (matchedFood) {
        finalFoodName = matchedFood.name;
        // 같은 칼로리대 혹은 영양성분이 유사한 후보군 4개 뽑기
        const dbCandidates = await this.foodRepository.createQueryBuilder('food')
          .where('food.id != :id', { id: matchedFood.id })
          .orderBy('ABS(food.calories - :cal)', 'ASC')
          .setParameter('cal', matchedFood.calories)
          .take(4)
          .getMany();
        
        candidates = dbCandidates.map(f => f.name);
      } else {
        // 일치하는 음식을 못 찾았다면 랜덤으로 4개 후보 추천
        const dbCandidates = await this.foodRepository.createQueryBuilder('food')
          .orderBy('RANDOM()') 
          .take(4)
          .getMany();
        candidates = dbCandidates.map(f => f.name);
      }

      return {
        success: true,
        foodName: finalFoodName,
        candidates: candidates, 
        message: '분석에 성공했습니다!',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 에러 발생';
      return {
        success: false,
        message: `AI 분석 실패: ${errorMessage}`,
        candidates: [],
      };
    }
  }

  // 📝 유저가 확정한 식단 기록 저장하기
  async saveMealLog(userId: string, dto: SaveMealLogDto) {
    const log = this.mealLogRepository.create({
      userId,
      ...dto,
    });
    return await this.mealLogRepository.save(log);
  }

  // 📅 6개월 데이터 추적용 기간별 식단/영양 분석 조회 기록
  async getDietHistory(userId: string, startDate: string, endDate: string) {
    const logs = await this.mealLogRepository.find({
      where: {
        userId,
        eatDate: Between(startDate, endDate),
      },
      order: { eatDate: 'DESC', createdAt: 'DESC' },
    });

    const dailySummary = logs.reduce((acc, log) => {
      const date = log.eatDate;
      if (!acc[date]) {
        acc[date] = {
          date,
          totalCalories: 0,
          totalCarbs: 0,
          totalProtein: 0,
          totalFat: 0,
          meals: [],
        };
      }
      acc[date].totalCalories += log.calories;
      acc[date].totalCarbs += log.carbs;
      acc[date].totalProtein += log.protein;
      acc[date].totalFat += log.fat;
      acc[date].meals.push(log);
      return acc;
    }, {} as Record<string, any>);

    return {
      success: true,
      dailySummary: Object.values(dailySummary),
      rawLogs: logs,
    };
  }

  // 🏠 홈 화면 대시보드에 필요한 모든 데이터 통합 조회
  async getHomeDashboard(userId: string) {
    // 1. 유저 정보 및 맞춤형 6대 영양소 목표값 가져오기
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('존재하지 않는 유저입니다.'); // 💡 이제 정상 작동합니다.
    }

    const todayStr = new Date().toISOString().split('T')[0];

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    // 2. 오늘 유저가 먹은 식단 로그 조회
    const todayLogs = await this.mealLogRepository.find({
      where: { userId, eatDate: todayStr },
      order: { createdAt: 'ASC' },
    });

    const mappedTodayLogs = todayLogs.map(log => ({
      id: log.id,
      mealType: log.mealType,
      food: {
        name: log.foodName,
        emoji: '🍽️', 
        nutrition: {
          calories: log.calories,
          carbs: log.carbs,
          protein: log.protein,
          fat: log.fat,
          fiber: log.fiber,
          sugar: log.sugar,
          sodium: log.sodium,
        }
      }
    }));

    // 3. 주간 칼로리 통계 데이터 생성 (최근 7일)
    const weeklyLogs = await this.mealLogRepository.find({
      where: {
        userId,
        eatDate: Between(oneWeekAgoStr, todayStr),
      },
    });

    const weeklyCalories: { day: string; calories: number }[] = [];
    const dayLabels = ['일', '월', '화', '수', '목', '금', '토'];

    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      const dayLabel = dayLabels[d.getDay()];

      const dayTotalCal = weeklyLogs
        .filter(log => log.eatDate === dateStr)
        .reduce((sum, log) => sum + log.calories, 0);

      weeklyCalories.push({
        day: dayLabel,
        calories: dayTotalCal,
      });
    }

    const todayWater = 0; 

    return {
      success: true,
      currentUser: {
        profile: { name: user.nickname ?? '사용자' }
      },
      dailyGoals: {
        calories: user.goal_calories || 2000,
        carbs: user.goal_macros?.c || 250,
        protein: user.goal_macros?.p || 60,
        fat: user.goal_macros?.f || 50,
        fiber: user.goal_macros?.fiber || 25,
        sugar: user.goal_macros?.sugar || 50,
        sodium: user.goal_macros?.sodium || 2000,
      },
      todayLogs: mappedTodayLogs,
      weeklyCalories: weeklyCalories,
      todayWater: todayWater, 
    };
  }
}