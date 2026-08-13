import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CategoriesService } from '../services/categories.service';
import { CreateCategoryDto } from '../dto/create-category.dto';
import { UpdateCategoryDto } from '../dto/update-category.dto';
import { toCategoryResponse } from '../mappers/category.mapper';
import { JwtAuthGuard } from '../../auth/jwt-auth.guard';

@ApiTags('Categories')
@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'List categories for current user' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async list(@CurrentUser('sub') userId: string) {
    const items = await this.categories.listAll(userId);
    return { success: true, data: items.map((i) => toCategoryResponse(i)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get category by id' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async get(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    const c = await this.categories.getById(userId, id);
    return { success: true, data: toCategoryResponse(c) };
  }

  @Get('type/:type')
  @ApiOperation({ summary: 'List categories by type' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async listByType(
    @CurrentUser('sub') userId: string,
    @Param('type') type: string,
  ) {
    const items = await this.categories.listByType(userId, type);
    return { success: true, data: items.map((i) => toCategoryResponse(i)) };
  }

  @Post()
  @ApiOperation({ summary: 'Create category' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async create(
    @CurrentUser('sub') userId: string,
    @Body() body: CreateCategoryDto,
  ) {
    const created = await this.categories.create(userId, body);
    return { success: true, data: toCategoryResponse(created) };
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update category' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async update(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
  ) {
    const updated = await this.categories.update(userId, id, body);
    return { success: true, data: toCategoryResponse(updated) };
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Soft delete category' })
  @ApiBearerAuth('jwt')
  @UseGuards(JwtAuthGuard)
  async delete(
    @CurrentUser('sub') userId: string,
    @Param('id') id: string,
  ) {
    await this.categories.softDelete(userId, id);
    return { success: true };
  }
}
