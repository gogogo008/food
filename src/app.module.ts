import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

// ── 1. 기능별 모듈 임포트 ──
import { AuthModule } from './auth/auth.module';
import { DietModule } from './diet/diet.module';
import { RecipesModule } from './recipes/recipes.module';
import { UsersModule } from './User/users.module';

// ── 2. 모든 엔티티 임포트 ──
import { User } from './entities/user.entity';
import { MealLog } from './entities/meal-log.entity';
import { Food } from './entities/food.entity';
import { Recipe } from './entities/recipe.entity';
import { RecipeStep } from './entities/recipe-step.entity'; 
import { UserPhysicalInfo } from './entities/user-physical-info.entity'; 
import { Ingredient } from './entities/ingredient.entity';
import { CookingTool } from './entities/cooking-tool.entity';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),

    // TypeORM 연결 설정
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: 5432,
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
    
      entities: [
        User,
        UserPhysicalInfo, 
        MealLog,
        Food,
        Recipe,
        RecipeStep, 
        Ingredient,
        CookingTool,
      ],
      synchronize: true, // 개발용 자동 테이블 생성 및 동기화
    }),

    // ── 3. 가동할 핵심 모듈들 등록 ──
    AuthModule,    
    DietModule,    
    RecipesModule, 
    UsersModule,   
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}