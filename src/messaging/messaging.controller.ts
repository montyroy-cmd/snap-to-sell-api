import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import {
  CurrentUser,
  type AuthUser,
} from '../common/decorators/current-user.decorator';
import { MessagingService } from './messaging.service';
import { ReplyDto } from './dto/reply.dto';

@ApiTags('Messaging')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class MessagingController {
  constructor(private readonly messaging: MessagingService) {}

  @Get('inbox')
  @ApiOperation({ summary: 'Inbox; use platform=all or a marketplace id' })
  inbox(@CurrentUser() user: AuthUser, @Query('platform') platform?: string) {
    return this.messaging.inbox(user, platform ?? 'all');
  }

  @Get('conversation/:id')
  conversation(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.messaging.conversation(user, id);
  }

  @Post('reply')
  reply(@CurrentUser() user: AuthUser, @Body() dto: ReplyDto) {
    return this.messaging.reply(user, dto.conversationId, dto.messageText);
  }
}
