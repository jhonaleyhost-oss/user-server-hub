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

interface MagicLinkEmailProps {
  siteName: string
  confirmationUrl: string
}

export const MagicLinkEmail = ({
  siteName,
  confirmationUrl,
}: MagicLinkEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Your login link for {siteName}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Img
          src="https://jhonaleycpanel.lovable.app/__l5e/assets-v1/f108ee57-10f0-48a6-bd81-8de8ae7e5b19/jhonaley-logo.png"
          width="72"
          height="72"
          alt="Jhonaley Store ID"
          style={logo}
        />
        <Heading style={h1}>Link login kamu</Heading>
        <Text style={text}>
          Klik tombol di bawah untuk login ke {siteName}. Link ini akan
          kedaluwarsa dalam waktu singkat.
        </Text>
        <Button style={button} href={confirmationUrl}>
          Login
        </Button>
        <Text style={footer}>
          Jika kamu tidak meminta link ini, kamu bisa mengabaikan email ini.
        </Text>
      </Container>
    </Body>
  </Html>
)

export default MagicLinkEmail

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
