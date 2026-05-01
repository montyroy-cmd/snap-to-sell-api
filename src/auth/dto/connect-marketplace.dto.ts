import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ConnectMarketplaceDto {
  @ApiProperty({
    description:
      'JSON string of Playwright storage state / cookies for the marketplace session',
  })
  @IsString()
  @MinLength(2)
  sessionJson: string;
}
