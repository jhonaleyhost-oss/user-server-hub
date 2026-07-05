/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { brand, card, header, headerBrand, headerTag, contentPad, h1, text, buttonPrimary, link, divider, footer } from './_brand.ts'

interface EmailChangeEmailProps {
  siteName: string
  oldEmail: string
  email: string
  newEmail: string
  confirmationUrl: string
}

export const EmailChangeEmail = ({ siteName, oldEmail, newEmail, confirmationUrl }: EmailChangeEmailProps) => (
  <Html lang="id" dir="ltr">
    <Head />
    <Preview>Konfirmasi perubahan email untuk {siteName}</Preview>
    <Body style={brand.body}>
      <Container style={card}>
        <Section style={header}>
          <Text style={headerTag}>PERUBAHAN EMAIL</Text>
          <Text style={headerBrand}>{siteName}</Text>
        </Section>
        <Section style={contentPad}>
          <Heading style={h1}>Konfirmasi perubahan email</Heading>
          <Text style={text}>
            Anda meminta perubahan alamat email {siteName} dari{' '}
            <Link href={`mailto:${oldEmail}`} style={link}>{oldEmail}</Link> menjadi{' '}
            <Link href={`mailto:${newEmail}`} style={link}>{newEmail}</Link>. Klik tombol di
            bawah untuk mengonfirmasi perubahan ini.
          </Text>
          <Button style={buttonPrimary} href={confirmationUrl}>
            Konfirmasi Perubahan Email
          </Button>
          <Section style={divider} />
          <Text style={footer}>
            Jika Anda tidak meminta perubahan ini, segera amankan akun Anda.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default EmailChangeEmail
