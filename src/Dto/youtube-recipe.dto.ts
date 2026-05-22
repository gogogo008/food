import { IsString, IsNotEmpty } from 'class-validator';

export class YoutubeRecipeDto {
  @IsString()
  @IsNotEmpty()
  videoUrl!: string;

  @IsString()
  @IsNotEmpty()
  userId!: string;
}