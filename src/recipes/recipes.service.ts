// src/recipes/recipes.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from '../entities/recipe.entity';
import { User } from '../entities/user.entity';
import { Ingredient } from '../entities/ingredient.entity';
import { CookingTool } from '../entities/cooking-tool.entity';
import { CreateRecipeDto } from '../Dto/create-recipe.dto';
import { GoogleGenerativeAI } from '@google/generative-ai'; 

@Injectable()
export class RecipesService {
  private ai!: GoogleGenerativeAI;

  constructor(
    @InjectRepository(Recipe) private recipeRepository: Repository<Recipe>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Ingredient) private ingredientRepository: Repository<Ingredient>,
    @InjectRepository(CookingTool) private cookingToolRepository: Repository<CookingTool>,
  ) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenerativeAI(apiKey);
    }
  }

async createRecipeFromYoutube(userId: string, videoUrl: string) {
    try {
      const user = await this.userRepository.findOne({ where: { id: userId } });
      if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

      const videoId = this.extractYoutubeVideoId(videoUrl);
      if (!videoId) throw new BadRequestException('올바른 유튜브 URL이 아닙니다.');

      if (!this.ai) throw new BadRequestException('Gemini API 키 설정이 누락되었습니다.');

      // 1. Gemini 모델 설정
      const model = this.ai.getGenerativeModel({ 
        model: 'gemini-2.5-flash-lite',
        generationConfig: { responseMimeType: 'application/json' } 
      });

      // 2. 프롬프트 구성 (유튜브 URL을 본문에 직접 포함시켜 분석하도록 유도)
     const prompt = `
      다음 제공되는 유튜브 영상 링크의 시각적(영상 화면) 및 청각적(오디오/음성) 내용을 정밀하게 분석해 주세요.
      영상 링크: ${videoUrl}

      사용자가 요리 앱('레시피오')에서 고품질의 레시피를 보고 직접 따라 할 수 있도록, 내용을 분석하여 아래 조건에 맞는 구조화된 JSON 데이터로 정제해 주세요.

      [핵심 필터링 규칙 - 매우 중요]
      - 영상에 여러 명의 셰프가 나오거나 여러 요리가 동시에 등장(예: 서바이벌 대결, 예능 등)한다면, 자막과 화면에서 비중이 가장 높거나 완성도가 높은 '단 하나의 메인 요리'만 타겟팅해서 레시피를 추출해 줘.
      - 중간에 인물들의 사담, 리액션, 대결 상황, 중간 예능 자막, 최종 평가 및 시식 내용(예: "맛있다", "누구를 선택한다", "감탄한다" 등)은 레시피 순서(steps)나 설명에 절대 포함하지 마. 오직 순수한 '요리 과정'만 남겨야 해.

      [데이터 정제 조건]
      1. title: 요리의 특징이 잘 드러나는 직관적이고 깔끔한 제목 (예: "백종원 매콤 제육볶음")
      2. content: 이 요리에 대한 매력적인 한 줄 소개글 (예: "집에서 불맛을 낼 수 있는 초간단 제육볶음 레시피입니다.")
      3. video_url: 제공된 원본 영상 주소(${videoUrl})를 그대로 반환해 줘.
      4. info: 요리 기본 정보 객체
         - servings: 몇 인분 기준인지 영상을 토대로 추정 (모호하면 "1인분" 또는 "2인분"으로 기본값 설정)
         - time: 요리에 걸리는 예상 소요 시간 (예: "15분", "30분")
         - difficulty: 요리 난이도 ("아무나", "초급", "중급", "상급" 중 문맥을 보고 판단하여 선택)
         - nutrients: 사용된 재료와 분량을 기반으로 요리 전체(또는 1인분 기준)의 대략적인 영양 성분을 영양학적으로 추정해서 숫자로 채워줘. (필요시 소수점 첫째 자리까지 표기)
           * calories: 칼로리 수치 (kcal 단위, 예: 450.5)
           * carbs: 탄수화물 양 (g 단위, 예: 35.2)
           * protein: 단백질 양 (g 단위, 예: 25.0)
           * fat: 지방 양 (g 단위, 예: 12.4)
           * fiber: 식이섬유 양 (g 단위, 예: 3.5)
           * sugar: 당류 양 (g 단위, 예: 8.2)
           * sodium: 나트륨 양 (mg 단위, 예: 450.0)
      5. ingredients: 요리에 사용된 재료들의 배열. 단순 이름이 아니라 실제 앱처럼 '이름'과 '계량(정량)'을 분리한 객체 배열로 만들어 줘.
         - name: 재료 이름 (예: "돼지고기 앞다리살", "고춧가루", "설탕")
         - amount: 영상에 나온 계량 정보 (예: "300g", "2스푼", "약간", "1/2개"). 정확한 양이 안 나오면 영상 문맥상 알맞은 양을 추정하거나 "적당량"으로 채워줘.
      6. cooking_tools: 요리에 사용된 조리기구들의 '이름'만 문자열 배열로 추출 (예: ["프라이팬", "궁중팬", "볼", "칼"])
      7. steps: 실제 사용자가 따라 할 수 있는 명확한 요리 순서 배열.
         - step_number: 1부터 시작하는 순차적인 정수
         - description: 해당 단계에서 해야 할 요리 행위를 명확하고 간결한 명령조(~합니다, ~하세요)로 작성. (예: "야채를 손질합니다", "팬에 기름을 두르고 고기를 볶습니다") 
         - 주객관적인 예능 멘트나 셰프의 이름(예: "최현석 셰프는~")은 빼고 오직 요리 행위 주체 중심으로 서술할 것.

      [반환 형태 예시]
      {
        "title": "원팬 토마토 파스타",
        "content": "냄비 하나로 끝내는 초간단 파스타 레시피입니다.",
        "video_url": "${videoUrl}",
        "info": {
          "servings": "1인분",
          "time": "15분",
          "difficulty": "초급",
          "nutrients": {
            "calories": 520.5,
            "carbs": 75.2,
            "protein": 15.4,
            "fat": 10.1,
            "fiber": 4.2,
            "sugar": 5.0,
            "sodium": 320.5
          }
        },
        "ingredients": [
          { "name": "파스타면", "amount": "100g" },
          { "name": "방울토마토", "amount": "8개" },
          { "name": "마늘", "amount": "5알" },
          { "name": "올리브유", "amount": "3큰술" },
          { "name": "소금", "amount": "약간" }
        ],
        "cooking_tools": ["냄비", "칼", "도마"],
        "steps": [
          { "step_number": 1, "description": "마늘은 편으로 썰고 방울토마토는 흐르는 물에 씻어 반으로 자릅니다." },
          { "step_number": 2, "description": "냄비에 올리브유를 두르고 썰어둔 마늘을 넣어 중불에서 향이 날 때까지 볶습니다." }
        ]
      }
    `;
      console.log("🔍 [단계 2] Gemini AI에게 유튜브 영상 직접 분석 요청 중...");
      const result = await model.generateContent(prompt);
      const responseText = result.response.text();

      // 3. AI가 준 JSON 텍스트를 실제 객체로 변환
      let aiData: any;
      try {
        aiData = JSON.parse(responseText);
      } catch (parseError) {
        console.error("❌ AI 응답 JSON 파싱 에러!");
        throw new BadRequestException('AI 응답을 파싱할 수 없습니다.');
      }

      // 4. 유튜브 공식 썸네일 이미지 주소 조합하기
      const thumbnailImg = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

      // 5. DTO 매핑
     const mockDto: CreateRecipeDto & { nutrients?: any } = {
        title: aiData.title,
        content: aiData.content,
        thumbnail_img: thumbnailImg,
        ingredients: aiData.ingredients || [],
        cooking_tools: aiData.cooking_tools || [],
        steps: aiData.steps || [],
        nutrients: aiData.info?.nutrients || { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 }
      };

      return await this.createRecipe(userId, mockDto);
    } catch (finalError: any) {
      console.error("❌ 최종 에러 발생:", finalError.message || finalError);
      throw finalError;
    }
  }

  private extractYoutubeVideoId(url: string): string | null {
    if (!url) return null;
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

 
  // =========================================================================
  // 1. 레시피 직접 등록 (사용자 입력 기반 AI 영양성분 자동 추출 버전)
  // =========================================================================
  async createRecipe(userId: string, dto: CreateRecipeDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    // 1. 재료(Ingredient) 확인 및 생성
    const ingredientEntities = await Promise.all(
      dto.ingredients.map(async (ing: any) => {
        // AI 추출 시 객체({name, amount})로 들어오거나, 직접 작성 시 문자열이나 객체로 올 수 있으므로 방어 코드 처리
        const name = typeof ing === 'string' ? ing : ing.name;
        let ingredient = await this.ingredientRepository.findOne({ where: { name } });
        if (!ingredient) {
          ingredient = this.ingredientRepository.create({ name });
          await this.ingredientRepository.save(ingredient);
        }
        return ingredient;
      }),
    );

    // 2. 조리기구(CookingTool) 확인 및 생성
    const toolEntities = await Promise.all(
      dto.cooking_tools.map(async (name) => {
        let tool = await this.cookingToolRepository.findOne({ where: { name } });
        if (!tool) {
          tool = this.cookingToolRepository.create({ name });
          await this.cookingToolRepository.save(tool);
        }
        return tool;
      }),
    );

    // 3. 입력한 재료 정보를 기반으로 AI에게 영양성분 추정 요청
    let nutrients = { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0, sugar: 0, sodium: 0 };
    
    if (this.ai && dto.ingredients && dto.ingredients.length > 0) {
      try {
        const model = this.ai.getGenerativeModel({ 
          model: 'gemini-2.5-flash-lite',
          generationConfig: { responseMimeType: 'application/json' } 
        });

        // 사용자가 입력한 재료 목록을 가독성 있게 문자열로 변환
        const ingredientsText = dto.ingredients
          .map((ing: any) => typeof ing === 'string' ? ing : `${ing.name} (${ing.amount || '적당량'})`)
          .join(', ');

        const nutrientPrompt = `
          다음 제공되는 요리 재료 목록을 기반으로, 이 요리 전체의 대략적인 영양 성분 7종을 영양학적으로 추정해서 JSON 객체로 반환해 주세요.
          필요하다면 소수점 첫째 자리까지 표기해 주세요.

          재료 목록: ${ingredientsText}

          [반환 형태]
          {
            "calories": 450.5,
            "carbs": 35.2,
            "protein": 25.0,
            "fat": 12.4,
            "fiber": 3.5,
            "sugar": 8.2,
            "sodium": 450.0
          }
        `;

        console.log("🔍 [직접 작성] 입력된 재료 기반 AI 영양성분 분석 중...");
        const result = await model.generateContent(nutrientPrompt);
        const aiResponse = JSON.parse(result.response.text());
        
        if (aiResponse) {
          nutrients = {
            calories: aiResponse.calories || 0,
            carbs: aiResponse.carbs || 0,
            protein: aiResponse.protein || 0,
            fat: aiResponse.fat || 0,
            fiber: aiResponse.fiber || 0,
            sugar: aiResponse.sugar || 0,
            sodium: aiResponse.sodium || 0,
          };
        }
      } catch (aiError) {
        // AI가 일시적으로 실패하더라도 레시피 등록 자체가 막히지 않도록 예외 처리 후 기본값(0)으로 진행
        console.error("⚠️ 직접 작성 레시피 AI 영양소 추정 실패 (기본값 0으로 대체):", aiError);
      }
    }

    // 4. 레시피 객체 생성 및 최종 저장
    const recipe = this.recipeRepository.create({
      title: dto.title,
      content: dto.content,
      thumbnail_img: dto.thumbnail_img,
      creator: user,
      ingredients: ingredientEntities,
      cooking_tools: toolEntities,
      is_public: false, // 기본 비공개
      // AI가 계산해낸 7종 영양성분 주입
      calories: nutrients.calories,
      carbs: nutrients.carbs,
      protein: nutrients.protein,
      fat: nutrients.fat,
      fiber: nutrients.fiber,
      sugar: nutrients.sugar,
      sodium: nutrients.sodium,
      steps: dto.steps.map((step) => ({
        step_number: step.step_number,
        description: step.description,
        step_img: step.step_img,
      })),
    });

    return await this.recipeRepository.save(recipe);
  }
  // =========================================================================
  // 2. 피드 검색 및 자취생 필터링 조회
  // =========================================================================
async findAll(search?: string, includeIngredients?: string[], excludeTools?: string[]) {
    const query = this.recipeRepository.createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.creator', 'creator')
      .leftJoinAndSelect('recipe.ingredients', 'ingredient')
      .leftJoinAndSelect('recipe.cooking_tools', 'tool')
      .select([
        'recipe.id', 'recipe.title', 'recipe.thumbnail_img', 
        'recipe.likes_count', 'recipe.created_at', 'recipe.is_public',
        'recipe.calories', 'recipe.carbs', 'recipe.protein', 'recipe.fat', 'recipe.fiber', 'recipe.sugar', 'recipe.sodium',
        'creator.id', 'creator.nickname',
        'ingredient.id', 'ingredient.name',
        'tool.id', 'tool.name'
      ])
      .where('recipe.is_public = :isPublic', { isPublic: true });

    if (search) {
      // 기존 where 문과 꼬이지 않게 andWhere 괄호 처리 보강
      query.andWhere('(recipe.title LIKE :search OR recipe.content LIKE :search)', { search: `%${search}%` });
    }

    if (includeIngredients && includeIngredients.length > 0) {
      query.andWhere('ingredient.name IN (:...incIngs)', { incIngs: includeIngredients });
    }

    if (excludeTools && excludeTools.length > 0) {
      query.andWhere((qb) => {
        const subQuery = qb.subQuery()
          .select('r.id')
          .from(Recipe, 'r')
          .innerJoin('r.cooking_tools', 't')
          .where('t.name IN (:...excTools)', { excTools: excludeTools })
          .getQuery();
        return 'recipe.id NOT IN ' + subQuery;
      });
    }

    query.orderBy('recipe.created_at', 'DESC');

    return await query.getMany();
  }

  // =========================================================================
  // 3. 레시피 상세 조회 
  // =========================================================================
  async findOne(id: number) {
    const recipe = await this.recipeRepository.findOne({
      where: { id },
      relations: ['creator', 'ingredients', 'cooking_tools', 'steps'],
    });

    if (!recipe) throw new NotFoundException('레시피를 찾을 수 없습니다.');

    recipe.steps.sort((a, b) => a.step_number - b.step_number);
    return recipe;
  }

  // =========================================================================
  // 4. 좋아요 / 좋아요 취소 토글 
  // =========================================================================
  async toggleLike(id: number, userId: string) {
    const recipe = await this.recipeRepository.findOne({
      where: { id },
      relations: ['likedByUsers'],
    });
    if (!recipe) throw new NotFoundException('레시피를 찾을 수 없습니다.');

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    const isLiked = recipe.likedByUsers.some((likedUser) => likedUser.id === userId);

    if (isLiked) {
      recipe.likedByUsers = recipe.likedByUsers.filter((likedUser) => likedUser.id !== userId);
      recipe.likes_count = Math.max(0, recipe.likes_count - 1);
    } else {
      recipe.likedByUsers.push(user);
      recipe.likes_count += 1;
    }

    await this.recipeRepository.save(recipe);
    return { liked: !isLiked, likes_count: recipe.likes_count };
  }

  //5. 좋아요순 랭킹 탐3
  async findTop3() {
    return await this.recipeRepository.createQueryBuilder('recipe')
      .leftJoinAndSelect('recipe.creator', 'creator')
      .select([
        'recipe.id', 'recipe.title', 'recipe.thumbnail_img', 
        'recipe.likes_count', 'recipe.created_at',
        'recipe.calories', 'recipe.carbs', 'recipe.protein', 'recipe.fat', 'recipe.fiber', 'recipe.sugar', 'recipe.sodium',
        'creator.id', 'creator.nickname'
      ])
        // 당연히 공개 상태인 레시피들 중에서만 랭킹을 매겨야 합니다.
        .where('recipe.is_public = :isPublic', { isPublic: true })
        // 좋아요가 많은 순 -> 같다면 최신등록 순으로 정렬
        .orderBy('recipe.likes_count', 'DESC')
        .addOrderBy('recipe.created_at', 'DESC')
        // 상위 딱 3개만 제한
        .limit(3)
        .getMany();
    }
}