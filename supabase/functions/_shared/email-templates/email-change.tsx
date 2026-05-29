/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface EmailChangeEmailProps {
  siteName: string
  // oldEmail is the user's current address (HookData.OldEmail). For the
  // NEW-recipient half of a secure email_change fanout, `email` equals the
  // recipient (NEW), so the "from" line must render oldEmail to read
  // "from OLD to NEW" instead of "from NEW to NEW".
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({
  siteName,
  oldEmail,
  newEmail,
  confirmationUrl,
}: EmailChangeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Konfirmasi perubahan email {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandBar}>{siteName}</div>
        <Heading style={h1}>Konfirmasi perubahan email</Heading>
        <Text style={text}>
          Kamu meminta perubahan alamat email akun {siteName} dari{' '}
          <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link>{' '}
          ke{' '}
          <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>.
        </Text>
        <Text style={text}>
          Klik tombol di bawah untuk mengonfirmasi perubahan ini:
        </Text>
        <Button style={button} href={confirmationUrl}>
          Konfirmasi Email Baru
        </Button>
        <Text style={footer}>
          Jika kamu tidak meminta perubahan ini, segera amankan akun kamu
          dengan mengganti password.
        </Text>
        <Text style={brandFooter}>© {siteName} • Jhonaley Store</Text>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", -apple-system, Segoe UI, Roboto, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brandBar = {
  display: 'inline-block',
  background: 'linear-gradient(135deg, #e11d48, #9333ea)',
  color: '#ffffff',
  fontSize: '13px',
  fontWeight: 700,
  letterSpacing: '0.5px',
  padding: '6px 14px',
  borderRadius: '999px',
  marginBottom: '24px',
}
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const link = { color: '#e11d48', textDecoration: 'underline', fontWeight: 600 }
const button = {
  background: 'linear-gradient(135deg, #e11d48, #9333ea)',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: 600,
  borderRadius: '12px',
  padding: '14px 26px',
  textDecoration: 'none',
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0', lineHeight: '1.5' }
const brandFooter = { fontSize: '11px', color: '#cbd5e1', margin: '24px 0 0', textAlign: 'center' as const }
