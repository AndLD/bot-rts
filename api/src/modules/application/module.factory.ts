import { IdGenerator } from '../../shared/application/id-generator'
import { MODULE_CATALOG, ModuleTemplate, STARTER_KIT } from '../domain/module-catalog'
import { UnknownModuleError } from '../domain/module.errors'
import { Module } from '../domain/module.entity'

// Builds new modules of a bot from the catalog of module templates
export class ModuleFactory {
  constructor(
    private readonly ids: IdGenerator,
    private readonly catalog: readonly ModuleTemplate[] = MODULE_CATALOG
  ) {}

  create(name: string, botId: string): Module {
    const template = this.catalog.find((candidate) => candidate.name === name)
    if (!template) {
      throw new UnknownModuleError(name)
    }
    return this.fromTemplate(template, botId)
  }

  fromTemplate(template: ModuleTemplate, botId: string): Module {
    return { ...template, props: structuredClone(template.props), id: this.ids.next(), botId }
  }

  // The equipment of a new base
  starterKit(botId: string): Module[] {
    return STARTER_KIT.map((name) => this.create(name, botId))
  }
}
