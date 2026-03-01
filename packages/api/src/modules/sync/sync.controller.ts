import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { SyncService } from './sync.service';
import { AnalyzeSyncDto, GenerateSyncDto, ExecuteSyncDto } from './dto/sync.dto';

@ApiTags('sync')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('api/v1/sync')
export class SyncController {
  constructor(private readonly service: SyncService) {}

  @Post('analyze')
  @ApiOperation({ summary: 'Analyze sync possibility for a project group' })
  @ApiResponse({ status: 201, description: 'Analysis started' })
  analyze(@Body() dto: AnalyzeSyncDto) {
    return this.service.analyze(dto);
  }

  @Post('generate')
  @ApiOperation({ summary: 'Generate sync patches for selected variants' })
  @ApiResponse({ status: 201, description: 'Generation started' })
  generate(@Body() dto: GenerateSyncDto) {
    return this.service.generate(dto);
  }

  @Post('execute')
  @ApiOperation({ summary: 'Execute sync for approved variants' })
  @ApiResponse({ status: 201, description: 'Execution started' })
  execute(@Body() dto: ExecuteSyncDto) {
    return this.service.execute(dto);
  }

  @Get(':id/status')
  @ApiOperation({ summary: 'Get sync task status and progress' })
  @ApiResponse({ status: 200, description: 'Sync status' })
  getStatus(@Param('id') id: string) {
    return this.service.getStatus(id);
  }
}
