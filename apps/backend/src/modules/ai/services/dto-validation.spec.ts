import { validate } from 'class-validator';
import {
  DEFAULT_FORECAST_HORIZON,
  ForecastQueryDto,
  MAX_FORECAST_HORIZON,
} from '../dto/forecast-query.dto';
import {
  DEFAULT_SPENDING_PREDICTION_HORIZON,
  SpendingPredictionQueryDto,
} from '../dto/spending-prediction-query.dto';

describe('ForecastQueryDto validation', () => {
  it('uses the default horizon', async () => {
    const dto = new ForecastQueryDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.horizon).toBe(DEFAULT_FORECAST_HORIZON);
  });

  it('accepts horizon 1', async () => {
    const dto = new ForecastQueryDto();
    dto.horizon = 1;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts the maximum horizon', async () => {
    const dto = new ForecastQueryDto();
    dto.horizon = MAX_FORECAST_HORIZON;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects horizon 0', async () => {
    const dto = new ForecastQueryDto();
    dto.horizon = 0;
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('rejects a horizon above the maximum', async () => {
    const dto = new ForecastQueryDto();
    dto.horizon = MAX_FORECAST_HORIZON + 1;
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('rejects a non-integer horizon', async () => {
    const dto = new ForecastQueryDto();
    dto.horizon = 2.5;
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('rejects an invalid ISO date', async () => {
    const dto = new ForecastQueryDto();
    dto.startDate = 'not-a-date';
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('accepts valid ISO dates', async () => {
    const dto = new ForecastQueryDto();
    dto.startDate = '2026-01-01';
    dto.endDate = '2026-06-30';
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('SpendingPredictionQueryDto validation', () => {
  it('uses the default horizon', async () => {
    const dto = new SpendingPredictionQueryDto();
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
    expect(dto.horizon).toBe(DEFAULT_SPENDING_PREDICTION_HORIZON);
  });

  it('accepts horizon 1', async () => {
    const dto = new SpendingPredictionQueryDto();
    dto.horizon = 1;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts horizon 6', async () => {
    const dto = new SpendingPredictionQueryDto();
    dto.horizon = 6;
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('rejects horizon 0', async () => {
    const dto = new SpendingPredictionQueryDto();
    dto.horizon = 0;
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('rejects horizon 7', async () => {
    const dto = new SpendingPredictionQueryDto();
    dto.horizon = 7;
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });

  it('rejects a non-integer horizon', async () => {
    const dto = new SpendingPredictionQueryDto();
    dto.horizon = 2.5;
    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
  });
});
