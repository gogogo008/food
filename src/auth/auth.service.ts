// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { JwtService } from '@nestjs/jwt';
import { User } from '../entities/user.entity';
import { SignupDto } from '../Dto/signup.dto';
import * as bcrypt from 'bcrypt';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private userRepository: Repository<User>,
    private jwtService: JwtService,
  ) {}

  // 회원가입
  async signup(signupDto: SignupDto) {
  const { email, password, nickname } = signupDto;

  // 1. [순서 변경] 저장하기 전에 비밀번호부터 암호화합니다.
  const hashedPassword = await bcrypt.hash(password, 10);

  // 2. 암호화된 비밀번호를 넣어서 유저 객체를 생성합니다.
  const user = this.userRepository.create({
    email,
    password: hashedPassword,
    nickname,
  });

  // 3. [중요] DB 저장은 딱 '한 번만' 실행합니다.
  const savedUser = await this.userRepository.save(user);

  // 4. 이제 진짜 DB에 저장된 유저의 UUID(savedUser.id)를 응답합니다.
  return { 
    success: true, 
    userId: savedUser.id, 
    message: '회원가입 성공' 
  };
}

  // 로그인
  async login(email: string, pass: string) {
    const user = await this.userRepository.findOne({ where: { email } });

    
    if (user && (await bcrypt.compare(pass, user.password!))) {
      const payload = { email: user.email, sub: user.id };
      
      
      return {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        token: this.jwtService.sign(payload), // accessToken -> token 변경
      };
    }
    throw new UnauthorizedException('이메일 또는 비밀번호를 확인해주세요.');
  }
}