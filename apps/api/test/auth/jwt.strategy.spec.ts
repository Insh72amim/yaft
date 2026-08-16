import { UnauthorizedException } from '@nestjs/common';
import type { PrismaService } from '../../src/common/prisma.service';
import { JwtStrategy } from '../../src/auth/jwt.strategy';

describe('JwtStrategy', () => {
  const previousSecret = process.env.JWT_SECRET;

  beforeAll(() => { process.env.JWT_SECRET = 'synthetic-test-secret-at-least-32-characters'; });
  afterAll(() => {
    if (previousSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previousSecret;
  });

  it('returns the live owner for an active session', async () => {
    const findUnique = jest.fn().mockResolvedValue({ id: 'owner-a', email: 'owner@example.test' });
    const strategy = new JwtStrategy({ user: { findUnique } } as unknown as PrismaService);

    await expect(strategy.validate({ sub: 'owner-a', email: 'owner@example.test' }))
      .resolves.toEqual({ id: 'owner-a', email: 'owner@example.test' });
    expect(findUnique).toHaveBeenCalledWith({ where: { id: 'owner-a' }, select: { id: true, email: true } });
  });

  it('rejects a signed session whose owner no longer exists', async () => {
    const strategy = new JwtStrategy({ user: { findUnique: jest.fn().mockResolvedValue(null) } } as unknown as PrismaService);

    await expect(strategy.validate({ sub: 'deleted-owner', email: 'owner@example.test' }))
      .rejects.toBeInstanceOf(UnauthorizedException);
  });
});
