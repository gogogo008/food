import { Controller, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { DietService } from './diet.service'; 
import { Multer } from 'multer';

@Controller('diet')
export class DietController { 
  constructor(private readonly dietService: DietService) {}

  @Post('upload')
  @UseInterceptors(FileInterceptor('image'))
 async uploadFoodImage(@UploadedFile() file: any) { 
    if (!file) {
      throw new BadRequestException('파일이 전송되지 않았습니다!');
    }
    console.log('받은 파일:', file.originalname);
    return await this.dietService.analyzeFoodImage(file.buffer);
  }
}