import { useTranslations } from 'next-intl'

// What a BotOS command does, in the player's language (the same texts as the terminal's help)
export function useCommandDescription() {
  const t = useTranslations('terminal')

  return (command: string) => (t.has(`commands.${command}`) ? t(`commands.${command}`) : '')
}
