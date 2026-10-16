import { IAlert } from '../../../../lib/utils/admin'
import { Alert } from '../domain/alert'

export const toAlertDto = ({ id, openedAt, clearedAt, acknowledgedAt, ...alert }: Alert): IAlert => ({
  _id: id,
  ...alert,
  openedAt: openedAt.getTime(),
  clearedAt: clearedAt?.getTime() ?? null,
  acknowledgedAt: acknowledgedAt?.getTime() ?? null
})
