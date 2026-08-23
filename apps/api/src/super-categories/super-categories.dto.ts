import { CategoryType } from '@prisma/client';

export class CreateSuperCategoryDto {
  name: string;
  kind?: CategoryType;
  color?: string;
  icon?: string;
  order?: number;
}

export class UpdateSuperCategoryDto {
  name?: string;
  kind?: CategoryType;
  color?: string;
  icon?: string;
  order?: number;
}
