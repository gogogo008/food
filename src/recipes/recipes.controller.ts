// src/recipes/recipes.controller.ts
import { Controller, Post, Get, Body, Param, Query, HttpCode, HttpStatus } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from '../Dto/create-recipe.dto';
import { YoutubeRecipeDto } from '../Dto/youtube-recipe.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}

  // 1. 레시피 게시물 등록
  @Post(':userId')
  async createRecipe(
    @Param('userId') userId: string,
    @Body() createRecipeDto: CreateRecipeDto,
  ) {
    return await this.recipesService.createRecipe(userId, createRecipeDto);
  }

  // 2. 인스타 피드형 레시피 검색 및 전체 조회 (필터링 포함)
  // GET /recipes?search=닭가슴살&ingredients=양파,마늘&excludeTools=오븐
  @Get()
  async getRecipes(
    @Query('search') search?: string,
    @Query('ingredients') ingredients?: string, // 쉼표분리 (양파,대파)
    @Query('excludeTools') excludeTools?: string, // 제외할 기구 (오븐,그릴)
  ) {
    const ingredientList = ingredients ? ingredients.split(',') : [];
    const excludeToolList = excludeTools ? excludeTools.split(',') : [];
    
    return await this.recipesService.findAll(search, ingredientList, excludeToolList);
  }
 @Post('api/youtube/create')
  async createByYoutube(@Body() dto: YoutubeRecipeDto) {
    return await this.recipesService.createRecipeFromYoutube(dto.userId, dto.videoUrl);
  }
  @Get('top3')
  async getTop3Recipes() {
    return await this.recipesService.findTop3();
  }
  // 3. 레시피 상세 조회 (음성인식 스텝 카드용)
  @Get(':id')
  async getRecipeDetail(@Param('id') id: number) {
    return await this.recipesService.findOne(id);
  }

  // 4. 레시피 좋아요 토글 (누르면 좋아요, 다시 누르면 취소)
  @Post(':id/like/:userId')
  @HttpCode(HttpStatus.OK)
  async toggleLikeRecipe(
    @Param('id') id: number,
    @Param('userId') userId: string,
  ) {
    return await this.recipesService.toggleLike(id, userId);
  }
  
}