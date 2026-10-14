export const INACTIVITY_NOTIFIER = Symbol('InactivityNotifier')

export interface InactivityNotifier {
  // Tells the player the account will be erased on `eraseOn` unless they sign in before
  sendNotice(to: string, name: string, eraseOn: Date): Promise<void>
}
