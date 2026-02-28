import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// ── Helpers ────────────────────────────────────────────────────────────────────

function hoursAgo(h: number) { return new Date(Date.now() - h * 60 * 60 * 1000); }
function daysAgo(d: number) { return new Date(Date.now() - d * 24 * 60 * 60 * 1000); }
function rand(min: number, max: number) { return Math.floor(Math.random() * (max - min + 1)) + min; }

// ── Clean ─────────────────────────────────────────────────────────────────────

async function cleanDatabase() {
  console.log('🧹 Cleaning database...');
  const models = [
    'activityLog',
    'taskGroupItem', 'taskGroup',
    'releaseChecklistItem', 'releaseTestRun', 'release',
    'libraryBookmark', 'libraryDiscussion', 'librarySuggestion',
    'libraryDependency', 'libraryTestCaseLink',
    'libraryTestCaseVersion', 'libraryTestCase', 'libraryCollection',
    'artifact', 'testResult', 'retryRequest', 'testCase', 'testRun',
    'passwordReset', 'invite', 'refreshToken',
    'teamMember', 'team', 'user',
  ];
  for (const model of models) {
    try { await (prisma as any)[model].deleteMany(); } catch { /* skip */ }
  }
  console.log('  ✓ Database cleaned');
}

// ── Users ─────────────────────────────────────────────────────────────────────

async function createUsers() {
  console.log('👥 Creating users...');
  const hash = bcrypt.hashSync('demo1234', 10);

  const [admin, manager, supervisor, teamLeadWeb, teamLeadMobile, memberSarah, memberJohn, monitoring] =
    await Promise.all([
      prisma.user.create({ data: { email: 'admin@qcmonitor.demo', name: 'Andi Pratama', password: hash, role: 'ADMIN', mustChangePass: false, isActive: true } }),
      prisma.user.create({ data: { email: 'manager@qcmonitor.demo', name: 'Budi Santoso', password: hash, role: 'MANAGER', mustChangePass: false, isActive: true } }),
      prisma.user.create({ data: { email: 'supervisor@qcmonitor.demo', name: 'Citra Dewi', password: hash, role: 'SUPERVISOR', mustChangePass: false, isActive: true } }),
      prisma.user.create({ data: { email: 'teamlead.web@qcmonitor.demo', name: 'Dian Purnama', password: hash, role: 'TEAM_LEAD', mustChangePass: false, isActive: true } }),
      prisma.user.create({ data: { email: 'teamlead.mobile@qcmonitor.demo', name: 'Eko Widodo', password: hash, role: 'TEAM_LEAD', mustChangePass: false, isActive: true } }),
      prisma.user.create({ data: { email: 'sarah@qcmonitor.demo', name: 'Sarah Amalia', password: hash, role: 'MEMBER', mustChangePass: false, isActive: true } }),
      prisma.user.create({ data: { email: 'john@qcmonitor.demo', name: 'John Kurniawan', password: hash, role: 'MEMBER', mustChangePass: false, isActive: true } }),
      prisma.user.create({ data: { email: 'monitoring@qcmonitor.demo', name: 'Fira Monitoring', password: hash, role: 'MONITORING', mustChangePass: false, isActive: true } }),
    ]);

  console.log(`  ✓ Created 8 users`);
  return { admin, manager, supervisor, teamLeadWeb, teamLeadMobile, memberSarah, memberJohn, monitoring };
}

// ── Teams ─────────────────────────────────────────────────────────────────────

async function createTeams(users: Awaited<ReturnType<typeof createUsers>>) {
  console.log('🏢 Creating teams...');
  const web = await prisma.team.create({
    data: { name: 'QA Web Team', apiKey: 'sk-qcm-demo-web-001' },
  });
  const mobile = await prisma.team.create({
    data: { name: 'QA Mobile Team', apiKey: 'sk-qcm-demo-mobile-001' },
  });
  console.log('  ✓ Created 2 teams');
  return { web, mobile };
}

// ── Team Members ──────────────────────────────────────────────────────────────

async function addTeamMembers(
  teams: Awaited<ReturnType<typeof createTeams>>,
  users: Awaited<ReturnType<typeof createUsers>>,
) {
  console.log('🤝 Adding team members...');

  await prisma.teamMember.createMany({
    data: [
      { userId: users.admin.id, teamId: teams.web.id },
      { userId: users.manager.id, teamId: teams.web.id },
      { userId: users.supervisor.id, teamId: teams.web.id },
      { userId: users.teamLeadWeb.id, teamId: teams.web.id },
      { userId: users.memberSarah.id, teamId: teams.web.id },
      { userId: users.memberJohn.id, teamId: teams.web.id },
      { userId: users.monitoring.id, teamId: teams.web.id },
    ],
    skipDuplicates: true,
  });

  await prisma.teamMember.createMany({
    data: [
      { userId: users.admin.id, teamId: teams.mobile.id },
      { userId: users.manager.id, teamId: teams.mobile.id },
      { userId: users.teamLeadMobile.id, teamId: teams.mobile.id },
      { userId: users.monitoring.id, teamId: teams.mobile.id },
    ],
    skipDuplicates: true,
  });

  console.log('  ✓ Team members added');
}

// ── Library ───────────────────────────────────────────────────────────────────

