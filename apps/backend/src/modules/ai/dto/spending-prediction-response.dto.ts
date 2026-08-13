import { ApiProperty } from '@nestjs/swagger';

export class CategoryPredictionDto {
  @ApiProperty({
    description: 'Category id belonging to the authenticated user',
  })
  categoryId: string;

  @ApiProperty({ description: 'Category name' })
  categoryName: string;

  @ApiProperty({ description: 'Predicted spending amount in integer cents' })
  predictedAmountCents: string;

  @ApiProperty({
    description: 'Prediction confidence normalized between 0 and 1',
  })
  confidence: number;

  @ApiProperty({
    description: 'Number of historical months the prediction is based on',
  })
  basedOnMonths: number;
}

export class SpendingPredictionResponseDto {
  @ApiProperty({
    description:
      'ISO-4217 currency code the prediction is expressed in (all cents are minor units of this currency)',
  })
  currency: string;

  @ApiProperty({ description: 'Predicted period in YYYY-MM format' })
  period: string;

  @ApiProperty({
    description: 'Predicted total upcoming spending in integer cents',
  })
  predictedTotalCents: string;

  @ApiProperty({
    description: 'Overall prediction confidence normalized between 0 and 1',
  })
  confidence: number;

  @ApiProperty({ type: () => [CategoryPredictionDto] })
  categories: CategoryPredictionDto[];

  @ApiProperty({
    description:
      'Category ids with no spending history, belonging to the authenticated user',
    type: [String],
  })
  noHistoryCategoryIds: string[];

  @ApiProperty({
    description:
      'Remaining predicted spending not attributed to a specific category, integer cents',
  })
  otherCents: string;

  @ApiProperty({
    description:
      'Whether historical data is insufficient for a meaningful prediction',
  })
  insufficientData: boolean;
}
