import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  MessageSquare,
  Users,
  BarChart3,
  Shield,
  Zap,
  Globe,
  Check,
  ArrowRight,
  Phone,
  Inbox,
  Layers,
  Sparkles,
} from "lucide-react";

const APP_URL = "https://app.convora.tech";
const HELP_NUMBER = "8766350093";

function FadeIn({ children, delay = 0 }: { children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.6, delay, ease: "easeOut" }}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-400/30 relative">
      {/* Subtle dot-grid texture across the whole page so dark sections never read as empty */}
      <div
        className="fixed inset-0 -z-20 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
      {/* Top help bar */}
      <div className="bg-slate-900 border-b border-slate-800/80 text-slate-400 text-center text-sm py-2 px-4">
        <Phone className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5 text-cyan-400" />
        Need help? Call us at{" "}
        <a href={`tel:+91${HELP_NUMBER}`} className="font-semibold text-cyan-400 underline underline-offset-2">
          +91 {HELP_NUMBER}
        </a>
      </div>

      <nav className="sticky top-0 z-50 border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-xl">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-cyan-600 text-slate-950">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-xl font-serif font-semibold tracking-tight">Convora</span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Pricing</a>
            <Link href="/privacy" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Privacy</Link>
          </div>
          <div className="flex items-center gap-3">
            <a href={`${APP_URL}/login`}>
              <Button variant="outline" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-slate-100" data-testid="button-login">Log In</Button>
            </a>
            <a href={`${APP_URL}/login`}>
              <Button className="bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-semibold hover:from-cyan-300 hover:to-cyan-400" data-testid="button-get-started">Start Free Trial</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(34,211,238,0.14),transparent)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,rgba(9,9,11,0.6))]" />
        {/* Glow orbs for depth - purely decorative, blurred and low-opacity */}
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px] -z-10" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-blue-600/10 blur-[110px] -z-10" />
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-1.5 text-sm text-cyan-300 mb-8">
              <Sparkles className="h-3.5 w-3.5" />
              Built on the official Meta WhatsApp Business API
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-semibold leading-tight mb-6 tracking-tight">
              Business leaders don't like limitations.
              <br />
              <span className="bg-gradient-to-r from-cyan-200 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                So why are we setting limits?
              </span>
            </h1>
            <p className="text-lg md:text-xl text-slate-400 max-w-2xl mx-auto mb-10 leading-relaxed">
              Message without limits — with Convora. Broadcast to thousands of customers on WhatsApp,
              track every delivery in real time, and never pay a reseller markup again.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-10">
              <a href={`${APP_URL}/login`}>
                <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-semibold hover:from-cyan-300 hover:to-cyan-400 shadow-lg shadow-cyan-500/20" data-testid="button-start-free">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href="#pricing">
                <Button size="lg" variant="outline" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800">See Pricing</Button>
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-cyan-400" />
                <span>7-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-cyan-400" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-cyan-400" />
                <span>Unlimited messages, one flat price</span>
              </div>
            </div>
          </motion.div>

          {/* Phone mockup - stylized broadcast conversation, no external asset needed */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 flex justify-center"
          >
            <div className="w-[300px] rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-2xl shadow-cyan-500/10 overflow-hidden">
              <div className="bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 border-b border-slate-800 px-4 py-3 flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-300 to-cyan-600 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-slate-950" />
                </div>
                <div className="text-left">
                  <p className="text-sm font-semibold text-slate-100">Convora Broadcast</p>
                  <p className="text-xs text-cyan-400">3,204 delivered</p>
                </div>
              </div>
              <div className="p-4 space-y-3 text-left">
                {[
                  { text: "Hi! Your order #4821 has shipped 📦", time: "10:02", status: "read" },
                  { text: "Flat 20% off this weekend only. Reply STOP to opt out.", time: "10:03", status: "read" },
                  { text: "Thank you for your purchase! ⭐", time: "10:04", status: "delivered" },
                ].map((msg) => (
                  <div key={msg.text} className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-cyan-500/15 border border-cyan-400/20 px-3.5 py-2">
                      <p className="text-sm text-slate-100 leading-snug">{msg.text}</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-slate-500">{msg.time}</span>
                        <svg width="14" height="10" viewBox="0 0 16 11" className={msg.status === "read" ? "text-cyan-400" : "text-slate-500"}>
                          <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M1 5.5L4 8.5L10 1.5" />
                          <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M6 5.5L9 8.5L15 1.5" />
                        </svg>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-4 border-t border-slate-800/60">
        <div className="container mx-auto max-w-5xl">
          <FadeIn>
            <div className="text-center mb-16">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">How it works</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">From signup to broadcast in four steps</h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">No developers, no waiting weeks for setup</p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-x-10 gap-y-10">
            {[
              { n: "01", title: "Connect your WhatsApp number", desc: "Link your verified WhatsApp Business number in minutes - no API keys to wrangle yourself." },
              { n: "02", title: "Create approved templates", desc: "Build message templates with images, buttons, and variables. We handle Meta's approval process." },
              { n: "03", title: "Import & segment contacts", desc: "Upload your contact list, organize into lists and tags, and target exactly who you want to reach." },
              { n: "04", title: "Broadcast & track results", desc: "Send to thousands at once and watch delivery, read receipts, and replies roll in live." },
            ].map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1}>
                <div className="flex gap-5 p-6 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:border-cyan-400/30 transition-colors">
                  <div className="text-3xl font-semibold bg-gradient-to-br from-cyan-300 to-cyan-600 bg-clip-text text-transparent font-mono shrink-0">{step.n}</div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1.5 text-slate-100">{step.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4 border-t border-slate-800/60">
        <div className="container mx-auto max-w-6xl">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">Features</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">
                Everything You Need to Broadcast at Scale
              </h2>
              <p className="text-lg text-slate-400 max-w-2xl mx-auto">
                Powerful features designed for businesses that need to reach customers effectively
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {[
              { icon: MessageSquare, title: "Template Management", desc: "Create, manage, and track WhatsApp message templates with approval workflows" },
              { icon: Users, title: "Contact Management", desc: "Organize contacts into lists and segments for targeted messaging campaigns" },
              { icon: BarChart3, title: "Real-time Analytics", desc: "Track delivery rates, read receipts, and campaign performance in real-time" },
              { icon: Zap, title: "Instant Delivery", desc: "Send messages to thousands of recipients in seconds with our optimized API" },
              { icon: Shield, title: "Secure & Compliant", desc: "Enterprise-grade security with Meta's official WhatsApp Business API" },
              { icon: Globe, title: "Multi-Account Support", desc: "Manage multiple WhatsApp Business numbers from a single dashboard" },
              { icon: Inbox, title: "Unified Inbox", desc: "See and reply to every customer conversation in one place, in real time" },
              { icon: Layers, title: "Smart Segmentation", desc: "Tag and filter contacts to send the right message to the right audience" },
              { icon: Sparkles, title: "No Reseller Markup", desc: "Pay Meta's standard conversation pricing directly - nothing hidden on top" },
            ].map((f, i) => (
              <FadeIn key={f.title} delay={(i % 3) * 0.1}>
                <div className="h-full p-6 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:border-cyan-400/30 hover:bg-slate-900/70 transition-all duration-300">
                  <div className="h-11 w-11 rounded-lg bg-cyan-400/10 flex items-center justify-center mb-4">
                    <f.icon className="h-5 w-5 text-cyan-400" />
                  </div>
                  <h3 className="font-semibold text-slate-100 mb-1.5">{f.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{f.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Why Convora */}
      <section className="py-24 px-4 border-t border-slate-800/60 bg-slate-900/20">
        <div className="container mx-auto max-w-5xl">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">Why Convora</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">Why businesses choose Convora</h2>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-6">
            {[
              { title: "No artificial limits", desc: "Other tools cap your sends or throttle your growth. Convora scales with your business, not against it." },
              { title: "Transparent pricing", desc: "One flat ₹799/month. No per-message markup, no surprise invoices, no hidden tiers." },
              { title: "Built for real operators", desc: "Multi-account support, team access, and an inbox built for people who actually run campaigns daily." },
              { title: "You own the relationship", desc: "Your Meta WhatsApp Business API connection, your data, your contacts - never locked into a black box." },
            ].map((item, i) => (
              <FadeIn key={item.title} delay={i * 0.1}>
                <div className="flex gap-3.5">
                  <div className="h-6 w-6 rounded-full bg-cyan-400/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Check className="h-3.5 w-3.5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold mb-1 text-slate-100">{item.title}</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 border-t border-slate-800/60">
        <div className="container mx-auto max-w-4xl">
          <FadeIn>
            <div className="text-center mb-14">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-slate-400">
                One plan with everything you need to grow your business
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <div className="max-w-md mx-auto rounded-2xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/80 to-slate-900/40 backdrop-blur-sm p-8 shadow-2xl shadow-cyan-500/5">
              <div className="text-center pb-4">
                <div className="inline-block mx-auto px-3 py-1 rounded-full bg-cyan-400/10 text-cyan-300 text-sm font-medium mb-5 border border-cyan-400/20">
                  Most Popular
                </div>
                <h3 className="text-2xl font-serif font-semibold text-slate-100">Unlimited Plan</h3>
                <p className="text-slate-400 text-sm mt-1">Everything you need for WhatsApp broadcasting</p>
              </div>
              <div className="space-y-6">
                <div className="text-center">
                  <span className="text-5xl font-bold bg-gradient-to-r from-cyan-200 to-cyan-500 bg-clip-text text-transparent">₹799</span>
                  <span className="text-slate-500">/month</span>
                </div>

                <ul className="space-y-3">
                  {[
                    "Unlimited messages, no caps",
                    "Unlimited message templates",
                    "Unlimited contacts & lists",
                    "Real-time delivery tracking",
                    "Advanced analytics dashboard",
                    "Multi-account management",
                    "2-way messaging inbox",
                    "Priority support",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-3">
                      <Check className="h-5 w-5 text-cyan-400 flex-shrink-0" />
                      <span className="text-slate-300">{item}</span>
                    </li>
                  ))}
                </ul>

                <a href={`${APP_URL}/login`} className="block">
                  <Button className="w-full bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-semibold hover:from-cyan-300 hover:to-cyan-400" size="lg" data-testid="button-subscribe">
                    Start 7-Day Free Trial
                  </Button>
                </a>
                <p className="text-center text-sm text-slate-500">
                  No credit card required to start · Upgrade anytime
                </p>
              </div>
            </div>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 border-t border-slate-800/60 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_80%_at_50%_100%,rgba(34,211,238,0.08),transparent)]" />
        <div className="container mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">Stop messaging with limits.</h2>
            <p className="text-lg text-slate-400 mb-8">Join Convora and reach every customer, every time.</p>
            <a href={`${APP_URL}/login`}>
              <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-semibold hover:from-cyan-300 hover:to-cyan-400 shadow-lg shadow-cyan-500/20">
                Start Your Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </FadeIn>
        </div>
      </section>

      <footer className="border-t border-slate-800/60 py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-300 to-cyan-600 text-slate-950">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="font-serif font-semibold text-slate-100">Convora</span>
              </div>
              <p className="text-sm text-slate-500">
                Message without limits. Professional WhatsApp broadcasting for businesses.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-slate-200">Product</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-slate-200 transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-slate-200 transition-colors">Pricing</a></li>
                <li><a href={`${APP_URL}/login`} className="hover:text-slate-200 transition-colors">Login</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-slate-200">Legal</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/privacy" className="hover:text-slate-200 transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-slate-200 transition-colors">Terms of Service</Link></li>
                <li><Link href="/refund" className="hover:text-slate-200 transition-colors">Refund Policy</Link></li>
                <li><Link href="/delete-data" className="hover:text-slate-200 transition-colors">Data Deletion</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-slate-200">Support</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><Link href="/contact" className="hover:text-slate-200 transition-colors">Contact Us</Link></li>
                <li>
                  <a href={`tel:+91${HELP_NUMBER}`} className="hover:text-slate-200 transition-colors flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5 text-cyan-400" /> +91 {HELP_NUMBER}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t border-slate-800/60 mt-8 pt-8 text-center text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} Convora. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
