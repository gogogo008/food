import { IsString, IsNotEmpty, IsNumber, IsOptional, IsIn } from 'class-validator';

export class SaveMealLogDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['아침', '점심', '저녁', '간식'])
  mealType!: '아침' | '점심' | '저녁' | '간식';

  @IsString()
  @IsNotEmpty()
  foodName!: string;

  @IsNumber()
  @IsNotEmpty()
  quantity!: number;

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
  @IsOptional()
  fiber?: number;

  @IsNumber()
  @IsOptional()
  sugar?: number;

  @IsNumber()
  @IsOptional()
  sodium?: number;

  @IsString()
  @IsNotEmpty()
  eatDate!: string; // 'YYYY-MM-DD' 형식
}