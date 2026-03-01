import { IsString, IsOptional, IsArray, IsBoolean } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AnalyzeSyncDto {
  @ApiProperty()
  @IsString()
  projectGroupId!: string;

  @ApiProperty()
  @IsString()
  commitHash!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  targetVariants?: string[];
}

export class GenerateSyncDto {
  @ApiProperty()
  @IsString()
  syncId!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  variantIds!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  options?: { includeExplanation?: boolean; maxTokens?: number };
}

export class ExecuteSyncDto {
  @ApiProperty()
  @IsString()
  syncId!: string;

  @ApiProperty()
  @IsArray()
  @IsString({ each: true })
  approvedVariants!: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchPrefix?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  autoMerge?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  createPr?: boolean;
}
