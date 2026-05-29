/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Img,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Reset password akun {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img src="https://qjkaoghqatkminsufqfn.supabase.co/storage/v1/object/public/email-assets/logo.png" width="72" height="72" alt={siteName} style={logo} />
        <div style={brandBar}>{siteName}</div>
        <Heading style={h1}>Reset password kamu</Heading>
        <Text style={text}>
          Kami menerima permintaan reset password untuk akun {siteName} kamu.
          Klik tombol di bawah untuk membuat password baru.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Reset Password
        </Button>
        <Text style={footer}>
          Jika kamu tidak meminta reset password, abaikan email ini —
          password kamu tidak akan berubah.
        </Text>
        <Text style={brandFooter}>© {siteName} • Jhonaley Store</Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", -apple-system, Segoe UI, Roboto, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const logo = { display: 'block', margin: '0 auto 16px', borderRadius: '50%' }
const brandBar = { display: 'inline-block', background: 'linear-gradient(135deg, #e11d48, #9333ea)', color: '#ffffff', fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', padding: '6px 14px', borderRadius: '999px', marginBottom: '24px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const button = { background: 'linear-gradient(135deg, #e11d48, #9333ea)', color: '#ffffff', fontSize: '14px', fontWeight: 600, borderRadius: '12px', padding: '14px 26px', textDecoration: 'none', display: 'inline-block' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0', lineHeight: '1.5' }
const brandFooter = { fontSize: '11px', color: '#cbd5e1', margin: '24px 0 0', textAlign: 'center' as const }