async function createLibrary(
  teams: Awaited<ReturnType<typeof createTeams>>,
  users: Awaited<ReturnType<typeof createUsers>>,
) {
  console.log('📚 Creating library collections and test cases...');

  // ── Collection 1: Authentication ──────────────────────────────────────────

  const authCollection = await prisma.libraryCollection.create({
    data: {
      name: 'Authentication',
      description: 'Test cases covering login, logout, session management, and role-based access.',
      icon: '🔐',
      teamId: teams.web.id,
      createdById: users.teamLeadWeb.id,
    },
  });

  const authTCData = [
    {
      title: 'Login with valid credentials',
      priority: 'P0' as const,
      difficulty: 'EASY' as const,
      tags: ['login', 'auth', 'smoke'],
      steps: '1. Navigate to /login\n2. Enter valid email and password\n3. Click Sign In button\n4. Wait for redirect to dashboard',
      preconditions: 'User account exists with known credentials',
      expectedOutcome: 'User is redirected to dashboard. Access token is stored in memory. Refresh token cookie is set.',
    },
    {
      title: 'Login with invalid credentials',
      priority: 'P0' as const,
      difficulty: 'EASY' as const,
      tags: ['login', 'auth', 'negative'],
      steps: '1. Navigate to /login\n2. Enter registered email with wrong password\n3. Click Sign In\n4. Observe error message',
      preconditions: 'Valid email exists in the system',
      expectedOutcome: "Error message 'Invalid credentials' appears. User remains on login page. No tokens are issued.",
    },
    {
      title: 'Login with empty fields',
      priority: 'P1' as const,
      difficulty: 'EASY' as const,
      tags: ['login', 'auth', 'validation'],
      steps: '1. Navigate to /login\n2. Leave email and password fields blank\n3. Click Sign In button\n4. Observe validation messages',
      preconditions: 'None',
      expectedOutcome: 'Validation errors are shown for both fields. Form is not submitted. No API call is made.',
    },
    {
      title: 'Session refresh — auto token rotation',
      priority: 'P0' as const,
      difficulty: 'HARD' as const,
      tags: ['auth', 'session', 'token', 'security'],
      steps: '1. Log in and obtain access token\n2. Wait 14 minutes for auto-refresh trigger\n3. Observe background token refresh\n4. Verify new access token is stored in memory\n5. Verify new refresh token cookie is set',
      preconditions: 'User is logged in. Token expiry is 15 minutes.',
      expectedOutcome: 'New access token replaces old one in memory. Refresh token is rotated (old invalidated, new issued). User remains logged in without interruption.',
    },
    {
      title: 'Logout — clear all tokens',
      priority: 'P0' as const,
      difficulty: 'EASY' as const,
      tags: ['logout', 'auth', 'security'],
      steps: '1. Log in as any user\n2. Click the logout button in the sidebar or profile menu\n3. Verify redirect to /login\n4. Attempt to access a protected page directly',
      preconditions: 'User is logged in',
      expectedOutcome: 'User is redirected to /login. Access token is cleared from memory. Refresh token cookie is cleared. Protected pages redirect to /login.',
    },
    {
      title: 'Password reset flow',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['auth', 'password', 'reset'],
      steps: '1. Admin navigates to User Management\n2. Admin clicks "Reset Password" for target user\n3. System generates password reset link (1-hour expiry)\n4. User navigates to the reset link\n5. User enters and confirms new password\n6. User is redirected to login with success message',
      preconditions: 'Target user exists. Admin has permission to reset passwords.',
      expectedOutcome: 'Password is updated. Old password no longer works. All existing refresh tokens for the user are invalidated. User can log in with new password.',
    },
    {
      title: 'Role-based access — member cannot access admin pages',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['auth', 'rbac', 'security'],
      steps: '1. Log in as a MEMBER user\n2. Attempt to navigate to /users page\n3. Attempt to navigate to /api-keys page\n4. Attempt to call admin-only API endpoints directly',
      preconditions: 'MEMBER user account exists',
      expectedOutcome: 'MEMBER is redirected away from admin pages. Admin-only API endpoints return 403 Forbidden. MEMBER can only access their team\'s data.',
    },
    {
      title: 'Invite flow — new user registration',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['auth', 'invite', 'registration'],
      steps: '1. Admin navigates to User Management\n2. Admin clicks "Invite User" and enters email + role\n3. System generates invite link (7-day expiry)\n4. Invited user opens the link\n5. User enters their name and sets a password\n6. User is auto-logged in after registration',
      preconditions: 'Target email is not already registered. Admin or Manager role required to send invites.',
      expectedOutcome: 'New user account is created with the specified role. User is auto-logged in and redirected to dashboard. Invite record is marked ACCEPTED.',
    },
  ];

  const authTCs: any[] = [];
  for (const tc of authTCData) {
    const created = await prisma.libraryTestCase.create({
      data: {
        ...tc,
        status: 'ACTIVE',
        collectionId: authCollection.id,
        createdById: users.teamLeadWeb.id,
      },
    });
    await prisma.libraryTestCaseVersion.create({
      data: {
        libraryTestCaseId: created.id,
        version: 1,
        title: created.title,
        steps: created.steps,
        preconditions: created.preconditions,
        expectedOutcome: created.expectedOutcome,
        changeNotes: 'Initial version',
        createdById: users.teamLeadWeb.id,
      },
    });
    authTCs.push(created);
  }

  const [loginValidTC, loginInvalidTC, , sessionRefreshTC, logoutTC, , , inviteFlowTC] = authTCs;

  console.log('  ✓ Auth collection: 8 test cases');

  // ── Collection 2: Payment ─────────────────────────────────────────────────

  const paymentCollection = await prisma.libraryCollection.create({
    data: {
      name: 'Payment',
      description: 'End-to-end payment flows including checkout, refunds, and edge cases.',
      icon: '💳',
      teamId: teams.web.id,
      createdById: users.teamLeadWeb.id,
    },
  });

  const paymentTCData = [
    {
      title: 'Checkout with credit card',
      priority: 'P0' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['payment', 'checkout', 'credit-card', 'smoke'],
      steps: '1. Add items to cart\n2. Navigate to checkout\n3. Enter valid credit card details (Visa/Mastercard)\n4. Complete 3D Secure verification if prompted\n5. Confirm order\n6. Wait for payment confirmation',
      preconditions: 'User is logged in. Cart has at least one item. Valid test credit card available.',
      expectedOutcome: 'Order is placed successfully. Payment confirmation page is shown. Order appears in payment history. Inventory is updated.',
    },
    {
      title: 'Checkout with bank transfer',
      priority: 'P0' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['payment', 'checkout', 'bank-transfer'],
      steps: '1. Add items to cart\n2. Navigate to checkout\n3. Select "Bank Transfer" payment method\n4. Complete order\n5. Verify bank transfer instructions are displayed\n6. Simulate payment confirmation from bank webhook',
      preconditions: 'User is logged in. Cart has items. Bank transfer is enabled for the team.',
      expectedOutcome: 'Order is created in PENDING state. Bank transfer instructions (VA number, amount, bank name) are shown. Order status updates to PAID after webhook confirmation.',
    },
    {
      title: 'Checkout with GoPay',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['payment', 'checkout', 'gopay', 'e-wallet'],
      steps: '1. Add items to cart\n2. Navigate to checkout\n3. Select "GoPay" as payment method\n4. Scan QR code or use deep link to GoPay app\n5. Approve payment in GoPay\n6. Return to merchant app',
      preconditions: 'User is logged in. Cart has items. GoPay integration is configured.',
      expectedOutcome: 'Payment QR code / deep link is displayed. After approval, order is confirmed. User is redirected to order success page.',
    },
    {
      title: 'Checkout with expired card',
      priority: 'P1' as const,
      difficulty: 'EASY' as const,
      tags: ['payment', 'checkout', 'negative', 'credit-card'],
      steps: '1. Add items to cart\n2. Navigate to checkout\n3. Enter expired credit card details\n4. Attempt to complete payment',
      preconditions: 'User is logged in. Cart has items.',
      expectedOutcome: 'Payment is rejected with a clear error message indicating the card is expired. Order is not created. User can retry with a valid card.',
    },
    {
      title: 'Refund flow — full refund',
      priority: 'P0' as const,
      difficulty: 'HARD' as const,
      tags: ['payment', 'refund'],
      steps: '1. Find a completed paid order\n2. Navigate to order detail\n3. Click "Request Refund" button\n4. Select "Full Refund" option and provide reason\n5. Submit refund request\n6. Admin approves the refund\n7. Verify refund status and timeline',
      preconditions: 'A completed paid order exists. User has permission to request refunds.',
      expectedOutcome: 'Refund request is created. Admin receives notification. Upon approval, refund amount is credited back. Order status changes to REFUNDED. Customer receives confirmation.',
    },
    {
      title: 'Payment history page',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['payment', 'history', 'listing'],
      steps: '1. Log in as a user with payment history\n2. Navigate to /account/payments\n3. Verify list of past payments is shown\n4. Test pagination\n5. Click on a payment to view detail\n6. Test date range filter',
      preconditions: 'User has at least 2 past payments.',
      expectedOutcome: 'Payment history is displayed in reverse chronological order. Each row shows date, amount, status, and method. Detail view shows full transaction info. Filters work correctly.',
    },
    {
      title: 'Checkout timeout handling (30s)',
      priority: 'P1' as const,
      difficulty: 'HARD' as const,
      tags: ['payment', 'timeout', 'edge-case'],
      steps: '1. Begin checkout process\n2. Initiate payment but do not complete it\n3. Wait for 30-second payment timeout\n4. Observe system behavior after timeout\n5. Attempt to retry payment',
      preconditions: 'User is in the middle of a payment flow. Payment gateway has 30s timeout configured.',
      expectedOutcome: 'After timeout, clear error message is shown. Order is cancelled or returned to PENDING. User is offered a retry option. Cart contents are preserved.',
    },
    {
      title: 'Apply discount coupon at checkout',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['payment', 'coupon', 'discount'],
      steps: '1. Add items to cart\n2. Navigate to checkout\n3. Enter a valid discount coupon code\n4. Verify discount is applied to total\n5. Complete payment\n6. Verify coupon is marked as used',
      preconditions: 'A valid, unused coupon code exists. Cart has eligible items.',
      expectedOutcome: 'Discount is calculated and displayed correctly. Final amount reflects the discount. Coupon is consumed after successful payment. Cannot reuse the same coupon.',
    },
    {
      title: 'Checkout with empty cart',
      priority: 'P2' as const,
      difficulty: 'EASY' as const,
      tags: ['payment', 'checkout', 'negative', 'edge-case'],
      steps: '1. Ensure cart is empty\n2. Attempt to navigate directly to /checkout\n3. Observe system behavior',
      preconditions: 'User is logged in with an empty cart.',
      expectedOutcome: 'User is redirected to the cart or home page. A message is shown: "Your cart is empty." Checkout process does not proceed.',
    },
    {
      title: 'Concurrent checkout prevention',
      priority: 'P0' as const,
      difficulty: 'HARD' as const,
      tags: ['payment', 'concurrency', 'security'],
      steps: '1. Open checkout in two browser tabs simultaneously\n2. In Tab 1: proceed to payment step\n3. In Tab 2: also proceed to payment step\n4. Complete payment in Tab 1\n5. Observe Tab 2 behavior',
      preconditions: 'User is logged in. Cart has items.',
      expectedOutcome: 'Only one payment goes through. Tab 2 shows an error or detects the concurrent session. No duplicate charges occur. Idempotency keys prevent double-charging.',
    },
  ];

  const paymentTCs: any[] = [];
  for (const tc of paymentTCData) {
    const created = await prisma.libraryTestCase.create({
      data: {
        ...tc,
        status: 'ACTIVE',
        collectionId: paymentCollection.id,
        createdById: users.teamLeadWeb.id,
      },
    });
    await prisma.libraryTestCaseVersion.create({
      data: {
        libraryTestCaseId: created.id,
        version: 1,
        title: created.title,
        steps: created.steps,
        preconditions: created.preconditions,
        expectedOutcome: created.expectedOutcome,
        changeNotes: 'Initial version',
        createdById: users.teamLeadWeb.id,
      },
    });
    paymentTCs.push(created);
  }

  const [checkoutCCTC, checkoutBankTC, checkoutGopayTC, , refundTC, paymentHistoryTC, checkoutTimeoutTC] = paymentTCs;

  console.log('  ✓ Payment collection: 10 test cases');

  // ── Collection 3: Dashboard & Navigation ──────────────────────────────────

  const dashCollection = await prisma.libraryCollection.create({
    data: {
      name: 'Dashboard & Navigation',
      description: 'Test cases for the main dashboard, sidebar navigation, and real-time updates.',
      icon: '🖥️',
      teamId: teams.web.id,
      createdById: users.teamLeadWeb.id,
    },
  });

  const dashTCData = [
    {
      title: 'Dashboard overview loads correctly',
      priority: 'P0' as const,
      difficulty: 'EASY' as const,
      tags: ['dashboard', 'smoke', 'overview'],
      steps: '1. Log in as any user\n2. Navigate to / (dashboard home)\n3. Verify all stat cards are visible\n4. Verify recent runs table is populated\n5. Verify pass rate chart renders',
      preconditions: 'User is logged in. At least one test run exists.',
      expectedOutcome: 'Dashboard overview page loads within 2 seconds. All KPI cards show correct values. Recent runs are listed. No console errors.',
    },
    {
      title: 'Sidebar navigation — all menu items accessible',
      priority: 'P1' as const,
      difficulty: 'EASY' as const,
      tags: ['navigation', 'sidebar', 'smoke'],
      steps: '1. Log in as an admin\n2. Click each sidebar menu item in turn\n3. Verify correct page loads for each item\n4. Verify active state highlights correct item\n5. Test sidebar collapse/expand',
      preconditions: 'User is logged in as ADMIN (all menu items visible).',
      expectedOutcome: 'Each menu item navigates to the correct page. Active item is highlighted. Sidebar collapses to icon-only mode and expands back. State is persisted in localStorage.',
    },
    {
      title: 'Dark / Light mode toggle',
      priority: 'P2' as const,
      difficulty: 'EASY' as const,
      tags: ['theme', 'dark-mode', 'ui'],
      steps: '1. Load the dashboard in light mode\n2. Click the theme toggle button\n3. Verify dark mode is applied\n4. Refresh the page\n5. Verify dark mode persists\n6. Toggle back to light mode',
      preconditions: 'User is logged in.',
      expectedOutcome: 'Theme switches between light and dark. CSS variables update correctly. Preference is persisted in localStorage. No white flash on reload.',
    },
    {
      title: 'Dashboard filters by date range',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['dashboard', 'filter', 'date-range'],
      steps: '1. Navigate to the dashboard\n2. Open the date range filter\n3. Select "Last 7 days"\n4. Verify stats update to reflect the selected range\n5. Change to "Last 30 days"\n6. Verify stats update again',
      preconditions: 'Test runs exist across multiple dates.',
      expectedOutcome: 'Dashboard stats reflect only runs within the selected date range. Charts and tables update accordingly. Filter state is reflected in the URL or UI.',
    },
    {
      title: 'Real-time WebSocket updates on dashboard',
      priority: 'P1' as const,
      difficulty: 'HARD' as const,
      tags: ['dashboard', 'websocket', 'real-time'],
      steps: '1. Open the dashboard in one browser tab\n2. Trigger a test run from another tab or via API\n3. Observe dashboard updates without page refresh\n4. Verify run appears in the recent runs list\n5. Verify KPI counts update',
      preconditions: 'WebSocket server is running. User is on the dashboard page.',
      expectedOutcome: 'New test run appears in the recent runs table within 2 seconds of being triggered. Pass/fail counts update in real time. No page refresh required.',
    },
    {
      title: 'Team switcher — change active team context',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['navigation', 'team-switcher', 'context'],
      steps: '1. Log in as a user who belongs to multiple teams\n2. Open the team switcher in the sidebar\n3. Select a different team\n4. Verify dashboard data changes to reflect the new team\n5. Verify URL or state reflects team context',
      preconditions: 'User belongs to at least 2 teams.',
      expectedOutcome: 'Switching teams updates all dashboard data to the selected team. Sidebar shows the active team name. Data from the previous team is not shown.',
    },
  ];

  const dashTCs: any[] = [];
  for (const tc of dashTCData) {
    const created = await prisma.libraryTestCase.create({
      data: {
        ...tc,
        status: 'ACTIVE',
        collectionId: dashCollection.id,
        createdById: users.teamLeadWeb.id,
      },
    });
    await prisma.libraryTestCaseVersion.create({
      data: {
        libraryTestCaseId: created.id,
        version: 1,
        title: created.title,
        steps: created.steps,
        preconditions: created.preconditions,
        expectedOutcome: created.expectedOutcome,
        changeNotes: 'Initial version',
        createdById: users.teamLeadWeb.id,
      },
    });
    dashTCs.push(created);
  }

  const [dashOverviewTC] = dashTCs;

  console.log('  ✓ Dashboard & Navigation collection: 6 test cases');

  // ── Collection 4: User Management ─────────────────────────────────────────

  const userMgmtCollection = await prisma.libraryCollection.create({
    data: {
      name: 'User Management',
      description: 'Test cases for inviting, editing, and deactivating users across all roles.',
      icon: '👥',
      teamId: teams.web.id,
      createdById: users.teamLeadWeb.id,
    },
  });

  const userMgmtTCData = [
    {
      title: 'Invite new user with email',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['user-management', 'invite', 'admin'],
      steps: '1. Log in as ADMIN or MANAGER\n2. Navigate to /users\n3. Click "Invite User"\n4. Enter email address and select role\n5. Click Send Invite\n6. Verify invite appears in pending list',
      preconditions: 'Email is not already registered. Inviter has ADMIN or MANAGER role.',
      expectedOutcome: 'Invite is created and sent. User appears in the pending invites list. The invite link is valid for 7 days.',
    },
    {
      title: 'Change user role',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['user-management', 'role', 'admin', 'rbac'],
      steps: '1. Log in as ADMIN\n2. Navigate to /users\n3. Find a user with MEMBER role\n4. Click "Edit" or the role selector\n5. Change role to TEAM_LEAD\n6. Save changes\n7. Verify the user\'s permissions are updated',
      preconditions: 'Target user exists with a lower role. Logged-in user is ADMIN.',
      expectedOutcome: 'User role is updated. Activity log records the change. User\'s access level reflects the new role on their next action.',
    },
    {
      title: 'Deactivate user account',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['user-management', 'deactivate', 'admin'],
      steps: '1. Log in as ADMIN\n2. Navigate to /users\n3. Find an active user\n4. Click "Deactivate Account"\n5. Confirm the deactivation in the confirmation dialog\n6. Attempt to log in as the deactivated user',
      preconditions: 'Target user is currently active. Logged-in user is ADMIN.',
      expectedOutcome: 'User is deactivated (isActive: false). Their existing sessions are invalidated. Login attempts with their credentials are rejected with "Account deactivated" message.',
    },
    {
      title: 'User list pagination and search',
      priority: 'P2' as const,
      difficulty: 'EASY' as const,
      tags: ['user-management', 'pagination', 'search'],
      steps: '1. Log in as ADMIN\n2. Navigate to /users\n3. Verify all users are listed\n4. Type in the search box to filter by name or email\n5. Verify filtered results update in real time\n6. Test pagination if user count exceeds page size',
      preconditions: 'Multiple users exist (at least 5).',
      expectedOutcome: 'User list shows all users. Search filters correctly by name or email. Pagination works correctly. Role filter filters by role.',
    },
    {
      title: 'Manager cannot change admin role',
      priority: 'P0' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['user-management', 'rbac', 'security', 'negative'],
      steps: '1. Log in as MANAGER\n2. Navigate to /users\n3. Find an ADMIN user\n4. Attempt to change the ADMIN\'s role via UI or direct API call',
      preconditions: 'An ADMIN user exists. Logged-in user has MANAGER role.',
      expectedOutcome: 'UI does not allow changing the ADMIN\'s role (edit button disabled or hidden). Direct API call returns 403 Forbidden. Security constraint is enforced at both UI and API level.',
    },
  ];

  const userMgmtTCs: any[] = [];
  for (const tc of userMgmtTCData) {
    const created = await prisma.libraryTestCase.create({
      data: {
        ...tc,
        status: 'ACTIVE',
        collectionId: userMgmtCollection.id,
        createdById: users.teamLeadWeb.id,
      },
    });
    await prisma.libraryTestCaseVersion.create({
      data: {
        libraryTestCaseId: created.id,
        version: 1,
        title: created.title,
        steps: created.steps,
        preconditions: created.preconditions,
        expectedOutcome: created.expectedOutcome,
        changeNotes: 'Initial version',
        createdById: users.teamLeadWeb.id,
      },
    });
    userMgmtTCs.push(created);
  }

  const [inviteUserTC, changeRoleTC, deactivateUserTC] = userMgmtTCs;

  console.log('  ✓ User Management collection: 5 test cases');

  // ── Collection 5: Product Catalog (Mobile) ─────────────────────────────────

  const mobileCollection = await prisma.libraryCollection.create({
    data: {
      name: 'Product Catalog',
      description: 'Mobile-specific test cases for product browsing, search, and detail views.',
      icon: '📦',
      teamId: teams.mobile.id,
      createdById: users.teamLeadMobile.id,
    },
  });

  const mobileTCData = [
    {
      title: 'Product list loads on mobile',
      priority: 'P0' as const,
      difficulty: 'EASY' as const,
      tags: ['mobile', 'product-catalog', 'smoke'],
      steps: '1. Open the mobile app\n2. Navigate to the Product Catalog\n3. Verify product grid loads\n4. Scroll down to trigger infinite scroll\n5. Verify more products load',
      preconditions: 'App is installed. Products exist in the catalog.',
      expectedOutcome: 'Product list loads within 2 seconds. Images are displayed correctly. Infinite scroll loads additional products. No layout overflow.',
    },
    {
      title: 'Product search with filters',
      priority: 'P0' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['mobile', 'product-catalog', 'search', 'filter'],
      steps: '1. Open the product catalog\n2. Tap the search bar\n3. Type a product name\n4. Apply a category filter\n5. Apply a price range filter\n6. Verify filtered results',
      preconditions: 'Products exist in multiple categories with varying prices.',
      expectedOutcome: 'Search returns relevant results. Filters narrow results correctly. Combined search + filter works. Empty state shown if no results.',
    },
    {
      title: 'Product detail view',
      priority: 'P1' as const,
      difficulty: 'EASY' as const,
      tags: ['mobile', 'product-catalog', 'detail'],
      steps: '1. From the product list, tap on a product\n2. Verify product detail page loads\n3. Verify images, price, description, and stock are shown\n4. Tap image to view full-screen gallery\n5. Test Add to Cart button',
      preconditions: 'At least one product with images and description exists.',
      expectedOutcome: 'Product detail page shows all information correctly. Image gallery works. Add to Cart button adds the item and shows feedback toast.',
    },
    {
      title: 'Product unavailable — out of stock handling',
      priority: 'P1' as const,
      difficulty: 'MEDIUM' as const,
      tags: ['mobile', 'product-catalog', 'negative', 'edge-case'],
      steps: '1. Find a product marked as out of stock\n2. Navigate to its detail page\n3. Attempt to add it to cart\n4. Observe UI behavior',
      preconditions: 'An out-of-stock product exists in the catalog.',
      expectedOutcome: '"Out of Stock" badge is shown on the product. Add to Cart button is disabled. User can choose to be notified when back in stock.',
    },
  ];

  const mobileTCs: any[] = [];
  for (const tc of mobileTCData) {
    const created = await prisma.libraryTestCase.create({
      data: {
        ...tc,
        status: 'ACTIVE',
        collectionId: mobileCollection.id,
        createdById: users.teamLeadMobile.id,
      },
    });
    await prisma.libraryTestCaseVersion.create({
      data: {
        libraryTestCaseId: created.id,
        version: 1,
        title: created.title,
        steps: created.steps,
        preconditions: created.preconditions,
        expectedOutcome: created.expectedOutcome,
        changeNotes: 'Initial version',
        createdById: users.teamLeadMobile.id,
      },
    });
    mobileTCs.push(created);
  }

  console.log('  ✓ Product Catalog (Mobile) collection: 4 test cases');

  // ── Discussions ────────────────────────────────────────────────────────────

  await prisma.libraryDiscussion.create({
    data: {
      libraryTestCaseId: loginValidTC.id,
      content: 'Should we also cover SSO login here, or create a separate test case for that?',
      createdById: users.memberSarah.id,
      createdAt: daysAgo(4),
    },
  });
  await prisma.libraryDiscussion.create({
    data: {
      libraryTestCaseId: loginValidTC.id,
      content: 'Good point! Let\'s keep this focused on email/password auth. I\'ll create a separate "SSO Login" test case in the next sprint.',
      createdById: users.teamLeadWeb.id,
      createdAt: daysAgo(3),
    },
  });

  await prisma.libraryDiscussion.create({
    data: {
      libraryTestCaseId: checkoutCCTC.id,
      content: 'Does this test cover 3D Secure (3DS) verification? Our gateway now enforces it for cards above Rp 500k.',
      createdById: users.memberJohn.id,
      createdAt: daysAgo(5),
    },
  });
  await prisma.libraryDiscussion.create({
    data: {
      libraryTestCaseId: checkoutCCTC.id,
      content: 'Good catch! I\'ll update this test case to include a 3DS verification step. Updating now.',
      createdById: users.teamLeadWeb.id,
      createdAt: daysAgo(4),
    },
  });
  await prisma.libraryDiscussion.create({
    data: {
      libraryTestCaseId: checkoutCCTC.id,
      content: 'Reminder: use the Midtrans sandbox card 4811111111111114 for 3DS simulation in test env.',
      createdById: users.memberSarah.id,
      createdAt: daysAgo(3),
    },
  });

  console.log('  ✓ Discussions created');

  // ── Suggestions ────────────────────────────────────────────────────────────

  await prisma.librarySuggestion.create({
    data: {
      libraryTestCaseId: checkoutTimeoutTC.id,
      type: 'UPDATE',
      content: 'Update timeout from 30s to 45s — our payment gateway (Midtrans) changed their timeout policy last week. Tests using 30s are now incorrectly failing.',
      status: 'PENDING',
      createdById: users.memberSarah.id,
      createdAt: hoursAgo(3),
    },
  });

  await prisma.librarySuggestion.create({
    data: {
      libraryTestCaseId: checkoutCCTC.id,
      type: 'IMPROVEMENT',
      content: 'Add test for QRIS payment method — QRIS is now supported by our gateway and used by ~30% of our customers. Should be P1.',
      status: 'ACCEPTED',
      createdById: users.memberJohn.id,
      reviewedById: users.teamLeadWeb.id,
      reviewedAt: daysAgo(2),
      createdAt: daysAgo(3),
    },
  });

  console.log('  ✓ Suggestions created');

  // ── Bookmarks ──────────────────────────────────────────────────────────────

  await prisma.libraryBookmark.createMany({
    data: [
      { libraryTestCaseId: loginValidTC.id, userId: users.memberSarah.id },
      { libraryTestCaseId: checkoutCCTC.id, userId: users.memberSarah.id },
      { libraryTestCaseId: refundTC.id, userId: users.memberSarah.id },
      { libraryTestCaseId: sessionRefreshTC.id, userId: users.memberJohn.id },
      { libraryTestCaseId: dashOverviewTC.id, userId: users.memberJohn.id },
    ],
    skipDuplicates: true,
  });

  console.log('  ✓ Bookmarks created');

  // ── Version 2 for "Checkout with credit card" ──────────────────────────────

  await prisma.libraryTestCase.update({
    where: { id: checkoutCCTC.id },
    data: {
      tags: ['payment', 'checkout', 'credit-card', 'smoke', '3d-secure'],
      steps: '1. Add items to cart\n2. Navigate to checkout\n3. Enter valid credit card details (Visa/Mastercard)\n4. Complete 3D Secure verification if prompted (use sandbox card 4811111111111114)\n5. Confirm order\n6. Wait for payment confirmation',
      updatedById: users.teamLeadWeb.id,
    },
  });

  await prisma.libraryTestCaseVersion.create({
    data: {
      libraryTestCaseId: checkoutCCTC.id,
      version: 2,
      title: checkoutCCTC.title,
      steps: '1. Add items to cart\n2. Navigate to checkout\n3. Enter valid credit card details (Visa/Mastercard)\n4. Complete 3D Secure verification if prompted (use sandbox card 4811111111111114)\n5. Confirm order\n6. Wait for payment confirmation',
      preconditions: checkoutCCTC.preconditions,
      expectedOutcome: checkoutCCTC.expectedOutcome,
      changeNotes: 'Added 3D Secure step based on team discussion — gateway now enforces 3DS for transactions above Rp 500k',
      createdById: users.teamLeadWeb.id,
    },
  });

  console.log('  ✓ Version 2 created for "Checkout with credit card"');

  const allLibraryTestCases = [...authTCs, ...paymentTCs, ...dashTCs, ...userMgmtTCs, ...mobileTCs];

  console.log(`  ✓ Library total: ${allLibraryTestCases.length} test cases across 5 collections`);

  return {
    authCollection,
    paymentCollection,
    dashCollection,
    userMgmtCollection,
    mobileCollection,
    loginValidTC,
    loginInvalidTC,
    checkoutCCTC,
    checkoutGopayTC,
    checkoutBankTC,
    refundTC,
    paymentHistoryTC,
    dashOverviewTC,
    inviteFlowTC,
    inviteUserTC,
    changeRoleTC,
    deactivateUserTC,
    sessionRefreshTC,
    logoutTC,
    allLibraryTestCases,
  };
}

