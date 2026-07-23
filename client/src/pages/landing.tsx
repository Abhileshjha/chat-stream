import { Link } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
      transition={{ duration: 0.5, delay }}
    >
      {children}
    </motion.div>
  );
}

export default function Landing() {
  return (
    <div className="min-h-screen bg-background">
      {/* Top help bar */}
      <div className="bg-primary text-primary-foreground text-center text-sm py-2 px-4">
        <Phone className="inline h-3.5 w-3.5 mr-1.5 -mt-0.5" />
        Need help? Call us at{" "}
        <a href={`tel:+91${HELP_NUMBER}`} className="font-semibold underline underline-offset-2">
          +91 {HELP_NUMBER}
        </a>
      </div>

      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <MessageSquare className="h-5 w-5" />
            </div>
            <span className="text-xl font-bold">Convora</span>
          </div>
          <div className="hidden md:flex items-center gap-6">
            <a href="#features" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm text-muted-foreground hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
            <Link href="/privacy" className="text-sm text-muted-foreground hover:text-foreground transition-colors">Privacy</Link>
          </div>
          <div className="flex items-center gap-3">
            <a href={`${APP_URL}/login`}>
              <Button variant="outline" data-testid="button-login">Log In</Button>
            </a>
            <a href={`${APP_URL}/login`}>
              <Button data-testid="button-get-started">Start Free Trial</Button>
            </a>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="pt-20 pb-24 px-4 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_60%_50%_at_50%_-20%,hsl(var(--primary)/0.15),transparent)]" />
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm text-muted-foreground mb-6">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Built on the official Meta WhatsApp Business API
            </div>
            <h1 className="text-4xl md:text-6xl font-serif font-bold leading-tight mb-6">
              Business leaders don't like limitations.
              <br />
              <span className="text-primary">So why are we setting limits?</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-8">
              Message without limits — with Convora. Broadcast to thousands of customers on WhatsApp,
              track every delivery in real time, and never pay a reseller markup again.
            </p>
            <div className="flex flex-wrap justify-center gap-4 mb-8">
              <a href={`${APP_URL}/login`}>
                <Button size="lg" className="gap-2" data-testid="button-start-free">
                  Start Free Trial <ArrowRight className="h-4 w-4" />
                </Button>
              </a>
              <a href="#pricing">
                <Button size="lg" variant="outline">See Pricing</Button>
              </a>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>7-day free trial</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>No credit card required</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="h-4 w-4 text-primary" />
                <span>Unlimited messages, one flat price</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <FadeIn>
            <div className="text-center mb-14">
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">From signup to broadcast in four steps</h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">No developers, no waiting weeks for setup</p>
            </div>
          </FadeIn>
          <div className="grid md:grid-cols-2 gap-8">
            {[
              { n: "01", title: "Connect your WhatsApp number", desc: "Link your verified WhatsApp Business number in minutes - no API keys to wrangle yourself." },
              { n: "02", title: "Create approved templates", desc: "Build message templates with images, buttons, and variables. We handle Meta's approval process." },
              { n: "03", title: "Import & segment contacts", desc: "Upload your contact list, organize into lists and tags, and target exactly who you want to reach." },
              { n: "04", title: "Broadcast & track results", desc: "Send to thousands at once and watch delivery, read receipts, and replies roll in live." },
            ].map((step, i) => (
              <FadeIn key={step.n} delay={i * 0.1}>
                <div className="flex gap-4">
                  <div className="text-3xl font-bold text-primary/40 font-mono shrink-0">{step.n}</div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{step.title}</h3>
                    <p className="text-muted-foreground text-sm">{step.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="py-20 px-4">
        <div className="container mx-auto max-w-6xl">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
                Everything You Need to Broadcast at Scale
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                Powerful features designed for businesses that need to reach customers effectively
              </p>
            </div>
          </FadeIn>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                <Card className="hover-elevate transition-all duration-300 h-full">
                  <CardHeader>
                    <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{f.title}</CardTitle>
                    <CardDescription>{f.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Why Convora */}
      <section className="py-20 px-4 bg-muted/30">
        <div className="container mx-auto max-w-5xl">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Why businesses choose Convora</h2>
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
                <div className="flex gap-3">
                  <Check className="h-5 w-5 text-primary shrink-0 mt-1" />
                  <div>
                    <h3 className="font-semibold mb-1">{item.title}</h3>
                    <p className="text-muted-foreground text-sm">{item.desc}</p>
                  </div>
                </div>
              </FadeIn>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4">
        <div className="container mx-auto max-w-4xl">
          <FadeIn>
            <div className="text-center mb-12">
              <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">
                Simple, Transparent Pricing
              </h2>
              <p className="text-lg text-muted-foreground">
                One plan with everything you need to grow your business
              </p>
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <Card className="max-w-md mx-auto border-2 border-primary">
              <CardHeader className="text-center pb-2">
                <div className="inline-block mx-auto px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
                  Most Popular
                </div>
                <CardTitle className="text-2xl">Unlimited Plan</CardTitle>
                <CardDescription>Everything you need for WhatsApp broadcasting</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="text-center">
                  <span className="text-5xl font-bold">₹799</span>
                  <span className="text-muted-foreground">/month</span>
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
                      <Check className="h-5 w-5 text-primary flex-shrink-0" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>

                <a href={`${APP_URL}/login`} className="block">
                  <Button className="w-full" size="lg" data-testid="button-subscribe">
                    Start 7-Day Free Trial
                  </Button>
                </a>
                <p className="text-center text-sm text-muted-foreground">
                  No credit card required to start · Upgrade anytime
                </p>
              </CardContent>
            </Card>
          </FadeIn>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 px-4 bg-primary text-primary-foreground">
        <div className="container mx-auto max-w-3xl text-center">
          <FadeIn>
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Stop messaging with limits.</h2>
            <p className="text-lg opacity-90 mb-8">Join Convora and reach every customer, every time.</p>
            <a href={`${APP_URL}/login`}>
              <Button size="lg" variant="secondary" className="gap-2">
                Start Your Free Trial <ArrowRight className="h-4 w-4" />
              </Button>
            </a>
          </FadeIn>
        </div>
      </section>

      <footer className="border-t py-12 px-4">
        <div className="container mx-auto max-w-6xl">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                  <MessageSquare className="h-4 w-4" />
                </div>
                <span className="font-bold">Convora</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Message without limits. Professional WhatsApp broadcasting for businesses.
              </p>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Product</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><a href="#features" className="hover:text-foreground transition-colors">Features</a></li>
                <li><a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a></li>
                <li><a href={`${APP_URL}/login`} className="hover:text-foreground transition-colors">Login</a></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/privacy" className="hover:text-foreground transition-colors">Privacy Policy</Link></li>
                <li><Link href="/terms" className="hover:text-foreground transition-colors">Terms of Service</Link></li>
                <li><Link href="/refund" className="hover:text-foreground transition-colors">Refund Policy</Link></li>
                <li><Link href="/delete-data" className="hover:text-foreground transition-colors">Data Deletion</Link></li>
              </ul>
            </div>

            <div>
              <h4 className="font-semibold mb-4">Support</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link href="/contact" className="hover:text-foreground transition-colors">Contact Us</Link></li>
                <li>
                  <a href={`tel:+91${HELP_NUMBER}`} className="hover:text-foreground transition-colors flex items-center gap-1.5">
                    <Phone className="h-3.5 w-3.5" /> +91 {HELP_NUMBER}
                  </a>
                </li>
              </ul>
            </div>
          </div>

          <div className="border-t mt-8 pt-8 text-center text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} Convora. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
