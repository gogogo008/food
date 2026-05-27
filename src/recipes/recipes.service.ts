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
import { YoutubeTranscript } from 'youtube-transcript';

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

    // ─── [핵심 수정] 백엔드에서 유튜브 자막 텍스트 직접 추출 ───
    let transcriptText = '';
    try {
      console.log("🔍 유튜브에서 자막 데이터를 가져오는 중...");
      const transcriptObj = await YoutubeTranscript.fetchTranscript(videoUrl, { lang: 'ko' }); // 한국어 자막 우선
      transcriptText = transcriptObj.map(t => t.text).join(' ');
    } catch (transcriptError) {
      console.error("⚠️ 자막 추출 실패:", transcriptError);
      throw new BadRequestException('유튜브 영상에서 자막을 추출할 수 없습니다. (자막이 없는 영상이거나 차단됨)');
    }

    const model = this.ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: 'application/json' } 
    });

    // ─── 프롬프트에 실제 자막 데이터 주입 ───
    const prompt = `
      다음 제공되는 유튜브 영상의 실제 자막 텍스트를 기반으로 요리 레시피를 정밀하게 분석해 주세요.
      절대 가짜 데이터를 지어내지 말고, 오직 제공된 [자막 내용]만 바탕으로 정제해야 합니다.

      [자막 내용]
      ${transcriptText}

      사용자가 요리 앱('레시피오')에서 고품질의 레시피를 보고 직접 따라 할 수 있도록, 내용을 분석하여 아래 조건에 맞는 구조화된 JSON 데이터로 정제해 주세요.

      [핵심 필터링 규칙]
      - 여러 요리가 등장한다면 비중이 가장 높은 '단 하나의 메인 요리'만 타겟팅하세요.
      - 리액션, 사담, 시식 평가는 제외하고 오직 순수한 '요리 과정'만 남기세요.

      [데이터 정제 조건]
      1. title: 요리의 특징이 잘 드러나는 직관적이고 깔끔한 제목
      2. content: 이 요리에 대한 매력적인 한 줄 소개글
      3. video_url: "${videoUrl}" (그대로 반환)
      4. info: { servings, time, difficulty, nutrients: { calories, carbs, protein, fat, fiber, sugar, sodium } }
      5. ingredients: { "name": "재료명", "amount": "계량" } 객체 배열 (자막에 계량이 없으면 문맥상 추정하거나 "적당량" 처리)
      6. cooking_tools: 사용된 조리기구들의 이름 문자열 배열 (예: ["프라이팬", "칼"])
      7. steps: { "step_number": 1, "description": "설명" } 객체 배열 (명령조로 간결하게 작성)
    `;

    console.log("🔍 Gemini AI에게 실제 자막 기반 레시피 정제 요청 중...");
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();

    let aiData: any;
    try {
      aiData = JSON.parse(responseText);
    } catch (parseError) {
      throw new BadRequestException('AI 응답을 파싱할 수 없습니다.');
    }

    const thumbnailImg = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    const mockDto: CreateRecipeDto = {
      title: aiData.title,
      content: aiData.content,
      thumbnail_img: thumbnailImg,
      ingredients: aiData.ingredients ? aiData.ingredients.map((i: any) => i.name) : [], 
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

    async togglePublicStatus(id: number, userId: string) {
  // 레시피와 작성자(creator) 정보를 함께 조회
  const recipe = await this.recipeRepository.findOne({
    where: { id },
    relations: ['creator'],
  });

  if (!recipe) throw new NotFoundException('레시피를 찾을 수 없습니다.');

  
  if (recipe.creator.id !== userId) {
    throw new BadRequestException('본인이 작성한 레시피만 공개 여부를 변경할 수 있습니다.');
  }

  // 현재 상태를 반전 (true -> false / false -> true)
  recipe.is_public = !recipe.is_public;

  await this.recipeRepository.save(recipe);

  return { 
    recipeId: recipe.id, 
    is_public: recipe.is_public, 
    message: recipe.is_public ? '레시피가 전체 공개되었습니다.' : '레시피가 비공개 처리되었습니다.' 
  };
}

async findMyRecipes(userId: string) {
  // 유저가 존재하는지 먼저 검증
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

  return await this.recipeRepository.createQueryBuilder('recipe')
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
    .where('creator.id = :userId', { userId })
    .orderBy('recipe.created_at', 'DESC')
    .getMany();
}
// =========================================================================
// 9. 레시피 수정 (작성자 검증 포함)
// =========================================================================
async updateRecipe(id: number, userId: string, dto: CreateRecipeDto) {
  // 수정할 레시피와 작성자 정보를 가져옴
  const recipe = await this.recipeRepository.findOne({
    where: { id },
    relations: ['creator'],
  });

  if (!recipe) throw new NotFoundException('레시피를 찾을 수 없습니다.');

  if (recipe.creator.id !== userId) {
    throw new BadRequestException('본인이 작성한 레시피만 수정할 수 있습니다.');
  }

  // 1. 새로운 재료(Ingredient) 확인 및 생성/매핑
  const ingredientEntities = await Promise.all(
    dto.ingredients.map(async (ing: any) => {
      const name = typeof ing === 'string' ? ing : ing.name;
      let ingredient = await this.ingredientRepository.findOne({ where: { name } });
      if (!ingredient) {
        ingredient = this.ingredientRepository.create({ name });
        await this.ingredientRepository.save(ingredient);
      }
      return ingredient;
    }),
  );

  // 2. 새로운 조리기구(CookingTool) 확인 및 생성/매핑
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

  // 3. 변경된 데이터 덮어씌우기
  if (dto.steps && dto.steps.length > 0) {
    recipe.steps = dto.steps.map((step) => {
      return {
        step_number: step.step_number,
        description: step.description,
        step_img: step.step_img ?? '', // step_img가 옵셔널이므로 없으면 빈 문자열 처리
      } as any; 
    });
  }

  // 4. 영양성분 정보도 DTO에 담겨왔다면 갱신 (없으면 기존 값 유지)
  if (dto.nutrients) {
    recipe.calories = dto.nutrients.calories !== undefined ? dto.nutrients.calories : (recipe.calories ?? 0);
    recipe.carbs = dto.nutrients.carbs !== undefined ? dto.nutrients.carbs : (recipe.carbs ?? 0);
    recipe.protein = dto.nutrients.protein !== undefined ? dto.nutrients.protein : (recipe.protein ?? 0);
    recipe.fat = dto.nutrients.fat !== undefined ? dto.nutrients.fat : (recipe.fat ?? 0);
    recipe.fiber = dto.nutrients.fiber !== undefined ? dto.nutrients.fiber : (recipe.fiber ?? 0);
    recipe.sugar = dto.nutrients.sugar !== undefined ? dto.nutrients.sugar : (recipe.sugar ?? 0);
    recipe.sodium = dto.nutrients.sodium !== undefined ? dto.nutrients.sodium : (recipe.sodium ?? 0);
  }

  return await this.recipeRepository.save(recipe);
}

// =========================================================================
// 10. 레시피 삭제 (작성자 검증 포함)
// =========================================================================
async removeRecipe(id: number, userId: string) {
  const recipe = await this.recipeRepository.findOne({
    where: { id },
    relations: ['creator'],
  });

  if (!recipe) throw new NotFoundException('레시피를 찾을 수 없습니다.');

  if (recipe.creator.id !== userId) {
    throw new BadRequestException('본인이 작성한 레시피만 삭제할 수 있습니다.');
  }

  // 레시피 완전 삭제 (Cascade 설정에 의해 하위 steps 등도 함께 지워집니다)
  await this.recipeRepository.remove(recipe);

  return { recipeId: id, message: '레시피가 성공적으로 삭제되었습니다.' };
}
async findLikedRecipes(userId: string) {
  // 1. 유저 존재 여부 먼저 깔끔하게 검증
  const user = await this.userRepository.findOne({ where: { id: userId } });
  if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

  // 2. QueryBuilder로 유저가 좋아요한 레시피만 필터링해서 셀렉트
  return await this.recipeRepository.createQueryBuilder('recipe')
    .innerJoin('recipe.likedByUsers', 'likedUser', 'likedUser.id = :userId', { userId }) // 👈 여기가 핵심! 좋아요 누른 유저 테이블과 조인
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
    .orderBy('recipe.created_at', 'DESC') // 최신 찜한 순(또는 등록순) 정렬
    .getMany();
}
}