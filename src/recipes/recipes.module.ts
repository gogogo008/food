// src/recipes/recipes.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RecipesController } from './recipes.controller';
import { RecipesService } from './recipes.service';
import { Recipe } from '../entities/recipe.entity';
import { User } from '../entities/user.entity';
import { Ingredient } from '../entities/ingredient.entity';
import { CookingTool } from '../entities/cooking-tool.entity';
import { RecipeStep } from '../entities/recipe-step.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Recipe, User, Ingredient, CookingTool, RecipeStep]),
  ],
  controllers: [RecipesController],
  providers: [RecipesService],
})
export class RecipesModule {}