import { Controller, Get, Post, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProjectGroupService } from './project-group.service';
import { CreateProjectGroupDto, AddVariantDto } from './dto/project-group.dto';

@ApiTags('project-groups')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('project-groups')
export class ProjectGroupController {
  constructor(private readonly service: ProjectGroupService) {}

  @Post()
  @ApiOperation({ summary: 'Create project group' })
  create(@Body() dto: CreateProjectGroupDto) {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'List project groups' })
  @ApiQuery({ name: 'page', required: false })
  @ApiQuery({ name: 'limit', required: false })
  findAll(@Query('page') page?: string, @Query('limit') limit?: string) {
    return this.service.findAll(
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get project group detail' })
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post(':id/variants')
  @ApiOperation({ summary: 'Add variant project' })
  addVariant(@Param('id') id: string, @Body() dto: AddVariantDto) {
    return this.service.addVariant(id, dto);
  }

  @Get(':id/mapping')
  @ApiOperation({ summary: 'Get code mapping' })
  @ApiQuery({ name: 'variantId', required: false })
  @ApiQuery({ name: 'path', required: false })
  getMapping(
    @Param('id') id: string,
    @Query('variantId') variantId?: string,
    @Query('path') path?: string,
  ) {
    return this.service.getMapping(id, variantId, path);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete project group' })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
