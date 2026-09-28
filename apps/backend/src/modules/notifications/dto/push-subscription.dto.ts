import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsObject,
  IsString,
  IsUrl,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class PushSubscriptionKeysDto {
  @ApiProperty({ description: 'Browser-provided P-256 public key' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{20,200}$/)
  p256dh!: string;

  @ApiProperty({ description: 'Browser-provided authentication secret' })
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{16,100}$/)
  auth!: string;
}

export class PushSubscriptionEndpointDto {
  @ApiProperty({ description: 'HTTPS push service endpoint' })
  @IsString()
  @MaxLength(2048)
  @IsUrl({ protocols: ['https'], require_protocol: true })
  endpoint!: string;
}

export class CreatePushSubscriptionDto extends PushSubscriptionEndpointDto {
  @ApiProperty({ type: PushSubscriptionKeysDto })
  @IsObject()
  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys!: PushSubscriptionKeysDto;
}
