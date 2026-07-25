import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  MessageSquare,
  Users,
  BarChart3,
  Shield,
  Zap,
  Check,
  ArrowRight,
  Phone,
  Inbox,
  Send,
  FileText,
  RefreshCw,
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

const features = [
  {
    icon: Send,
    title: "Broadcast campaigns",
    desc: "Send offers, launches and event invites to thousands of opted-in contacts in minutes — with per-campaign delivery tracking.",
  },
  {
    icon: FileText,
    title: "Template manager",
    desc: "Create, submit and track Meta template approvals from the dashboard. Buttons, media headers and variables included.",
  },
  {
    icon: Inbox,
    title: "Shared team inbox",
    desc: "Every reply lands in one inbox your whole team can work from — assign chats, add notes and never miss a hot lead.",
  },
  {
    icon: Users,
    title: "Contact management",
    desc: "Import contacts, tag by project or interest, segment audiences and keep opt-in status clean and compliant.",
  },
  {
    icon: BarChart3,
    title: "Real-time analytics",
    desc: "Sent, delivered, read and failed — tracked live per message and per campaign, so you know exactly what's working.",
  },
  {
    icon: RefreshCw,
    title: "Meta API sync",
    desc: "One-click sync keeps your quality rating, messaging limits and template statuses up to date, straight from Meta.",
  },
];

const steps = [
  {
    n: "01",
    title: "Connect your Meta API",
    desc: "Link your WhatsApp Business account with guided embedded signup. We handle the technical setup end-to-end.",
  },
  {
    n: "02",
    title: "Create your templates",
    desc: "Build message templates with media, variables and call-to-action buttons, then submit them to Meta for approval in-app.",
  },
  {
    n: "03",
    title: "Launch & track campaigns",
    desc: "Pick your audience, schedule the broadcast, and watch delivery and read rates update in real time.",
  },
];

const useCases = [
  {
    tag: "Real estate",
    title: "Developers & brokers",
    desc: "From new-launch blasts to site-visit reminders and possession updates.",
    items: [
      "Project launch broadcasts with brochures",
      "Lead follow-up sequences from Meta ads",
      "Channel-partner event invites",
    ],
  },
  {
    tag: "D2C & retail",
    title: "Stores & e-commerce",
    desc: "Recover carts, announce sales and confirm orders where customers read.",
    items: [
      "Order & delivery notifications",
      "Festive offer campaigns",
      "Abandoned-cart nudges",
    ],
  },
  {
    tag: "Agencies",
    title: "Marketing agencies",
    desc: "Run WhatsApp as a managed service for your clients under one roof.",
    items: [
      "Multi-client campaign management",
      "Client-ready delivery reports",
      "Team inbox with assignments",
    ],
  },
];

const plans = [
  {
    name: "Starter",
    tagline: "For small teams getting started",
    price: "₹1,999",
    featured: false,
    features: [
      "1 WhatsApp number",
      "2,500 contacts",
      "10 message templates",
      "Broadcast campaigns",
      "Basic analytics",
      "Email support",
    ],
    cta: "Start free trial",
  },
  {
    name: "Growth",
    tagline: "For growing sales & marketing teams",
    price: "₹4,999",
    featured: true,
    features: [
      "1 WhatsApp number",
      "25,000 contacts",
      "Unlimited templates",
      "Shared team inbox (5 seats)",
      "Campaign scheduling & segments",
      "Real-time delivery analytics",
      "Priority WhatsApp support",
    ],
    cta: "Start free trial",
  },
  {
    name: "Scale",
    tagline: "For agencies & high-volume senders",
    price: "₹9,999",
    featured: false,
    features: [
      "Multiple WhatsApp numbers",
      "Unlimited contacts",
      "Unlimited templates & campaigns",
      "Team inbox (unlimited seats)",
      "Multi-client workspaces",
      "API access & webhooks",
      "Dedicated account manager",
    ],
    cta: "Talk to sales",
  },
];

