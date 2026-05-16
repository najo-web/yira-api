import { ScheduleModule } from '@nestjs/schedule';
import { QuizModule } from './modules/quiz/quiz.module';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { DatabaseModule } from './database/database.module';
import { AuthModule } from './auth/auth.module';
import { IaModule } from './ia/ia.module';
import { OsModule } from './modules/os/os.module';
import { OpModule } from './modules/op/op.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { UssdModule } from './modules/ussd/ussd.module';
import { FreemiumModule } from './modules/freemium/freemium.module';
import { CoreConfigModule } from './core-config/core-config.module';
import { ModerationModule } from './modules/moderation/moderation.module';
import { SaraModule } from './modules/sara/sara.module';
import { SignerModule } from './modules/signer/signer.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true }),
    CoreConfigModule,
    DatabaseModule,
    IaModule,
    FreemiumModule,
    AuthModule,
    OsModule,
    OpModule,
    AssessmentModule,
    UssdModule,
    ScheduleModule.forRoot(),
    QuizModule,
    ModerationModule,
    SaraModule,
    SignerModule,
  ],
})
export class AppModule {}