# MASTER PROMPT — SHOKFAT PRO
## International Medical CRM SaaS Platform

You are a world-class Senior Software Architect, SaaS Product Manager, UI/UX Designer, Full-Stack Engineer, Database Architect, and Cybersecurity Specialist.

I want you to help me build a fully owned, commercial, enterprise-grade international Medical CRM SaaS platform.

The platform will be sold to medical centers, dental clinics, dermatology clinics, aesthetic centers, and multi-branch healthcare organizations through monthly and annual subscriptions.

This is a real commercial software product, NOT a demonstration website, a simple dashboard, or a CRM built for only one clinic.

# 1. Official Project Identity

**Platform Name:** شوكفات برو

**Owning Company:** شوكفات

**Product Type:** International Medical CRM SaaS

**Business Model:** Monthly and annual subscriptions.

**Primary Language:** Arabic

**Secondary Language:** English

**Initial Target Markets:** Saudi Arabia, Egypt, and GCC countries.

The platform must be independently branded as **شوكفات برو**, while the company **شوكفات** must be identified as the official owner and operator.

Important branding rules:

- Use شوكفات برو as the product name throughout the platform.
- Use شوكفات as the owning company.
- Use the provided company or product logo.
- Extract the primary brand colors from the provided logo.
- If the logo is missing, use a temporary placeholder rather than inventing an official logo.
- Build a centralized Design System.
- Make the branding configurable without rewriting application code.
- Allow subscribed medical centers to upload their own logos and customize permitted workspace branding.
- Keep the main شوكفات برو product identity separate from individual medical center identities.
- Prepare the design for future mobile applications.

The visual identity must be premium, modern, elegant, and suitable for an international professional SaaS platform.

# 2. International Markets

The platform must be designed to operate in:

1. Saudi Arabia
2. Egypt
3. United Arab Emirates
4. Kuwait
5. Qatar
6. Bahrain
7. Oman

Build a single configurable international platform rather than seven separate applications.

Support:

- Arabic and English.
- RTL and LTR layouts.
- Multiple currencies.
- Country-specific time zones.
- Country-specific tax configuration.
- International phone number formats.
- Country-specific payment gateway integrations.
- Different local calling and messaging providers.
- Country-specific privacy and data retention configurations.
- Country-specific data hosting and residency requirements.
- Configurable country launch availability.

Architect the system with a Global Control Plane and configurable Regional Data Environments.

Each medical center must have isolated data.

Do not assume that a particular hosting location automatically satisfies local privacy or healthcare regulations.

Document the legal and security requirements that need independent verification before launching in each country.

# 3. SaaS System Architecture

Build a secure Multi-Tenant SaaS architecture.

The system must support three main management levels.

## Level 1 — Platform Super Admin

This is the management dashboard owned by شوكفات.

The platform administrator must be able to:

- Create and manage medical center subscriptions.
- Manage subscription packages.
- Create medical center accounts.
- Activate and suspend subscriptions.
- Configure subscriptions by country.
- Manage countries and currencies.
- Manage application-level feature availability.
- View recurring revenue analytics.
- Track active and cancelled subscriptions.
- Monitor platform performance.
- Manage support tickets.
- Configure integrations.
- Manage subscription billing and invoices.
- Monitor platform-wide system health.

Platform administrators must not have unrestricted access to sensitive patient information or private conversations.

## Level 2 — Medical Center Administrator

Every medical center will have its own private workspace.

The medical center administrator must be able to:

- Manage medical center information.
- Add branches.
- Add departments.
- Create employee accounts.
- Define employee permissions.
- Connect authorized WhatsApp accounts.
- Connect supported Meta and TikTok business accounts.
- Manage customer inquiries.
- Manage appointments.
- Monitor employee performance.
- View marketing reports.
- View subscriptions and invoices.
- Manage permitted marketing campaigns.
- Configure notifications and automation.

## Level 3 — Employees

Create configurable permissions for:

- Receptionist
- Customer Service Agent
- Supervisor
- Marketing Specialist
- Branch Manager
- Medical Center Administrator

Each employee must log in with an individual account.

Use secure authentication and role-based access control.

# 4. Unified Omnichannel Inbox

This is one of the most important components of شوكفات برو.

The platform must eventually support official integrations with:

- WhatsApp Business Platform
- Facebook Messenger
- Instagram Direct Messages
- Meta Lead Forms
- TikTok Lead Generation Forms
- TikTok Business Messaging when officially available and approved
- Incoming and outgoing phone calls through authorized telephony providers

