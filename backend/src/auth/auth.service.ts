import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { User } from '../users/user.entity';
import { UsersService } from '../users/users.service';
import { LoginResponseDto, UserProfileDto } from './dto/auth-response.dto';
import { JwtPayload } from './jwt-auth.guard';

/**
 * A valid bcrypt hash compared against when the email is unknown, so a login
 * for a non-existent user costs the same time as a wrong password and response
 * timing does not reveal which emails are registered.
 */
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const user = await this.users.findByEmailWithPassword(email);
    const passwordOk = await bcrypt.compare(password, user?.passwordHash ?? DUMMY_HASH);
    if (!user || !passwordOk) {
      // Same message for both cases to avoid user enumeration.
      throw new UnauthorizedException('Invalid email or password');
    }

    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = await this.jwt.signAsync(payload);
    return {
      accessToken,
      tokenType: 'Bearer',
      expiresIn: this.config.getOrThrow<number>('JWT_EXPIRES_IN'),
      user: toProfile(user),
    };
  }

  async profile(userId: string): Promise<UserProfileDto> {
    const user = await this.users.findById(userId);
    // A valid token for a since-deleted user must not grant access.
    if (!user) throw new UnauthorizedException('User no longer exists');
    return toProfile(user);
  }
}

function toProfile(user: User): UserProfileDto {
  return { id: user.id, email: user.email, fullname: user.fullname, createdAt: user.createdAt };
}
