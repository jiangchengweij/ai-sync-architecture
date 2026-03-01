import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { CreateProjectGroupDto, AddVariantDto } from './dto/project-group.dto';

@Injectable()
export class ProjectGroupService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: CreateProjectGroupDto) {
    const existing = await this.prisma.projectGroup.findUnique({ where: { name: dto.name } });
    if (existing) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Project group name already exists' });
    }

    return this.prisma.projectGroup.create({
      data: {
        name: dto.name,
        description: dto.description,
        syncStrategy: (dto.syncStrategy || { mode: 'semi-automatic', confidenceThreshold: 0.85, autoMerge: false }) as any,
        projects: {
          create: {
            name: dto.baseProject.name,
            gitUrl: dto.baseProject.gitUrl,
            gitBranch: dto.baseProject.defaultBranch || 'main',
            type: 'base',
          },
        },
      },
      include: { projects: true },
    });
  }

  async findAll(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.projectGroup.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          projects: { select: { id: true, name: true, type: true, status: true } },
          _count: { select: { syncTasks: true } },
        },
      }),
      this.prisma.projectGroup.count(),
    ]);

    return { items, pagination: { total, page, limit } };
  }

  async findOne(id: string) {
    const group = await this.prisma.projectGroup.findUnique({
      where: { id },
      include: {
        projects: true,
        _count: { select: { syncTasks: true } },
      },
    });
    if (!group) throw new NotFoundException({ code: 'NOT_FOUND', message: 'Project group not found' });
    return group;
  }

  async addVariant(groupId: string, dto: AddVariantDto) {
    const group = await this.findOne(groupId);

    const existingUrl = await this.prisma.project.findUnique({ where: { gitUrl: dto.gitUrl } });
    if (existingUrl) {
      throw new ConflictException({ code: 'CONFLICT', message: 'Git URL already registered' });
    }

    return this.prisma.project.create({
      data: {
        projectGroupId: group.id,
        name: dto.name,
        gitUrl: dto.gitUrl,
        gitBranch: dto.defaultBranch || 'main',
        type: 'variant',
        metadata: {
          customizationNotes: dto.customizationNotes || '',
          excludedPaths: dto.excludedPaths || [],
        },
      },
    });
  }

  async getMapping(groupId: string, variantId?: string, pathFilter?: string) {
    await this.findOne(groupId);

    const where: any = { projectGroupId: groupId };
    if (variantId) where.variantProjectId = variantId;
    if (pathFilter) where.baseFilePath = { contains: pathFilter };

    const mappings = await this.prisma.codeMapping.findMany({
      where,
      include: {
        baseProject: { select: { id: true, name: true } },
        variantProject: { select: { id: true, name: true } },
      },
      orderBy: { matchConfidence: 'desc' },
    });

    return {
      projectGroupId: groupId,
      mappings: mappings.map((m) => ({
        baseFile: m.baseFilePath,
        functionName: m.baseFunctionName,
        variants: [{
          variantId: m.variantProjectId,
          variantFile: m.variantFilePath,
          functionName: m.variantFunctionName,
          matchConfidence: Number(m.matchConfidence),
          structuralMatch: m.structuralMatch,
        }],
      })),
    };
  }

  async remove(id: string) {
    await this.findOne(id);
    return this.prisma.projectGroup.delete({ where: { id } });
  }
}
