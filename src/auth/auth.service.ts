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

    // 비밀번호 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 유저 생성 및 저장
    const user = this.userRepository.create({
      email,
      password: hashedPassword,
      nickname,
    });

    await this.userRepository.save(user);
    return { success: true, message: '회원가입 성공' };
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