All permitted conversations must be managed from one unified inbox.

Required features:

- Customer name and phone number.
- Communication channel.
- Conversation history.
- Date and time of every message.
- Assigned employee.
- Unanswered message tracking.
- First response time.
- Average response time.
- Conversation status.
- Conversation assignment.
- Internal employee notes.
- Saved replies.
- Conversation search.
- Advanced filters.
- Follow-up reminders.
- Notifications for delayed responses.
- Missed call tracking.
- Employee activity audit logs.

Conversation statuses:

- New
- Open
- Pending
- Waiting for Customer
- Resolved
- Closed

Do not use unofficial APIs or scraping.

Create mock integrations first.

Implement real integrations only after confirming availability, permissions, credentials, and provider requirements.

# 5. Customer CRM

Build a centralized CRM for every subscribed medical center.

Required features:

- Customer profiles.
- Contact information.
- Lead source.
- Inquiry history.
- Conversation timeline.
- Customer service interests.
- Employee assignment.
- Follow-up tasks.
- Customer status.
- Duplicate contact detection.
- Appointment history.
- Customer activity timeline.
- Internal operational notes.

Create a configurable sales and booking pipeline.

Example pipeline:

1. New Inquiry
2. Contacted
3. Qualified Lead
4. Appointment Requested
5. Appointment Booked
6. Appointment Confirmed
7. Attended
8. Cancelled
9. No-show
10. Closed

Do not build an electronic medical records system in the initial MVP.

Avoid storing clinical diagnoses and detailed sensitive medical information unless a separately approved business requirement and security architecture demand it.

# 6. Appointment Management

Build a flexible appointment management module.

Features:

- Create appointments.
- Assign appointments to branches.
- Assign appointment departments.
- Set appointment dates and times.
- Confirm bookings.
- Cancel appointments.
- Reschedule appointments.
- Record attendance.
- Identify no-show appointments.
- Create operational follow-up reminders.
- Track bookings by communication source.
- Track bookings by employee.
- Support future integrations with external medical scheduling systems.

# 7. Marketing and Analytics

Build powerful operational and marketing dashboards.

The system should measure:

- Total inquiries.
- Inquiries by platform.
- Inquiries by campaign.
- Unanswered messages.
- Missed calls.
- First response times.
- Employee response performance.
- Appointment booking rates.
- Appointment attendance rates.
- Lead conversion rates.
- Campaign-to-booking attribution where technically supported.
- Verified revenue attribution where reliable data is available.

Marketing automation features should include:

- Approved communication templates.
- Consent management.
- Opt-out handling.
- Follow-up reminders.
- Customer service automation.
- Appointment confirmation messages.
- Appointment reminders.
- Operational follow-ups.
- Eligible marketing campaign workflows.

Important:

Do not use sensitive health information for marketing audience creation.

Separate service messages from promotional messages.

Apply country-specific privacy and messaging rules.

# 8. SaaS Subscriptions

Create a complete subscription management system for شوكفات برو.

Support:

- Monthly plans.
- Annual plans.
- Free trials.
- Subscription upgrades.
- Subscription downgrades.
- Subscription renewals.
- Subscription cancellation.
- Usage limits.
- User limits.
- Branch limits.
- Connected channel limits.
- Optional premium features.
- Subscription invoices.
- Payment history.
- Payment failure handling.
- Subscription analytics.
- Country-specific pricing.
- Multi-currency billing.
- Payment gateway adapters.

Payment providers must be selected after verifying availability and eligibility for each operating country.

# 9. User Interface and Experience

Design شوكفات برو to compete visually and functionally with premium international SaaS products.

The interface must be:

- Modern.
- Professional.
- Premium.
- Elegant.
- Fast.
- Responsive.
- Easy for nontechnical reception employees.
- Arabic-first.
- Fully compatible with English.
- Compatible with RTL and LTR.
- Accessible.
- Consistent across all modules.

Support light mode and dark mode.

Create a scalable component library and design system.

Initial screens:

1. Login
2. Super Admin Dashboard
3. Medical Centers Management
4. Medical Center Dashboard
5. Unified Inbox
6. Customer CRM
7. Appointment Management
8. Employee Management
9. Analytics and Reports
10. Subscription Packages
11. Billing and Invoices
12. Integrations
13. Notifications
14. Settings
15. Country Management

Do not create fake production statistics or present simulated activity as real.

