import { MonitoringService } from '../application/monitoring.service'
import { Alert } from '../domain/alert'
import { MonitoringController } from './monitoring.controller'

const alert: Alert = {
  id: 'a1',
  metric: 'engine.up',
  area: 'engine',
  severity: 'red',
  value: 0,
  threshold: 1,
  openedAt: new Date(1000),
  clearedAt: new Date(2000),
  acknowledgedAt: new Date(1500),
  acknowledgedBy: 'admin-1'
}

describe('MonitoringController', () => {
  it('turns dates into milliseconds and keeps absent ones null', () => {
    const open: Alert = { ...alert, clearedAt: null, acknowledgedAt: null, acknowledgedBy: null }
    const service = {
      health: () => ({ sampledAt: new Date(5000), status: 'red', areas: [], alerts: [open] }),
      listAlerts: () => [alert]
    } as unknown as MonitoringService
    const controller = new MonitoringController(service)

    expect(controller.health()).toMatchObject({
      sampledAt: 5000,
      alerts: [{ _id: 'a1', openedAt: 1000, clearedAt: null }]
    })
    expect(controller.alerts()).toEqual([
      expect.objectContaining({ _id: 'a1', clearedAt: 2000, acknowledgedAt: 1500, acknowledgedBy: 'admin-1' })
    ])
  })

  it('reports no sample time before the first sample', () => {
    const service = {
      health: () => ({ sampledAt: null, status: 'green', areas: [], alerts: [] })
    } as unknown as MonitoringService

    expect(new MonitoringController(service).health().sampledAt).toBeNull()
  })
})
