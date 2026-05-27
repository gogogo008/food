import { Controller, Post, Get, Patch, Body, Param, Query, HttpCode, HttpStatus, Put, Delete } from '@nestjs/common';
import { RecipesService } from './recipes.service';
import { CreateRecipeDto } from '../Dto/create-recipe.dto';
import { YoutubeRecipeDto } from '../Dto/youtube-recipe.dto';

@Controller('recipes')
export class RecipesController {
  constructor(private readonly recipesService: RecipesService) {}


  // [전체 조회 및 필터 검색] GET /recipes
  @Get()
  async getRecipes(
    @Query('search') search?: string,
    @Query('ingredients') ingredients?: string,
    @Query('excludeTools') excludeTools?: string,
  ) {
    const ingredientList = ingredients ? ingredients.split(',') : [];
    const excludeToolList = excludeTools ? excludeTools.split(',') : [];
    
    return await this.recipesService.findAll(search, ingredientList, excludeToolList);
  }

  // [좋아요 순 랭킹 TOP 3] GET /recipes/top3
  @Get('top3')
  async getTop3Recipes() {
    return await this.recipesService.findTop3();
  }

  // [유튜브 레시피 자동 등록] POST /recipes/api/youtube/create
  @Post('api/youtube/create')
  async createByYoutube(@Body() dto: YoutubeRecipeDto) {
    return await this.recipesService.createRecipeFromYoutube(dto.userId, dto.videoUrl);
  }



  // [내 작성 레시피 목록 조회] GET /recipes/my/list/:userId
  @Get('my/list/:userId')
  async getMyRecipes(@Param('userId') userId: string) {
    return await this.recipesService.findMyRecipes(userId);
  }

  // [내가 좋아요한 레시피 목록 조회] GET /recipes/my/liked/:userId
  @Get('my/liked/:userId')
  async getMyLikedRecipes(@Param('userId') userId: string) {
    return await this.recipesService.findLikedRecipes(userId);
  }

  // [공개 / 비공개 여부 전환 토글] PATCH /recipes/:id/public/:userId
  @Patch(':id/public/:userId')
  async toggleRecipePublic(
    @Param('id') id: number,
    @Param('userId') userId: string,
  ) {
    return await this.recipesService.togglePublicStatus(id, userId);
  }

  // [레시피 좋아요 토글] POST /recipes/:id/like/:userId
  @Post(':id/like/:userId')
  @HttpCode(HttpStatus.OK)
  async toggleLikeRecipe(
    @Param('id') id: number,
    @Param('userId') userId: string,
  ) {
    return await this.recipesService.toggleLike(id, userId);
  }

  // [레시피 수정] PUT /recipes/:id/:userId
  @Put(':id/:userId')
  async updateRecipe(
    @Param('id') id: number,
    @Param('userId') userId: string,
    @Body() updateRecipeDto: CreateRecipeDto,
  ) {
    return await this.recipesService.updateRecipe(id, userId, updateRecipeDto);
  }

  // [레시피 삭제] DELETE /recipes/:id/:userId
  @Delete(':id/:userId')
  async deleteRecipe(
    @Param('id') id: number,
    @Param('userId') userId: string,
  ) {
    return await this.recipesService.removeRecipe(id, userId);
  }


  // [레시피 상세 조회] GET /recipes/:id
  @Get(':id')
  async getRecipeDetail(@Param('id') id: number) {
    return await this.recipesService.findOne(id);
  }

  // [레시피 직접 등록] POST /recipes/:userId
  @Post(':userId')
  async createRecipe(
    @Param('userId') userId: string,
    @Body() createRecipeDto: CreateRecipeDto,
  ) {
    return await this.recipesService.createRecipe(userId, createRecipeDto);
  }
}