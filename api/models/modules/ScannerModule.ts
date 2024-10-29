import { IScannerModule, IScannerModuleProps, ModuleType } from '../../utils/interfaces/modules'
import Module from './Module'

export default class ScannerClass extends Module implements IScannerModule {
  type: ModuleType = 'scanner'
  distance!: number
  delay!: number

  constructor(props: IScannerModuleProps) {
    super(props)
  }

  async scan() {
    return []
  }
}