// ── Test Data (SDK test cases + runs) ─────────────────────────────────────────

async function createTestData(
  teams: Awaited<ReturnType<typeof createTeams>>,
  users: Awaited<ReturnType<typeof createUsers>>,
) {
  console.log('🧪 Creating test cases and run history...');

  // ── SDK TestCases (what the reporter syncs) ────────────────────────────────

  await prisma.testCase.createMany({
    data: [
      // auth.spec.ts
      { title: 'Login with valid credentials', filePath: 'tests/auth.spec.ts', suiteName: 'auth.spec.ts', tags: ['auth', 'smoke'], teamId: teams.web.id },
      { title: 'Login with invalid credentials', filePath: 'tests/auth.spec.ts', suiteName: 'auth.spec.ts', tags: ['auth', 'negative'], teamId: teams.web.id },
      { title: 'Login with empty fields', filePath: 'tests/auth.spec.ts', suiteName: 'auth.spec.ts', tags: ['auth', 'validation'], teamId: teams.web.id },
      { title: 'Session refresh - auto token rotation', filePath: 'tests/auth.spec.ts', suiteName: 'auth.spec.ts', tags: ['auth', 'security'], teamId: teams.web.id },
      { title: 'Logout - clear all tokens', filePath: 'tests/auth.spec.ts', suiteName: 'auth.spec.ts', tags: ['auth', 'security'], teamId: teams.web.id },
      // payment.spec.ts
      { title: 'Checkout with credit card', filePath: 'tests/payment.spec.ts', suiteName: 'payment.spec.ts', tags: ['payment', 'smoke'], teamId: teams.web.id },
      { title: 'Checkout with bank transfer', filePath: 'tests/payment.spec.ts', suiteName: 'payment.spec.ts', tags: ['payment'], teamId: teams.web.id },
      { title: 'Checkout with GoPay', filePath: 'tests/payment.spec.ts', suiteName: 'payment.spec.ts', tags: ['payment', 'e-wallet'], teamId: teams.web.id },
      { title: 'Checkout with expired card', filePath: 'tests/payment.spec.ts', suiteName: 'payment.spec.ts', tags: ['payment', 'negative'], teamId: teams.web.id },
      { title: 'Refund flow - full refund', filePath: 'tests/payment.spec.ts', suiteName: 'payment.spec.ts', tags: ['payment', 'refund'], teamId: teams.web.id },
      { title: 'Payment history page', filePath: 'tests/payment.spec.ts', suiteName: 'payment.spec.ts', tags: ['payment'], teamId: teams.web.id },
      { title: 'Apply discount coupon at checkout', filePath: 'tests/payment.spec.ts', suiteName: 'payment.spec.ts', tags: ['payment', 'coupon'], teamId: teams.web.id },
      // dashboard.spec.ts
      { title: 'Dashboard overview loads correctly', filePath: 'tests/dashboard.spec.ts', suiteName: 'dashboard.spec.ts', tags: ['dashboard', 'smoke'], teamId: teams.web.id },
      { title: 'Sidebar navigation - all menu items accessible', filePath: 'tests/dashboard.spec.ts', suiteName: 'dashboard.spec.ts', tags: ['navigation'], teamId: teams.web.id },
      { title: 'Dark Light mode toggle', filePath: 'tests/dashboard.spec.ts', suiteName: 'dashboard.spec.ts', tags: ['ui', 'theme'], teamId: teams.web.id },
      { title: 'Dashboard filters by date range', filePath: 'tests/dashboard.spec.ts', suiteName: 'dashboard.spec.ts', tags: ['dashboard', 'filter'], teamId: teams.web.id },
      // user-management.spec.ts
      { title: 'Invite new user with email', filePath: 'tests/user-management.spec.ts', suiteName: 'user-management.spec.ts', tags: ['user-management', 'admin'], teamId: teams.web.id },
      { title: 'Change user role', filePath: 'tests/user-management.spec.ts', suiteName: 'user-management.spec.ts', tags: ['user-management', 'rbac'], teamId: teams.web.id },
      { title: 'Deactivate user account', filePath: 'tests/user-management.spec.ts', suiteName: 'user-management.spec.ts', tags: ['user-management', 'admin'], teamId: teams.web.id },
      { title: 'User list pagination and search', filePath: 'tests/user-management.spec.ts', suiteName: 'user-management.spec.ts', tags: ['user-management', 'search'], teamId: teams.web.id },
    ],
    skipDuplicates: true,
  });

  const testCases = await prisma.testCase.findMany({ where: { teamId: teams.web.id } });
  console.log(`  ✓ Created ${testCases.length} SDK test cases`);

  // ── Test Runs ──────────────────────────────────────────────────────────────

  const errors = [
    'TimeoutError: locator.click: Timeout 30000ms exceeded.',
    'Error: expect(received).toBeVisible() — element is not visible',
    'Error: expect(received).toHaveText() — Expected "Success", Received "Loading..."',
    'Error: page.goto: net::ERR_CONNECTION_REFUSED at https://staging.nexchief.com',
    'AssertionError: expected 500 to equal 200',
    'TimeoutError: page.waitForResponse: Timeout 15000ms exceeded',
  ];

  const branches = ['feature/sprint-14', 'fix/checkout-flow'];
  const runCreators = [users.memberSarah, users.memberJohn, users.teamLeadWeb];

  let runCounter = 0;
  const runs: any[] = [];

  // Generate runs day by day
  // Days 14..4 ago: 2 runs/day at 9am and 12pm
  // Days 3..0 ago: 3 runs/day at 9am, 12pm, 3pm

  for (let daysBack = 14; daysBack >= 0; daysBack--) {
    const runsPerDay = daysBack >= 4 ? 2 : 3;
    const runHours = runsPerDay === 2 ? [9, 12] : [9, 12, 15];

    const daysFromStart = 14 - daysBack; // 0 at start, 14 at end
    const passRate = 0.70 + (daysFromStart / 14) * 0.26; // trends 70% → 96%

    for (let hi = 0; hi < runHours.length; hi++) {
      runCounter++;
      const hour = runHours[hi];
      const isCI = hour === 9;
      const source = isCI ? 'CI' : 'LOCAL';
      const branch = isCI ? 'main' : branches[(runCounter + hi) % branches.length];
      const environment = isCI ? 'staging' : 'local';

      const baseTime = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      baseTime.setHours(hour, 0, 0, 0);

      const creator = runCreators[runCounter % runCreators.length];

      // Compute results
      const resultData: { testCaseId: string; status: string; duration?: number; error?: string }[] = [];
      let totalPassed = 0;
      let totalFailed = 0;
      let totalSkipped = 0;
      let totalDurationMs = 0;

      for (const tc of testCases) {
        const roll = Math.random();
        let status: string;
        let duration: number | undefined;
        let error: string | undefined;

        if (roll < passRate) {
          status = 'PASSED';
          duration = rand(2000, 12000);
          totalPassed++;
        } else if (roll < passRate + 0.05) {
          status = 'SKIPPED';
          duration = 0;
          totalSkipped++;
        } else {
          status = 'FAILED';
          duration = rand(500, 8000);
          error = errors[rand(0, errors.length - 1)];
          totalFailed++;
        }
        totalDurationMs += duration ?? 0;
        resultData.push({ testCaseId: tc.id, status, duration, error });
      }

      const runStatus: string = totalFailed > 0 ? 'FAILED' : totalSkipped === testCases.length ? 'CANCELLED' : 'PASSED';
      const finishedAt = new Date(baseTime.getTime() + Math.ceil(totalDurationMs / 1000) * 1000 + 60000);

      const run = await prisma.testRun.create({
        data: {
          teamId: teams.web.id,
          status: runStatus as any,
          source: source as any,
          branch,
          environment,
          totalTests: testCases.length,
          passed: totalPassed,
          failed: totalFailed,
          skipped: totalSkipped,
          duration: Math.ceil(totalDurationMs / 1000),
          startedAt: baseTime,
          finishedAt,
        },
      });

      await prisma.testResult.createMany({
        data: resultData.map((r) => ({
          testRunId: run.id,
          testCaseId: r.testCaseId,
          status: r.status as any,
          duration: r.duration,
          error: r.error,
          startedAt: baseTime,
          finishedAt,
        })),
      });

      runs.push(run);
    }
  }

  console.log(`  ✓ Created ${runs.length} test runs with results`);

  // ── Retry Run ──────────────────────────────────────────────────────────────

  const targetRun = runs[runs.length - 2]; // second-to-last run

  // Find failed test cases in the target run
  const failedResults = await prisma.testResult.findMany({
    where: { testRunId: targetRun.id, status: 'FAILED' },
    include: { testCase: true },
  });

  if (failedResults.length > 0) {
    const retryStartedAt = new Date(targetRun.finishedAt!.getTime() + 5 * 60 * 1000);
    const retryFinishedAt = new Date(retryStartedAt.getTime() + 120000);

    const retryRun = await prisma.testRun.create({
      data: {
        teamId: teams.web.id,
        status: 'PASSED',
        source: 'LOCAL',
        branch: targetRun.branch,
        environment: targetRun.environment,
        totalTests: failedResults.length,
        passed: failedResults.length,
        failed: 0,
        skipped: 0,
        duration: 120,
        startedAt: retryStartedAt,
        finishedAt: retryFinishedAt,
      },
    });

    await prisma.testResult.createMany({
      data: failedResults.map((r) => ({
        testRunId: retryRun.id,
        testCaseId: r.testCaseId,
        status: 'PASSED' as any,
        duration: rand(2000, 8000),
        retryCount: 1,
        startedAt: retryStartedAt,
        finishedAt: retryFinishedAt,
      })),
    });

    // Create a RetryRequest for the first failed test case
    await prisma.retryRequest.create({
      data: {
        teamId: teams.web.id,
        testCaseId: failedResults[0].testCaseId,
        status: 'COMPLETED',
        requestedAt: retryStartedAt,
        pickedUpAt: new Date(retryStartedAt.getTime() + 30000),
        completedAt: retryFinishedAt,
      },
    });

    runs.push(retryRun);
    console.log(`  ✓ Created retry run (${failedResults.length} tests re-run, all now PASSED)`);
  }

  return { testCases, runs };
}

