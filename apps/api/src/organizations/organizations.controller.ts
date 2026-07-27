import {
  Body, Controller, Delete, Get, Param, Post, Put, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { CreateOrganizationDto, UpdateOrganizationDto } from './organizations.dto';
import { OrganizationsService } from './organizations.service';

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly organizations: OrganizationsService) {}

  @Get()
  async list(@CurrentUser() user: { id: string }) {
    return this.organizations.list(user.id);
  }

  @Get(':id')
  async get(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.organizations.get(user.id, id);
  }

  @Post()
  async create(@CurrentUser() user: { id: string }, @Body() dto: CreateOrganizationDto) {
    return this.organizations.create(user.id, dto);
  }

  @Put(':id')
  async update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizations.update(user.id, id, dto);
  }

  @Delete(':id')
  async remove(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Query('purgeStatements') purgeStatements?: string,
  ) {
    return this.organizations.remove(user.id, id, purgeStatements === 'true');
  }

  @Post(':id/sample-slip')
  @UseInterceptors(FileInterceptor('file'))
  async uploadSampleSlip(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('pdfPassword') pdfPassword?: string,
  ) {
    return this.organizations.uploadSampleSlip(user.id, id, file, pdfPassword);
  }

  @Post(':id/test-parser')
  @UseInterceptors(FileInterceptor('file'))
  async testParser(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Body('pdfPassword') pdfPassword?: string,
    @Body('configJson') configJson?: string,
  ) {
    let parsedConfig: any;
    if (configJson) {
      try {
        parsedConfig = JSON.parse(configJson);
      } catch {
        // ignore
      }
    }
    return this.organizations.testParser(user.id, id, file, parsedConfig, pdfPassword);
  }
}
