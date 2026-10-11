import { Module } from '@nestjs/common'
import { PrismaClient } from '@prisma/client'
import { AuthModule } from '../auth/auth.module'
import { ModuleFactory } from '../modules/application/module.factory'
import { ModuleRegistry } from '../modules/domain/module-registry'
import { ModulesModule } from '../modules/modules.module'
import { UNIT_OF_WORK, UnitOfWork } from '../persistence/application/unit-of-work'
import { ID_GENERATOR, IdGenerator } from '../shared/application/id-generator'
import { APP_CONFIG, AppConfig } from '../config/app-config'
import { CLOCK, Clock } from '../shared/application/clock'
import { PRISMA_CLIENT } from '../persistence/infrastructure/prisma-client'
import { BLUEPRINT_REPOSITORY, BlueprintRepository } from './application/blueprint.repository'
import { ITEM_REPOSITORY } from './application/item.repository'
import { FactorySettler } from './application/factory-settler'
import { RecipeService } from './application/recipe.service'
import { CRAFTING_CONFIG, CraftingConfig } from './domain/crafting-config'
import { RecipeBook } from './domain/recipe-book'
import { PrismaBlueprintRepository } from './infrastructure/prisma-blueprint.repository'
import { PrismaItemRepository } from './infrastructure/prisma-item.repository'
import { CraftingController } from './presentation/crafting.controller'

@Module({
  imports: [AuthModule, ModulesModule],
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
      provide: FactorySettler,
      inject: [UNIT_OF_WORK, ModuleRegistry, ID_GENERATOR, CLOCK, ModuleFactory],
      useFactory: (
        unitOfWork: UnitOfWork,
        registry: ModuleRegistry,
        ids: IdGenerator,
        clock: Clock,
        moduleFactory: ModuleFactory
      ) => new FactorySettler(unitOfWork, registry, ids, clock, moduleFactory)
    },
    {
      provide: RecipeService,
      inject: [RecipeBook, BLUEPRINT_REPOSITORY, FactorySettler],
      useFactory: (book: RecipeBook, blueprints: BlueprintRepository, settler: FactorySettler) =>
        new RecipeService(book, blueprints, settler)
    }
  ],
  exports: [RecipeBook, RecipeService, FactorySettler, BLUEPRINT_REPOSITORY, ITEM_REPOSITORY]
})
export class CraftingModule {}
