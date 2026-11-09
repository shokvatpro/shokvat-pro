# معمارية النظام — شوكفات برو
**SYSTEM_ARCHITECTURE.md** · الإصدار 0.1 (مسودة للاعتماد)

---

## 1. الملخص
نظام واحد بقاعدة كود واحدة (Monorepo) يُنشر على شكل:
- **Global Control Plane** واحد: الحسابات العامة، المجمعات (بيانات وصفية فقط)، الباقات، الاشتراكات، الفواتير، الدول، المزايا، المراقبة.
- **Regional Data Planes** متعددة: لكل منطقة بيانات (مثلًا `sa-1`، `eg-1`، `ae-1`) نسخة مستقلة من الـ API والعمال (workers) وقاعدة البيانات والتخزين ومفاتيح التشفير. فيها **كل بيانات المرضى والمحادثات**.

في الـ MVP: Control Plane + Data Plane واحد للسعودية (`sa-1`)، لكن الكود يعمل بمفهوم المنطقة من اليوم الأول، فإضافة دولة = نشر Data Plane جديد + إعداد، لا إعادة كتابة.

---

## 2. المخطط العام

```
                        ┌───────────────────────────────────────────────┐
                        │              Users (Browser / Mobile)          │
                        └───────────────┬───────────────────────────────┘
                                        │ HTTPS
                        ┌───────────────▼───────────────┐
                        │  Web App (Next.js)             │  app.shokfatpro.example
                        │  + Edge: WAF / CDN (static only)│  {tenant}.shokfatpro.example
                        └───────┬───────────────┬────────┘
             control requests  │               │  tenant data requests (routed by tenant.region)
                ┌──────────────▼──────┐   ┌────▼──────────────────────────────────────┐
                │  GLOBAL CONTROL PLANE│   │  REGIONAL DATA PLANE  (sa-1 | eg-1 | ae-1 …)│
                │  control-api (NestJS)│   │  tenant-api (NestJS)                        │
                │  - auth / identity   │◄─►│  - inbox / crm / appointments / reports     │
                │  - tenants registry  │   │  - webhooks ingress (Meta, TikTok, voice)   │
                │  - plans / billing   │   │  workers (BullMQ): send, ingest, SLA, notify│
                │  - countries / flags │   │  PostgreSQL (RLS)  · Redis · Object Storage │
                │  Postgres (control)  │   │  KMS keys per region · Backups in-region    │
                │  Redis · workers     │   └─────────────────────────────────────────────┘
                └──────────┬───────────┘
                           │ adapters
          Payment gateways · Email · Monitoring · Status page
```

**قاعدة التدفق:** يحتفظ الـ Control Plane فقط بما يلزم لتشغيل الاشتراك (اسم المجمع، الدولة، المنطقة، الباقة، عدد المستخدمين، الاستخدام المجمّع، حالة الفوترة). **لا ينتقل أي محتوى رسائل أو بيانات عملاء/مرضى إلى الـ Control Plane.**

---

## 3. التقنيات المقترحة (التوصية النهائية)

| الطبقة | الاختيار | المبرر |
|---|---|---|
| Monorepo | **pnpm + Turborepo** | مشاركة الأنواع والتصميم بين الواجهة والخادم، بناء سريع |
| اللغة | **TypeScript** (strict) في كل مكان | نوع واحد من الواجهة إلى قاعدة البيانات |
| الواجهة | **Next.js (App Router)** + React | SSR للصفحات العامة، تطبيق سريع للوحة |
| التنسيق | **Tailwind CSS** بخصائص منطقية (`ms-`, `pe-`, `start`) | دعم RTL/LTR دون نسختين من الأنماط |
| مكتبة المكونات | **shadcn/ui** فوق **Radix UI** | مكونات مملوكة داخل المستودع (لا قفل مورد)، إتاحة جيدة، تدعم `dir` |
| التدويل | **next-intl** + ICU MessageFormat | الجمع العربي (zero/one/two/few/many/other) صحيح |
| الخادم | **NestJS** (REST + OpenAPI + Webhooks) | بنية وحدات واضحة، حقن تبعيات، اختبار سهل |
| ORM | **Drizzle ORM** + migrations SQL صريحة | يدعم RLS وإعداد `set_config` لكل معاملة بسهولة أكبر من Prisma |
| قاعدة البيانات | **PostgreSQL 16+** مع Row-Level Security | عزل المستأجرين داخل المحرك نفسه |
| الطوابير | **Redis + BullMQ** | إعادة المحاولة، تأخير، طوابير ميتة (DLQ) |
| البحث | Postgres Full-Text + `pg_trgm` في MVP | تجنّب خدمة بحث إضافية مبكرًا؛ دعم العربية بتطبيع مخصّص |
| الوقت الفعلي | **WebSocket** (Socket.IO عبر NestJS Gateway) + Redis adapter | تحديث الصندوق لحظيًا |
| التخزين | واجهة S3-compatible | مرفقات وشعارات؛ Bucket لكل منطقة |
| المصادقة | وحدة داخل NestJS: **argon2id** + جلسات httpOnly + **TOTP MFA**؛ WebAuthn لاحقًا؛ SSO (OIDC/SAML) لباقة المؤسسات | ملكية كاملة، لا اعتماد على مزود هوية خارجي في MVP |
| التحقق | **Zod** مشترك بين الواجهة والخادم | تعريف واحد للمخططات |
| الاختبارات | Vitest (وحدات) · Supertest (API) · Playwright (E2E) · Testcontainers (Postgres حقيقي) | اختبارات العزل تعمل على قاعدة حقيقية |
| المراقبة | OpenTelemetry → Grafana/Prometheus (أو بديل مُدار)، Sentry للأخطاء | مع **تنقية** محتوى الرسائل من السجلات |
| الحاويات | Docker + docker-compose محليًا | تشغيل محلي بأمر واحد |
| CI/CD | GitHub Actions | lint, typecheck, test, secret scan (gitleaks), dependency audit, SAST (CodeQL), license check |
| البنية ككود | OpenTofu/Terraform — وحدة لكل منطقة | إضافة دولة = تطبيق وحدة جديدة |

