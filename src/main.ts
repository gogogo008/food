import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe());
  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 포트 번호 설정 (기본 3000번)
  await app.listen(3000);
  console.log(`🚀 서버가 3000번 포트에서 정상 가동 중입니다!`);
  
  console.log(`🚀 백엔드 서버가 시작되었습니다!`);
  //console.log(`📍 주소: http://localhost:${port}`);
}
bootstrap();