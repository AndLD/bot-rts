import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AuthModule } from '../auth/auth.module'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { BLUEPRINT_REPOSITORY, BlueprintRepository } from './application/blueprint.repository'
import { ITEM_REPOSITORY } from './application/item.repository'
import { RecipeService } from './application/recipe.service'
import { CRAFTING_CONFIG, CraftingConfig } from './domain/crafting-config'
import { RecipeBook } from './domain/recipe-book'
import { PrismaBlueprintRepository } from './infrastructure/prisma-blueprint.repository'
import { PrismaItemRepository } from './infrastructure/prisma-item.repository'
import { CraftingController } from './presentation/crafting.controller'

@Module({
  imports: [AuthModule],
  controllers: [CraftingController],
  providers: [
    { provide: CRAFTING_CONFIG, inject: [APP_CONFIG], useFactory: (config: AppConfig) => config.crafting },
    {
      provide: RecipeBook,
      inject: [CRAFTING_CONFIG],
      useFactory: ({ recipes, balance }: CraftingConfig) => new RecipeBook(recipes, balance)
    },
    {
      provide: BLUEPRINT_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaBlueprintRepository(client)
    },
    {
      provide: ITEM_REPOSITORY,
      inject: [PRISMA_CLIENT],
      useFactory: (client: PrismaClient) => new PrismaItemRepository(client)
    },
    {
      provide: RecipeService,
      inject: [RecipeBook, BLUEPRINT_REPOSITORY],
      useFactory: (book: RecipeBook, blueprints: BlueprintRepository) => new RecipeService(book, blueprints)
    }
  ],
  exports: [RecipeBook, RecipeService, BLUEPRINT_REPOSITORY, ITEM_REPOSITORY]
})
export class CraftingModule {}
