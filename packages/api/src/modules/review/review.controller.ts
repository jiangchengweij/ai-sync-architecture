import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ReviewService } from './review.service';
import { AutoApproveService } from './auto-approve.service';
import { RejectReviewDto, BatchApproveDto, ReviewQueryDto } from './dto/review.dto';

@ApiTags('reviews')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/reviews')
export class ReviewController {
  constructor(
    private readonly service: ReviewService,
    private readonly autoApproveService: AutoApproveService,
  ) {}

  @Get('pending')
  @ApiOperation({ summary: 'List pending reviews sorted by confidence' })
  @ApiResponse({ status: 200, description: 'Pending review list' })
  findPending(@Query() query: ReviewQueryDto) {
    return this.service.findPending(query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get review detail with patch and feedback history' })
  @ApiResponse({ status: 200, description: 'Review detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/approve')
  @ApiOperation({ summary: 'Approve a review' })
  @ApiResponse({ status: 200, description: 'Review approved' })
  approve(@Param('id') id: string) {
    return this.service.approve(id);
  }

  @Post(':id/reject')
  @ApiOperation({ summary: 'Reject a review with reason' })
  @ApiResponse({ status: 200, description: 'Review rejected' })
  reject(@Param('id') id: string, @Body() dto: RejectReviewDto) {
    return this.service.reject(id, dto);
  }

  @Post('batch-approve')
  @ApiOperation({ summary: 'Batch approve reviews by IDs or confidence threshold' })
  @ApiResponse({ status: 200, description: 'Batch approval result' })
  batchApprove(@Body() dto: BatchApproveDto) {
    return this.service.batchApprove(dto);
  }

  @Post('auto-approve/evaluate/:id')
  @ApiOperation({ summary: 'Evaluate a single review for auto-approval' })
  @ApiResponse({ status: 200, description: 'Auto-approve decision' })
  evaluateAutoApprove(@Param('id') id: string) {
    return this.autoApproveService.evaluate(id);
  }

  @Post('auto-approve/batch')
  @ApiOperation({ summary: 'Run auto-approve on all pending reviews' })
  @ApiResponse({ status: 200, description: 'Batch auto-approve results' })
  batchAutoApprove() {
    return this.autoApproveService.evaluateBatch();
  }
}
