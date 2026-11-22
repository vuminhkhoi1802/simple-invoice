import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ACCESS_TOKEN_COOKIE } from './auth.constants';
import { JwtAuthGuard } from './jwt-auth.guard';

describe('JwtAuthGuard', () => {
  const jwt = new JwtService({ secret: 'x'.repeat(32), signOptions: { expiresIn: 60 } });
  const reflector = new Reflector();
  const guard = new JwtAuthGuard(jwt, reflector);

  function ctx(req: Record<string, unknown>, isPublic = false): ExecutionContext {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(isPublic);
    return {
      getHandler: () => undefined,
      getClass: () => undefined,
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
  }

  it('lets @Public routes through without a token', async () => {
    await expect(guard.canActivate(ctx({ headers: {} }, true))).resolves.toBe(true);
  });

  it('rejects requests without a token', async () => {
    await expect(guard.canActivate(ctx({ headers: {} }))).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('accepts a Bearer token and attaches the user', async () => {
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.co' });
    const req: Record<string, unknown> = { headers: { authorization: `Bearer ${token}` } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
    expect(req.user).toEqual({ id: 'u1', email: 'a@b.co' });
  });

  it('accepts the httpOnly cookie', async () => {
    const token = await jwt.signAsync({ sub: 'u1', email: 'a@b.co' });
    const req = { headers: {}, cookies: { [ACCESS_TOKEN_COOKIE]: token } };
    await expect(guard.canActivate(ctx(req))).resolves.toBe(true);
  });

  it('rejects a token signed with another secret', async () => {
    const forged = await new JwtService({ secret: 'y'.repeat(32) }).signAsync({ sub: 'u1', email: 'a@b.co' });
    const req = { headers: { authorization: `Bearer ${forged}` } };
    await expect(guard.canActivate(ctx(req))).rejects.toThrow('Invalid or expired token');
  });

  it('rejects an expired token', async () => {
    const expired = await jwt.signAsync({ sub: 'u1', email: 'a@b.co' }, { expiresIn: -10 });
    const req = { headers: { authorization: `Bearer ${expired}` } };
    await expect(guard.canActivate(ctx(req))).rejects.toThrow('Invalid or expired token');
  });
});
