import { Global, Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerService } from './logger.service';
import { LoggerMiddleware } from './logger.middleware';
import { LoggerInterceptor } from './logger.interceptor';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [LoggerService, LoggerMiddleware, LoggerInterceptor],
  exports: [LoggerService, LoggerMiddleware, LoggerInterceptor],
})
export class LoggerModule {}
