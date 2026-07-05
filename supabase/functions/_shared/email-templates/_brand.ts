// Shared brand tokens for Jhonaley Store ID email templates.
// Palette: blue + white, professional / clean.

export const brand = {
  primary: '#1d4ed8',
  primaryDark: '#1e3a8a',
  primaryLight: '#3b82f6',
  accent: '#e0ecff',
  ink: '#0f172a',
  muted: '#475569',
  soft: '#94a3b8',
  border: '#e2e8f0',
  body: {
    backgroundColor: '#eef4ff',
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif",
    margin: 0,
    padding: '32px 12px',
  } as const,
}

export const card = {
  backgroundColor: '#ffffff',
  borderRadius: '16px',
  maxWidth: '560px',
  margin: '0 auto',
  overflow: 'hidden' as const,
  border: '1px solid #e2e8f0',
}

export const header = {
  backgroundColor: '#1d4ed8',
  backgroundImage: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 55%, #3b82f6 100%)',
  padding: '28px 32px',
  textAlign: 'left' as const,
}

export const headerTag = {
  color: '#bfdbfe',
  fontSize: '11px',
  letterSpacing: '2px',
  fontWeight: 700 as const,
  margin: '0 0 6px',
  textTransform: 'uppercase' as const,
}

export const headerBrand = {
  color: '#ffffff',
  fontSize: '22px',
  fontWeight: 700 as const,
  margin: 0,
  letterSpacing: '-0.2px',
}

export const contentPad = { padding: '28px 32px 32px' }

export const h1 = {
  color: '#0f172a',
  fontSize: '22px',
  fontWeight: 700 as const,
  margin: '0 0 14px',
  lineHeight: '1.3',
}

export const text = {
  color: '#475569',
  fontSize: '15px',
  lineHeight: '1.65',
  margin: '0 0 22px',
}

export const buttonPrimary = {
  backgroundColor: '#1d4ed8',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: 600 as const,
  borderRadius: '10px',
  padding: '13px 24px',
  textDecoration: 'none',
  display: 'inline-block',
  boxShadow: '0 6px 14px rgba(29, 78, 216, 0.28)',
}

export const link = { color: '#1d4ed8', textDecoration: 'underline', fontWeight: 500 as const }

export const divider = {
  borderTop: '1px solid #e2e8f0',
  margin: '28px 0 20px',
  height: '1px',
}

export const footer = {
  color: '#94a3b8',
  fontSize: '12px',
  lineHeight: '1.6',
  margin: 0,
}

export const otpBox = {
  backgroundColor: '#eef4ff',
  border: '1px dashed #93c5fd',
  borderRadius: '12px',
  color: '#1d4ed8',
  fontFamily: "'SF Mono', Menlo, Consolas, monospace",
  fontSize: '30px',
  fontWeight: 700 as const,
  letterSpacing: '10px',
  padding: '18px 20px',
  textAlign: 'center' as const,
  margin: '0 0 24px',
}