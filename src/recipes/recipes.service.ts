// src/recipes/recipes.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from '../entities/recipe.entity';
import { User } from '../entities/user.entity';
import { Ingredient } from '../entities/ingredient.entity';
import { CookingTool } from '../entities/cooking-tool.entity';
import { CreateRecipeDto } from '../Dto/create-recipe.dto';
import { YoutubeTranscript } from 'youtube-transcript';
import { GoogleGenerativeAI } from '@google/generative-ai'; // 💡 최신 패키지 명칭으로 고정

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

  // 유튜브 URL 기반 레시피 자동 생성 및 등록
  async createRecipeFromYoutube(userId: string, videoUrl: string) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    // 1. 유튜브 URL에서 영상 고유 ID 추출 (썸네일 및 임베드 영상 링크용)
    const videoId = this.extractYoutubeVideoId(videoUrl);
    if (!videoId) throw new BadRequestException('올바른 유튜브 URL이 아닙니다.');

    let transcriptText = '';
    try {
      // 2. 유튜브 영상에서 자막(스크립트) 데이터 긁어오기
      const transcripts = await YoutubeTranscript.fetchTranscript(videoUrl, { lang: 'ko' });
      transcriptText = transcripts.map((t) => t.text).join(' ');
    } catch (error) {
      throw new BadRequestException('유튜브 영상에서 자막을 추출할 수 없습니다. 자막이 비활성화되어 있을 수 있습니다.');
    }

    if (!this.ai) throw new BadRequestException('Gemini API 키 설정이 누락되었습니다.');

    // 3. Gemini AI에게 자막을 주고 구조화된 JSON 데이터로 요약 요청하기
    const model = this.ai.getGenerativeModel({ 
      model: 'gemini-2.5-flash-lite',
      generationConfig: { responseMimeType: 'application/json' } // JSON 형태로만 응답받도록 강제 규칙 적용
    });

    const prompt = `
      다음은 요리 유튜브 영상의 자막 스크립트입니다. 
      이 내용을 분석해서 앱에 바로 등록할 수 있는 레시피 데이터(JSON)로 정제해 주세요.

      [조건]
      1. title: 요리에 어울리는 깔끔한 제목
      2. content: 이 레시피에 대한 간단한 한 줄 소개글과 함께 마지막에 원본 영상 주소(${videoUrl})를 포함해 줘.
      3. ingredients: 요리에 사용된 재료들의 '이름'만 문자열 배열로 추출 (예: ["닭고기", "양파", "간장"])
      4. cooking_tools: 요리에 사용된 조리기구들의 '이름'만 문자열 배열로 추출 (예: ["프라이팬", "냄비"])
      5. steps: 요리 순서 배열. 각 순서마다 step_number(1부터 시작하는 정수)와 description(요리 과정 설명)을 포함해 줘.

      [자막 스크립트]
      ${transcriptText}

      [반환 형태 예시]
      {
        "title": "원팬 토마토 파스타",
        "content": "냄비 하나로 끝내는 초간단 파스타 레시피입니다. 원본 영상: ${videoUrl}",
        "ingredients": ["파스타면", "방울토마토", "마늘", "올리브유"],
        "cooking_tools": ["냄비", "칼"],
        "steps": [
          { "step_number": 1, "description": "마늘을 편으로 썰고 방울토마토는 반으로 자릅니다." },
          { "step_number": 2, "description": "냄비에 올리브유를 두르고 마늘을 볶아 향을 냅니다." }
        ]
      }
    `;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    
    // AI가 준 JSON 텍스트를 실제 TypeScript 객체(Dto 형태)로 변환
    const aiData = JSON.parse(responseText);

    // 4. 유튜브 공식 썸네일 이미지 주소 조합하기
    const thumbnailImg = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

    // 5. 기존 내장 로직(createRecipe)을 재활용하여 데이터베이스에 안전하게 저장
    const mockDto: CreateRecipeDto = {
      title: aiData.title,
      content: aiData.content,
      thumbnail_img: thumbnailImg,
      ingredients: aiData.ingredients || [],
      cooking_tools: aiData.cooking_tools || [],
      steps: aiData.steps || [],
    };

    return await this.createRecipe(userId, mockDto);
  }
  private extractYoutubeVideoId(url: string): string | null {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
  }

  // =========================================================================
  // 1. 레시피 등록 
  // =========================================================================
  async createRecipe(userId: string, dto: CreateRecipeDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    const ingredientEntities = await Promise.all(
      dto.ingredients.map(async (name) => {
        let ingredient = await this.ingredientRepository.findOne({ where: { name } });
        if (!ingredient) {
          ingredient = this.ingredientRepository.create({ name });
          await this.ingredientRepository.save(ingredient);
        }
        return ingredient;
      }),
    );

    // 조리기구(CookingTool) 확인 및 생성
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

    // 레시피 객체 생성 및 순서(Steps) 매핑
    const recipe = this.recipeRepository.create({
      title: dto.title,
      content: dto.content,
      thumbnail_img: dto.thumbnail_img,
      creator: user,
      ingredients: ingredientEntities,
      cooking_tools: toolEntities,
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
        'recipe.likes_count', 'recipe.created_at',
        'creator.id', 'creator.nickname',
        'ingredient.id', 'ingredient.name',
        'tool.id', 'tool.name'
      ]);

    if (search) {
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
}