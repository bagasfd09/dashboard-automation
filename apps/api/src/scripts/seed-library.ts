/**
 * Seed realistic example data for the Test Case Library.
 * Safe to re-run — skips if library data already exists.
 *
 * Usage:  pnpm --filter @qc-monitor/api seed:library
 */

import 'dotenv/config';
import {
  prisma,
  TestPriority,
  TestDifficulty,
  LibraryTestCaseStatus,
  SuggestionType,
  SuggestionStatus,
} from '@qc-monitor/db';

// ── Helpers ──────────────────────────────────────────────────────────────────

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function seedLibrary() {
  const force = process.argv.includes('--force');

  // Check if already seeded
  const existing = await prisma.libraryCollection.count();
  if (existing > 0) {
    if (!force) {
      console.log(
        `\nLibrary already has ${existing} collection(s).\nRun with --force to wipe and re-seed.\n`,
      );
      await prisma.$disconnect();
      return;
    }
    // Wipe existing library data in dependency order
    console.log('  🗑️  Wiping existing library data (--force)…');
    await prisma.libraryDependency.deleteMany();
    await prisma.libraryTestCaseVersion.deleteMany();
    await prisma.libraryBookmark.deleteMany();
    await prisma.libraryDiscussion.deleteMany();
    await prisma.librarySuggestion.deleteMany();
    await prisma.libraryTestCaseLink.deleteMany();
    await prisma.libraryTestCase.deleteMany();
    await prisma.libraryCollection.deleteMany();
  }

  // Grab first admin user as the "author"
  const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.error('\n❌  No admin user found. Run `pnpm seed` first.\n');
    await prisma.$disconnect();
    process.exit(1);
  }

  // Optional: grab a second user for suggestions/discussions variety
  const secondUser = await prisma.user.findFirst({
    where: { id: { not: admin.id } },
  });

  const authorId = admin.id;
  const reviewerId = secondUser?.id ?? admin.id;

  console.log(`\n📚  Seeding library as "${admin.name}" (${admin.email})…\n`);

  // ── 1. Collections ──────────────────────────────────────────────────────────

  const [colAuth, colCheckout, colSearch, colAdmin] = await Promise.all([
    prisma.libraryCollection.create({
      data: {
        name: 'Authentication & Access',
        description: 'Login, registration, password reset, SSO, and session management flows.',
        icon: '🔐',
        createdById: authorId,
      },
    }),
    prisma.libraryCollection.create({
      data: {
        name: 'Checkout & Payments',
        description: 'Full purchase funnel: cart, address, payment methods, order confirmation.',
        icon: '🛒',
        createdById: authorId,
      },
    }),
    prisma.libraryCollection.create({
      data: {
        name: 'Search & Discovery',
        description: 'Product search, filters, sorting, autocomplete, and recommendations.',
        icon: '🔍',
        createdById: authorId,
      },
    }),
    prisma.libraryCollection.create({
      data: {
        name: 'Admin & Back Office',
        description: 'Internal admin panel: user management, order processing, inventory.',
        icon: '⚙️',
        createdById: authorId,
      },
    }),
  ]);

  console.log('  ✅  Created 4 collections');

  // ── 2. Library Test Cases ───────────────────────────────────────────────────

  const tcDefs = [
    // ── Authentication ────────────────────────────────────────────────────────
    {
      collectionId: colAuth.id,
      title: 'User can log in with valid email and password',
      description:
        'Verifies that a registered user can successfully authenticate using their email and password and is redirected to the dashboard.',
      priority: TestPriority.P0,
      difficulty: TestDifficulty.EASY,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['smoke', 'auth', 'login'],
      preconditions:
        'A registered user account exists with email "test@example.com" and password "Password1!".',
      steps:
        '1. Navigate to /login\n2. Enter "test@example.com" in the Email field\n3. Enter "Password1!" in the Password field\n4. Click the "Sign In" button',
      expectedOutcome:
        'User is redirected to the dashboard. A welcome toast notification is shown. The session cookie is set.',
    },
    {
      collectionId: colAuth.id,
      title: 'Login fails with invalid credentials',
      description:
        'Confirms that an appropriate error message is shown when a user enters an incorrect email or password.',
      priority: TestPriority.P0,
      difficulty: TestDifficulty.EASY,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['auth', 'login', 'negative'],
      preconditions: 'Application is accessible at /login.',
      steps:
        '1. Navigate to /login\n2. Enter "wrong@example.com" in the Email field\n3. Enter "badpassword" in the Password field\n4. Click "Sign In"',
      expectedOutcome:
        'User remains on /login. An error message "Invalid email or password" is displayed. No session cookie is set.',
    },
    {
      collectionId: colAuth.id,
      title: 'User can reset password via email link',
      description:
        'Verifies the full password-reset flow: request link, receive email, open link, set new password, and log in with new credentials.',
      priority: TestPriority.P1,
      difficulty: TestDifficulty.MEDIUM,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['auth', 'password-reset'],
      preconditions:
        'A registered account exists. Email delivery is available in the test environment (Mailhog or similar).',
      steps:
        '1. Navigate to /login and click "Forgot password?"\n2. Enter the account email and click "Send reset link"\n3. Open the reset email and click the link\n4. Enter a new password and confirm it\n5. Submit the form\n6. Log in with the new password',
      expectedOutcome:
        'User receives a reset email within 60 seconds. After setting new password, login succeeds. Old password is rejected.',
    },
    {
      collectionId: colAuth.id,
      title: 'Session expires after inactivity timeout',
      description:
        'Ensures that a user session is automatically invalidated after the configured idle timeout, and the user is redirected to login.',
      priority: TestPriority.P1,
      difficulty: TestDifficulty.HARD,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['auth', 'session', 'security'],
      preconditions:
        'User is logged in. Idle timeout is configured to 15 minutes (or override via env).',
      steps:
        '1. Log in as a valid user\n2. Remain idle for the configured timeout period (manipulate system clock or use short timeout env)\n3. Attempt to navigate to a protected page\n4. Observe the redirect behaviour',
      expectedOutcome:
        'User is redirected to /login with a "Session expired" message. Protected page content is not shown.',
    },
    {
      collectionId: colAuth.id,
      title: 'User can log out and session is invalidated',
      description:
        'Verifies that clicking Log Out clears the session and prevents access to protected routes.',
      priority: TestPriority.P1,
      difficulty: TestDifficulty.EASY,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['auth', 'logout', 'smoke'],
      preconditions: 'User is logged in.',
      steps:
        '1. Click the user avatar / profile menu\n2. Click "Sign Out"\n3. Attempt to navigate directly to /dashboard',
      expectedOutcome:
        'User is redirected to /login. Back-button does not restore the authenticated session. Auth cookie is cleared.',
    },

    // ── Checkout ──────────────────────────────────────────────────────────────
    {
      collectionId: colCheckout.id,
      title: 'User can complete checkout with credit card',
      description:
        'End-to-end happy-path test covering adding a product, entering shipping details, paying by card, and receiving an order confirmation.',
      priority: TestPriority.P0,
      difficulty: TestDifficulty.COMPLEX,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['smoke', 'checkout', 'payment', 'e2e'],
      preconditions:
        'User is logged in. At least one product is in stock. Payment gateway sandbox is configured.',
      steps:
        '1. Navigate to a product page and click "Add to Cart"\n2. Open the cart and click "Proceed to Checkout"\n3. Fill in a valid shipping address\n4. Select "Standard Shipping"\n5. Enter card number "4242 4242 4242 4242", expiry "12/26", CVV "123"\n6. Click "Place Order"',
      expectedOutcome:
        'Order confirmation page is shown with a unique order number. Confirmation email is sent within 2 minutes. Inventory count decreases by 1.',
    },
    {
      collectionId: colCheckout.id,
      title: 'Declined payment shows appropriate error',
      description:
        'Verifies that a failed payment transaction shows a clear error and does not create an order.',
      priority: TestPriority.P0,
      difficulty: TestDifficulty.MEDIUM,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['checkout', 'payment', 'negative'],
      preconditions: 'User is logged in with items in cart. Sandbox decline card is available.',
      steps:
        '1. Proceed through checkout to the payment step\n2. Enter decline card number "4000 0000 0000 0002"\n3. Click "Place Order"',
      expectedOutcome:
        'Error message "Your card was declined" is shown. User remains on payment page. No order is created in the system.',
    },
    {
      collectionId: colCheckout.id,
      title: 'Coupon code applies discount correctly',
      description:
        'Tests that a valid discount coupon reduces the order total by the expected amount before payment.',
      priority: TestPriority.P1,
      difficulty: TestDifficulty.MEDIUM,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['checkout', 'discount', 'coupon'],
      preconditions:
        'An active coupon "SAVE20" for 20% off exists. User has items in cart totalling at least $10.',
      steps:
        '1. Navigate to the cart\n2. Enter "SAVE20" in the coupon field and click "Apply"\n3. Observe the updated order summary',
      expectedOutcome:
        'A 20% discount line is shown in the order summary. The total is reduced accordingly. "Coupon applied" confirmation is displayed.',
    },
    {
      collectionId: colCheckout.id,
      title: 'Cart persists across browser sessions',
      description:
        'Ensures that items added to the cart are still present after the user closes and reopens the browser.',
      priority: TestPriority.P2,
      difficulty: TestDifficulty.MEDIUM,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['checkout', 'cart', 'session'],
      preconditions: 'User is logged in.',
      steps:
        '1. Add 2 different products to the cart\n2. Close the browser completely\n3. Reopen the browser and navigate to the application\n4. Open the cart',
      expectedOutcome:
        'Both items are still in the cart with correct quantities. Cart total matches the pre-close state.',
    },

    // ── Search ────────────────────────────────────────────────────────────────
    {
      collectionId: colSearch.id,
      title: 'Search returns relevant results for keyword',
      description:
        'Validates that entering a product keyword returns a result set with relevant items and appropriate metadata.',
      priority: TestPriority.P0,
      difficulty: TestDifficulty.EASY,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['smoke', 'search'],
      preconditions: 'At least 3 products containing "wireless" exist in the catalogue.',
      steps:
        '1. Click the search bar\n2. Type "wireless"\n3. Press Enter or click the search icon',
      expectedOutcome:
        'Results page shows items containing "wireless" in title or description. Result count is shown. No 500 errors.',
    },
    {
      collectionId: colSearch.id,
      title: 'Search with no results shows empty state',
      description: 'Ensures a helpful empty state is displayed when no products match the query.',
      priority: TestPriority.P1,
      difficulty: TestDifficulty.EASY,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['search', 'negative'],
      preconditions: 'No products exist with the query string "xyzabcnonexistent".',
      steps: '1. Search for "xyzabcnonexistent"',
      expectedOutcome:
        '"No results found" message is displayed. A suggestion to try different keywords is shown. Search bar remains populated.',
    },
    {
      collectionId: colSearch.id,
      title: 'Price range filter narrows results correctly',
      description:
        'Verifies that applying a min/max price filter only shows products within the specified range.',
      priority: TestPriority.P1,
      difficulty: TestDifficulty.MEDIUM,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['search', 'filter'],
      preconditions: 'Search results for "laptop" include products across multiple price tiers.',
      steps:
        '1. Search for "laptop"\n2. Set minimum price to "$500"\n3. Set maximum price to "$1000"\n4. Apply the filter',
      expectedOutcome:
        'All displayed products have prices between $500 and $1000 inclusive. Products outside this range are hidden.',
    },
    {
      collectionId: colSearch.id,
      title: 'Autocomplete suggestions appear on typing',
      description:
        'Tests that typing into the search bar triggers autocomplete suggestions within an acceptable response time.',
      priority: TestPriority.P2,
      difficulty: TestDifficulty.MEDIUM,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['search', 'autocomplete', 'performance'],
      preconditions: 'Autocomplete is enabled and indexed.',
      steps: '1. Click the search bar\n2. Type "head" (3+ characters)',
      expectedOutcome:
        'Autocomplete dropdown appears within 300ms. Suggestions are relevant to "head". Clicking a suggestion navigates to that product/category.',
    },

    // ── Admin ─────────────────────────────────────────────────────────────────
    {
      collectionId: colAdmin.id,
      title: 'Admin can deactivate a user account',
      description:
        'Verifies that an admin can disable a user account, preventing them from logging in.',
      priority: TestPriority.P1,
      difficulty: TestDifficulty.MEDIUM,
      status: LibraryTestCaseStatus.ACTIVE,
      tags: ['admin', 'user-management'],
      preconditions: 'Admin is logged into the back-office. A target user account exists and is active.',
      steps:
        '1. Navigate to Admin > Users\n2. Find the target user and click "Edit"\n3. Toggle the "Active" switch to OFF\n4. Click "Save changes"\n5. Attempt to log in as the deactivated user',
      expectedOutcome:
        'The user account shows "Inactive" status in the admin panel. Login attempt by that user fails with "Account disabled" message.',
    },
    {
      collectionId: colAdmin.id,
      title: 'Inventory count updates after order fulfilment',
      description:
        'Checks that marking an order as "Fulfilled" in the admin panel correctly decrements the product stock count.',
      priority: TestPriority.P1,
      difficulty: TestDifficulty.MEDIUM,
      status: LibraryTestCaseStatus.DRAFT,
      tags: ['admin', 'inventory', 'orders'],
      preconditions: 'An unfulfilled order exists for a product with known stock count.',
      steps:
        '1. Note the current stock count of the product\n2. Navigate to Admin > Orders and open the unfulfilled order\n3. Click "Mark as Fulfilled"\n4. Navigate to Admin > Products and check the stock count',
      expectedOutcome:
        'Stock count decreased by the quantity ordered. Order status shows "Fulfilled". Customer receives shipment notification email.',
    },
  ];

  const createdTcs: { id: string; title: string }[] = [];

  for (const def of tcDefs) {
    const tc = await prisma.libraryTestCase.create({
      data: {
        ...def,
        createdById: authorId,
        updatedById: authorId,
      },
    });
    createdTcs.push({ id: tc.id, title: tc.title });
  }

  console.log(`  ✅  Created ${createdTcs.length} library test cases`);

  // ── 3. Suggestions ──────────────────────────────────────────────────────────

  // Add a few pending + resolved suggestions for variety
  const loginTc = createdTcs.find((t) => t.title.includes('log in with valid'));
  const checkoutTc = createdTcs.find((t) => t.title.includes('complete checkout'));
  const resetTc = createdTcs.find((t) => t.title.includes('reset password'));

  if (loginTc) {
    await prisma.librarySuggestion.create({
      data: {
        libraryTestCaseId: loginTc.id,
        type: SuggestionType.IMPROVEMENT,
        content:
          'We should also test login via social auth (Google OAuth). The current test only covers email/password.',
        status: SuggestionStatus.PENDING,
        createdById: reviewerId,
      },
    });
  }

  if (checkoutTc) {
    await prisma.librarySuggestion.createMany({
      data: [
        {
          libraryTestCaseId: checkoutTc.id,
          type: SuggestionType.UPDATE,
          content:
            'Step 5 should also cover 3D Secure authentication flow since our payment provider now enforces it for cards over $500.',
          status: SuggestionStatus.ACCEPTED,
          createdById: reviewerId,
          reviewedById: authorId,
          reviewedAt: new Date(),
        },
        {
          libraryTestCaseId: checkoutTc.id,
          type: SuggestionType.BUG_REPORT,
          content:
            'The test occasionally fails because the sandbox payment gateway has a 5s delay. Expected outcome assertion hits before the redirect completes.',
          status: SuggestionStatus.PENDING,
          createdById: reviewerId,
        },
      ],
    });
  }

  if (resetTc) {
    await prisma.librarySuggestion.create({
      data: {
        libraryTestCaseId: resetTc.id,
        type: SuggestionType.IMPROVEMENT,
        content:
          'Add a sub-case: verify that the reset link expires after 1 hour and shows an appropriate expiry message.',
        status: SuggestionStatus.REJECTED,
        createdById: reviewerId,
        reviewedById: authorId,
        reviewedAt: new Date(),
      },
    });
  }

  console.log('  ✅  Created suggestions');

  // ── 4. Discussions ──────────────────────────────────────────────────────────

  if (checkoutTc) {
    await prisma.libraryDiscussion.createMany({
      data: [
        {
          libraryTestCaseId: checkoutTc.id,
          content:
            'Should we split this into separate test cases for each payment method? The current one is already quite complex.',
          createdById: reviewerId,
        },
        {
          libraryTestCaseId: checkoutTc.id,
          content:
            'Good point — I\'d keep the card flow here (P0 smoke) and create separate P1 cases for PayPal and Apple Pay. Want to draft those?',
          createdById: authorId,
        },
        {
          libraryTestCaseId: checkoutTc.id,
          content: 'On it 👍',
          createdById: reviewerId,
        },
      ],
    });
  }

  if (loginTc) {
    await prisma.libraryDiscussion.createMany({
      data: [
        {
          libraryTestCaseId: loginTc.id,
          content:
            'This test is in our nightly smoke suite and has been stable for 3 sprints. Marking as P0 was the right call.',
          createdById: authorId,
        },
      ],
    });
  }

  console.log('  ✅  Created discussions');

  // ── 5. Dependencies ─────────────────────────────────────────────────────────

  // Checkout depends on login
  const loginId = createdTcs.find((t) => t.title.includes('log in with valid'))?.id;
  const checkoutId = createdTcs.find((t) => t.title.includes('complete checkout'))?.id;
  const couponId = createdTcs.find((t) => t.title.includes('Coupon code'))?.id;
  const declinedId = createdTcs.find((t) => t.title.includes('Declined payment'))?.id;

  if (loginId && checkoutId) {
    await prisma.libraryDependency.create({
      data: { libraryTestCaseId: checkoutId, dependsOnId: loginId },
    });
  }
  if (loginId && couponId) {
    await prisma.libraryDependency.create({
      data: { libraryTestCaseId: couponId, dependsOnId: loginId },
    });
  }
  if (loginId && declinedId) {
    await prisma.libraryDependency.create({
      data: { libraryTestCaseId: declinedId, dependsOnId: loginId },
    });
  }

  console.log('  ✅  Created dependencies (checkout/coupon/declined → login)');

  // ── 6. Version snapshots ────────────────────────────────────────────────────
  // Simulate a couple of test cases that have been edited

  if (loginId) {
    await prisma.libraryTestCaseVersion.createMany({
      data: [
        {
          libraryTestCaseId: loginId,
          version: 1,
          title: 'User can log in with email and password',
          description: 'Basic login test.',
          steps: '1. Go to /login\n2. Enter credentials\n3. Click Sign In',
          preconditions: 'Registered user exists.',
          expectedOutcome: 'User is redirected to the dashboard.',
          changeNotes: 'Initial version',
          createdById: authorId,
        },
        {
          libraryTestCaseId: loginId,
          version: 2,
          title: 'User can log in with valid email and password',
          description:
            'Verifies that a registered user can successfully authenticate using their email and password and is redirected to the dashboard.',
          steps:
            '1. Navigate to /login\n2. Enter "test@example.com" in the Email field\n3. Enter "Password1!" in the Password field\n4. Click the "Sign In" button',
          preconditions:
            'A registered user account exists with email "test@example.com" and password "Password1!".',
          expectedOutcome:
            'User is redirected to the dashboard. A welcome toast notification is shown. The session cookie is set.',
          changeNotes:
            'Updated to use specific test credentials, added session cookie to expected outcome',
          createdById: authorId,
        },
      ],
    });
  }

  if (checkoutId) {
    await prisma.libraryTestCaseVersion.create({
      data: {
        libraryTestCaseId: checkoutId,
        version: 1,
        title: 'User can complete checkout with credit card',
        description: 'Happy-path checkout test.',
        steps:
          '1. Add product to cart\n2. Proceed to checkout\n3. Fill shipping details\n4. Pay by card\n5. Confirm order',
        preconditions: 'User is logged in. Product in stock.',
        expectedOutcome: 'Order confirmation page shown.',
        changeNotes: 'Initial version',
        createdById: authorId,
      },
    });
  }

  console.log('  ✅  Created version history');

  // ── Summary ─────────────────────────────────────────────────────────────────

  const w = 56;
  const pad = (s: string) => s + ' '.repeat(Math.max(0, w - s.length));

  console.log('\n' + '╔' + '═'.repeat(w) + '╗');
  console.log('║' + pad('  📚 Library Seed Complete') + '║');
  console.log('╠' + '═'.repeat(w) + '╣');
  console.log('║' + pad('  Collections : 4') + '║');
  console.log('║' + pad(`  Test Cases  : ${createdTcs.length}`) + '║');
  console.log('║' + pad('  Suggestions : 4') + '║');
  console.log('║' + pad('  Discussions : 4') + '║');
  console.log('║' + pad('  Dependencies: 3') + '║');
  console.log('║' + pad('  Versions    : 3') + '║');
  console.log('╚' + '═'.repeat(w) + '╝\n');

  await prisma.$disconnect();
}

seedLibrary().catch((err) => {
  console.error('Library seed failed:', err);
  prisma.$disconnect().finally(() => process.exit(1));
});
