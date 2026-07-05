/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Button, Container, Head, Heading, Html, Link, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { brand, card, header, headerBrand, headerTag, contentPad, h1, text, buttonPrimary, link, divider, footer } from './_brand.ts'

interface InviteEmailProps {
  siteName: string
  siteUrl: string
  confirmationUrl: string
}

export const InviteEmail = ({ siteName, siteUrl, confirmationUrl }: InviteEmailProps) => (
  <Html lang="id" dir="ltr">
    <Head />
    <Preview>Anda diundang bergabung di {siteName}</Preview>
    <Body style={brand.body}>
      <Container style={card}>
        <Section style={header}>
          <Text style={headerTag}>UNDANGAN</Text>
          <Text style={headerBrand}>{siteName}</Text>
        </Section>
        <Section style={contentPad}>
          <Heading style={h1}>Anda diundang</Heading>
          <Text style={text}>
            Anda diundang untuk bergabung di{' '}
            <Link href={siteUrl} style={link}>{siteName}</Link>. Klik tombol di bawah untuk
            menerima undangan dan membuat akun Anda.
          </Text>
          <Button style={buttonPrimary} href={confirmationUrl}>
            Terima Undangan
          </Button>
          <Section style={divider} />
          <Text style={footer}>
            Jika Anda tidak mengharapkan undangan ini, abaikan email ini.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default InviteEmail
