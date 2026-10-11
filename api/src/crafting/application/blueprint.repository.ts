import { Blueprint } from '../domain/blueprint.entity'

export const BLUEPRINT_REPOSITORY = Symbol('BlueprintRepository')

export interface BlueprintRepository {
  // Learning something already known changes nothing
  add(blueprint: Blueprint): Promise<void>
  listOfUser(userId: string): Promise<Blueprint[]>
}
