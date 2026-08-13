import { Module } from '@nestjs/common';
import { CategoriesModule } from '../categories/categories.module';
import { AiController } from './controllers/ai.controller';
import { ForecastController } from './controllers/forecast.controller';
import { SpendingPredictionController } from './controllers/spending-prediction.controller';
import { AiService } from './services/ai.service';
import { ForecastService } from './services/forecast.service';
import { SpendingPredictionService } from './services/spending-prediction.service';
import { AI_PROVIDER } from './interfaces/ai-provider.interface';
import { SimpleAiProvider } from './providers/simple-ai.provider';

@Module({
  imports: [CategoriesModule],
  controllers: [AiController, ForecastController, SpendingPredictionController],
  providers: [
    AiService,
    ForecastService,
    SpendingPredictionService,
    {
      provide: AI_PROVIDER,
      useClass: SimpleAiProvider,
    },
  ],
  exports: [AiService],
})
export class AiModule {}
