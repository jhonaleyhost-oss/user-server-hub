/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { brand, card, header, headerBrand, headerTag, contentPad, h1, text, buttonPrimary, divider, footer } from './_brand.ts'

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({ siteName, confirmationUrl }: MagicLinkEmailProps) => (
  <Html lang="id" dir="ltr">
    <Head />
    <Preview>Link login Anda untuk {siteName}</Preview>
    <Body style={brand.body}>
      <Container style={card}>
        <Section style={header}>
          <Text style={headerTag}>LOGIN AMAN</Text>
          <Text style={headerBrand}>{siteName}</Text>
        </Section>
        <Section style={contentPad}>
          <Heading style={h1}>Link login Anda</Heading>
          <Text style={text}>
            Klik tombol di bawah untuk login ke {siteName}. Link ini hanya berlaku dalam
            waktu singkat, jadi gunakan sekarang.
          </Text>
          <Button style={buttonPrimary} href={confirmationUrl}>
            Login Sekarang
          </Button>
          <Section style={divider} />
          <Text style={footer}>
            Jika Anda tidak meminta link ini, abaikan email ini.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail
