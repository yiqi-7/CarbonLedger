export const CUSTOMER_MESSAGE_TYPES = {
  unauthorized: 'carbon-ledger-unauthorized',
  projects: 'carbon-ledger-projects',
  projectState: 'carbon-ledger-project-state',
} as const

export const CUSTOMER_EVENT_TYPES = {
  unauthorized: CUSTOMER_MESSAGE_TYPES.unauthorized,
} as const

export type CustomerProjectState = 'loading' | 'ready' | 'error'

export type CustomerMessage =
  | { type: typeof CUSTOMER_MESSAGE_TYPES.unauthorized }
  | { type: typeof CUSTOMER_MESSAGE_TYPES.projects }
  | { type: typeof CUSTOMER_MESSAGE_TYPES.projectState; state: CustomerProjectState; message?: string }

export interface CustomerBridge {
  hasUnsavedChanges: () => boolean
  prepareToLeave: () => Promise<boolean>
}

export interface CustomerWindow extends Window {
  carbonLedgerCustomer?: CustomerBridge
}

export function isCustomerMessage(value: unknown): value is CustomerMessage {
  if (!value || typeof value !== 'object') return false
  const message = value as Partial<CustomerMessage>
  if (message.type === CUSTOMER_MESSAGE_TYPES.unauthorized || message.type === CUSTOMER_MESSAGE_TYPES.projects) return true
  return message.type === CUSTOMER_MESSAGE_TYPES.projectState
    && (message.state === 'loading' || message.state === 'ready' || message.state === 'error')
}
