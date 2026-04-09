import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  // 포트 번호 설정 (기본 3000번)
  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  
  console.log(`🚀 백엔드 서버가 시작되었습니다!`);
  console.log(`📍 주소: http://localhost:${port}`);
}
bootstrap();