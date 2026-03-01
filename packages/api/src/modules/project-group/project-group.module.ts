import { Module } from '@nestjs/common';
import { ProjectGroupController } from './project-group.controller';
import { ProjectGroupService } from './project-group.service';

@Module({
  controllers: [ProjectGroupController],
  providers: [ProjectGroupService],
  exports: [ProjectGroupService],
})
export class ProjectGroupModule {}