// ── Library Links ─────────────────────────────────────────────────────────────

async function createLibraryLinks(
  library: Awaited<ReturnType<typeof createLibrary>>,
  testCases: any[],
) {
  console.log('🔗 Creating library → SDK test case links...');

  const linkMap: { libraryTC: any; sdkTitle: string }[] = [
    { libraryTC: library.loginValidTC, sdkTitle: 'Login with valid credentials' },
    { libraryTC: library.loginInvalidTC, sdkTitle: 'Login with invalid credentials' },
    { libraryTC: library.checkoutCCTC, sdkTitle: 'Checkout with credit card' },
    { libraryTC: library.checkoutBankTC, sdkTitle: 'Checkout with bank transfer' },
    { libraryTC: library.checkoutGopayTC, sdkTitle: 'Checkout with GoPay' },
    { libraryTC: library.refundTC, sdkTitle: 'Refund flow - full refund' },
    { libraryTC: library.paymentHistoryTC, sdkTitle: 'Payment history page' },
    { libraryTC: library.dashOverviewTC, sdkTitle: 'Dashboard overview loads correctly' },
    { libraryTC: library.inviteUserTC, sdkTitle: 'Invite new user with email' },
  ];

  let linkedCount = 0;
  for (const { libraryTC, sdkTitle } of linkMap) {
    const sdkTC = testCases.find((tc: any) => tc.title === sdkTitle);
    if (sdkTC) {
      await prisma.libraryTestCaseLink.create({
        data: {
          libraryTestCaseId: libraryTC.id,
          testCaseId: sdkTC.id,
          autoMatched: true,
        },
      }).catch(() => { /* skip if already exists */ });
      linkedCount++;
    }
  }

  console.log(`  ✓ Created ${linkedCount} library links`);
}

