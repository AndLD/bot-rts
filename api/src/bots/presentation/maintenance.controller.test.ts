import { ItemType } from '../../../../lib/utils/interfaces/items'
import { Principal } from '../../auth/application/auth.service'
import { MaintenanceService } from '../application/maintenance.service'
import { MaintenanceController } from './maintenance.controller'

const principal = { user: { id: 'user-1' } } as Principal
const body = { targetBotId: 'bot-2', moduleId: 'module-1' }

describe('MaintenanceController.disassemble', () => {
  it('answers the scrap and the blueprint item that was found', async () => {
    const service = {
      disassemble: jest.fn().mockResolvedValue({
        scrap: [{ resource: 'iron', amount: 20 }],
        blueprint: { id: 'item-1', type: ItemType.BLUEPRINT, name: 'gun-class1', weight: 0.1, botId: 'bot-1' }
      })
    }
    const controller = new MaintenanceController(service as unknown as MaintenanceService)

    expect(await controller.disassemble(principal, 'bot-1', body)).toEqual({
      scrap: [{ resource: 'iron', amount: 20 }],
      blueprint: { _id: 'item-1', type: 'blueprint', name: 'gun-class1', weight: 0.1 }
    })
    expect(service.disassemble).toHaveBeenCalledWith('user-1', { repairerId: 'bot-1', ...body })
  })

  it('answers no blueprint when none was found', async () => {
    const service = { disassemble: jest.fn().mockResolvedValue({ scrap: [], blueprint: null }) }
    const controller = new MaintenanceController(service as unknown as MaintenanceService)

    expect(await controller.disassemble(principal, 'bot-1', body)).toEqual({ scrap: [], blueprint: null })
  })
})
