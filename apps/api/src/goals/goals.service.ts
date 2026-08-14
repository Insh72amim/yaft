import { Injectable, NotFoundException } from '@nestjs/common';
import { GoalStatus } from '@prisma/client';
import { PrismaService } from '../common/prisma.service';
import { CreateContributionDto, CreateGoalDto, UpdateGoalDto } from './goals.dto';

function rupeesToPaise(rupees: number): bigint {
  return BigInt(Math.round(rupees * 100));
}

function monthsBetween(from: Date, to: Date): number {
  return (
    (to.getFullYear() - from.getFullYear()) * 12 +
    (to.getMonth() - from.getMonth())
  );
}

@Injectable()
export class GoalsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string) {
    const goals = await this.prisma.financialGoal.findMany({
      where: { userId },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
      include: {
        contributions: {
          orderBy: { date: 'desc' },
        },
      },
    });

    return goals.map((goal) => this.enrichGoal(goal));
  }

  async create(userId: string, dto: CreateGoalDto) {
    const goal = await this.prisma.financialGoal.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description ?? null,
        targetAmount: rupeesToPaise(dto.targetAmount),
        targetDate: dto.targetDate ? new Date(dto.targetDate) : null,
      },
      include: { contributions: true },
    });
    return this.enrichGoal(goal);
  }

  async update(userId: string, id: string, dto: UpdateGoalDto) {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Goal not found.');

    const updated = await this.prisma.financialGoal.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.targetAmount !== undefined && { targetAmount: rupeesToPaise(dto.targetAmount) }),
        ...(dto.targetDate !== undefined && { targetDate: dto.targetDate ? new Date(dto.targetDate) : null }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
      include: { contributions: { orderBy: { date: 'desc' } } },
    });
    return this.enrichGoal(updated);
  }

  async delete(userId: string, id: string) {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Goal not found.');
    await this.prisma.financialGoal.delete({ where: { id } });
  }

  async addContribution(userId: string, goalId: string, dto: CreateContributionDto) {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new NotFoundException('Goal not found.');

    await this.prisma.goalContribution.create({
      data: {
        goalId,
        amount: rupeesToPaise(dto.amount),
        note: dto.note ?? null,
        date: dto.date ? new Date(dto.date) : new Date(),
      },
    });

    const updated = await this.prisma.financialGoal.findFirst({
      where: { id: goalId },
      include: { contributions: { orderBy: { date: 'desc' } } },
    });
    return this.enrichGoal(updated!);
  }

  async deleteContribution(userId: string, goalId: string, contributionId: string) {
    const goal = await this.prisma.financialGoal.findFirst({ where: { id: goalId, userId } });
    if (!goal) throw new NotFoundException('Goal not found.');

    const contribution = await this.prisma.goalContribution.findFirst({
      where: { id: contributionId, goalId },
    });
    if (!contribution) throw new NotFoundException('Contribution not found.');

    await this.prisma.goalContribution.delete({ where: { id: contributionId } });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private enrichGoal(goal: {
    id: string;
    name: string;
    description: string | null;
    targetAmount: bigint;
    targetDate: Date | null;
    status: GoalStatus;
    createdAt: Date;
    updatedAt: Date;
    contributions: Array<{
      id: string;
      amount: bigint;
      note: string | null;
      date: Date;
      createdAt: Date;
    }>;
  }) {
    const targetPaise = Number(goal.targetAmount);
    const savedPaise = goal.contributions.reduce((sum, c) => sum + Number(c.amount), 0);
    const remainingPaise = Math.max(0, targetPaise - savedPaise);
    const percentage = targetPaise > 0 ? Math.min(100, Math.round((savedPaise / targetPaise) * 100)) : 0;

    // Monthly savings needed to reach goal by target date
    let monthlyNeededPaise: number | null = null;
    let daysLeft: number | null = null;
    if (goal.targetDate) {
      const now = new Date();
      daysLeft = Math.max(0, Math.ceil((goal.targetDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
      const months = monthsBetween(now, goal.targetDate);
      if (months > 0 && remainingPaise > 0) {
        monthlyNeededPaise = Math.ceil(remainingPaise / months);
      } else if (months <= 0) {
        monthlyNeededPaise = remainingPaise; // overdue — full remaining due now
      } else {
        monthlyNeededPaise = 0; // already achieved
      }
    }

    return {
      id: goal.id,
      name: goal.name,
      description: goal.description,
      targetAmount: targetPaise,
      targetDate: goal.targetDate ? goal.targetDate.toISOString() : null,
      status: goal.status,
      createdAt: goal.createdAt.toISOString(),
      updatedAt: goal.updatedAt.toISOString(),
      savedAmount: savedPaise,
      remainingAmount: remainingPaise,
      percentage,
      monthlyNeeded: monthlyNeededPaise,
      daysLeft,
      contributions: goal.contributions.map((c) => ({
        id: c.id,
        amount: Number(c.amount),
        note: c.note,
        date: c.date.toISOString(),
        createdAt: c.createdAt.toISOString(),
      })),
    };
  }
}
