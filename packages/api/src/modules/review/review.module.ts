import { Module } from '@nestjs/common';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';
import { AutoApproveService } from './auto-approve.service';

@Module({
  controllers: [ReviewController],
  providers: [ReviewService, AutoApproveService],
  exports: [ReviewService, AutoApproveService],
})
export class ReviewModule {}
