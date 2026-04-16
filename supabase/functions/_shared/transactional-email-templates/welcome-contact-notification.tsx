/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  email?: string
  category?: string
  message?: string
}

const categoryLabel = (c?: string) => {
  switch (c) {
    case 'question': return 'Question'
    case 'feedback': return 'Feedback'
    case 'feature': return 'Feature Request'
    case 'partnership': return 'Partnership'
    default: return 'Message'
  }
}

const WelcomeContactNotification = ({ name, email, category, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New {categoryLabel(category)} from {name || 'a visitor'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New welcome page message</Heading>

        <Section style={meta}>
          <Text style={row}><b>Type:</b> {categoryLabel(category)}</Text>
          <Text style={row}><b>Name:</b> {name || '—'}</Text>
          <Text style={row}><b>Email:</b> {email || '—'}</Text>
        </Section>

        <Hr style={hr} />

        <Text style={label}>Message</Text>
        <Text style={messageStyle}>{message || '(empty)'}</Text>

        <Hr style={hr} />
        <Text style={footer}>
          Reply directly to {email || 'the sender'} to respond.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeContactNotification,
  subject: (data: Record<string, any>) =>
    `New ${categoryLabel(data?.category)} from ${data?.name || 'visitor'} — VORA`,
  displayName: 'Welcome contact — admin notification',
  previewData: {
    name: 'Jane Doe',
    email: 'jane@example.com',
    category: 'partnership',
    message: 'Hi — I run a boutique in London and would love to discuss a collab.',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '40px 28px',
}
const h1: React.CSSProperties = {
  fontSize: '20px',
  fontWeight: 600,
  color: '#0a0a0a',
  margin: '0 0 24px',
}
const meta: React.CSSProperties = { margin: '0 0 8px' }
const row: React.CSSProperties = {
  fontSize: '14px',
  color: '#3a3a3a',
  lineHeight: '1.7',
  margin: '0 0 4px',
}
const label: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '1.5px',
  textTransform: 'uppercase',
  color: '#999999',
  margin: '0 0 8px',
}
const messageStyle: React.CSSProperties = {
  fontSize: '14px',
  color: '#0a0a0a',
  lineHeight: '1.7',
  margin: 0,
  whiteSpace: 'pre-wrap',
}
const hr: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #ececec',
  margin: '24px 0',
}
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  margin: 0,
}
