import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SupplementsController } from './supplements.controller';
import { SupplementsService } from './supplements.service';
import { Supplement } from '../entities/supplement.entity';
import { Ingredient } from '../entities/ingredient.entity';
import { User } from '../entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Supplement, Ingredient, User]),
  ],
  controllers: [SupplementsController],
  providers: [SupplementsService],
  exports: [SupplementsService], // 필요시 다른 모듈에서 사용 가능하도록 export
})
export class SupplementsModule {}