### بدائل تم رفضها أو تأجيلها
- **Microservices كاملة:** مؤجلة. نبدأ بـ «Modular Monolith» لكل plane، مع حدود وحدات صارمة، ويمكن فصلها لاحقًا.
- **Database-per-tenant للجميع:** مكلف تشغيليًا في البداية. نوفّره كخيار لباقة المؤسسات لاحقًا (انظر DATABASE_DESIGN.md §2).
- **Prisma:** ممتاز للإنتاجية لكن تطبيق RLS معه عبر connection pooling أكثر تعقيدًا وخطورة.
- **Firebase/Supabase:** يقلل الملكية والتحكم في منطقة البيانات.

---

## 4. هيكل المستودع المقترح

```
shokfat-pro/
├── apps/
│   ├── web/                 # Next.js — اللوحات + صفحات تسويق وتسعير
│   ├── control-api/         # NestJS — Control Plane
│   ├── tenant-api/          # NestJS — Regional Data Plane (HTTP + WebSocket + webhooks)
│   └── worker/              # NestJS standalone — BullMQ processors
├── packages/
│   ├── design-tokens/       # الألوان والخطوط والمسافات (platform + tenant overrides)
│   ├── ui/                  # مكونات shadcn/ui المخصصة
│   ├── i18n/                # ملفات ar / en + أدوات التنسيق
│   ├── contracts/           # Zod schemas + أنواع API + OpenAPI
│   ├── db-control/          # Drizzle schema + migrations للـ Control Plane
│   ├── db-tenant/           # Drizzle schema + migrations + سياسات RLS للـ Data Plane
│   ├── auth/                # منطق المصادقة والصلاحيات المشترك (RBAC)
│   ├── adapters/            # WhatsApp, Meta, TikTok, Voice, Payment, Email, SMS (+ mocks)
│   ├── country-config/      # تعريفات الدول (عملة، ضريبة، منطقة زمنية، قواعد)
│   └── testing/             # مولّدات البيانات الوهمية + أدوات اختبار العزل
├── infra/
│   ├── docker/              # docker-compose للتطوير
│   └── tofu/                # modules: control-plane, data-plane-region
├── docs/                    # هذه الوثائق
├── .github/workflows/
└── CLAUDE.md                # قواعد العمل لـ Claude Code داخل المستودع
```

---

## 5. المكونات الرئيسية

### 5.1 Global Control Plane
| الوحدة | المسؤولية |
|---|---|
| `identity` | حسابات المستخدمين، كلمات المرور، MFA، الجلسات، ربط المستخدم بمجمع/مجمعات |
| `tenants` | سجل المجمعات: id، الاسم، الدولة، **region**، الحالة، النطاق الفرعي |
| `countries` | تكوين الدول وحالة الإطلاق |
| `plans` / `subscriptions` / `invoices` | الفوترة |
| `entitlements` | ما يحق لكل مجمع (حدود + مزايا) — يُنسخ للـ Data Plane |
| `feature-flags` | تفعيل المزايا على مستوى المنصة/الدولة/الباقة/المجمع |
| `support` | التذاكر + طلبات الوصول المؤقت (break-glass) |
| `platform-audit` | سجل تدقيق إجراءات إدارة المنصة |

