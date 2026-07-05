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
  recipient?: string
  email?: string
}

export const RecoveryEmail = ({
  siteName,
  confirmationUrl,
  recipient,
  email,
}: RecoveryEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Atur ulang kata sandi Anda untuk {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://jhonaleycpanel.lovable.app/email-logo.png"
          width="64"
          height="64"
          alt="Jhonaley Store ID"
          style={logo}
        />
        <Heading style={h1}>Atur ulang kata sandi Anda</Heading>
        <Text style={text}>
          Kami menerima permintaan untuk mengatur ulang kata sandi Anda untuk{' '}
          <strong>{(recipient || email || '').split('@')[0] || 'akun Anda'}</strong>.
          Klik tombol di bawah ini untuk memilih kata sandi baru.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Atur Ulang Kata Sandi
        </Button>
        <Text style={footer}>
          Jika Anda tidak meminta pengaturan ulang kata sandi, Anda dapat
          mengabaikan email ini. Kata sandi Anda tidak akan diubah.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default RecoveryEmail

const main = { backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif' }
const container = { padding: '20px 25px' }
const logo = { margin: '0 0 20px', borderRadius: '12px' }
const h1 = {
  fontSize: '22px',
  fontWeight: 'bold' as const,
  color: '#000000',
  margin: '0 0 20px',
}
const text = {
  fontSize: '14px',
  color: '#55575d',
  lineHeight: '1.5',
  margin: '0 0 25px',
}
const button = {
  backgroundColor: '#000000',
  color: '#ffffff',
  fontSize: '14px',
  borderRadius: '8px',
  padding: '12px 20px',
  textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#999999', margin: '30px 0 0' }
