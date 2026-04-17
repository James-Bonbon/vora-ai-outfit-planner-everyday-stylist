/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  category?: string
  message?: string
}

const bodyTextFor = (category?: string): string => {
  switch ((category || '').toLowerCase()) {
    case 'question':
      return 'We have received your inquiry. Our team is reviewing your question and will reply personally shortly.'
    case 'feedback':
      return 'Thank you for your thoughts. VORA is shaped by the meticulous standards of our early community. We are reviewing your feedback closely.'
    case 'feature':
    case 'feature request':
      return 'Thank you for sharing your vision. The atelier is constantly evolving, and we have shared your suggestion directly with our product team.'
    case 'partnership':
      return 'Thank you for your interest in VORA. Our team is reviewing your proposal and will reach out if there is a mutual alignment.'
    default:
      return 'We have received your message. Our team will reply personally shortly.'
  }
}

// Hand-crafted HTML email — inline styles, dark luxury aesthetic.
// We bypass React Email's helper components to preserve exact markup fidelity.
const WelcomeContactConfirmation = ({ name, category, message }: Props) => {
  const bodyText = bodyTextFor(category)
  const safeName = name || 'there'
  const safeMessage = message || ''

  return (
    <html>
      <head>
        <meta charSet="utf-8" />
      </head>
      <body
        style={{
          margin: 0,
          padding: 0,
          backgroundColor: '#0A0A0A',
          color: '#EAEAEA',
          fontFamily:
            "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          WebkitFontSmoothing: 'antialiased',
        }}
      >
        <table
          width="100%"
          border={0}
          cellSpacing={0}
          cellPadding={0}
          style={{ backgroundColor: '#0A0A0A' }}
        >
          <tbody>
            <tr>
              <td align="center" style={{ padding: '80px 20px' }}>
                <table
                  width="100%"
                  border={0}
                  cellSpacing={0}
                  cellPadding={0}
                  style={{ maxWidth: '500px', textAlign: 'left' }}
                >
                  <tbody>
                    <tr>
                      <td align="center" style={{ paddingBottom: '50px' }}>
                        <h1
                          style={{
                            fontFamily: "'Georgia', serif",
                            fontSize: '22px',
                            fontWeight: 'normal',
                            letterSpacing: '8px',
                            margin: 0,
                            color: '#FFFFFF',
                            textTransform: 'uppercase',
                          }}
                        >
                          Vora
                        </h1>
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          fontSize: '15px',
                          lineHeight: '1.8',
                          color: '#CCCCCC',
                          paddingBottom: '25px',
                        }}
                      >
                        Hello {safeName},
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          fontSize: '15px',
                          lineHeight: '1.8',
                          color: '#CCCCCC',
                          paddingBottom: '35px',
                        }}
                      >
                        {bodyText}
                      </td>
                    </tr>
                    {safeMessage ? (
                      <tr>
                        <td
                          style={{
                            fontSize: '15px',
                            lineHeight: '1.8',
                            color: '#CCCCCC',
                            paddingBottom: '35px',
                          }}
                        >
                          A copy of your message:
                          <br />
                          <em style={{ color: '#888' }}>"{safeMessage}"</em>
                        </td>
                      </tr>
                    ) : null}
                    <tr>
                      <td
                        style={{
                          fontFamily: "'Georgia', serif",
                          fontStyle: 'italic',
                          fontSize: '16px',
                          color: '#FFFFFF',
                          paddingBottom: '40px',
                        }}
                      >
                        Welcome to clarity.
                      </td>
                    </tr>
                    <tr>
                      <td
                        style={{
                          fontSize: '13px',
                          letterSpacing: '1px',
                          color: '#888888',
                          textTransform: 'uppercase',
                        }}
                      >
                        The Vora Team
                        <br />
                        <a
                          href="https://vora.london"
                          style={{
                            color: '#888888',
                            textDecoration: 'none',
                            borderBottom: '1px solid #444444',
                            paddingBottom: '2px',
                            lineHeight: 2,
                          }}
                        >
                          vora.london
                        </a>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </td>
            </tr>
          </tbody>
        </table>
      </body>
    </html>
  )
}

const subjectFor = (data: Record<string, any>) => {
  const c = (data?.category || '').toLowerCase()
  switch (c) {
    case 'question':
      return 'We received your question — VORA'
    case 'feedback':
      return 'Thank you for your feedback — VORA'
    case 'feature':
    case 'feature request':
      return 'Thank you for your idea — VORA'
    case 'partnership':
      return 'Thank you for your interest — VORA'
    default:
      return 'We received your message — VORA'
  }
}

export const template = {
  component: WelcomeContactConfirmation,
  subject: subjectFor,
  displayName: 'Welcome contact — visitor confirmation',
  previewData: {
    name: 'Jane',
    category: 'feedback',
    message: 'Loving the aesthetic — would love to see a tablet view.',
  },
} satisfies TemplateEntry