### 5.2 Regional Data Plane
| الوحدة | المسؤولية |
|---|---|
| `org` | الفروع، الأقسام، ساعات العمل، الموظفون داخل المجمع، الأدوار |
| `channels` | حسابات القنوات المتصلة ورموزها (مشفّرة) |
| `ingress` | استقبال الـ webhooks، التحقق من التوقيع، إزالة التكرار، وضعها في الطابور |
| `inbox` | المحادثات، الرسائل، التعيين، الحالات، الملاحظات، الردود الجاهزة |
| `crm` | العملاء، جهات الاتصال، المسار، المهام، الوسوم |
| `appointments` | المواعيد والحضور |
| `sla` | حساب زمن الرد، التنبيهات، التصعيد |
| `marketing` | الموافقات، إلغاء الاشتراك، القوالب، الحملات المسموحة |
| `analytics` | جداول مجمّعة + حساب المؤشرات |
| `audit` | سجل تدقيق المجمع (غير قابل للتعديل) |
| `usage-reporter` | يرسل **أرقام الاستخدام المجمعة فقط** للـ Control Plane |

---

## 6. تدفق رسالة واردة (مثال واتساب)

```
Meta Cloud API ──POST /webhooks/whatsapp──► tenant-api (sa-1) ingress
   1. verify X-Hub-Signature-256 (HMAC) — reject if invalid
   2. resolve channel → tenant_id (by phone_number_id)
   3. idempotency: INSERT provider_event(provider, external_id) ON CONFLICT DO NOTHING
   4. respond 200 quickly (< 2s)
   5. enqueue job "ingest.message"
worker:
   6. SET LOCAL app.tenant_id = … (RLS)
   7. find/create contact + conversation, store message
   8. assignment rules → assign agent
   9. start SLA timer (first response)
  10. publish realtime event → WebSocket room tenant:{id}:inbox
  11. notification to assigned agent
failures → retry with backoff → DLQ + alert
```

## 7. تدفق رسالة صادرة
الموظف يرسل ← `tenant-api` يتحقق من الصلاحية + نافذة 24 ساعة + الموافقة (للترويجي) ← يُحفظ بحالة `queued` ← worker يرسل عبر المحوّل ← تحديث الحالة (`sent` / `delivered` / `read` / `failed`) من webhooks الحالة.

---

## 8. توجيه الطلبات بين المناطق
1. المستخدم يسجل الدخول عبر `control-api` ← يحصل على جلسة تتضمن قائمة المجمعات المسموحة + منطقة كل مجمع.
2. الواجهة تستدعي `https://api.{region}.shokfatpro.example` حسب المجمع النشط.
3. `tenant-api` يتحقق من رمز وصول قصير العمر موقّع من الـ Control Plane، يحتوي `tenant_id` و `region` و `roles`؛ **يرفض أي رمز لمنطقة أخرى**.
4. الـ Webhooks تصل مباشرة لعنوان المنطقة المعنية (كل قناة مسجّلة على عنوان منطقتها).

---

## 9. البيئات

| البيئة | البيانات | الغرض |
|---|---|---|
| `local` | وهمية فقط | تطوير |
| `dev` | وهمية فقط | تكامل مستمر |
| `staging` | وهمية فقط + أرقام اختبار للمزودين | اختبار قبل الإصدار، اختبارات اختراق |
| `production` | حقيقية — **بعد اعتماد قانوني وأمني** | تشغيل |

لا نسخ من الإنتاج إلى بيئات أخرى. الأسرار منفصلة لكل بيئة.

---

## 10. الجاهزية لتطبيق الجوال لاحقًا
- كل الوظائف عبر API موثّق (OpenAPI) — لا منطق عمل داخل Next.js Server Actions يتعذر على الجوال استدعاؤه.
- `design-tokens` بصيغة محايدة (JSON) قابلة للتحويل إلى React Native / Flutter.
- إشعارات Push عبر محوّل `PushAdapter` (FCM/APNs) لاحقًا.
- المصادقة تدعم رموز وصول للأجهزة (Device sessions) قابلة للإلغاء.
- المرشح الأول: React Native (Expo) لإعادة استخدام الأنواع والمنطق.

---

## 11. قرارات معمارية تحتاج اعتمادك
- **A-01** Modular Monolith لكل Plane بدل خدمات مصغّرة — موصى به.
- **A-02** Drizzle بدل Prisma — موصى به بسبب RLS.
- **A-03** مصادقة داخلية بدل Auth0/Keycloak — موصى به (ملكية + منطقة بيانات)، مع تكلفة أعلى في الاختبار الأمني.
- **A-04** مزود الاستضافة لمنطقة السعودية — يحتاج تحققًا قانونيًا ومن إتاحة الخدمات (انظر INTERNATIONALIZATION.md §6، والقرار Q-01 في README.md).
