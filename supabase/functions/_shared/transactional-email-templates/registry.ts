/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as welcomeContactConfirmation } from './welcome-contact-confirmation.tsx'
import { template as welcomeContactNotification } from './welcome-contact-notification.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'welcome-contact-confirmation': welcomeContactConfirmation,
  'welcome-contact-notification': welcomeContactNotification,
}