// ── Releases ──────────────────────────────────────────────────────────────────

async function createReleases(
  teams: Awaited<ReturnType<typeof createTeams>>,
  users: Awaited<ReturnType<typeof createUsers>>,
  library: Awaited<ReturnType<typeof createLibrary>>,
  testCases: any[],
  runs: any[],
) {
  console.log('🚀 Creating releases...');

  // Helper to find SDK test case by title
  const findTC = (title: string) => testCases.find((tc: any) => tc.title === title);

  // ── Release 1: v2.4.0 — RELEASED ─────────────────────────────────────────

  const r1 = await prisma.release.create({
    data: {
      name: 'Sprint 13 — Auth & Payment Improvements',
      version: 'v2.4.0',
      description: 'Authentication hardening and payment method expansion. Includes GoPay integration, session security improvements, and credit card 3DS support.',
      status: 'RELEASED',
      teamId: teams.web.id,
      createdById: users.teamLeadWeb.id,
      targetDate: daysAgo(14),
      releasedAt: daysAgo(14),
      createdAt: daysAgo(16),
      updatedAt: daysAgo(14),
    },
  });

  await prisma.releaseChecklistItem.createMany({
    data: [
      {
        releaseId: r1.id,
        type: 'AUTOMATED_TEST',
        title: 'Login with valid credentials',
        status: 'PASSED',
        libraryTestCaseId: library.loginValidTC.id,
        testCaseId: findTC('Login with valid credentials')?.id ?? null,
        order: 0,
        completedAt: daysAgo(15),
      },
      {
        releaseId: r1.id,
        type: 'AUTOMATED_TEST',
        title: 'Login with invalid credentials',
        status: 'PASSED',
        libraryTestCaseId: library.loginInvalidTC.id,
        testCaseId: findTC('Login with invalid credentials')?.id ?? null,
        order: 1,
        completedAt: daysAgo(15),
      },
      {
        releaseId: r1.id,
        type: 'AUTOMATED_TEST',
        title: 'Checkout with credit card',
        status: 'PASSED',
        libraryTestCaseId: library.checkoutCCTC.id,
        testCaseId: findTC('Checkout with credit card')?.id ?? null,
        order: 2,
        completedAt: daysAgo(15),
      },
      {
        releaseId: r1.id,
        type: 'AUTOMATED_TEST',
        title: 'Checkout with GoPay',
        status: 'PASSED',
        libraryTestCaseId: library.checkoutGopayTC.id,
        testCaseId: findTC('Checkout with GoPay')?.id ?? null,
        order: 3,
        completedAt: daysAgo(15),
      },
      {
        releaseId: r1.id,
        type: 'DEPLOYMENT',
        title: 'Deploy to staging',
        status: 'PASSED',
        order: 4,
        completedAt: daysAgo(15),
      },
      {
        releaseId: r1.id,
        type: 'VERIFICATION',
        title: 'Smoke test on staging',
        status: 'PASSED',
        order: 5,
        completedAt: daysAgo(14),
      },
      {
        releaseId: r1.id,
        type: 'SIGN_OFF',
        title: 'Product owner sign-off',
        status: 'PASSED',
        order: 6,
        completedAt: daysAgo(14),
        assignedToId: users.manager.id,
      },
    ],
  });

  console.log('  ✓ Release v2.4.0 (RELEASED) — 7 checklist items');

  // ── Release 2: v2.5.0 — IN_PROGRESS ──────────────────────────────────────

  const r2 = await prisma.release.create({
    data: {
      name: 'Sprint 14 — Payment & Dashboard',
      version: 'v2.5.0',
      description: 'Payment improvements, dashboard real-time updates, and UX polish. Includes QRIS payment method and WebSocket-driven live dashboard.',
      status: 'IN_PROGRESS',
      teamId: teams.web.id,
      createdById: users.teamLeadWeb.id,
      targetDate: daysAgo(-7),
      createdAt: daysAgo(5),
      updatedAt: daysAgo(1),
    },
  });

  await prisma.releaseChecklistItem.createMany({
    data: [
      {
        releaseId: r2.id,
        type: 'AUTOMATED_TEST',
        title: 'Checkout with credit card',
        status: 'PASSED',
        libraryTestCaseId: library.checkoutCCTC.id,
        testCaseId: findTC('Checkout with credit card')?.id ?? null,
        order: 0,
        completedAt: daysAgo(3),
      },
      {
        releaseId: r2.id,
        type: 'AUTOMATED_TEST',
        title: 'Checkout with bank transfer',
        status: 'PASSED',
        libraryTestCaseId: library.checkoutBankTC.id,
        testCaseId: findTC('Checkout with bank transfer')?.id ?? null,
        order: 1,
        completedAt: daysAgo(3),
      },
      {
        releaseId: r2.id,
        type: 'AUTOMATED_TEST',
        title: 'Payment history page',
        status: 'PASSED',
        libraryTestCaseId: library.paymentHistoryTC.id,
        testCaseId: findTC('Payment history page')?.id ?? null,
        order: 2,
        completedAt: daysAgo(2),
      },
      {
        releaseId: r2.id,
        type: 'AUTOMATED_TEST',
        title: 'Dashboard overview loads correctly',
        status: 'PASSED',
        libraryTestCaseId: library.dashOverviewTC.id,
        testCaseId: findTC('Dashboard overview loads correctly')?.id ?? null,
        order: 3,
        completedAt: daysAgo(2),
      },
      {
        releaseId: r2.id,
        type: 'AUTOMATED_TEST',
        title: 'Checkout with GoPay',
        status: 'FAILED',
        libraryTestCaseId: library.checkoutGopayTC.id,
        testCaseId: findTC('Checkout with GoPay')?.id ?? null,
        order: 4,
        notes: 'GoPay sandbox returning 503 intermittently — investigating with gateway team.',
      },
      {
        releaseId: r2.id,
        type: 'AUTOMATED_TEST',
        title: 'Refund flow — full refund',
        status: 'PENDING',
        libraryTestCaseId: library.refundTC.id,
        testCaseId: findTC('Refund flow - full refund')?.id ?? null,
        order: 5,
      },
      {
        releaseId: r2.id,
        type: 'DEPLOYMENT',
        title: 'Deploy to staging',
        status: 'PASSED',
        order: 6,
        completedAt: daysAgo(4),
      },
      {
        releaseId: r2.id,
        type: 'VERIFICATION',
        title: 'Performance testing',
        status: 'PENDING',
        order: 7,
        assignedToId: users.memberSarah.id,
      },
      {
        releaseId: r2.id,
        type: 'SIGN_OFF',
        title: 'Product owner sign-off',
        status: 'PENDING',
        order: 8,
        assignedToId: users.manager.id,
      },
    ],
  });

  // Link last 3 runs to release 2
  const lastRuns = runs.slice(-3);
  await prisma.releaseTestRun.createMany({
    data: lastRuns.map((r) => ({ releaseId: r2.id, testRunId: r.id })),
    skipDuplicates: true,
  });

  console.log('  ✓ Release v2.5.0 (IN_PROGRESS) — 9 checklist items, 3 runs linked');

  // ── Release 3: v2.4.1-hotfix — CANCELLED ─────────────────────────────────

  await prisma.release.create({
    data: {
      name: 'Hotfix — Checkout Timeout',
      version: 'v2.4.1-hotfix',
      description: 'Emergency fix for checkout timeout regression — decision made to merge into v2.5.0 instead to avoid scope creep on the hotfix branch.',
      status: 'CANCELLED',
      teamId: teams.web.id,
      createdById: users.teamLeadWeb.id,
      createdAt: daysAgo(10),
      updatedAt: daysAgo(8),
    },
  });

  console.log('  ✓ Release v2.4.1-hotfix (CANCELLED)');
}

