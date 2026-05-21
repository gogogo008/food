// src/users/dto/physical-info.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class PhysicalInfoDto {
  @IsString()
  @IsNotEmpty()
  gender!: string; // 'male' | 'female' 등

  @IsString()
  @IsNotEmpty()
  age!: string;

  @IsString()
  @IsNotEmpty()
  height!: string;

  @IsString()
  @IsNotEmpty()
  weight!: string;

  @IsString()
  @IsNotEmpty()
  activityLevel!: string; // 'sedentary' | 'active' 등
}