/// <reference types="npm:@types/react@18.3.1" />

import * as React from 'npm:react@18.3.1'

import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Text,
} from 'npm:@react-email/components@0.0.22'

interface ReauthenticationEmailProps {
  token: string
}

export const ReauthenticationEmail = ({ token }: ReauthenticationEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Kode verifikasi kamu</Preview>
    <Body style={main}>
      <Container style={container}>
        <div style={brandBar}>Jhonaley Store</div>
        <Heading style={h1}>Konfirmasi identitas kamu</Heading>
        <Text style={text}>Gunakan kode di bawah untuk mengonfirmasi identitas kamu:</Text>
        <Text style={codeStyle}>{token}</Text>
        <Text style={footer}>
          Kode ini akan kedaluwarsa dalam waktu singkat. Jika kamu tidak
          meminta ini, abaikan saja email ini.
        </Text>
        <Text style={brandFooter}>© Jhonaley Store</Text>
      </Container>
    </Body>
  </Html>
)

export default ReauthenticationEmail

const main = { backgroundColor: '#ffffff', fontFamily: '"Plus Jakarta Sans", -apple-system, Segoe UI, Roboto, Arial, sans-serif' }
const container = { padding: '24px 28px', maxWidth: '560px' }
const brandBar = { display: 'inline-block', background: 'linear-gradient(135deg, #e11d48, #9333ea)', color: '#ffffff', fontSize: '13px', fontWeight: 700, letterSpacing: '0.5px', padding: '6px 14px', borderRadius: '999px', marginBottom: '24px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#475569', lineHeight: '1.6', margin: '0 0 20px' }
const codeStyle = {
  fontFamily: '"JetBrains Mono", Courier, monospace',
  fontSize: '28px',
  fontWeight: 700 as const,
  letterSpacing: '6px',
  color: '#e11d48',
  background: '#fef2f4',
  padding: '14px 20px',
  borderRadius: '12px',
  display: 'inline-block',
  margin: '0 0 24px',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '28px 0 0', lineHeight: '1.5' }
const brandFooter = { fontSize: '11px', color: '#cbd5e1', margin: '24px 0 0', textAlign: 'center' as const }