// ── Task Groups ────────────────────────────────────────────────────────────────

async function createTaskGroups(
  teams: Awaited<ReturnType<typeof createTeams>>,
  users: Awaited<ReturnType<typeof createUsers>>,
  library: Awaited<ReturnType<typeof createLibrary>>,
) {
  console.log('📋 Creating task groups...');

  // Sarah's payment tasks
  const tg1 = await prisma.taskGroup.create({
    data: {
      name: 'Sprint 14 — Payment Tests',
      userId: users.memberSarah.id,
      createdById: users.teamLeadWeb.id,
      teamId: teams.web.id,
      branch: 'feature/sprint-14-payment',
      status: 'ACTIVE',
      dueDate: daysAgo(-5),
    },
  });

  await prisma.taskGroupItem.createMany({
    data: [
      { taskGroupId: tg1.id, libraryTestCaseId: library.checkoutCCTC.id, personalStatus: 'IN_PROGRESS', order: 0 },
      { taskGroupId: tg1.id, libraryTestCaseId: library.checkoutGopayTC.id, personalStatus: 'NOT_STARTED', order: 1 },
      { taskGroupId: tg1.id, libraryTestCaseId: library.refundTC.id, personalStatus: 'NOT_STARTED', order: 2 },
    ],
  });

  // John's auth tasks
  const tg2 = await prisma.taskGroup.create({
    data: {
      name: 'Sprint 14 — Auth Tests',
      userId: users.memberJohn.id,
      createdById: users.teamLeadWeb.id,
      teamId: teams.web.id,
      branch: 'feature/sprint-14-auth',
      status: 'ACTIVE',
      dueDate: daysAgo(-5),
    },
  });

  await prisma.taskGroupItem.createMany({
    data: [
      { taskGroupId: tg2.id, libraryTestCaseId: library.loginValidTC.id, personalStatus: 'IN_PROGRESS', order: 0 },
      { taskGroupId: tg2.id, libraryTestCaseId: library.sessionRefreshTC.id, personalStatus: 'NOT_STARTED', order: 1 },
      { taskGroupId: tg2.id, libraryTestCaseId: library.logoutTC.id, personalStatus: 'NOT_STARTED', order: 2 },
    ],
  });

  console.log('  ✓ Created 2 task groups (Sprint 14 Payment + Auth)');
}

