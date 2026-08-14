import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import { JwtAuthGuard } from '../auth/auth.guard';
import { GoalsService } from './goals.service';
import { CreateContributionDto, CreateGoalDto, UpdateGoalDto } from './goals.dto';

@Controller('goals')
@UseGuards(JwtAuthGuard)
export class GoalsController {
  constructor(private readonly goals: GoalsService) {}

  @Get()
  list(@CurrentUser() user: { id: string }) {
    return this.goals.list(user.id);
  }

  @Post()
  create(@CurrentUser() user: { id: string }, @Body() dto: CreateGoalDto) {
    return this.goals.create(user.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: { id: string },
    @Param('id') id: string,
    @Body() dto: UpdateGoalDto,
  ) {
    return this.goals.update(user.id, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  delete(@CurrentUser() user: { id: string }, @Param('id') id: string) {
    return this.goals.delete(user.id, id);
  }

  @Post(':id/contributions')
  addContribution(
    @CurrentUser() user: { id: string },
    @Param('id') goalId: string,
    @Body() dto: CreateContributionDto,
  ) {
    return this.goals.addContribution(user.id, goalId, dto);
  }

  @Delete(':id/contributions/:cid')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteContribution(
    @CurrentUser() user: { id: string },
    @Param('id') goalId: string,
    @Param('cid') contributionId: string,
  ) {
    return this.goals.deleteContribution(user.id, goalId, contributionId);
  }
}
