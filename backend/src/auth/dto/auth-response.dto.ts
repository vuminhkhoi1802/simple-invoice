import { ApiProperty } from '@nestjs/swagger';

export class UserProfileDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty({ example: 'admin@simpleinvoice.dev' })
  email: string;

  @ApiProperty({ example: 'Admin User' })
  fullname: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt: Date;
}

export class LoginResponseDto {
  @ApiProperty({ description: 'JWT access token (also set as an httpOnly cookie).' })
  accessToken: string;

  @ApiProperty({ example: 'Bearer' })
  tokenType: 'Bearer';

  @ApiProperty({ example: 3600, description: 'Token lifetime in seconds.' })
  expiresIn: number;

  @ApiProperty({ type: UserProfileDto })
  user: UserProfileDto;
}
