import { IsIn, IsNotEmpty, IsString, Matches, MaxLength } from 'class-validator';

export class NativePushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @Matches(/^(?:Expo|Exponent)PushToken\[[^\]\r\n]{10,512}\]$/)
  token!: string;

  @IsString()
  @IsIn(['android', 'ios'])
  platform!: 'android' | 'ios';
}

export class RemoveNativePushTokenDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(512)
  @Matches(/^(?:Expo|Exponent)PushToken\[[^\]\r\n]{10,512}\]$/)
  token!: string;
}
