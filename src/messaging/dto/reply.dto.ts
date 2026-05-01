import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsUUID, MaxLength } from 'class-validator';

export class ReplyDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  conversationId: string;

  @ApiProperty()
  @IsString()
  @MaxLength(8000)
  messageText: string;
}