// ── Activity Log ──────────────────────────────────────────────────────────────

async function createActivityLog(
  users: Awaited<ReturnType<typeof createUsers>>,
  teams: Awaited<ReturnType<typeof createTeams>>,
) {
  console.log('📋 Creating activity log...');

  const entries = [
    { userId: users.admin.id, teamId: teams.web.id, action: 'user.role.changed', details: 'Dian Purnama: MEMBER → TEAM_LEAD', createdAt: daysAgo(20) },
    { userId: users.admin.id, teamId: null as string | null, action: 'user.invited', details: 'monitoring@qcmonitor.demo invited as MONITORING', createdAt: daysAgo(7) },
    { userId: users.teamLeadWeb.id, teamId: teams.web.id, action: 'library.collection.created', details: 'Collection "Authentication" created', createdAt: daysAgo(6) },
    { userId: users.teamLeadWeb.id, teamId: teams.web.id, action: 'library.collection.created', details: 'Collection "Payment" created', createdAt: daysAgo(6) },
    { userId: users.teamLeadWeb.id, teamId: teams.web.id, action: 'library.testcase.created', details: '"Login with valid credentials" added to Authentication', createdAt: daysAgo(6) },
    { userId: users.memberJohn.id, teamId: teams.web.id, action: 'library.discussion.created', details: 'Comment on "Checkout with credit card"', createdAt: daysAgo(5) },
    { userId: users.teamLeadWeb.id, teamId: teams.web.id, action: 'release.created', details: 'Release v2.5.0 — Sprint 14 created', createdAt: daysAgo(5) },
    { userId: users.teamLeadWeb.id, teamId: teams.web.id, action: 'library.testcase.updated', details: '"Checkout with credit card" updated to v2 — Added 3D Secure step', createdAt: daysAgo(4) },
    { userId: users.teamLeadWeb.id, teamId: teams.web.id, action: 'release.status.updated', details: 'Release v2.4.0: ACTIVE → RELEASED', createdAt: daysAgo(14) },
    { userId: users.teamLeadWeb.id, teamId: teams.web.id, action: 'release.status.updated', details: 'Release v2.4.1-hotfix: ACTIVE → CANCELLED', createdAt: daysAgo(8) },
    { userId: users.memberSarah.id, teamId: teams.web.id, action: 'run.retry.triggered', details: 'Retry triggered for 2 failed tests', createdAt: hoursAgo(6) },
    { userId: users.memberSarah.id, teamId: teams.web.id, action: 'library.suggestion.created', details: 'Suggested: "Update timeout from 30s to 45s"', createdAt: hoursAgo(3) },
    { userId: users.admin.id, teamId: teams.web.id, action: 'apikey.created', details: 'API key "QA Web Team" created', createdAt: daysAgo(3) },
    { userId: users.teamLeadWeb.id, teamId: teams.web.id, action: 'library.suggestion.reviewed', details: 'Approved suggestion: "Add test for QRIS payment method"', createdAt: hoursAgo(2) },
  ];

  for (const entry of entries) {
    await prisma.activityLog.create({ data: entry });
  }

  console.log(`  ✓ Created ${entries.length} activity entries`);
}