const faqs = [
  {
    q: "Is this the official WhatsApp Business API?",
    a: "Yes. Convora runs entirely on the official Meta WhatsApp Business Platform. Your number gets a verified business profile, and there's no risk of the bans that come with unofficial bulk-sender tools.",
  },
  {
    q: "Do I need a new phone number?",
    a: "You can use a fresh number or migrate an existing WhatsApp Business number. A number connected to the API can't be used in the regular WhatsApp app at the same time, so most teams dedicate a number to it.",
  },
  {
    q: "What are Meta conversation charges?",
    a: "Meta charges a small per-conversation fee for messages sent via the API, based on category (marketing, utility, authentication). These are billed at Meta's actual rates with no markup from us — your plan fee only covers the platform.",
  },
  {
    q: "How fast do templates get approved?",
    a: "Most templates are reviewed by Meta within minutes to a few hours. Convora shows the live approval status of every template, and our team helps you fix rejected ones.",
  },
  {
    q: "Can my whole team use one number?",
    a: "Yes — that's the point of the shared inbox. Multiple teammates can read, reply to and assign conversations on the same WhatsApp number, with full history visible to everyone.",
  },
  {
    q: "Is there a free trial?",
    a: "Every plan comes with a free trial. Connect your number, send real campaigns and see the analytics before you pay anything.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 selection:bg-cyan-400/30 relative">
      <div
        className="fixed inset-0 -z-20 opacity-[0.15]"
        style={{
          backgroundImage: "radial-gradient(circle, rgba(148,163,184,0.4) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />
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
            <a href="#use-cases" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Use Cases</a>
            <a href="#pricing" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">Pricing</a>
            <a href="#faq" className="text-sm text-slate-400 hover:text-slate-100 transition-colors">FAQ</a>
          </div>
          <div className="flex items-center gap-3">
            <a href={`${APP_URL}/login`}>
              <Button variant="outline" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800 hover:text-slate-100" data-testid="button-login">Log In</Button>
            </a>
            <a href={`${APP_URL}/login`}>
              <Button className="bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-semibold hover:from-cyan-300 hover:to-cyan-400" data-testid="button-get-started">Get Started</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-20 px-4 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,rgba(34,211,238,0.14),transparent)]" />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(to_bottom,transparent,rgba(9,9,11,0.6))]" />
        <div className="absolute -left-32 top-10 h-72 w-72 rounded-full bg-cyan-500/10 blur-[100px] -z-10" />
        <div className="absolute -right-24 top-1/3 h-80 w-80 rounded-full bg-blue-600/10 blur-[110px] -z-10" />
        <div className="container mx-auto max-w-6xl">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-400/5 px-4 py-1.5 text-sm text-cyan-300 mb-8">
                <Shield className="h-3.5 w-3.5" />
                Official Meta WhatsApp Business API
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-serif font-semibold leading-tight mb-6 tracking-tight">
                Turn WhatsApp into your{" "}
                <span className="bg-gradient-to-r from-cyan-200 via-cyan-400 to-cyan-500 bg-clip-text text-transparent">
                  #1 revenue channel
                </span>
              </h1>
              <p className="text-lg md:text-xl text-slate-400 max-w-xl mb-10 leading-relaxed">
                Broadcast campaigns, approved templates, a shared team inbox and real-time delivery
                analytics — everything your business needs to sell, support and follow up on WhatsApp,
                from one dashboard.
              </p>
              <div className="flex flex-wrap gap-4 mb-10">
                <a href={`${APP_URL}/login`}>
                  <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-semibold hover:from-cyan-300 hover:to-cyan-400 shadow-lg shadow-cyan-500/20" data-testid="button-start-free">
                    Start Free Trial <ArrowRight className="h-4 w-4" />
                  </Button>
                </a>
                <a href="#how-it-works">
                  <Button size="lg" variant="outline" className="border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800">See How It Works</Button>
                </a>
              </div>
              <div className="flex flex-wrap items-center gap-6 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-400" />
                  <span>90%+ delivery rate</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-400" />
                  <span>No-code setup</span>
                </div>
                <div className="flex items-center gap-2">
                  <Check className="h-4 w-4 text-cyan-400" />
                  <span>Cancel anytime</span>
                </div>
              </div>
            </motion.div>

            {/* Phone mockup */}
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
              className="relative flex justify-center"
            >
              <div className="absolute -top-4 -left-4 md:-left-10 z-10 rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm px-4 py-3 shadow-xl hidden sm:block">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Messages sent</p>
                <p className="text-xl font-serif font-semibold text-slate-100">7,839</p>
                <p className="text-[11px] text-cyan-400 flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse" /> live campaign
                </p>
              </div>
              <div className="absolute -bottom-4 -right-4 md:-right-10 z-10 rounded-xl border border-slate-800 bg-slate-900/90 backdrop-blur-sm px-4 py-3 shadow-xl hidden sm:block">
                <p className="text-[10px] uppercase tracking-wide text-slate-500">Delivery rate</p>
                <p className="text-xl font-serif font-semibold text-slate-100">90.8%</p>
                <p className="text-[11px] text-cyan-400">quality: high</p>
              </div>

              <div className="w-[300px] rounded-[2rem] border border-slate-800 bg-slate-900/60 backdrop-blur-sm shadow-2xl shadow-cyan-500/10 overflow-hidden">
                <div className="bg-gradient-to-r from-cyan-500/20 to-cyan-400/10 border-b border-slate-800 px-4 py-3 flex items-center gap-2.5">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-cyan-300 to-cyan-600 flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-slate-950" />
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-slate-100">Your Business</p>
                    <p className="text-xs text-cyan-400">online · verified</p>
                  </div>
                </div>
                <div className="p-4 space-y-3 text-left">
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-cyan-500/15 border border-cyan-400/20 px-3.5 py-2">
                      <p className="text-sm text-slate-100 leading-snug">
                        🎉 New Launch Alert! Premium retail shops now open for booking from ₹28L*. Assured
                        footfall location, limited units.
                      </p>
                      <p className="text-xs text-cyan-300 mt-1.5 border-t border-cyan-400/20 pt-1.5 text-center font-medium">📅 Book a site visit</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-slate-500">11:02</span>
                        <svg width="14" height="10" viewBox="0 0 16 11" className="text-cyan-400">
                          <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M1 5.5L4 8.5L10 1.5" />
                          <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M6 5.5L9 8.5L15 1.5" />
                        </svg>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-start">
                    <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-800/80 border border-slate-700/60 px-3.5 py-2">
                      <p className="text-sm text-slate-100 leading-snug">Interested! Can you share the price list and floor plan?</p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-slate-500">11:04</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <div className="max-w-[85%] rounded-2xl rounded-tr-sm bg-cyan-500/15 border border-cyan-400/20 px-3.5 py-2">
                      <p className="text-sm text-slate-100 leading-snug">
                        Sure — sending the brochure now. Our team will call you within 10 minutes to
                        schedule your visit. 🤝
                      </p>
                      <div className="flex items-center justify-end gap-1 mt-1">
                        <span className="text-[10px] text-slate-500">11:04</span>
                        <svg width="14" height="10" viewBox="0 0 16 11" className="text-cyan-400">
                          <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M1 5.5L4 8.5L10 1.5" />
                          <path fill="none" stroke="currentColor" strokeWidth="1.5" d="M6 5.5L9 8.5L15 1.5" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Trust strip */}
      <section className="border-y border-slate-800/60 bg-slate-900/30 py-7 px-4">
        <div className="container mx-auto max-w-6xl flex flex-wrap items-center justify-between gap-7">
          <div className="flex items-center gap-3 text-sm text-slate-400 max-w-md">
            <Shield className="h-6 w-6 text-cyan-400 shrink-0" />
            <span>
              Built on the <b className="text-slate-100">official Meta WhatsApp Business API</b> — no
              grey-market tools, no ban risk.
            </span>
          </div>
          <div className="flex flex-wrap gap-8 md:gap-11">
            {[
              { value: "1M+", label: "messages / mo" },
              { value: "90%", label: "avg delivery" },
              { value: "40%", label: "avg read rate" },
              { value: "High", label: "quality rating" },
            ].map((s) => (
              <div key={s.label}>
                <p className="text-2xl font-serif font-semibold text-cyan-400">{s.value}</p>
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-24 px-4">
        <div className="container mx-auto max-w-6xl">
          <FadeIn>
            <div className="max-w-2xl mb-14">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">Platform</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">
                Everything WhatsApp marketing needs, in one place
              </h2>
              <p className="text-lg text-slate-400">
                Convora replaces the mess of spreadsheets, broadcast lists and manual follow-ups with a
                single, compliant command centre.
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
            {features.map((f, i) => (
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

      {/* How it works */}
      <section id="how-it-works" className="py-24 px-4 border-t border-slate-800/60">
        <div className="container mx-auto max-w-5xl">
          <FadeIn>
            <div className="max-w-2xl mb-14">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">Setup</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">Live in three steps, not three weeks</h2>
              <p className="text-lg text-slate-400">
                If you have a Facebook Business account and a phone number, you can be sending your first
                campaign today.
              </p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-6">
            {steps.map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1}>
                <div className="h-full p-6 rounded-xl border border-slate-800/80 bg-slate-900/40 hover:border-cyan-400/30 transition-colors">
                  <div className="text-3xl font-semibold bg-gradient-to-br from-cyan-300 to-cyan-600 bg-clip-text text-transparent font-mono mb-4">{step.n}</div>
                  <h3 className="font-semibold text-lg mb-1.5 text-slate-100">{step.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed">{step.desc}</p>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Use cases */}
      <section id="use-cases" className="py-24 px-4 border-t border-slate-800/60 bg-slate-900/20">
        <div className="container mx-auto max-w-6xl">
          <FadeIn>
            <div className="max-w-2xl mb-14">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">Who it's for</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">Built for teams that sell in conversations</h2>
              <p className="text-lg text-slate-400">
                WhatsApp is where Indian buyers actually respond. Convora turns those conversations into a
                pipeline.
              </p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-3 gap-5">
            {useCases.map((c, i) => (
              <FadeIn key={c.title} delay={i * 0.1}>
                <div className="h-full p-6 rounded-xl border border-slate-800/80 bg-gradient-to-b from-slate-900/60 to-transparent">
                  <span className="inline-block text-xs font-medium uppercase tracking-wide text-cyan-300 bg-cyan-400/10 border border-cyan-400/20 rounded-full px-3 py-1 mb-4">
                    {c.tag}
                  </span>
                  <h3 className="font-semibold text-lg mb-1.5 text-slate-100">{c.title}</h3>
                  <p className="text-slate-400 text-sm leading-relaxed mb-4">{c.desc}</p>
                  <ul className="space-y-2">
                    {c.items.map((item) => (
                      <li key={item} className="flex items-start gap-2 text-sm text-slate-400">
                        <Check className="h-4 w-4 text-cyan-400 shrink-0 mt-0.5" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24 px-4 border-t border-slate-800/60">
        <div className="container mx-auto max-w-6xl">
          <FadeIn>
            <div className="text-center max-w-2xl mx-auto mb-14">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">Pricing</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">
                Simple plans that scale with your messaging
              </h2>
              <p className="text-lg text-slate-400">
                Every plan runs on the official API. Meta's per-conversation charges are billed at cost —
                we never mark them up.
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-3 gap-6 items-stretch">
            {plans.map((plan, i) => (
              <FadeIn key={plan.name} delay={i * 0.1}>
                <div
                  className={`h-full flex flex-col rounded-2xl p-8 backdrop-blur-sm relative ${
                    plan.featured
                      ? "border border-cyan-400/40 bg-gradient-to-b from-slate-900/80 to-slate-900/40 shadow-2xl shadow-cyan-500/10"
                      : "border border-slate-800/80 bg-slate-900/40"
                  }`}
                >
                  {plan.featured && (
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-cyan-400 text-slate-950 text-xs font-semibold uppercase tracking-wide px-4 py-1">
                      Most Popular
                    </div>
                  )}
                  <h3 className="text-xl font-serif font-semibold text-slate-100">{plan.name}</h3>
                  <p className="text-slate-500 text-sm mt-1">{plan.tagline}</p>
                  <div className="mt-6 mb-1">
                    <span className="text-4xl font-bold text-slate-100">{plan.price}</span>
                    <span className="text-slate-500">/month</span>
                  </div>
                  <p className="text-xs text-slate-500 font-mono mb-6">+ Meta conversation charges, + GST</p>

                  <ul className="space-y-3 mb-8 flex-1">
                    {plan.features.map((item) => (
                      <li key={item} className="flex items-center gap-3">
                        <Check className="h-4 w-4 text-cyan-400 flex-shrink-0" />
                        <span className="text-slate-300 text-sm">{item}</span>
                      </li>
                    ))}
                  </ul>

                  <a href={`${APP_URL}/login`} className="block">
                    <Button
                      className={`w-full font-semibold ${
                        plan.featured
                          ? "bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 hover:from-cyan-300 hover:to-cyan-400"
                          : "border border-slate-700 bg-transparent text-slate-200 hover:bg-slate-800"
                      }`}
                      size="lg"
                      data-testid={`button-subscribe-${plan.name.toLowerCase()}`}
                    >
                      {plan.cta}
                    </Button>
                  </a>
                </div>
              </FadeIn>
            ))}
          </div>
          <p className="text-center text-sm text-slate-500 font-mono mt-8">
            All prices exclusive of GST · Free trial on every plan · No setup fees
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-24 px-4 border-t border-slate-800/60">
        <div className="container mx-auto max-w-3xl">
          <FadeIn>
            <div className="text-center mb-12">
              <p className="text-cyan-400 text-sm font-medium tracking-wide uppercase mb-3">FAQ</p>
              <h2 className="text-3xl md:text-4xl font-serif font-semibold">Questions, answered</h2>
            </div>
          </FadeIn>
          <FadeIn delay={0.1}>
            <Accordion type="single" collapsible className="w-full">
              {faqs.map((item, i) => (
                <AccordionItem
                  key={item.q}
                  value={`item-${i}`}
                  className="border border-slate-800/80 rounded-xl bg-slate-900/40 px-6 mb-3 last:mb-0"
                >
                  <AccordionTrigger className="text-left font-serif font-semibold text-slate-100 hover:no-underline py-5">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="text-slate-400 text-sm leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-24 px-4 border-t border-slate-800/60 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_50%_80%_at_50%_100%,rgba(34,211,238,0.08),transparent)]" />
        <div className="container mx-auto max-w-3xl text-center">
          <FadeIn>
            <div className="rounded-3xl border border-cyan-400/30 bg-gradient-to-b from-slate-900/80 to-slate-900/40 px-6 md:px-16 py-16">
              <h2 className="text-3xl md:text-4xl font-serif font-semibold mb-4">
                Your customers are already on WhatsApp.
                <br />
                Meet them there.
              </h2>
              <p className="text-lg text-slate-400 mb-8 max-w-lg mx-auto">
                Set up in a day, send your first campaign this week, and watch the read rates speak for
                themselves.
              </p>
              <a href={`${APP_URL}/login`}>
                <Button size="lg" className="gap-2 bg-gradient-to-r from-cyan-400 to-cyan-500 text-slate-950 font-semibold hover:from-cyan-300 hover:to-cyan-400 shadow-lg shadow-cyan-500/20">
                  Start Your Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
            </div>
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
                The WhatsApp Business API platform for teams that sell in conversations.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4 text-slate-200">Product</h4>
              <ul className="space-y-2 text-sm text-slate-500">
                <li><a href="#features" className="hover:text-slate-200 transition-colors">Features</a></li>
                <li><a href="#how-it-works" className="hover:text-slate-200 transition-colors">How It Works</a></li>
                <li><a href="#pricing" className="hover:text-slate-200 transition-colors">Pricing</a></li>
                <li><a href="#faq" className="hover:text-slate-200 transition-colors">FAQ</a></li>
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

          <div className="border-t border-slate-800/60 mt-8 pt-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-slate-500">
            <p>&copy; {new Date().getFullYear()} Convora. All rights reserved.</p>
            <p>Built on the official Meta WhatsApp Business Platform</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
