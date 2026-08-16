import { PrismaClient } from '@prisma/client';
import { JwtService } from '@nestjs/jwt';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: '/Users/yaft/Code/YAFT/.env' });
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.resolve(process.cwd(), '.env') });
}

const WEB_BASE = process.env.WEB_ORIGIN || 'http://localhost:3000';
const API_BASE = 'http://localhost:4000/api';

interface TestResult {
  category: string;
  name: string;
  url: string;
  status: 'PASS' | 'FAIL';
  statusCode: number;
  latencyMs: number;
  details: string;
}

async function runUITests() {
  console.log('================================================================');
  console.log('   YAFT Comprehensive UI & Sub-Pages End-to-End Test Suite');
  console.log('================================================================\n');

  const prisma = new PrismaClient();
  const jwt = new JwtService({ secret: process.env.JWT_SECRET || '<REDACTED_JWT_SECRET>' });

  const user = await prisma.user.findFirst({
    where: {
      accounts: { some: {} },
    },
  });

  if (!user) {
    console.error('❌ Error: No user with financial accounts found in database to test.');
    process.exit(1);
  }

  const token = await jwt.signAsync(
    { sub: user.id, email: user.email },
    { issuer: 'yaft', audience: 'yaft-web' },
  );

  const authHeaders = {
    Cookie: `finance_session=${token}`,
    Authorization: `Bearer ${token}`,
  };

  const results: TestResult[] = [];

  async function testRoute(category: string, name: string, url: string, expectedStatus = 200, validator?: (body: any) => string | null) {
    const start = Date.now();
    try {
      const res = await fetch(url, { headers: authHeaders });
      const latencyMs = Date.now() - start;
      const isJson = res.headers.get('content-type')?.includes('application/json');
      const body = isJson ? await res.json() : await res.text();

      let validationError: string | null = null;
      if (res.status !== expectedStatus) {
        validationError = `Expected HTTP ${expectedStatus}, got ${res.status}`;
      } else if (validator) {
        validationError = validator(body);
      }

      if (validationError) {
        results.push({
          category,
          name,
          url,
          status: 'FAIL',
          statusCode: res.status,
          latencyMs,
          details: validationError,
        });
      } else {
        results.push({
          category,
          name,
          url,
          status: 'PASS',
          statusCode: res.status,
          latencyMs,
          details: 'Data verified OK',
        });
      }
    } catch (err: any) {
      results.push({
        category,
        name,
        url,
        status: 'FAIL',
        statusCode: 0,
        latencyMs: Date.now() - start,
        details: err.message || 'Network error',
      });
    }
  }

  // 1. Test All Top-Level Web Pages (HTML Rendering)
  console.log('🔍 Testing Top-Level Web Page Routes (HTML / DOM Rendering)...');
  const webPages = [
    { name: 'Dashboard Overview Page', path: '/dashboard' },
    { name: 'Accounts Directory Page', path: '/accounts' },
    { name: 'Transactions Ledger Page', path: '/transactions' },
    { name: 'Envelopes & Budgets Page', path: '/budgets' },
    { name: 'Credit Cards Hub Page', path: '/credit-cards' },
    { name: 'Salary & Income Page', path: '/salary' },
    { name: 'Smart Imports & Sync Page', path: '/import' },
    { name: 'Transaction Tags Page', path: '/tags' },
    { name: 'Portfolio & Assets Page', path: '/assets' },
    { name: 'User Profile & Settings Page', path: '/me' },
    { name: 'Login Page', path: '/login' },
    { name: 'Register Page', path: '/register' },
  ];

  for (const page of webPages) {
    await testRoute('Web Page HTML', page.name, `${WEB_BASE}${page.path}`, 200, (html: string) => {
      if (typeof html === 'string' && (html.includes('Cannot GET') || html.includes('Internal Server Error'))) {
        return 'Server returned error page';
      }
      return null;
    });
  }

  // 2. Test All Core Backend API Endpoints Powering the Pages
  console.log('🔍 Testing Core API Endpoints Powering Dashboard & Overview...');
  await testRoute('API Dashboard', 'User Profile (/auth/me)', `${API_BASE}/auth/me`, 200, (data) => {
    if (!data.id || !data.email) return 'Missing user profile fields';
    return null;
  });

  await testRoute('API Dashboard', 'Dashboard Metrics & Summary (/dashboard)', `${API_BASE}/dashboard`, 200, (data) => {
    if (typeof data.netWorth !== 'number') return 'Missing netWorth';
    if (!Array.isArray(data.accounts)) return 'Missing accounts array';
    return null;
  });

  await testRoute('API Dashboard', 'Net Worth History (/dashboard/assets-history)', `${API_BASE}/dashboard/assets-history`, 200, (data) => {
    if (!Array.isArray(data.history) || !data.allocation) return 'Expected history array and allocation object';
    return null;
  });

  // 3. Test Accounts & All Individual Sub-Pages dynamically
  console.log('🔍 Testing All Accounts & Individual Sub-Page Views...');
  const userAccounts = await prisma.account.findMany({ where: { userId: user.id } });

  await testRoute('API Accounts', 'Accounts List (/accounts)', `${API_BASE}/accounts`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected array of accounts';
    return null;
  });

  for (const acc of userAccounts) {
    // Web subpage URL: /accounts?account=<id>
    await testRoute(
      'Web Sub-Page',
      `Account View (${acc.type}: ${acc.name})`,
      `${WEB_BASE}/accounts?account=${acc.id}`,
      200,
    );

    // API ledger for account
    await testRoute(
      'API Account Sub-View',
      `Ledger Transactions (${acc.name})`,
      `${API_BASE}/accounts/${acc.id}/transactions`,
      200,
      (data) => {
        if (!Array.isArray(data.transactions)) return 'Missing transactions array';
        return null;
      },
    );

    // Account Timeline
    await testRoute(
      'API Account Sub-View',
      `Account Timeline (${acc.name})`,
      `${API_BASE}/accounts/${acc.id}/timeline`,
      200,
      (data) => {
        if (!Array.isArray(data.timeline)) return 'Missing timeline array';
        return null;
      },
    );

    // Account Documents Vault
    await testRoute(
      'API Account Sub-View',
      `Attached Documents (${acc.name})`,
      `${API_BASE}/accounts/${acc.id}/documents`,
      200,
      (data) => {
        if (!Array.isArray(data)) return 'Expected documents array';
        return null;
      },
    );

    // Specific Account Type Sub-Views
    if (acc.type === 'LOAN') {
      await testRoute(
        'API Loan Sub-View',
        `Loan Amortisation Schedule (${acc.name})`,
        `${API_BASE}/accounts/${acc.id}/loan`,
        200,
        (data) => {
          if (!data.loan || !Array.isArray(data.installments) || !data.summary) {
            return 'Invalid loan schedule data structure';
          }
          if (data.installments.length === 0) return 'Loan has 0 installments';
          return null;
        },
      );
    }
  }

  // 4. Test Transactions Page APIs
  console.log('🔍 Testing Transactions Page APIs...');
  await testRoute('API Transactions', 'All Transactions Ledger (/accounts/all-transactions)', `${API_BASE}/accounts/all-transactions`, 200, (data) => {
    if (!Array.isArray(data.transactions) || !data.pagination) {
      return 'Invalid all-transactions pagination structure';
    }
    return null;
  });

  // 5. Test Budgets & Categories APIs
  console.log('🔍 Testing Budgets & Category Rules APIs...');
  await testRoute('API Budgets', 'Category Budgets List (/budgets)', `${API_BASE}/budgets`, 200, (data) => {
    if (!data.summary || !Array.isArray(data.budgets)) return 'Expected budgets summary & budgets array';
    return null;
  });

  await testRoute('API Budgets', 'Categories List (/categories)', `${API_BASE}/categories`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected categories array';
    return null;
  });

  await testRoute('API Budgets', 'Category Rules List (/category-rules)', `${API_BASE}/category-rules`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected category rules array';
    return null;
  });

  // 6. Test Credit Cards Hub APIs
  console.log('🔍 Testing Credit Cards Hub APIs...');
  await testRoute('API Credit Cards', 'Credit Cards Summary (/accounts/credit-cards/summary)', `${API_BASE}/accounts/credit-cards/summary`, 200, (data) => {
    if (!data.cards || !Array.isArray(data.cards) || !data.summary) {
      return 'Invalid credit cards summary structure';
    }
    return null;
  });

  // 7. Test Salary & Income APIs
  console.log('🔍 Testing Salary Statements & Organizations APIs...');
  await testRoute('API Salary', 'Salary Statements List (/salary-statements)', `${API_BASE}/salary-statements`, 200, (data) => {
    if (!Array.isArray(data.statements) || !data.summary) return 'Expected salary overview with statements array';
    return null;
  });

  await testRoute('API Salary', 'Employer Organizations List (/organizations)', `${API_BASE}/organizations`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected organizations array';
    return null;
  });

  const salaryStatement = await prisma.salaryStatement.findFirst({ where: { userId: user.id } });
  if (salaryStatement) {
    await testRoute('API Salary Sub-View', `Salary Statement Detail (${salaryStatement.id})`, `${API_BASE}/salary-statements/${salaryStatement.id}`, 200, (data) => {
      if (!data.id || !Array.isArray(data.lineItems)) return 'Invalid salary statement detail';
      return null;
    });
  }

  // 8. Test Portfolio & Assets APIs
  console.log('🔍 Testing Investments & Demat Holdings APIs...');
  await testRoute('API Assets', 'Portfolio Holdings (/investments/portfolio)', `${API_BASE}/investments/portfolio`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected portfolio holdings array';
    return null;
  });

  await testRoute('API Assets', 'Active SIPs List (/investments/sips)', `${API_BASE}/investments/sips`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected SIPs array';
    return null;
  });

  // 9. Test Tags APIs
  console.log('🔍 Testing Tags & Analytics APIs...');
  await testRoute('API Tags', 'Tags List (/tags)', `${API_BASE}/tags`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected tags array';
    return null;
  });

  const tag = await prisma.tag.findFirst({ where: { userId: user.id } });
  if (tag) {
    await testRoute('API Tags Sub-View', `Tag Analytics (${tag.name})`, `${API_BASE}/tags/${tag.id}/analytics`, 200, (data) => {
      if (!data.summary || typeof data.summary.totalSpent !== 'number') return 'Missing summary.totalSpent in tag analytics';
      return null;
    });
  }

  // 10. Test Smart Imports & Email Ingestion APIs
  console.log('🔍 Testing Smart Imports & Email Ingestion APIs...');
  await testRoute('API Imports', 'Import Options (/imports/unified/options)', `${API_BASE}/imports/unified/options`, 200, (data) => {
    if (!Array.isArray(data.options)) return 'Expected import options array';
    return null;
  });

  await testRoute('API Imports', 'Pending Imports Review Queue (/imports/unified/pending)', `${API_BASE}/imports/unified/pending`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected pending imports array';
    return null;
  });

  await testRoute('API Imports', 'Import History (/imports/unified/history)', `${API_BASE}/imports/unified/history`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected import history array';
    return null;
  });

  await testRoute('API Email Ingestion', 'Gmail Sync Logs (/email-ingestion/logs)', `${API_BASE}/email-ingestion/logs`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected email sync logs array';
    return null;
  });

  await testRoute('API Email Ingestion', 'Google Gmail Config (/email-ingestion/google/config)', `${API_BASE}/email-ingestion/google/config`, 200, (data) => {
    if (typeof data.connected !== 'boolean') return 'Missing connected status in Google Gmail config';
    return null;
  });

  // 11. Test Backup & Google Drive Cloud APIs
  console.log('🔍 Testing Backup & Google Drive Cloud APIs...');
  await testRoute('API Backup', 'Google Drive Config (/backup/drive/config)', `${API_BASE}/backup/drive/config`, 200, (data) => {
    if (typeof data.connected !== 'boolean') return 'Missing connected status in Google Drive config';
    return null;
  });

  await testRoute('API Backup', 'Google Drive Revisions (/backup/drive/revisions)', `${API_BASE}/backup/drive/revisions`, 200, (data) => {
    if (!Array.isArray(data)) return 'Expected revisions array';
    return null;
  });

  await prisma.$disconnect();

  // Print Summary Table
  console.log('\n================================================================');
  console.log('                 UI & API TEST SUITE SUMMARY');
  console.log('================================================================\n');

  let passed = 0;
  let failed = 0;

  for (const r of results) {
    const icon = r.status === 'PASS' ? '✅' : '❌';
    const statusText = r.status === 'PASS' ? `PASS (${r.latencyMs}ms)` : `FAIL [${r.statusCode}] ${r.details}`;
    console.log(`${icon} [${r.category.padEnd(18)}] ${r.name.padEnd(45)} -> ${statusText}`);
    if (r.status === 'PASS') passed++;
    else failed++;
  }

  console.log('\n----------------------------------------------------------------');
  console.log(`Total Checks: ${results.length} | Passed: ${passed} | Failed: ${failed}`);
  console.log('----------------------------------------------------------------\n');

  if (failed > 0) {
    console.error('❌ Failed Checks Details:');
    for (const f of results.filter((r) => r.status === 'FAIL')) {
      console.error(`  - [${f.category}] ${f.name} (${f.url}): ${f.details}`);
    }
    console.error(`\n💥 ${failed} check(s) failed.`);
    process.exit(1);
  } else {
    console.log('🎉 All pages, sub-pages, and API contracts loaded successfully!');
  }
}

runUITests().catch((err) => {
  console.error('Fatal error during UI test execution:', err);
  process.exit(1);
});
