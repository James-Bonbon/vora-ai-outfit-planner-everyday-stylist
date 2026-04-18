/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ confirmationUrl }: MagicLinkEmailProps) => (
  <html>
    <head><meta charSet="utf-8" /></head>
    <body style={{ margin: 0, padding: 0, backgroundColor: '#0A0A0A', color: '#EAEAEA', fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif", WebkitFontSmoothing: 'antialiased' }}>
      <table width="100%" border={0} cellSpacing={0} cellPadding={0} style={{ backgroundColor: '#0A0A0A' }}>
        <tbody><tr><td align="center" style={{ padding: '80px 20px' }}>
          <table width="100%" border={0} cellSpacing={0} cellPadding={0} style={{ maxWidth: '500px', textAlign: 'left' }}>
            <tbody>
              <tr><td align="center" style={{ paddingBottom: '50px' }}>
                <h1 style={{ fontFamily: "'Georgia', serif", fontSize: '22px', fontWeight: 'normal', letterSpacing: '8px', margin: 0, color: '#FFFFFF', textTransform: 'uppercase' }}>Vora</h1>
              </td></tr>
              <tr><td style={{ fontSize: '15px', lineHeight: '1.8', color: '#CCCCCC', paddingBottom: '25px' }}>Hello,</td></tr>
              <tr><td style={{ fontSize: '15px', lineHeight: '1.8', color: '#CCCCCC', paddingBottom: '35px' }}>
                Your access link is ready. Tap the button below to sign in. This link will expire shortly for your security.
              </td></tr>
              <tr><td align="center" style={{ paddingBottom: '40px' }}>
                <a href={confirmationUrl} style={{ display: 'inline-block', backgroundColor: '#FFFFFF', color: '#0A0A0A', fontSize: '12px', letterSpacing: '3px', textTransform: 'uppercase', textDecoration: 'none', padding: '16px 36px', fontWeight: 500 }}>Sign In</a>
              </td></tr>
              <tr><td style={{ fontFamily: "'Georgia', serif", fontStyle: 'italic', fontSize: '16px', color: '#FFFFFF', paddingBottom: '40px' }}>Welcome to clarity.</td></tr>
              <tr><td style={{ fontSize: '13px', letterSpacing: '1px', color: '#888888', textTransform: 'uppercase' }}>
                The Vora Team<br />
                <a href="https://vora.london" style={{ color: '#888888', textDecoration: 'none', borderBottom: '1px solid #444444', paddingBottom: '2px', lineHeight: 2 }}>vora.london</a>
              </td></tr>
            </tbody>
          </table>
        </td></tr></tbody>
      </table>
    </body>
  </html>
)

export default MagicLinkEmail
