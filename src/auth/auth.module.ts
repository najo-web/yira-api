// ============================================================
// YIRA — src/auth/auth.module.ts  (fix TypeScript strict)
// ============================================================
import { Module }         from '@nestjs/common';
import { JwtModule }      from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthService }    from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy }    from './jwt.strategy';
import { JwtAuthGuard }   from './jwt-auth.guard';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports:    [ConfigModule],
      inject:     [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        secret:      cfg.get<string>('JWT_SECRET')!,
        signOptions: { expiresIn: cfg.get('JWT_EXPIRY', '7d') as any },
      }),
    }),
  ],
  providers:   [AuthService, JwtStrategy, JwtAuthGuard],
  controllers: [AuthController],
  exports:     [AuthService, JwtAuthGuard, JwtModule],
})
export class AuthModule {}