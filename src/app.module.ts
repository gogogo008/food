import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DietModule } from './diet/diet.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [DietModule, ConfigModule.forRoot(), ],
  controllers: [AppController],
  providers: [AppService],
  
})
export class AppModule {}
