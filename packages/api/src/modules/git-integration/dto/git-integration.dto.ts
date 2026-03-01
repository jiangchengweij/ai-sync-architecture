import { IsString, IsOptional, IsObject } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class GitHubPushEventDto {
  @ApiProperty()
  @IsString()
  ref!: string;

  @ApiProperty()
  @IsString()
  after!: string;

  @ApiProperty()
  @IsString()
  before!: string;

  @ApiProperty()
  @IsObject()
  repository!: {
    id: number;
    full_name: string;
    clone_url: string;
    default_branch: string;
  };

  @ApiProperty()
  @IsObject()
  pusher!: { name: string; email: string };

  @ApiPropertyOptional()
  @IsOptional()
  commits?: Array<{
    id: string;
    message: string;
    added: string[];
    removed: string[];
    modified: string[];
  }>;
}

export class RegisterWebhookDto {
  @ApiProperty()
  @IsString()
  projectGroupId!: string;

  @ApiProperty()
  @IsString()
  gitUrl!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  secret?: string;
}
