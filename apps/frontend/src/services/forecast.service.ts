import { apiClient } from '@/lib/axios';
import type { ForecastResponse, SpendingPredictionResponse } from '@/types/backend';

export interface ForecastParams {
  horizon?: number;
  startDate?: string;
  endDate?: string;
}

export interface SpendingPredictionParams {
  horizon?: number;
}

export const forecastService = {
  getForecast: (params?: ForecastParams): Promise<ForecastResponse> =>
    apiClient
      .get<{ success: boolean; data: ForecastResponse }>('/ai/forecast', {
        params: params as Record<string, unknown> | undefined,
      })
      .then((res) => res.data),

  getSpendingPrediction: (params?: SpendingPredictionParams): Promise<SpendingPredictionResponse> =>
    apiClient
      .get<{ success: boolean; data: SpendingPredictionResponse }>('/ai/spending-prediction', {
        params: params as Record<string, unknown> | undefined,
      })
      .then((res) => res.data),
};