Use clearly identified synthetic demo data.

# 10. Recommended Technology Stack

My preferred stack is:

**Frontend**
- Next.js
- TypeScript
- Tailwind CSS
- Modern UI component library

**Backend**
- NestJS
- TypeScript
- REST APIs and Webhooks

**Database**
- PostgreSQL

**Background Processing**
- Redis
- BullMQ

**Infrastructure**
- Docker
- Automated testing
- CI/CD
- Monitoring
- Secure secrets management

You may propose alternatives when supported by clear technical justification.

Avoid unnecessary architectural complexity in the MVP.

# 11. Security and Data Protection

Security must be a core part of the system.

Requirements:

- Strong Multi-Tenant isolation.
- Secure authentication.
- Role-based authorization.
- Multi-factor authentication capability.
- Encryption in transit and at rest.
- Webhook signature verification.
- Secure API authentication.
- Audit logging.
- Rate limiting.
- Secure credential management.
- Backup systems.
- Recovery procedures.
- Data export and deletion workflows.
- Country-specific privacy controls.
- Automated tenant-isolation tests.
- Restricted access to sensitive customer conversations.

Do not store real patient information in development or test environments.

Do not claim legal compliance unless it has been independently verified.

# 12. Ownership and Intellectual Property

The entire platform must be developed as software owned and operated by شوكفات, subject to the applicable licenses of any third-party components.

Requirements:

- Maintain clear source-code ownership.
- Use a private Git repository owned by the company.
- Document all external dependencies.
- Document all third-party licenses.
- Avoid unnecessary vendor lock-in.
- Keep credentials outside source code.
- Make the system deployable independently.
- Provide complete technical documentation.

# 13. Development Strategy

We will build شوكفات برو step by step using Claude Code.

Do not attempt to create the complete platform in a single implementation task.

Separate development into:

**Phase 1 — Product Analysis and Architecture**

**Phase 2 — Design System and UI/UX**

**Phase 3 — Multi-Tenant Infrastructure and Authentication**

**Phase 4 — Customer CRM and Unified Inbox**

**Phase 5 — Official Communication Integrations**

**Phase 6 — Appointment Management**

**Phase 7 — Analytics and Marketing Automation**

**Phase 8 — Subscriptions and Payments**

**Phase 9 — Security Testing and Pilot Launch**

**Phase 10 — International Expansion**

Each phase must have specific deliverables and measurable acceptance criteria.

# 14. YOUR FIRST ASSIGNMENT

Before writing application code, read every document and branding asset provided inside the project folder.

Carefully analyze the entire business concept.

Then:

1. Prepare the complete product architecture.
2. Define the Multi-Tenant database model.
3. Recommend the final technology stack.
4. Define the user roles and permissions.
5. Explain the international infrastructure strategy.
6. Identify external API requirements.
7. Prepare the detailed UI/UX structure.
8. Create a complete implementation roadmap.
9. Define the MVP scope.
10. Identify technical and security risks.
11. List required accounts, credentials, providers, and services.
12. Identify questions and decisions requiring the project owner's approval.

Create a `/docs` folder containing:

- PRODUCT_REQUIREMENTS.md
- SYSTEM_ARCHITECTURE.md
- DATABASE_DESIGN.md
- TENANT_SECURITY.md
- INTERNATIONALIZATION.md
- INTEGRATIONS_PLAN.md
- UI_UX_DESIGN_SYSTEM.md
- IMPLEMENTATION_ROADMAP.md
- REQUIRED_ACCOUNTS_AND_SERVICES.md
- MVP_ACCEPTANCE_CRITERIA.md

Write the documentation and project-owner explanations in Arabic.

Keep programming terminology, technical identifiers, and code conventions in English where appropriate.

# 15. Final Instructions

Treat شوكفات برو as a serious international commercial SaaS product.

Prioritize:

1. Security
2. Reliability
3. Excellent user experience
4. Maintainable code
5. Scalability
6. Performance
7. Modern visual identity

Do not purchase external services.

Do not connect real customer or patient information.

Do not deploy to production without approval.

**For this first assignment, perform analysis, architecture design, project documentation, and implementation planning ONLY.**

When completed, show me:

- Executive summary in Arabic.
- Proposed system architecture.
- MVP feature list.
- Detailed development phases.
- Required external accounts and services.
- Branding and interface recommendations.
- Critical decisions that need my approval.

Then STOP and wait for my approval before starting application development.