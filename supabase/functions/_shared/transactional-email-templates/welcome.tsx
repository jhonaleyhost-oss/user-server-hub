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
  Button,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

interface Props {
  name?: string
  siteUrl?: string
}

const WelcomeEmail = ({ name, siteUrl }: Props) => (
  <Html lang="id" dir="ltr">
    <Head />
    <Preview>Selamat datang di Jhonaley Store!</Preview>
    <Body style={{ backgroundColor: '#ffffff', fontFamily: 'Arial, sans-serif', margin: 0, padding: 0 }}>
      <Container style={{ padding: '32px 24px', maxWidth: 560 }}>
        <Heading style={{ color: '#0f172a', fontSize: 24, margin: '0 0 16px' }}>
          Halo {name || 'kak'} 👋
        </Heading>
        <Text style={{ color: '#334155', fontSize: 15, lineHeight: '24px' }}>
          Terima kasih sudah bergabung di <strong>Jhonaley Store</strong>. Sekarang kamu bisa
          bikin panel Pterodactyl, upgrade ke reseller, dan pakai semua fiturnya.
        </Text>
        {siteUrl && (
          <Button
            href={siteUrl}
            style={{
              backgroundColor: '#000000',
              color: '#ffffff',
              padding: '12px 20px',
              borderRadius: 8,
              textDecoration: 'none',
              display: 'inline-block',
              marginTop: 16,
            }}
          >
            Buka Dashboard
          </Button>
        )}
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Selamat datang di Jhonaley Store',
  displayName: 'Welcome Email',
  previewData: { name: 'Jhonaley', siteUrl: 'https://jhonaleystore.id' },
} satisfies TemplateEntry