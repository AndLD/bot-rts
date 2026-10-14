import { Controller, Get } from '@nestjs/common'
import { ApiBearerAuth, ApiDefaultResponse, ApiOkResponse, ApiTags } from '@nestjs/swagger'
import { Principal } from '../../auth/application/auth.service'
import { CurrentPrincipal } from '../../auth/presentation/current-principal.decorator'
import { ErrorResponseModel } from '../../shared/presentation/error-response.model'
import { RecipeService, RecipeView } from '../application/recipe.service'
import { RecipeResponse } from './recipe.response'
import { RequireScope } from '../../apikeys/presentation/scope.decorator'

@ApiTags('crafting')
@ApiDefaultResponse({ type: ErrorResponseModel })
@ApiBearerAuth()
@Controller({ path: 'crafting', version: '1' })
export class CraftingController {
  constructor(private readonly recipes: RecipeService) {}

  // Every recipe of the game, with what the player knows of it (design §9.3)
  @ApiOkResponse({ type: [RecipeResponse] })
  @RequireScope('read')
  @Get('recipes')
  recipeList(@CurrentPrincipal() { user }: Principal): Promise<RecipeView[]> {
    return this.recipes.listFor(user.id)
  }
}
