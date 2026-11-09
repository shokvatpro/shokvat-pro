# شوكفات برو — Shokfat Pro

منصة Medical CRM SaaS دولية متعددة المستأجرين، مملوكة لشركة **شوكفات**.
International multi-tenant Medical CRM SaaS, owned and operated by **Shokfat**. Proprietary — see `LICENSE`.

## الحالة
- المرحلة 1 (التحليل والمعمارية): ✅ معتمدة — `docs/`
- المرحلة 2 (نظام التصميم): 🟡 الأساس منجز — `docs/PHASE_2_STATUS.md`
- المرحلة 3 (تعدد المستأجرين): 🟡 طبقة قاعدة البيانات منجزة ومختبرة — `docs/PHASE_3_STATUS.md`

## البنية
```
packages/design-tokens   الألوان والخطوط والمسافات — فاتح/داكن + هوية المجمعات (مختبرة للتباين)
packages/i18n            العربية والإنجليزية، الاتجاه، تنسيق العملات والتواريخ، التطبيع العربي للبحث
packages/ui              مكونات React (RTL/LTR، فاتح/داكن، هوية المجمع) + معرض ثابت
packages/db-control      قاعدة Control Plane: الدول، الباقات، الاشتراكات، الهوية (SQL + اختبارات)
packages/db-tenant       قاعدة Data Plane: بيانات المجمعات مع RLS مفروض وعزل الفروع (SQL + اختبارات + بيانات وهمية)
packages/db-tools        تشغيل PostgreSQL مؤقت للاختبارات
assets/brand             شعار شوكفات (الأصلي + نسخ منظّفة شفافة)
docs/                    وثائق المنتج والمعمارية والأمان والقرارات
apps/                    (المرحلة 3) web · control-api · tenant-api · worker
```

## التشغيل
```bash
corepack enable
pnpm install          # أول مرة: يُنشئ pnpm-lock.yaml — احفظه في المستودع
pnpm tokens           # بناء الرموز
pnpm test             # الاختبارات
pnpm gallery          # معرض المكونات → packages/ui/gallery/out/index.html
```

## تعديل الهوية
عدّل `packages/design-tokens/tokens/platform.json` أو `tokens/themes/*.json` ثم `pnpm tokens && pnpm test`.
اختبارات التباين تفشل إذا أصبح أي نص غير مقروء.

اقرأ `CLAUDE.md` قبل أي تعديل.
