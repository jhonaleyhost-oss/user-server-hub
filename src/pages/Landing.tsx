import { motion } from 'framer-motion';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Server, Shield, Zap, Crown, Users, Terminal, Globe, Check,
  ArrowRight, Sparkles, Rocket, Lock, Clock, HeartHandshake,
  MessageCircle, Star, LogIn, Menu, X,
} from 'lucide-react';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import AccentColorPicker from '@/components/AccentColorPicker';
import { Button } from '@/components/ui/button';
import { PageTransition } from '@/components/PageTransition';

const features = [
  { icon: Rocket, title: 'Deploy Instan', desc: 'Buat panel Pterodactyl hanya dalam hitungan detik, tanpa konfigurasi ribet.' },
  { icon: Shield, title: 'Aman & Terpercaya', desc: 'Sistem proteksi device fingerprint + IP, RLS Supabase, dan enkripsi standar industri.' },
  { icon: Server, title: 'Multi Server', desc: 'Pilih dari beberapa server publik & private dengan spek dan lokasi yang berbeda.' },
  { icon: Terminal, title: 'Panel Lengkap', desc: 'Console real-time, file manager, database, dan kontrol penuh layaknya Pterodactyl asli.' },
  { icon: Users, title: 'Sub-user & ADP', desc: 'Kelola tim dan buat panel untuk klien Anda sendiri dengan tier Admin Panel (ADP).' },
  { icon: HeartHandshake, title: 'Support Aktif', desc: 'Live chat, feedback, dan garansi role — tim kami siap bantu 24/7.' },
];

const plans = [
  {
    name: 'Free',
    price: 'Rp 0',
    highlight: false,
    features: ['1 Panel Bot WhatsApp', 'Akses Server Publik', 'Spec Standar', 'Support Komunitas'],
    cta: 'Daftar Gratis',
  },
  {
    name: 'Reseller',
    price: 'Mulai Rp 5.000 / Bulan',
    highlight: true,
    badge: 'Paling Populer',
    features: ['Panel Unlimited', 'Akses Server Private', 'Spec Unlimited', 'Prioritas Support', 'Aktif 1 Bulan / Permanen'],
    cta: 'Upgrade Reseller',
  },
  {
    name: 'ADP Server',
    price: 'Mulai Rp 10.000 / Bulan',
    highlight: false,
    features: ['Buat Admin Panel Sendiri', 'Kelola Sub-user', 'Server Dedicated', 'Cocok untuk Reseller Besar'],
    cta: 'Upgrade ADP',
  },
];

const stats = [
  { value: '5K+', label: 'Pengguna Aktif' },
  { value: '10K+', label: 'Panel Dibuat' },
  { value: '99.9%', label: 'Uptime Server' },
  { value: '24/7', label: 'Support Online' },
];

const faqs = [
  { q: 'Apakah benar-benar gratis?', a: 'Ya. Setiap akun baru mendapat 1 panel gratis di server publik tanpa biaya, tanpa kartu kredit.' },
  { q: 'Bagaimana cara upgrade ke Reseller?', a: 'Login, buka menu Upgrade, pilih durasi (1 bulan / permanen) dan lakukan pembayaran via QRIS otomatis.' },
  { q: 'Apa itu ADP Server?', a: 'ADP (Admin Panel) memungkinkan Anda punya panel Pterodactyl sendiri untuk dijual ulang ke klien Anda.' },
  { q: 'Apakah ada garansi?', a: 'Ada. Jika role hilang karena error sistem, ajukan klaim di halaman Garansi dengan bukti invoice.' },
];

