import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import argon2 from 'argon2';
import { PrismaService } from '../common/prisma.service';
import { LoginDto, RegisterDto } from './auth.dto';

const starterCategories = [
  ['Salary', '#16a34a'], ['Groceries', '#0f766e'], ['Food & dining', '#f97316'],
  ['Transport', '#2563eb'], ['Shopping', '#db2777'], ['Bills', '#7c3aed'],
  ['Investment', '#0891b2'], ['Transfer', '#64748b'], ['Uncategorised', '#94a3b8'],
];

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService, private readonly jwt: JwtService) {}

  async register(dto: RegisterDto) {
    if (await this.prisma.user.count()) throw new ConflictException('This private instance already has an owner.');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });
    const user = await this.prisma.user.create({
      data: {
        name: dto.name.trim(), email: dto.email.toLowerCase().trim(), passwordHash,
        categories: { create: starterCategories.map(([name, color]) => ({ name, color })) },
      },
    });
    return this.issue(user.id, user.email, user.name);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email.toLowerCase().trim() } });
    if (!user || !(await argon2.verify(user.passwordHash, dto.password))) throw new UnauthorizedException('Invalid email or password.');
    return this.issue(user.id, user.email, user.name);
  }

  profile(userId: string) {
    return this.prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { id: true, name: true, email: true } });
  }

  private async issue(sub: string, email: string, name: string) {
    return { token: await this.jwt.signAsync({ sub, email }), user: { id: sub, email, name } };
  }
}
