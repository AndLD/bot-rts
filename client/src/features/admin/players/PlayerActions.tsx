'use client'

import { Button, Form, Input, Select, Space } from 'antd'
import { useState } from 'react'
import { useTranslations } from 'next-intl'
import type { IPlayerProfile } from '@lib/utils/admin-players'
import { AdminPermission, hasPermission } from '@lib/utils/admin'
import { USER_STATUSES, UserStatus } from '@lib/utils/interfaces/users'
import {
  usePlayersBanMutation,
  usePlayersChangeRoleMutation,
  usePlayersLogoutMutation,
  usePlayersRemoveMutation,
  usePlayersResendVerificationMutation,
  usePlayersResetPasswordMutation,
  usePlayersUnbanMutation,
  useSupervisionQuarantineMutation
} from '../../../shared/api'
import { useErrorMessage } from '../../../shared/errors'
import { errorNotification } from '../../../shared/notifications'
import { useAdminMe } from '../admin-me-context'
import ActionModal, { ActionValues } from './ActionModal'

type ActionName =
  'ban' | 'unban' | 'quarantine' | 'logout' | 'resendVerification' | 'resetPassword' | 'changeRole' | 'delete'

// How long a ban lasts, in hours; 0 is until an admin lifts it
const BAN_HOURS = [1, 24, 24 * 7, 24 * 30, 0] as const
// "banned" is a ban, not a role
const ROLES = USER_STATUSES.filter((status) => status !== 'banned')

const PERMISSION: Record<ActionName, AdminPermission> = {
  ban: 'players.ban',
  unban: 'players.ban',
  quarantine: 'supervision.quarantine',
  logout: 'players.logout',
  resendVerification: 'players.resend-verification',
  resetPassword: 'players.reset-password',
  changeRole: 'players.change-role',
  delete: 'players.delete'
}

// The moderation actions of a player; an action shows only to a role that holds its permission
export default function PlayerActions({ player }: { player: IPlayerProfile }) {
  const t = useTranslations('admin.players')
  const getErrorMessage = useErrorMessage()
  const { role } = useAdminMe()
  const [open, setOpen] = useState<ActionName | null>(null)
  const [ban, banState] = usePlayersBanMutation()
  const [unban, unbanState] = usePlayersUnbanMutation()
  const [quarantine, quarantineState] = useSupervisionQuarantineMutation()
  const [logout, logoutState] = usePlayersLogoutMutation()
  const [resendVerification, resendState] = usePlayersResendVerificationMutation()
  const [resetPassword, resetState] = usePlayersResetPasswordMutation()
  const [changeRole, roleState] = usePlayersChangeRoleMutation()
  const [remove, removeState] = usePlayersRemoveMutation()
  const id = player._id
  const isBanned = player.status === 'banned'

  const run: Record<ActionName, (values: ActionValues) => Promise<{ error?: unknown }>> = {
    ban: ({ reason, hours }) => ban({ id, banPlayerDto: { reason, durationHours: (hours as number) || undefined } }),
    unban: ({ reason }) => unban({ id, reasonDto: { reason } }),
    quarantine: ({ reason }) => quarantine({ id, reasonDto: { reason } }),
    logout: ({ reason }) => logout({ id, reasonDto: { reason } }),
    resendVerification: ({ reason }) => resendVerification({ id, reasonDto: { reason } }),
    resetPassword: ({ reason }) => resetPassword({ id, reasonDto: { reason } }),
    changeRole: ({ reason, role: newRole }) =>
      changeRole({ id, changeRoleDto: { reason, role: newRole as UserStatus } }),
    delete: ({ reason, confirmEmail }) =>
      remove({ id, deletePlayerDto: { reason, confirmEmail: confirmEmail as string } })
  }
  const loading: Record<ActionName, boolean> = {
    ban: banState.isLoading,
    unban: unbanState.isLoading,
    quarantine: quarantineState.isLoading,
    logout: logoutState.isLoading,
    resendVerification: resendState.isLoading,
    resetPassword: resetState.isLoading,
    changeRole: roleState.isLoading,
    delete: removeState.isLoading
  }

  async function submit(values: ActionValues) {
    const result = await run[open as ActionName](values)

    if (result.error) {
      const body = (result.error as { data?: { code?: string; error?: string } }).data
      errorNotification(getErrorMessage({ code: body?.code, message: body?.error }))
      return
    }
    setOpen(null)
  }

  const visible = (name: ActionName) =>
    hasPermission(role, PERMISSION[name]) &&
    !player.isDeleted &&
    (name === 'unban' ? isBanned : name === 'ban' ? !isBanned : true)

  const button = (name: ActionName, danger = false) =>
    visible(name) ? (
      <Button key={name} danger={danger} onClick={() => setOpen(name)}>
        {t(`action.${name}.button`)}
      </Button>
    ) : null

  return (
    <>
      <Space wrap>
        {button('ban', true)}
        {button('unban')}
        {button('quarantine')}
        {button('logout')}
        {button('resendVerification')}
        {button('resetPassword')}
        {button('changeRole')}
        {button('delete', true)}
      </Space>
      {open ? (
        <ActionModal
          title={t(`action.${open}.title`)}
          isOpen
          isLoading={loading[open]}
          initialValues={{ hours: 24, role: player.status === 'banned' ? 'user' : player.status }}
          onSubmit={submit}
          onCancel={() => setOpen(null)}
        >
          {open === 'ban' ? (
            <Form.Item name="hours" label={t('action.ban.duration')}>
              <Select
                options={BAN_HOURS.map((hours) => ({
                  value: hours,
                  label: hours === 0 ? t('action.ban.permanent') : t('action.ban.hours', { hours })
                }))}
              />
            </Form.Item>
          ) : null}
          {open === 'changeRole' ? (
            <Form.Item name="role" label={t('action.changeRole.role')}>
              <Select options={ROLES.map((value) => ({ value, label: t(`status.${value}`) }))} />
            </Form.Item>
          ) : null}
          {open === 'delete' ? (
            <Form.Item
              name="confirmEmail"
              label={t('action.delete.confirm', { email: player.email })}
              rules={[{ required: true, type: 'email' }]}
            >
              <Input autoComplete="off" />
            </Form.Item>
          ) : null}
        </ActionModal>
      ) : null}
    </>
  )
}
