import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ListingAnalyzeController } from './listing-analyze.controller';
import { ListingAnalyzeService } from './listing-analyze.service';

@Module({
  imports: [ConfigModule],
  controllers: [ListingAnalyzeController],
  providers: [ListingAnalyzeService],
})
export class ListingAnalyzeModule {}
