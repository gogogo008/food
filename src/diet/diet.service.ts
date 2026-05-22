// src/diet/diet.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
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

// 1. 음식 이미지 분석 (Type Error 완벽 해결 및 1인분 환산 버전)
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


      const allFoodCount = await this.foodRepository.count();
console.log('현재 DB에 저장된 총 음식 개수:', allFoodCount);
      // AI가 맞춘 음식을 DB에서 검색
      const matchedFood = await this.foodRepository.createQueryBuilder('food')
        .where('food.name LIKE :name', { name: `%${aiFoodName}%` })
        .getOne();

      // 💡 해결 포인트 2 & 3: 타입을 명시적으로 지정하여 'null' 또는 'never' 에러 방지
      let finalFood: any = null;
      let candidates: any[] = [];

      // 💡 100g/ml 기준 영양성분을 1인분(예: 250g) 기준으로 변환해 주는 내부 헬퍼 함수
      const convertToServing = (food: Food) => {
        // DB의 영양성분함량기준량은 대개 100g 또는 100ml입니다.
        // 일반적인 성인 1인분 정량을 약 250g(2.5배)으로 가정하고 연산합니다.
        const defaultServingSize = 250; 
        const ratio = defaultServingSize / 100; // 2.5배 비율 곱하기

        return {
          id: food.id,
          name: food.name,
          servingSize: defaultServingSize, // 프론트엔드에게 보낼 1인분 정량 가이드 (250g)
          calories: Math.round(food.calories * ratio),
          carbs: Math.round(food.carbs * ratio),
          protein: Math.round(food.protein * ratio),
          fat: Math.round(food.fat * ratio),
          sugar: Math.round((food.sugar || 0) * ratio),
          fiber: Math.round((food.fiber || 0) * ratio),
          sodium: Math.round((food.sodium || 0) * ratio),
        };
      };

      if (matchedFood) {
        // 매칭된 음식을 1인분 기준으로 변환
        finalFood = convertToServing(matchedFood);

        // 유사 칼로리대 주변 후보군 4개 추출 및 1인분 환산
        const dbCandidates = await this.foodRepository.createQueryBuilder('food')
          .where('food.id != :id', { id: matchedFood.id })
          .orderBy('ABS(food.calories - :cal)', 'ASC')
          .setParameter('cal', matchedFood.calories)
          .take(4)
          .getMany();
        
        candidates = dbCandidates.map(f => convertToServing(f));
      } else {
        // 일치하는 음식이 없다면 랜덤 후보군 4개 추출 및 1인분 환산
        const dbCandidates = await this.foodRepository.createQueryBuilder('food')
          .orderBy('RANDOM()') 
          .take(4)
          .getMany();
        candidates = dbCandidates.map(f => convertToServing(f));
      }

      return {
        success: true,
        foodName: finalFood ? finalFood.name : aiFoodName, // 💡 이제 정상 인식됩니다!
        matchedFoodInfo: finalFood, // AI가 정확히 매칭한 음식 정보 (없으면 null)
        candidates: candidates,     // 대안 카드용 후보 리스트 (항상 4개 존재)
        message: finalFood ? '음식 매칭에 성공했습니다!' : '일치하는 DB 음식을 찾지 못해 추천 후보를 제공합니다.',
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '알 수 없는 에러 발생';
      return {
        success: false,
        message: `AI 분석 실패: ${errorMessage}`,
        matchedFoodInfo: null,
        candidates: [],
      };
    }
  }

