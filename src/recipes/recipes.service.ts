// src/recipes/recipes.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Recipe } from '../entities/recipe.entity';
import { User } from '../entities/user.entity';
import { Ingredient } from '../entities/ingredient.entity';
import { CookingTool } from '../entities/cooking-tool.entity';
import { CreateRecipeDto } from '../Dto/create-recipe.dto'; // 💡 경로를 대문자 Dto에서 실제 폴더명인 소문자 dto로 정확히 고쳤습니다!

@Injectable()
export class RecipesService {
  constructor(
    @InjectRepository(Recipe) private recipeRepository: Repository<Recipe>,
    @InjectRepository(User) private userRepository: Repository<User>,
    @InjectRepository(Ingredient) private ingredientRepository: Repository<Ingredient>,
    @InjectRepository(CookingTool) private cookingToolRepository: Repository<CookingTool>,
  ) {}

  // 1. 레시피 등록
  async createRecipe(userId: string, dto: CreateRecipeDto) {
    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    // 재료(Ingredient) 확인 및 생성
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

  // 2. 인스타 피드 검색 및 자취생 필터링 조회 (최신순)
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

    // 제목 또는 소개글 키워드 검색
    if (search) {
      query.andWhere('(recipe.title LIKE :search OR recipe.content LIKE :search)', { search: `%${search}%` });
    }

    // 특정 재료를 포함해야 하는 경우
    if (includeIngredients && includeIngredients.length > 0) {
      query.andWhere('ingredient.name IN (:...incIngs)', { incIngs: includeIngredients });
    }

    // 자취생들을 위해 특정 조리기구(예: 오븐)가 필요한 레시피 전면 제외
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

    //최신 피드 정렬
    query.orderBy('recipe.created_at', 'DESC');

    return await query.getMany();
  }

  // 3. 레시피 상세 조회 (요리 시작시 스텝 순서대로 정렬해서 반환)
  async findOne(id: number) {
    const recipe = await this.recipeRepository.findOne({
      where: { id },
      relations: ['creator', 'ingredients', 'cooking_tools', 'steps'],
    });

    if (!recipe) throw new NotFoundException('레시피를 찾을 수 없습니다.');

    // 프론트엔드가 음성인식 카드뷰를 편하게 쓰도록 스텝 순서 정렬 오름차순(1 -> 2 -> 3)
    recipe.steps.sort((a, b) => a.step_number - b.step_number);
    return recipe;
  }

  // 4. 좋아요 / 좋아요 취소 토글
  async toggleLike(id: number, userId: string) {
    const recipe = await this.recipeRepository.findOne({
      where: { id },
      relations: ['likedByUsers'],
    });
    if (!recipe) throw new NotFoundException('레시피를 찾을 수 없습니다.');

    const user = await this.userRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('유저를 찾을 수 없습니다.');

    // 이미 좋아요를 누른 유저인지 확인
    const isLiked = recipe.likedByUsers.some((likedUser) => likedUser.id === userId);

    if (isLiked) {
      // 좋아요 취소
      recipe.likedByUsers = recipe.likedByUsers.filter((likedUser) => likedUser.id !== userId);
      recipe.likes_count = Math.max(0, recipe.likes_count - 1);
    } else {
      // 좋아요 추가
      recipe.likedByUsers.push(user);
      recipe.likes_count += 1;
    }

    await this.recipeRepository.save(recipe);
    return { liked: !isLiked, likes_count: recipe.likes_count };
  }
}