const Landing = () => {
  return (
    <PageTransition>
      <div className="min-h-screen bg-background text-foreground">
        {/* Nav */}
        <header className="sticky top-0 z-40 border-b border-border/50 backdrop-blur-xl bg-background/70">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <Logo size="md" />
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 mr-1 sm:mr-2">
                <AccentColorPicker />
                <ThemeToggle />
              </div>
              <Link to="/auth">
                <Button className="btn-primary flex items-center gap-2" size="sm">
                  <LogIn className="w-4 h-4" />
                  <span className="hidden xs:inline sm:inline">Masuk</span>
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 -z-10">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-primary/20 blur-3xl opacity-40" />
            <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-accent/20 blur-3xl opacity-30" />
          </div>
          <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 sm:py-28 text-center">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-primary/30 bg-primary/10 text-primary text-xs font-medium mb-6"
            >
              <Sparkles className="w-3.5 h-3.5" />
              Platform Pterodactyl Panel #1 di Indonesia
            </motion.div>
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.05 }}
              className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-tight"
            >
              Panel Bot WhatsApp
              <br />
              <span className="bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Cepat, Aman, Profesional
              </span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="mt-6 text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto"
            >
              Buat, kelola, dan jual panel Pterodactyl untuk bot WhatsApp Anda.
              Deploy instan, spec unlimited untuk reseller, dan support 24/7.
            </motion.p>
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
              className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3"
            >
              <Link to="/auth">
                <Button className="btn-primary flex items-center gap-2 h-12 px-6 text-base">
                  <Rocket className="w-4 h-4" />
                  Mulai Gratis Sekarang
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
              <a href="#pricing">
                <Button variant="outline" className="h-12 px-6 text-base">
                  Lihat Harga
                </Button>
              </a>
            </motion.div>

            {/* Stats */}
            <div className="mt-16 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
              {stats.map((s, i) => (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="glass-card rounded-xl p-4"
                >
                  <div className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {s.value}
                  </div>
                  <div className="text-xs text-muted-foreground mt-1">{s.label}</div>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 border-t border-border/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold">Kenapa Pilih Jhonaley Store?</h2>
              <p className="text-muted-foreground mt-3 max-w-xl mx-auto">
                Semua yang Anda butuhkan untuk menjalankan bot WhatsApp — dalam satu platform.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {features.map((f, i) => (
                <motion.div
                  key={f.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card rounded-2xl p-6 hover:border-primary/40 transition"
                >
                  <div className="w-11 h-11 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center mb-4">
                    <f.icon className="w-5 h-5 text-primary" />
                  </div>
                  <h3 className="font-semibold text-lg">{f.title}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{f.desc}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-20 border-t border-border/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold">Pilih Paket Anda</h2>
              <p className="text-muted-foreground mt-3">Mulai gratis, upgrade kapan saja.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {plans.map((p, i) => (
                <motion.div
                  key={p.name}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className={`relative rounded-2xl p-6 border ${
                    p.highlight
                      ? 'border-primary/60 bg-gradient-to-b from-primary/10 to-transparent shadow-[0_10px_40px_-10px_hsl(var(--primary)/0.4)]'
                      : 'border-border/60 bg-card/50'
                  }`}
                >
                  {p.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold flex items-center gap-1">
                      <Star className="w-3 h-3" />
                      {p.badge}
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {p.name === 'Reseller' && <Crown className="w-5 h-5 text-primary" />}
                    {p.name === 'ADP Server' && <Shield className="w-5 h-5 text-accent" />}
                    {p.name === 'Free' && <Zap className="w-5 h-5 text-emerald" />}
                    <h3 className="text-xl font-bold">{p.name}</h3>
                  </div>
                  <div className="mt-3 text-3xl font-extrabold">{p.price}</div>
                  <ul className="mt-5 space-y-2">
                    {p.features.map((f) => (
                      <li key={f} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link to="/auth" className="block mt-6">
                    <Button className={`w-full ${p.highlight ? 'btn-primary' : ''}`} variant={p.highlight ? 'default' : 'outline'}>
                      {p.cta}
                    </Button>
                  </Link>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* How it works */}
        <section id="how-it-works" className="py-20 border-t border-border/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold">3 Langkah Mudah</h2>
              <p className="text-muted-foreground mt-3">Dari daftar sampai panel jalan — kurang dari 2 menit.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {[
                { n: '01', icon: Users, t: 'Daftar Akun', d: 'Buat akun gratis dengan email. 1 device = 1 akun untuk keamanan.' },
                { n: '02', icon: Server, t: 'Pilih Server', d: 'Pilih server publik (gratis) atau upgrade untuk akses server private.' },
                { n: '03', icon: Terminal, t: 'Deploy Panel', d: 'Panel siap pakai dengan console, file manager, dan database.' },
              ].map((s, i) => (
                <motion.div
                  key={s.n}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="relative glass-card rounded-2xl p-6"
                >
                  <div className="absolute top-4 right-4 text-4xl font-black text-primary/10">{s.n}</div>
                  <s.icon className="w-8 h-8 text-primary mb-3" />
                  <h3 className="font-semibold text-lg">{s.t}</h3>
                  <p className="text-sm text-muted-foreground mt-2">{s.d}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 border-t border-border/50">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-12">
              <h2 className="text-3xl sm:text-4xl font-bold">Pertanyaan Umum</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((f, i) => (
                <motion.details
                  key={f.q}
                  initial={{ opacity: 0, y: 10 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="group glass-card rounded-xl p-5 cursor-pointer"
                >
                  <summary className="flex items-center justify-between font-medium list-none">
                    <span>{f.q}</span>
                    <ArrowRight className="w-4 h-4 text-primary group-open:rotate-90 transition" />
                  </summary>
                  <p className="text-sm text-muted-foreground mt-3">{f.a}</p>
                </motion.details>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 border-t border-border/50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6">
            <div className="relative overflow-hidden rounded-3xl p-10 sm:p-14 text-center bg-gradient-to-br from-primary/20 via-accent/10 to-transparent border border-primary/30">
              <div className="absolute inset-0 -z-10 opacity-30">
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,hsl(var(--accent)/0.3),transparent_60%)]" />
              </div>
              <Sparkles className="w-10 h-10 text-primary mx-auto mb-4" />
              <h2 className="text-3xl sm:text-4xl font-bold">Siap memulai?</h2>
              <p className="text-muted-foreground mt-3 max-w-lg mx-auto">
                Gabung ribuan reseller yang sudah percaya Jhonaley Store untuk bisnis bot mereka.
              </p>
              <Link to="/auth" className="inline-block mt-6">
                <Button className="btn-primary h-12 px-8 text-base flex items-center gap-2">
                  <Rocket className="w-4 h-4" />
                  Daftar Gratis Sekarang
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-10 border-t border-border/50">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Logo size="sm" />
            <p className="text-xs text-muted-foreground">
              &copy; 2026 Jhonaley Store Cpanel. All Rights Reserved.
            </p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <a href="https://t.me/upgradeuser_bot" target="_blank" rel="noreferrer" className="hover:text-primary flex items-center gap-1">
                <MessageCircle className="w-3.5 h-3.5" /> Telegram
              </a>
              <Link to="/auth" className="hover:text-primary">Masuk</Link>
            </div>
          </div>
        </footer>
      </div>
    </PageTransition>
  );
};

export default Landing;