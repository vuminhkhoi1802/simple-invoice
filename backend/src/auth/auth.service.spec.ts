import { UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { AuthService } from './auth.service';

describe('AuthService', () => {
  const jwt = new JwtService({ secret: 'x'.repeat(32), signOptions: { expiresIn: 3600 } });
  const config = { getOrThrow: () => 3600 } as unknown as ConfigService;
  let user: User;
  let users: jest.Mocked<Pick<UsersService, 'findByEmailWithPassword' | 'findById'>>;
  let service: AuthService;

  beforeAll(async () => {
    user = Object.assign(new User(), {
      id: '11111111-1111-4111-8111-111111111111',
      email: 'admin@example.com',
      fullname: 'Admin',
      passwordHash: await bcrypt.hash('correct-horse', 4),
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
  });

  beforeEach(() => {
    users = { findByEmailWithPassword: jest.fn(), findById: jest.fn() };
    service = new AuthService(users as unknown as UsersService, jwt, config);
  });

  it('issues a verifiable JWT on valid credentials and never returns the hash', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);
    const res = await service.login('admin@example.com', 'correct-horse');

    const payload = await jwt.verifyAsync(res.accessToken);
    expect(payload).toMatchObject({ sub: user.id, email: user.email });
    expect(payload.exp - payload.iat).toBe(3600);
    expect(res.tokenType).toBe('Bearer');
    expect(res.expiresIn).toBe(3600);
    expect(res.user).not.toHaveProperty('passwordHash');
  });

  it('rejects a wrong password', async () => {
    users.findByEmailWithPassword.mockResolvedValue(user);
    await expect(service.login('admin@example.com', 'nope')).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
  });

  it('rejects an unknown email with the same message (no user enumeration)', async () => {
    users.findByEmailWithPassword.mockResolvedValue(null);
    await expect(service.login('ghost@example.com', 'whatever')).rejects.toThrow(
      new UnauthorizedException('Invalid email or password'),
    );
  });

  it('rejects /me for a user that no longer exists', async () => {
    users.findById.mockResolvedValue(null);
    await expect(service.profile(user.id)).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
