/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'
import { Body, Container, Head, Heading, Html, Preview, Section, Text } from 'npm:@react-email/components@0.0.22'
import { brand, card, header, headerBrand, headerTag, contentPad, h1, text, otpBox, divider, footer } from './_brand.ts'

interface ReauthenticationEmailProps {
  siteName?: string
  token: string
}

export const ReauthenticationEmail = ({ siteName = 'Jhonaley Store ID', token }: ReauthenticationEmailProps) => (
  <Html lang="id" dir="ltr">
    <Head />
    <Preview>Kode verifikasi Anda: {token}</Preview>
    <Body style={brand.body}>
      <Container style={card}>
        <Section style={header}>
          <Text style={headerTag}>KODE VERIFIKASI</Text>
          <Text style={headerBrand}>{siteName}</Text>
        </Section>
        <Section style={contentPad}>
          <Heading style={h1}>Konfirmasi identitas Anda</Heading>
          <Text style={text}>
            Gunakan kode di bawah ini untuk mengonfirmasi identitas Anda:
          </Text>
          <Text style={otpBox}>{token}</Text>
          <Section style={divider} />
          <Text style={footer}>
            Kode ini akan kedaluwarsa dalam waktu singkat. Jika Anda tidak meminta kode ini,
            abaikan email ini.
          </Text>
        </Section>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail
