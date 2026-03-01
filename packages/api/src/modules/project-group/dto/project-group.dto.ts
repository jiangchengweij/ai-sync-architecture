import { IsString, IsOptional, IsObject, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

class SyncStrategyDto {
  @ApiProperty({ enum: ['automatic', 'semi-automatic', 'manual'] })
  @IsString()
  mode!: string;

  @ApiPropertyOptional()
  @IsOptional()
  confidenceThreshold?: number;

  @ApiPropertyOptional()
  @IsOptional()
  autoMerge?: boolean;
}

class BaseProjectDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  gitUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultBranch?: string;
}

export class CreateProjectGroupDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty()
  @ValidateNested()
  @Type(() => BaseProjectDto)
  baseProject!: BaseProjectDto;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => SyncStrategyDto)
  syncStrategy?: SyncStrategyDto;
}

export class AddVariantDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  gitUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  defaultBranch?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customizationNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString({ each: true })
  excludedPaths?: string[];
}