// 2. 식단 기록 저장
  async saveMealLog(userId: string, dto: SaveMealLogDto) {
  const log = this.mealLogRepository.create({
    userId,
    ...dto,
  });
    return await this.mealLogRepository.save(log);
  }
  // 3. 기간별 식단 조회 
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
          totalProtein: 0,
          totalFat: 0,
          totalCarbs: 0,
          totalSugar: 0,
          totalFiber: 0,
          totalSodium: 0,
          meals: [],
        };
      }
      acc[date].totalCalories += Number(log.calories || 0);
      acc[date].totalProtein += Number(log.protein || 0);
      acc[date].totalFat += Number(log.fat || 0);
      acc[date].totalCarbs += Number(log.carbs || 0);
      acc[date].totalSugar += Number(log.sugar || 0);
      acc[date].totalFiber += Number(log.fiber || 0);
      acc[date].totalSodium += Number(log.sodium || 0);
      
      acc[date].meals.push(log);
      return acc;
    }, {} as Record<string, any>);

    return {
      success: true,
      dailySummary: Object.values(dailySummary),
      rawLogs: logs,
    };
  }

  // 4. 홈 화면 대시보드 데이터 조회
  async getHomeDashboard(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('존재하지 않는 유저입니다.');

    const todayStr = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

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

    const weeklyLogs = await this.mealLogRepository.find({
      where: { userId, eatDate: Between(oneWeekAgoStr, todayStr) },
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

      weeklyCalories.push({ day: dayLabel, calories: dayTotalCal });
    }

    return {
      success: true,
      currentUser: { profile: { name: user.nickname ?? '사용자' } },
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
      todayWater: 0, 
    };
  }

  // =========================================================================
  // AI 지침 가중치 기반 실시간 맞춤 음식 DB 추천 알고리즘
  // =========================================================================
  async recommendFoods(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    const todayStr = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    // 1. 과거 먹은 음식 최근 3개 추출
    const recent3Meals = await this.mealLogRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 3,
    });
    const recentFoodNames = recent3Meals.map(m => m.foodName);

    // 2. 오늘 먹은 총 영양성분 및 남은 목표 칼로리 계산
    const todayLogs = await this.mealLogRepository.find({ where: { userId, eatDate: todayStr } });
    const todayEaten = todayLogs.reduce((acc, log) => {
      acc.calories += log.calories || 0;
      acc.carbs += log.carbs || 0;
      acc.protein += log.protein || 0;
      acc.fat += log.fat || 0;
      acc.sugar += log.sugar || 0;
      acc.fiber += log.fiber || 0;
      acc.sodium += log.sodium || 0;
      return acc;
    }, { calories: 0, carbs: 0, protein: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 });

    const goalCalories = user.goal_calories || 2000;
    const remainingCalories = Math.max(200, goalCalories - todayEaten.calories);

    // 3. 주간 먹은 총 영양성분 요약
    const weeklyLogs = await this.mealLogRepository.find({ where: { userId, eatDate: Between(oneWeekAgoStr, todayStr) } });
    const weeklyTotal = weeklyLogs.reduce((acc, log) => {
      acc.carbs += log.carbs || 0;
      acc.protein += log.protein || 0;
      acc.fat += log.fat || 0;
      acc.sugar += log.sugar || 0;
      acc.fiber += log.fiber || 0;
      acc.sodium += log.sodium || 0;
      return acc;
    }, { carbs: 0, protein: 0, fat: 0, sugar: 0, fiber: 0, sodium: 0 });

    // 4. Gemini AI에게 데이터를 주고 최적의 영양 밸런스 가중치 도출 요청 (JSON 강제)
    const model = this.genAI.getGenerativeModel({
      model: 'gemini-1.5-flash',
      generationConfig: { responseMimeType: 'application/json' },
    });

    const prompt = `
      유저의 영양 섭취 현황 데이터를 보고 다음 끼니에 보충하면 가장 좋은 영양소들의 '가중치(중요도 점수: -5점 ~ 5점)'와 '한 줄 추천 사유'를 명확한 JSON으로 반환해줘.
      부족한 성분은 +5점에 가깝게, 오늘/주간 과하게 많이 먹은 성분은 -5점에 가깝게 점수를 매겨줘.

      [유저 목표] 일일 칼로리 목표: ${goalCalories}kcal (현재 남은 칼로리: ${remainingCalories}kcal)
      [최근 먹은 음식 3개]: ${JSON.stringify(recentFoodNames)}
      [오늘 섭취량]: ${JSON.stringify(todayEaten)}
      [최근 7일 총 섭취량]: ${JSON.stringify(weeklyTotal)}

      [규칙] 반환 포맷은 반드시 아래 키값을 가진 JSON 객체 한 개여야 해.
      {
        "reason": "오늘 단백질 섭취가 크게 부족하고 최근 나트륨 과다 상태이므로, 담백하고 단백질이 풍부한 식단을 추천합니다.",
        "p_weight": 5,   // 단백질 가중치 (-5 ~ 5)
        "c_weight": 2,   // 탄수화물 가중치 (-5 ~ 5)
        "f_weight": 1,   // 지방 가중치 (-5 ~ 5)
        "fib_weight": 4, // 식이섬유 가중치 (-5 ~ 5)
        "sug_weight": -3,// 당류 가중치 (-5 ~ 5)
        "sod_weight": -4 // 나트륨 가중치 (-5 ~ 5)
      }
    `;

    const result = await model.generateContent(prompt);
    const aiData = JSON.parse(result.response.text());

    // 5. AI가 준 가중치를 스코어링 수식으로 만들어 실시간 DB(Food) 기획 연산 쿼리 수행
    const recommendedFoods = await this.foodRepository.createQueryBuilder('food')
      .select('food')
      .addSelect(
        `(food.protein * :pW + food.carbs * :cW + food.fat * :fW + food.fiber * :fibW + food.sugar * :sugW + food.sodium * :sodW)`,
        'score'
      )
      .where('food.calories <= :maxCal', { maxCal: remainingCalories }) // 남은 칼로리 내에서 해결 가능한 음식만
      .setParameters({
        pW: aiData.p_weight,
        cW: aiData.c_weight,
        fW: aiData.f_weight,
        fibW: aiData.fib_weight,
        sugW: aiData.sug_weight,
        sodW: aiData.sod_weight / 100, // 나트륨 단위(mg) 보정용 나눗셈
      })
      .orderBy('score', 'DESC')
      .take(3) // 최적의 맞춤 음식 3개 선택
      .getMany();

    return {
      success: true,
      aiAnalysisReason: aiData.reason,
      recommendedFoods: recommendedFoods,
    };
  }

  // =========================================================================
  // 주간 식단 기반 AI 종합 분석 요약 리포트/코멘트 발행
  // =========================================================================
  async getWeeklyAiReport(userId: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    const todayStr = new Date().toISOString().split('T')[0];
    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 6);
    const oneWeekAgoStr = oneWeekAgo.toISOString().split('T')[0];

    // 1. 최근 일주일간 유저가 기록한 모든 식단 가져오기
    const weeklyLogs = await this.mealLogRepository.find({
      where: { userId, eatDate: Between(oneWeekAgoStr, todayStr) },
      order: { eatDate: 'ASC' },
    });

    if (weeklyLogs.length === 0) {
      return {
        success: true,
        report: "이번 주에 기록된 식단 데이터가 없습니다. 음식을 기록하시면 멋진 AI 영양 종합 리포트를 작성해 드릴게요! 🍽️"
      };
    }

    // 2. AI에게 넘겨줄 간결한 텍스트 데이터 포맷팅
    const formattedHistory = weeklyLogs.map(log => 
      `[${log.eatDate} / ${log.mealType}] ${log.foodName}: ${log.calories}kcal (탄:${log.carbs}g, 단:${log.protein}g, 지:${log.fat}g, 당:${log.sugar}g, 섬유:${log.fiber}g, 나트륨:${log.sodium}mg)`
    ).join('\n');

    // 3. Gemini 모델을 호출하여 전문적인 영양 코멘트 리포트 작성 요청
    const model = this.genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    const prompt = `
      당신은 친절하고 전문적인 AI 피트니스 헬스 영양사입니다. 
      유저가 일주일간 기록한 아래의 식단 성분 리스트를 면밀히 분석하여 주간 건강 리포트(코멘트)를 작성해 주세요.

      [유저 기본 정보]
      - 닉네임: ${user.nickname ?? '회원님'}
      - 하루 목표 칼로리: ${user.goal_calories || 2000}kcal

      [일주일간의 식단 및 영양소 로그]:
      ${formattedHistory}

      [작성 요령]
      1. 친절하고 격려하는 말투(~요, ~습니다)를 사용하세요.
      2. 7대 성분(칼로리, 탄, 단, 지, 당, 식이섬유, 나트륨) 중 잘 조절한 부분과 다소 과하거나 부족했던 성분을 콕 집어 과학적으로 분석해 주세요.
      3. 다음 주 식단을 구성할 때 실천하기 좋은 구체적인 피드백 조언 2가지를 포함해 주세요.
      4. 가독성이 좋게 마크다운 이모지 형식(★, 🥦, ⚠️ 등)을 섞어서 보기 좋게 단락을 나눠 써줘. 너무 길지 않고 핵심만 3~4문단으로 깔끔하게 작성해 줘.
    `;

    const result = await model.generateContent(prompt);
    const reportText = result.response.text();

    return {
      success: true,
      report: reportText,
    };
  }
}