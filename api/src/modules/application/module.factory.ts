import { DEFAULT_STARTER_RESOURCES } from '../../../../lib/utils/interfaces/crafting'
import { IResourceStack } from '../../../../lib/utils/interfaces/resources'
import { IdGenerator } from '../../shared/application/id-generator'
import { MODULE_CATALOG, ModuleTemplate, STARTER_KIT } from '../domain/module-catalog'
import { UnknownModuleError } from '../domain/module.errors'
import { Module } from '../domain/module.entity'

// Builds new modules of a bot from the catalog of module templates
export class ModuleFactory {
  constructor(
    private readonly ids: IdGenerator,
    private readonly catalog: readonly ModuleTemplate[] = MODULE_CATALOG,
    private readonly starterResources: readonly IResourceStack[] = DEFAULT_STARTER_RESOURCES
  ) {}

  // The template of a module by name
  template(name: string): ModuleTemplate {
    const template = this.catalog.find((candidate) => candidate.name === name)
    if (!template) {
      throw new UnknownModuleError(name)
    }
    return template
  }

  create(name: string, botId: string): Module {
    return this.fromTemplate(this.template(name), botId)
  }

  fromTemplate(template: ModuleTemplate, botId: string): Module {
    return { ...template, props: structuredClone(template.props), id: this.ids.next(), botId }
  }

  // The equipment of a new base; its storage holds the starter resources (design §6.1)
  starterKit(botId: string): Module[] {
    return STARTER_KIT.map((name) => {
      const module = this.create(name, botId)
      return module.type === 'storage'
        ? { ...module, props: { ...module.props, items: structuredClone(this.starterResources) } }
        : module
    })
  }
}
