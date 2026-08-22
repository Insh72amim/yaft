import type { Metadata } from 'next';
import { MarketingNav } from '@/components/marketing/marketing-nav';
import { MarketingHero } from '@/components/marketing/marketing-hero';
import { MarketingEcosystem } from '@/components/marketing/marketing-ecosystem';
import { MarketingFeatures } from '@/components/marketing/marketing-features';
import { MarketingSecurity } from '@/components/marketing/marketing-security';
import { MarketingComparison } from '@/components/marketing/marketing-comparison';
import { MarketingDeploy } from '@/components/marketing/marketing-deploy';
import { MarketingFaq } from '@/components/marketing/marketing-faq';
import { MarketingFooter } from '@/components/marketing/marketing-footer';

export const metadata: Metadata = {
  title: 'YAFT — Private, Self-Hosted Financial Workspace',
  description:
    'A private, local-first financial ledger for Indian bank statements, credit card utilization, corporate payslips, EPFO passbooks, and broker holdings. Zero cloud exposure.',
};

export default function Home() {
  return (
    <main className="mkt-page-wrapper">
      <MarketingNav />
      <MarketingHero />
      <MarketingEcosystem />
      <MarketingFeatures />
      <MarketingSecurity />
      <MarketingComparison />
      <MarketingDeploy />
      <MarketingFaq />
      <MarketingFooter />
    </main>
  );
}
