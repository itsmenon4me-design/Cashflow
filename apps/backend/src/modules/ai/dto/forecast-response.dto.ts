import { ApiProperty } from '@nestjs/swagger';
import { SUPPORTED_CURRENCIES } from '../../../common/types/money';

export class ForecastMonthDto {
  @ApiProperty({ description: 'Forecast period in YYYY-MM format' })
  period: string;

  @ApiProperty({ description: 'Projected income in integer cents' })
  projectedIncomeCents: string;

  @ApiProperty({ description: 'Projected expense in integer cents' })
  projectedExpenseCents: string;

  @ApiProperty({ description: 'Projected net cashflow in integer cents' })
  projectedNetCashflowCents: string;

  @ApiProperty({ description: 'Projected ending balance in integer cents' })
  projectedEndingBalanceCents: string;
}

export class ForecastBasisDto {
  @ApiProperty({ description: 'Number of historical months used' })
  monthsUsed: number;

  @ApiProperty({
    description: 'Start of the historical window (YYYY-MM)',
  })
  historyStart: string;

  @ApiProperty({ description: 'End of the historical window (YYYY-MM)' })
  historyEnd: string;

  @ApiProperty({
    description: 'Total income in the historical window, integer cents',
  })
  totalIncomeCents: string;

  @ApiProperty({
    description: 'Total expense in the historical window, integer cents',
  })
  totalExpenseCents: string;

  @ApiProperty({
    description: 'Average monthly income, integer cents',
  })
  averageMonthlyIncomeCents: string;

  @ApiProperty({
    description: 'Average monthly expense, integer cents',
  })
  averageMonthlyExpenseCents: string;
}

export class ForecastOutlierDto {
  @ApiProperty({ description: 'Period in YYYY-MM format' })
  period: string;

  @ApiProperty({ description: 'Outlier amount in integer cents' })
  amountCents: string;
}

export class ForecastResponseDto {
  @ApiProperty({
    description:
      'ISO-4217 currency code the forecast is expressed in (all cents are minor units of this currency)',
    enum: SUPPORTED_CURRENCIES,
  })
  currency: string;

  @ApiProperty({ description: 'Number of forecast months' })
  horizon: number;

  @ApiProperty({ type: () => [ForecastMonthDto] })
  months: ForecastMonthDto[];

  @ApiProperty({
    description: 'Forecast confidence normalized between 0 and 1',
  })
  confidence: number;

  @ApiProperty({ type: () => ForecastBasisDto })
  basis: ForecastBasisDto;

  @ApiProperty({
    description: 'Whether transfer transactions were excluded',
  })
  excludedTransfers: boolean;

  @ApiProperty({ type: () => [ForecastOutlierDto] })
  outliers: ForecastOutlierDto[];

  @ApiProperty({
    description:
      'Whether historical data is insufficient for a meaningful forecast',
  })
  insufficientData: boolean;
}