// ── Print Credentials ─────────────────────────────────────────────────────────

function printLoginCredentials() {
  console.log('\n' + '='.repeat(60));
  console.log('  DEMO LOGIN CREDENTIALS');
  console.log('='.repeat(60));
  console.log('  Password for all users: demo1234\n');
  console.log('  Role          | Email');
  console.log('  ' + '-'.repeat(55));
  console.log('  ADMIN         | admin@qcmonitor.demo');
  console.log('  MANAGER       | manager@qcmonitor.demo');
  console.log('  SUPERVISOR    | supervisor@qcmonitor.demo');
  console.log('  TEAM_LEAD     | teamlead.web@qcmonitor.demo');
  console.log('  TEAM_LEAD     | teamlead.mobile@qcmonitor.demo');
  console.log('  MEMBER        | sarah@qcmonitor.demo');
  console.log('  MEMBER        | john@qcmonitor.demo');
  console.log('  MONITORING    | monitoring@qcmonitor.demo');
  console.log('='.repeat(60));
  console.log('\n  Teams:');
  console.log('  - QA Web Team    → apiKey: sk-qcm-demo-web-001');
  console.log('  - QA Mobile Team → apiKey: sk-qcm-demo-mobile-001');
  console.log('='.repeat(60) + '\n');
}

// ── Main ──────────────────────────────────────────────────────────────────────

async function main() {
  console.log('🌱 Starting demo seed...\n');

  await cleanDatabase();
  const users = await createUsers();
  const teams = await createTeams(users);
  await addTeamMembers(teams, users);
  const library = await createLibrary(teams, users);
  const { testCases, runs } = await createTestData(teams, users);
  await createLibraryLinks(library, testCases);
  await createReleases(teams, users, library, testCases, runs);
  await createTaskGroups(teams, users, library);
  await createActivityLog(users, teams);

  console.log('\n✅ Demo seed complete!');
  printLoginCredentials();
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
