/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { brand, card, header, headerBrand, headerTag, contentPad, h1, text, buttonPrimary, divider, footer } from './_brand.ts'

interface RecoveryEmailProps {
  siteName: string
  confirmationUrl: string
  recipient?: string
  email?: string
}

export const RecoveryEmail = ({ siteName, confirmationUrl, recipient, email }: RecoveryEmailProps) => {
  const username = (recipient || email || '').split('@')[0] || 'akun Anda'
  return (
    <Html lang="id" dir="ltr">
      <Head />
      <Preview>Atur ulang kata sandi Anda untuk {siteName}</Preview>
      <Body style={brand.body}>
        <Container style={card}>
          <Section style={header}>
            <Text style={headerTag}>KEAMANAN AKUN</Text>
            <Text style={headerBrand}>{siteName}</Text>
          </Section>
          <Section style={contentPad}>
            <Heading style={h1}>Atur ulang kata sandi Anda</Heading>
            <Text style={text}>
              Kami menerima permintaan untuk mengatur ulang kata sandi Anda untuk{' '}
              <strong style={{ color: brand.primary }}>{username}</strong>. Klik tombol di bawah
              ini untuk memilih kata sandi baru.
            </Text>
            <Button style={buttonPrimary} href={confirmationUrl}>
              Atur Ulang Kata Sandi
            </Button>
            <Section style={divider} />
            <Text style={footer}>
              Jika Anda tidak meminta pengaturan ulang kata sandi, Anda dapat mengabaikan email
              ini. Kata sandi Anda tidak akan diubah.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  )
}

export default RecoveryEmail
