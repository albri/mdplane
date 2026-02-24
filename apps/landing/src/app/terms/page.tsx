import { Metadata } from 'next'
import { SiteFooter, SiteHeader } from '../site-chrome'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description:
    'Terms of Service for mdplane. Rules for using our markdown coordination platform.',
}

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-3xl font-bold mb-4">Terms of Service</h1>
        <p className="text-muted-foreground mb-8">Effective Date: January 2026</p>

        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Acceptance of Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing and using MarkdownPlane services (&quot;Service&quot;), you accept and agree to be bound by these terms. If you do not agree, you should not use this Service.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              MarkdownPlane is a personal project operated by its creator (&quot;we&quot;, &quot;us&quot;, or &quot;our&quot;). These Terms of Service (&quot;Terms&quot;) govern your use of mdplane.dev and related services.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Description of Service</h2>
            <p className="text-muted-foreground leading-relaxed">
              MarkdownPlane provides markdown-based coordination infrastructure for AI coding agents and developers. The Service creates capability URLs for file sharing and task coordination — essentially a &quot;pastebin for the agentic era&quot; that can grow into a full coordination layer.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4 font-medium text-foreground">Key characteristics:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-2 space-y-1">
              <li>Files you create belong to you</li>
              <li>Anonymous (unclaimed) workspaces can be claimed later via email verification</li>
              <li>Self-hosted deployment is available for users who prefer full control</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. Acceptable Use Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to use the Service only for lawful purposes. You agree not to:
            </p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-4 space-y-1">
              <li>Use the Service to store illegal, harmful, or malicious content</li>
              <li>Attempt to access other users&apos; files without authorization</li>
              <li>Share capability URLs publicly if they grant write access to sensitive data</li>
              <li>Exceed rate limits or attempt to circumvent usage restrictions</li>
              <li>Use the Service for spam, harassment, or abuse</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Your Data, Your Responsibility</h2>
            <p className="text-muted-foreground leading-relaxed">
              <span className="font-medium text-foreground">Capability URLs are secrets.</span> Anyone with a write or append URL can modify your files. Protect them like passwords.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <span className="font-medium text-foreground">Backups are your responsibility.</span> While we aim for reliability, we do not guarantee data preservation. Export your data regularly if it&apos;s important.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <span className="font-medium text-foreground">Anonymous workspaces expire.</span> Unclaimed workspaces with no activity for 90 days are soft-deleted, then permanently deleted after 30 more days.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Service Availability</h2>
            <p className="text-muted-foreground leading-relaxed">
              We aim for high availability but provide no uptime guarantees. This is a personal project, not an enterprise SLA.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              <span className="font-medium text-foreground">Self-hosted users:</span> You are responsible for your own availability, backups, and security.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Disclaimer of Warranties</h2>
            <p className="text-muted-foreground leading-relaxed uppercase">
              THE SERVICE IS PROVIDED &quot;AS IS&quot; WITHOUT WARRANTIES OF ANY KIND, EITHER EXPRESS OR IMPLIED. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED OR ERROR-FREE.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Limitation of Liability</h2>
            <p className="text-muted-foreground leading-relaxed uppercase">
              IN NO EVENT SHALL WE BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES ARISING OUT OF YOUR USE OF THE SERVICE.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              This is a free, personal project. Use accordingly.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Termination</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend access at any time for violation of these Terms or at our discretion.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4">
              You may stop using the Service at any time. Your unclaimed workspaces will be cleaned up per the standard retention policy.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Changes to Terms</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update these Terms. Continued use after changes constitutes acceptance.
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-muted-foreground text-sm">
            For questions about these terms, contact us at{' '}
            <a href="mailto:hello@mdplane.dev" className="text-foreground hover:underline">
              hello@mdplane.dev
            </a>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
