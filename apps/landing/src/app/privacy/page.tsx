import { Metadata } from 'next'
import Link from 'next/link'
import { SiteFooter, SiteHeader } from '../site-chrome'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description:
    'Privacy Policy for mdplane. We collect minimal data. Your files are yours. We do not sell anything.',
}

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background font-sans">
      <SiteHeader />

      <main className="mx-auto max-w-3xl px-6 py-24">
        <h1 className="text-3xl font-bold mb-4">Privacy Policy</h1>
        <p className="text-muted-foreground mb-8">Effective Date: January 2026</p>

        <div className="space-y-10">
          <section>
            <h2 className="text-xl font-semibold mb-4">1. Introduction</h2>
            <p className="text-muted-foreground leading-relaxed">
              This Privacy Policy explains how we collect, use, and protect information when you use MarkdownPlane.
            </p>
            <p className="text-muted-foreground leading-relaxed mt-4 font-medium text-foreground">
              Summary: We collect minimal data. Your files are yours. We don&apos;t sell anything.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">2. Information We Collect</h2>
            <p className="text-muted-foreground leading-relaxed font-medium text-foreground">If you claim a workspace (optional):</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-2 space-y-1">
              <li>Email address (for authentication and workspace recovery)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4 font-medium text-foreground">Automatically collected:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-2 space-y-1">
              <li>Basic request logs (IP addresses, timestamps, endpoints) for rate limiting and abuse prevention</li>
              <li>Error logs for debugging</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4 font-medium text-foreground">What we do NOT collect:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-2 space-y-1">
              <li>Analytics or tracking cookies</li>
              <li>Advertising data</li>
              <li>Detailed behavioral profiles</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">3. How We Use Your Information</h2>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed space-y-1">
              <li><span className="font-medium text-foreground">Service Provision:</span> Authenticating claimed workspaces via OAuth</li>
              <li><span className="font-medium text-foreground">Rate Limiting:</span> Preventing abuse</li>
              <li><span className="font-medium text-foreground">Debugging:</span> Investigating errors when something breaks</li>
              <li><span className="font-medium text-foreground">Security:</span> Detecting unauthorized access attempts</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              We do not sell, trade, or rent your information.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">4. Data Storage</h2>
            <p className="text-muted-foreground leading-relaxed font-medium text-foreground">Hosted service (mdplane.dev):</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-2 space-y-1">
              <li>Files stored on our infrastructure</li>
              <li>Retained until you delete them (or workspace expires)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4 font-medium text-foreground">Self-hosted:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-2 space-y-1">
              <li>All data stays on your infrastructure</li>
              <li>We have no access to your files</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">5. Data Retention</h2>
            <div className="border border-border overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    <th className="text-left px-4 py-2 font-medium">Data Type</th>
                    <th className="text-left px-4 py-2 font-medium">Retention</th>
                  </tr>
                </thead>
                <tbody className="text-muted-foreground">
                  <tr className="border-t border-border">
                    <td className="px-4 py-2">File content</td>
                    <td className="px-4 py-2">Until deletion or workspace expiry</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-2">Email (claimed workspaces)</td>
                    <td className="px-4 py-2">Until account deletion</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-2">Request logs</td>
                    <td className="px-4 py-2">30 days</td>
                  </tr>
                  <tr className="border-t border-border">
                    <td className="px-4 py-2">Error logs</td>
                    <td className="px-4 py-2">30 days</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">6. Your Rights</h2>
            <p className="text-muted-foreground leading-relaxed">You can:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-2 space-y-1">
              <li><span className="font-medium text-foreground">Export:</span> Download all your workspace data at any time</li>
              <li><span className="font-medium text-foreground">Delete:</span> Delete files, folders, or entire workspaces</li>
              <li><span className="font-medium text-foreground">Leave:</span> Stop using the service (unclaimed workspaces auto-expire)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              For claimed workspaces, contact us to request account deletion.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">7. Security</h2>
            <p className="text-muted-foreground leading-relaxed">We implement reasonable security measures:</p>
            <ul className="list-disc list-inside text-muted-foreground leading-relaxed mt-2 space-y-1">
              <li>HTTPS for all connections</li>
              <li>Capability URLs as access control</li>
              <li>Rate limiting to prevent abuse</li>
              <li>No passwords stored (OAuth via GitHub/Google)</li>
            </ul>
            <p className="text-muted-foreground leading-relaxed mt-4">
              No system is 100% secure. Protect your capability URLs.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">8. Children&apos;s Privacy</h2>
            <p className="text-muted-foreground leading-relaxed">
              MarkdownPlane is not intended for use by individuals under 13. We do not knowingly collect information from children under 13.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">9. Changes to This Policy</h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this policy. Changes will be posted on this page.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-4">10. Contact</h2>
            <p className="text-muted-foreground leading-relaxed">
              For questions about these policies:{' '}
              <a href="mailto:hello@mdplane.dev" className="text-foreground hover:underline">
                hello@mdplane.dev
              </a>
            </p>
          </section>
        </div>

        <div className="mt-12 pt-8 border-t border-border">
          <p className="text-muted-foreground text-sm">
            See also:{' '}
            <Link href="/terms" className="text-foreground hover:underline">
              Terms of Service
            </Link>
          </p>
        </div>
      </main>

      <SiteFooter />
    </div>
  )
}
