/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Section, Text, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'VORA'

interface Props {
  name?: string
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

const WelcomeContactConfirmation = ({ name, category, message }: Props) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>We received your message — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={brand}>{SITE_NAME}</Heading>

        <Heading style={h1}>
          {name ? `Thank you, ${name}.` : 'Thank you for reaching out.'}
        </Heading>

        <Text style={text}>
          We've received your message and a member of the atelier will respond
          personally, usually within 1–2 business days.
        </Text>

        {message ? (
          <Section style={quote}>
            <Text style={quoteLabel}>{categoryLabel(category)}</Text>
            <Text style={quoteText}>{message}</Text>
          </Section>
        ) : null}

        <Hr style={hr} />
        <Text style={footer}>
          With care,<br />The {SITE_NAME} Team
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeContactConfirmation,
  subject: 'We received your message — VORA',
  displayName: 'Welcome contact — visitor confirmation',
  previewData: {
    name: 'Jane',
    category: 'feedback',
    message: 'Loving the aesthetic — would love to see a tablet view.',
  },
} satisfies TemplateEntry

const main: React.CSSProperties = {
  backgroundColor: '#ffffff',
  fontFamily: 'Helvetica Neue, Helvetica, Arial, sans-serif',
  margin: 0,
  padding: 0,
}
const container: React.CSSProperties = {
  maxWidth: '520px',
  margin: '0 auto',
  padding: '48px 28px',
}
const brand: React.CSSProperties = {
  fontSize: '14px',
  letterSpacing: '6px',
  fontWeight: 300,
  color: '#c9a96e',
  margin: '0 0 32px',
  textTransform: 'uppercase',
  textAlign: 'center',
}
const h1: React.CSSProperties = {
  fontSize: '24px',
  fontWeight: 400,
  color: '#0a0a0a',
  margin: '0 0 20px',
  lineHeight: '1.3',
}
const text: React.CSSProperties = {
  fontSize: '15px',
  color: '#55575d',
  lineHeight: '1.7',
  margin: '0 0 24px',
}
const quote: React.CSSProperties = {
  borderLeft: '2px solid #c9a96e',
  padding: '4px 16px',
  margin: '24px 0',
  backgroundColor: '#fafaf8',
}
const quoteLabel: React.CSSProperties = {
  fontSize: '10px',
  letterSpacing: '2px',
  textTransform: 'uppercase',
  color: '#c9a96e',
  margin: '0 0 6px',
}
const quoteText: React.CSSProperties = {
  fontSize: '14px',
  color: '#3a3a3a',
  lineHeight: '1.6',
  margin: 0,
  whiteSpace: 'pre-wrap',
}
const hr: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #ececec',
  margin: '32px 0 20px',
}
const footer: React.CSSProperties = {
  fontSize: '12px',
  color: '#999999',
  lineHeight: '1.6',
  margin: 0,
}
