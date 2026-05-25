// src/recipes/dto/create-recipe.dto.ts
import { IsString, IsNotEmpty, IsOptional, IsArray, ValidateNested, IsNumber } from 'class-validator';
import { Type } from 'class-transformer';

export class RecipeStepDto {
  @IsNumber()
  @IsNotEmpty()
  step_number!: number;

  @IsString()
  @IsNotEmpty()
  description!: string;

  @IsString()
  @IsOptional()
  step_img?: string;
}
export class NutrientsDto {
  @IsNumber()
  @IsNotEmpty()
  calories!: number;

  @IsNumber()
  @IsNotEmpty()
  carbs!: number;

  @IsNumber()
  @IsNotEmpty()
  protein!: number;

  @IsNumber()
  @IsNotEmpty()
  fat!: number;

  @IsNumber()
  @IsNotEmpty()
  fiber!: number;

  @IsNumber()
  @IsNotEmpty()
  sugar!: number;

  @IsNumber()
  @IsNotEmpty()
  sodium!: number;
}
export class CreateRecipeDto {
  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsOptional()
  content?: string;

  @IsString()
  @IsOptional()
  thumbnail_img?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RecipeStepDto)
  steps!: RecipeStepDto[];

  @IsArray()
  @IsString({ each: true })
  ingredients!: string[]; // 예: ["닭가슴살", "양파"]

  @IsArray()
  @IsString({ each: true })
  cooking_tools!: string[]; // 예: ["에어프라이어", "전자레인지"]
  
  @IsOptional()
  @ValidateNested()
  @Type(() => NutrientsDto)
  nutrients?: NutrientsDto;
}