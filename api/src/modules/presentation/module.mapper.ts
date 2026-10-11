import { ModuleProps } from '../../../../lib/utils/interfaces/modules'
import { Module } from '../domain/module.entity'

// Flattens the type-specific properties next to the common ones, the shape the client and scripts see
export function toModuleDto({ id, props, ...common }: Module): ModuleProps {
  return { ...common, ...props, _id: id } as unknown as ModuleProps
}
