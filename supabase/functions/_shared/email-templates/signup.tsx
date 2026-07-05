/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { brand, card, header, headerBrand, headerTag, contentPad, h1, text, buttonPrimary, link, divider, footer } from './_brand.ts'

interface SignupEmailProps {
  siteName: string
  siteUrl: string
  recipient: string
  confirmationUrl: string
}

export const SignupEmail = ({ siteName, siteUrl, recipient, confirmationUrl }: SignupEmailProps) => (
  <Html lang="id" dir="ltr">
    <Head />
    <Preview>Konfirmasi email Anda untuk {siteName}</Preview>
    <Body style={brand.body}>
      <Container style={card}>
        <Section style={header}>
          <Text style={headerTag}>SELAMAT DATANG</Text>
          <Text style={headerBrand}>{siteName}</Text>
        </Section>
        <Section style={contentPad}>
          <Heading style={h1}>Konfirmasi email Anda</Heading>
          <Text style={text}>
            Terima kasih sudah mendaftar di{' '}
            <Link href={siteUrl} style={link}>{siteName}</Link>. Untuk mengaktifkan akun,
            silakan konfirmasi alamat email{' '}
            <Link href={`mailto:${recipient}`} style={link}>{recipient}</Link> dengan tombol
            di bawah ini.
          </Text>
          <Button style={buttonPrimary} href={confirmationUrl}>
            Verifikasi Email
          </Button>
          <Section style={divider} />
          <Text style={footer}>
            Jika Anda tidak mendaftar akun di {siteName}, abaikan email ini.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default SignupEmail
