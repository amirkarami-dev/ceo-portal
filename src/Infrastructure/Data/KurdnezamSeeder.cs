using System.Globalization;
using System.Text.Json;
using Mabhas19.Domain.Kurdnezam;
using Microsoft.EntityFrameworkCore;

namespace Mabhas19.Infrastructure.Data;

/// <summary>
/// Seeds the kurdnezam landing-site CMS content (settings, categories, units, news, slides,
/// people, tab groups, forms, org pages) from the legacy TypeScript <c>defaultContent</c>.
/// Idempotent: it is a no-op once any content exists.
/// </summary>
/// <remarks>
/// Ids are database-generated, so relationships are wired through navigation properties and the
/// saves are ordered (categories/units → news → slides/tab items). The tab-item links into news
/// are built from the real saved ids rather than the old hard-coded <c>/news/{n}</c> paths.
/// Runtime tables (form submissions, contact messages, visits) are never seeded.
/// </remarks>
internal static class KurdnezamSeeder
{
    private static readonly PersianCalendar Jalali = new();

    public static async Task SeedAsync(ApplicationDbContext context, CancellationToken ct = default)
    {
        if (await context.KurdnezamNews.AnyAsync(ct) || await context.KurdnezamSettings.AnyAsync(ct))
        {
            return;
        }

        // ── Settings (singleton) + footer links ──────────────────────────────────────────────
        // "stats" in the legacy content is fake — real counters come from KurdnezamVisits.
        context.KurdnezamSettings.Add(new KurdnezamSettings
        {
            NameFa = "سازمان نظام مهندسی ساختمان استان کردستان",
            NameKu = "ڕێکخراوەی نەزامی ئەندازیاری بیناسازیی پارێزگای کوردستان",
            NameEn = "Kurdistan Construction Engineering Organization",
            Tagline = "مرجع رسمی خدمات مهندسی ساختمان در استان کردستان",
            Address = "سنندج - میدان کوهنورد - جنب بانک مسکن - سازمان نظام مهندسی ساختمان استان کردستان",
            PhonesJson = JsonSerializer.Serialize(new[] { "08733564876", "08733564874", "08733564878" }),
            PostalCode = "6619775411",
            Telegram = "https://t.me/kurdnezam",
            Instagram = "https://instagram.com/kurdnezam"
        });

        context.KurdnezamFooterLinks.AddRange(
            new KurdnezamFooterLink { Title = "سایت قبلی سازمان", Href = "https://old.kurdnezam.ir", SortOrder = 1 },
            new KurdnezamFooterLink { Title = "شورای مرکزی", Href = "https://irceo.net", SortOrder = 2 },
            new KurdnezamFooterLink { Title = "شهرداری سنندج", Href = "https://sanandaj.ir", SortOrder = 3 },
            new KurdnezamFooterLink { Title = "استانداری کردستان", Href = "https://ostan-kd.ir", SortOrder = 4 });

        // ── Quick links ──────────────────────────────────────────────────────────────────────
        context.KurdnezamQuickLinks.AddRange(
            new KurdnezamQuickLink
            {
                Title = "سامانه خدمات مهندسین",
                Href = "https://cartable.kurdnezam.ir/UserLogin",
                Icon = KurdnezamIcons.Engineer,
                SortOrder = 1
            },
            new KurdnezamQuickLink
            {
                Title = "سامانه خدمات مالکین",
                Href = "https://malek.kurdnezam.ir",
                Icon = KurdnezamIcons.Owner,
                SortOrder = 2
            },
            new KurdnezamQuickLink
            {
                Title = "سامانه سپامک",
                Href = "https://spamak.mrud.ir/",
                Icon = KurdnezamIcons.Badge,
                SortOrder = 3
            },
            new KurdnezamQuickLink
            {
                Title = "سامانه عضویت/صدور پروانه",
                Href = "https://ims.irceo.ir/",
                Icon = KurdnezamIcons.Membership,
                SortOrder = 4
            },
            new KurdnezamQuickLink
            {
                Title = "اتوماسیون اداری",
                Href = "http://185.92.41.23:7990/FarzinSoft/eOrgan/Login/LoginFrm.aspx",
                Icon = KurdnezamIcons.Automation,
                SortOrder = 5
            },
            new KurdnezamQuickLink
            {
                Title = "سامانه نظارت گاز",
                Href = "https://kurdvahedgas.ir",
                Icon = KurdnezamIcons.Gas,
                SortOrder = 6
            },
            new KurdnezamQuickLink
            {
                Title = "سامانه نظارت برق",
                Href = "https://kurdnezambargh.ir",
                Icon = KurdnezamIcons.Power,
                SortOrder = 7
            });

        // ── People ───────────────────────────────────────────────────────────────────────────
        context.KurdnezamPeople.AddRange(
            new KurdnezamPerson { Name = "مهندس بابک احمدزاده", Role = "عضو اصلی گروه عمران", Image = "/images/members/m1.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 1 },
            new KurdnezamPerson { Name = "مهندس پدرام گروهی", Role = "عضو اصلی گروه مکانیک", Image = "/images/members/m2.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 2 },
            new KurdnezamPerson { Name = "دکتر ایوب مرادخانی", Role = "عضو اصلی گروه معماری", Image = "/images/members/m3.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 3 },
            new KurdnezamPerson { Name = "مهندس سیدابراهیم حسینی", Role = "عضو اصلی گروه شهرسازی", Image = "/images/members/m4.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 4 },
            new KurdnezamPerson { Name = "مهندس بهار راستین", Role = "عضو اصلی گروه عمران", Image = "/images/members/m5.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 5 },
            new KurdnezamPerson { Name = "مهندس صلاح الدین محمدی", Role = "عضو اصلی گروه مکانیک", Image = "/images/members/m6.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 6 },
            new KurdnezamPerson { Name = "مهندس کریم قادرمزی", Role = "عضو گروه نقشه برداری", Image = "/images/members/m7.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 7 },
            new KurdnezamPerson { Name = "مهندس علی خشگوار", Role = "عضو اصلی گروه معماری", Image = "/images/members/m8.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 8 },
            new KurdnezamPerson { Name = "مهندس افشین نامی سنندجی", Role = "عضو اصلی گروه برق", Image = "/images/members/m9.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 9 },
            new KurdnezamPerson { Name = "مهندس کورش تیموری", Role = "عضو اصلی گروه عمران", Image = "/images/members/m10.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 10 },
            new KurdnezamPerson { Name = "مهندس ئاکو ویسی", Role = "عضو اصلی گروه عمران", Image = "/images/members/m11.jpg", Group = KurdnezamPersonGroups.Modir, SortOrder = 11 },

            new KurdnezamPerson { Name = "مهندس بابک احمدزاده", Role = "رئیس سازمان", Image = "/images/members/m1.jpg", Group = KurdnezamPersonGroups.HayatRaise, SortOrder = 12 },
            new KurdnezamPerson { Name = "مهندس پدرام گروهی", Role = "نایب رئیس اول", Image = "/images/members/m2.jpg", Group = KurdnezamPersonGroups.HayatRaise, SortOrder = 13 },
            new KurdnezamPerson { Name = "دکتر ایوب مرادخانی", Role = "نایب رئیس دوم", Image = "/images/members/m3.jpg", Group = KurdnezamPersonGroups.HayatRaise, SortOrder = 14 },
            new KurdnezamPerson { Name = "مهندس بهار راستین", Role = "دبیر هیئت رئیسه", Image = "/images/members/m5.jpg", Group = KurdnezamPersonGroups.HayatRaise, SortOrder = 15 },
            new KurdnezamPerson { Name = "مهندس کورش تیموری", Role = "خزانه‌دار", Image = "/images/members/m10.jpg", Group = KurdnezamPersonGroups.HayatRaise, SortOrder = 16 },

            new KurdnezamPerson { Name = "مهندس سامان احمدی", Role = "بازرس اصلی", Group = KurdnezamPersonGroups.Bazrsin, SortOrder = 17 },
            new KurdnezamPerson { Name = "مهندس ژیلا کریمی", Role = "بازرس اصلی", Group = KurdnezamPersonGroups.Bazrsin, SortOrder = 18 },
            new KurdnezamPerson { Name = "مهندس هیمن رحیمی", Role = "بازرس علی‌البدل", Group = KurdnezamPersonGroups.Bazrsin, SortOrder = 19 },

            new KurdnezamPerson { Name = "مهندس فرزاد شریفی", Role = "رئیس شورای انتظامی", Group = KurdnezamPersonGroups.ShorayeEntezami, SortOrder = 20 },
            new KurdnezamPerson { Name = "دکتر شیرکو عبدالهی", Role = "عضو حقوق‌دان شورا", Group = KurdnezamPersonGroups.ShorayeEntezami, SortOrder = 21 },
            new KurdnezamPerson { Name = "مهندس چیمن مرادی", Role = "عضو شورای انتظامی", Group = KurdnezamPersonGroups.ShorayeEntezami, SortOrder = 22 },
            new KurdnezamPerson { Name = "مهندس آرام فتحی", Role = "عضو شورای انتظامی", Group = KurdnezamPersonGroups.ShorayeEntezami, SortOrder = 23 },

            new KurdnezamPerson { Name = "کلیه اعضای دارای پروانه اشتغال", Role = "مجمع عمومی سازمان", Group = KurdnezamPersonGroups.MajmaeOmumi, SortOrder = 24 });

        // ── Units ────────────────────────────────────────────────────────────────────────────
        context.KurdnezamUnits.AddRange(
            new KurdnezamUnit
            {
                Title = "امور رفاهی",
                Description = "برنامه‌ریزی و اجرای خدمات رفاهی، ورزشی و بیمه‌ای ویژه اعضای سازمان؛ از جمله استخر، تفاهم‌نامه‌های بانکی و بیمه تکمیلی.",
                HeadName = "واحد رفاهی سازمان",
                HeadRole = "مسئول امور رفاهی",
                SortOrder = 1
            },
            new KurdnezamUnit
            {
                Title = "دفتر اجرایی برق",
                Description = "نظارت بر خدمات مهندسی تاسیسات برقی ساختمان، تاییدیه‌های انشعاب برق و هماهنگی با شرکت توزیع نیروی برق استان.",
                HeadName = "دفتر اجرایی برق",
                HeadRole = "مسئول دفتر",
                SortOrder = 2
            },
            new KurdnezamUnit
            {
                Title = "واحد گازرسانی",
                Description = "صدور تاییدیه نظارت گازرسانی، نظارت بر اجرای لوله‌کشی گاز ساختمان‌ها و هماهنگی با شرکت گاز استان کردستان.",
                HeadName = "واحد گازرسانی",
                HeadRole = "مسئول واحد",
                SortOrder = 3
            },
            new KurdnezamUnit
            {
                Title = "واحد نقشه برداری",
                Description = "ارائه خدمات تفکیک آپارتمان، تهیه نقشه‌های تفکیکی و کنترل خدمات نقشه‌برداری ساختمان در سطح استان.",
                HeadName = "واحد نقشه‌برداری",
                HeadRole = "مسئول واحد",
                SortOrder = 4
            },
            new KurdnezamUnit
            {
                Title = "واحد انرژی",
                Description = "کنترل و بهینه‌سازی مصرف انرژی ساختمان‌ها، صدور برچسب انرژی و نظارت بر اجرای مبحث ۱۹ مقررات ملی ساختمان.",
                HeadName = "واحد انرژی",
                HeadRole = "مسئول واحد",
                SortOrder = 5
            },
            new KurdnezamUnit
            {
                Title = "واحد مجریان",
                Description = "ساماندهی مجریان ذی‌صلاح ساختمان، کنترل قراردادهای اجرا و نظارت بر عملکرد مجریان حقیقی و حقوقی استان.",
                HeadName = "واحد مجریان",
                HeadRole = "مسئول واحد",
                SortOrder = 6
            },
            new KurdnezamUnit
            {
                Title = "واحد حقوقی",
                Description = "ارائه مشاوره حقوقی به سازمان و اعضا، پیگیری دعاوی حقوقی و تنظیم قراردادها و تفاهم‌نامه‌های سازمان.",
                HeadName = "عابد کریمیان",
                HeadRole = "مشاور حقوقی سازمان",
                SortOrder = 7
            });

        // ── Forms ────────────────────────────────────────────────────────────────────────────
        context.KurdnezamForms.AddRange(
            new KurdnezamForm
            {
                Title = "راهنمای مراحل عضویت، صدور و ارتقا پروانه",
                Note = "ثبت درخواست عضویت و پیگیری صدور پروانه اشتغال",
                Deadline = "۲۵ خرداد ۱۴۰۵",
                Image = "/images/forms/form-1.png",
                IsOpen = true,
                SortOrder = 1
            },
            new KurdnezamForm
            {
                Title = "ثبت‌نام استخر ویژه اعضا",
                Note = "هزینه استخر ۸۰ هزار تومان می‌باشد",
                Deadline = "۲۳ خرداد ۱۴۰۵",
                Image = "/images/forms/form-2.jpg",
                IsOpen = true,
                SortOrder = 2
            });

        // ── Organisation pages (/p/{slug}) ───────────────────────────────────────────────────
        context.KurdnezamOrgPages.AddRange(
            new KurdnezamOrgPage
            {
                Slug = "arkan",
                Title = "ارکان سازمان",
                Group = null,
                Intro = "ارکان سازمان نظام مهندسی ساختمان استان کردستان بر اساس قانون نظام مهندسی و کنترل ساختمان عبارت‌اند از: مجمع عمومی، هیئت مدیره، هیئت رئیسه، شورای انتظامی و بازرسان.",
                SortOrder = 1
            },
            new KurdnezamOrgPage
            {
                Slug = "modir",
                Title = "هیئت مدیره",
                Group = KurdnezamPersonGroups.Modir,
                Intro = "اعضای هیئت مدیره سازمان نظام مهندسی ساختمان استان کردستان — معرفی اعضا و مسئولین.",
                SortOrder = 2
            },
            new KurdnezamOrgPage
            {
                Slug = "hayatraise",
                Title = "هیئت رئیسه",
                Group = KurdnezamPersonGroups.HayatRaise,
                Intro = "اعضای هیئت رئیسه سازمان نظام مهندسی ساختمان استان کردستان.",
                SortOrder = 3
            },
            new KurdnezamOrgPage
            {
                Slug = "bazrsin",
                Title = "بازرسین",
                Group = KurdnezamPersonGroups.Bazrsin,
                Intro = "بازرسان قانونی سازمان نظام مهندسی ساختمان استان کردستان.",
                SortOrder = 4
            },
            new KurdnezamOrgPage
            {
                Slug = "shorayeentezami",
                Title = "شورای انتظامی",
                Group = KurdnezamPersonGroups.ShorayeEntezami,
                Intro = "شورای انتظامی سازمان، مرجع رسیدگی به تخلفات حرفه‌ای اعضا است.",
                SortOrder = 5
            },
            new KurdnezamOrgPage
            {
                Slug = "majmaeomumi",
                Title = "مجمع عمومی",
                Group = KurdnezamPersonGroups.MajmaeOmumi,
                Intro = "مجمع عمومی سازمان از کلیه اعضای دارای پروانه اشتغال تشکیل می‌شود و عالی‌ترین رکن تصمیم‌گیری سازمان است.",
                SortOrder = 6
            });

        // ── Categories (parents of news — saved first so the FKs exist) ──────────────────────
        var catNews = new KurdnezamCategory { Title = "اخبار و اطلاعیه", SortOrder = 1 };
        var catResolutions = new KurdnezamCategory { Title = "مصوبات هیات مدیره", SortOrder = 2 };
        var catGallery = new KurdnezamCategory { Title = "گالری تصاویر", SortOrder = 3 };
        var catEducation = new KurdnezamCategory { Title = "آموزش", SortOrder = 4 };

        context.KurdnezamCategories.AddRange(catNews, catResolutions, catGallery, catEducation);

        await context.SaveChangesAsync(ct);

        // ── News (categories are wired by navigation property; UnitId stays null) ────────────
        var newsPool = new KurdnezamNews
        {
            Title = "برنامه زمانبندی استخر ویژه اعضای سازمان نظام مهندسی ساختمان استان کردستان",
            Summary = "برنامه زمانبندی استخر ویژه اعضای سازمان نظام مهندسی ساختمان استان کردستان اعلام شد.",
            Body = "به اطلاع اعضای محترم سازمان می‌رساند برنامه زمان‌بندی استفاده از استخر ویژه اعضای سازمان نظام مهندسی ساختمان استان کردستان به شرح جدول اعلامی امور رفاهی است.\n\nهزینه استفاده از استخر برای هر جلسه ۸۰ هزار تومان می‌باشد و ثبت‌نام از طریق بخش فرم‌های سایت سازمان انجام می‌شود.\n\nاولویت استفاده با اعضایی است که زودتر ثبت‌نام کرده باشند.",
            DateJalali = "۱۴۰۵/۴/۲۱",
            PublishedAt = JalaliToUtc("۱۴۰۵/۴/۲۱"),
            Author = "هورامان بهرامی",
            Category = catNews,
            Image = "/images/news/news-3.jpg",
            Featured = true
        };

        var newsEarnings = new KurdnezamNews
        {
            Title = "درج کارکرد ریالی مهندسان در بخش‌های طراحی و نظارت در سال‌ ۱۴۰۴ در سامانه خدمات مهندسی",
            Summary = "کارکرد ریالی مهندسان در بخش‌های طراحی و نظارت سال ۱۴۰۴ در سامانه خدمات مهندسی درج شد.",
            Body = "به اطلاع اعضای محترم سازمان نظام مهندسی ساختمان استان کردستان می‌رساند کارکرد ریالی مهندسان در بخش‌های طراحی و نظارت در سال ۱۴۰۴ در سامانه خدمات مهندسی (کارتابل مهندس) درج گردیده است.\n\nاعضای محترم می‌توانند با مراجعه به کارتابل خود نسبت به مشاهده و بررسی کارکرد اقدام نمایند. در صورت وجود هرگونه مغایرت، مراتب را حداکثر تا پایان تیرماه به واحد خدمات مهندسی سازمان اعلام فرمایید.",
            DateJalali = "۱۴۰۵/۴/۱۷",
            PublishedAt = JalaliToUtc("۱۴۰۵/۴/۱۷"),
            Author = "هورامان بهرامی",
            Category = catNews,
            Image = "/images/news/news-2.png",
            Featured = true
        };

        var newsInsurance = new KurdnezamNews
        {
            Title = "توافق‌نامه بیمه مسئولیت حرفه‌ای سازمان نظام مهندسی ساختمان استان کردستان",
            Summary = "توافق‌نامه بیمه مسئولیت حرفه‌ای ویژه مهندسین ناظر، طراح، محاسب و مجریان ساختمان منعقد شد.",
            Body = "توافق‌نامه بیمه مسئولیت حرفه‌ای سازمان نظام مهندسی ساختمان استان کردستان با شرکت بیمه منعقد گردید.\n\nاین توافق‌نامه ویژه مهندسین ناظر، طراح، محاسب و مجریان ساختمان (حقیقی و حقوقی) بوده و اعضای محترم می‌توانند برای بهره‌مندی از پوشش بیمه‌ای با شرایط ویژه به واحد رفاهی سازمان مراجعه نمایند.",
            DateJalali = "۱۴۰۵/۴/۱۸",
            PublishedAt = JalaliToUtc("۱۴۰۵/۴/۱۸"),
            Author = "هورامان بهرامی",
            Category = catNews,
            Image = "/images/news/news-1.png",
            Featured = true
        };

        var newsLoanSignup = new KurdnezamNews
        {
            Title = "ثبت نام وام قرض الحسنه ۵۰ میلیونی بانک ملت ویژه اعضای سازمان نظام مهندسی ساختمان استان کردستان",
            Summary = "امکان ثبت‌نام وام قرض‌الحسنه ۵۰ میلیون تومانی بانک ملت برای اعضای سازمان فراهم شد.",
            Body = "به اطلاع اعضای محترم سازمان نظام مهندسی ساختمان استان کردستان می‌رساند با عنایت به اعلام رئیس محترم سازمان در خصوص تفاهمنامه سازمان با بانک ملت در خصوص ارائه وام قرض الحسنه ۵۰ میلیون تومانی، ثبت نام با شرایط زیر در سایت سازمان امکان‌پذیر می‌باشد.\n\n- وام به صورت قرض الحسنه به مبلغ ۵۰ میلیون تومان با نرخ ۴ درصد و بازپرداخت ۱۲ ماهه می‌باشد.\n\n- تسهیلات برای متقاضیانی است که در حوزه پروژه‌های نهضت ملی مسکن خدمات ارائه نموده‌اند (طراحی، نظارت، اجرا و آزمایشگاه).\n\n- برای متقاضیانی که دارای رتبه اعتباری بانکی A-B-C باشند، امکان دریافت وام بدون نیاز به ضامن فراهم شده است.",
            DateJalali = "۱۴۰۵/۴/۱۰",
            PublishedAt = JalaliToUtc("۱۴۰۵/۴/۱۰"),
            Author = "هورامان بهرامی",
            Category = catNews,
            Image = "/images/news/news-4.jpg",
            Featured = true
        };

        var newsLoanAgreement = new KurdnezamNews
        {
            Title = "ارائه وام قرض‌الحسنه ۵۰ میلیونی به اعضای سازمان نظام مهندسی ساختمان استان کردستان",
            Summary = "در پی انعقاد تفاهم‌نامه همکاری میان سازمان و بانک ملت، امکان بهره‌مندی اعضا از تسهیلات قرض‌الحسنه فراهم شد.",
            Body = "در پی انعقاد تفاهم‌نامه همکاری میان سازمان نظام مهندسی ساختمان استان کردستان و بانک ملت، امکان بهره‌مندی اعضای سازمان از تسهیلات قرض‌الحسنه فراهم شد.\n\nمهندس بابک احمدزاده، رئیس سازمان نظام مهندسی ساختمان استان کردستان، با اعلام این خبر اظهار داشت: با پیگیری‌های مستمر هیئت مدیره سازمان و بر اساس این تفاهم‌نامه، اعضای سازمان می‌توانند از وام قرض‌الحسنه به مبلغ ۵۰ میلیون تومان با نرخ کارمزد ۴ درصد و بازپرداخت ۱۲ ماهه بهره‌مند شوند.",
            DateJalali = "۱۴۰۵/۴/۱۰",
            PublishedAt = JalaliToUtc("۱۴۰۵/۴/۱۰"),
            Author = "هورامان بهرامی",
            Category = catNews,
            Image = "/images/news/news-4.jpg",
            Featured = false
        };

        // Old id 10 — linked from the "statistics" tab.
        var newsMembersByField = new KurdnezamNews
        {
            Title = "لیست اعضای سازمان به تفکیک رشته",
            Summary = "لیست اعضای سازمان نظام مهندسی ساختمان استان کردستان به تفکیک رشته منتشر شد.",
            Body = "لیست اعضای سازمان نظام مهندسی ساختمان استان کردستان به تفکیک رشته‌های هفت‌گانه (عمران، معماری، برق، مکانیک، شهرسازی، نقشه‌برداری و ترافیک) منتشر شد.\n\nاعضای محترم می‌توانند برای مشاهده لیست به واحد عضویت سازمان مراجعه نمایند.",
            DateJalali = "۱۴۰۵/۳/۲۵",
            PublishedAt = JalaliToUtc("۱۴۰۵/۳/۲۵"),
            Author = "هورامان بهرامی",
            Category = catNews,
            Image = "/images/news/news-2.png",
            Featured = false
        };

        // Old id 9 — linked from the "statistics" tab.
        var newsBoardPerformance = new KurdnezamNews
        {
            Title = "عملکرد هیئت مدیره در سال ۱۴۰۴",
            Summary = "گزارش عملکرد هیئت مدیره سازمان در سال ۱۴۰۴ منتشر شد.",
            Body = "گزارش عملکرد هیئت مدیره سازمان نظام مهندسی ساختمان استان کردستان در سال ۱۴۰۴ شامل اقدامات اجرایی، مالی و رفاهی سازمان منتشر گردید.\n\nاین گزارش در مجمع عمومی سالانه سازمان ارائه و به تصویب رسید.",
            DateJalali = "۱۴۰۵/۳/۲۵",
            PublishedAt = JalaliToUtc("۱۴۰۵/۳/۲۵"),
            Author = "هورامان بهرامی",
            Category = catResolutions,
            Image = "/images/news/news-1.png",
            Featured = false
        };

        var newsLicenceGuide = new KurdnezamNews
        {
            Title = "راهنمای کلیه مراحل عضویت، صدور و ارتقا پروانه",
            Summary = "راهنمای گام‌به‌گام عضویت در سازمان و صدور و ارتقای پروانه اشتغال منتشر شد.",
            Body = "راهنمای کلیه مراحل عضویت، صدور و ارتقا پروانه اشتغال به کار مهندسی منتشر شد.\n\nمتقاضیان محترم می‌توانند مراحل ثبت‌نام، مدارک مورد نیاز و فرآیند صدور پروانه را در این راهنما مطالعه نمایند. ثبت درخواست از طریق سامانه عضویت و صدور پروانه (ims.irceo.ir) انجام می‌شود.",
            DateJalali = "۱۴۰۵/۳/۲۵",
            PublishedAt = JalaliToUtc("۱۴۰۵/۳/۲۵"),
            Author = "هورامان بهرامی",
            Category = catNews,
            Image = "/images/forms/form-1.png",
            Featured = false
        };

        // Old id 7 — linked from the "education" tab.
        var newsTrainingProviders = new KurdnezamNews
        {
            Title = "مجریان آموزشی دوره های ارتقا پایه",
            Summary = "لیست مجریان آموزشی مورد تایید برای دوره‌های ارتقای پایه پروانه اشتغال اعلام شد.",
            Body = "لیست مجریان آموزشی مورد تایید وزارت راه و شهرسازی برای برگزاری دوره‌های ارتقای پایه پروانه اشتغال به کار مهندسی در استان کردستان اعلام شد.\n\nاعضای محترم می‌توانند برای ثبت‌نام در دوره‌ها به سامانه آموزش سازمان مراجعه نمایند.",
            DateJalali = "۱۴۰۵/۳/۲۵",
            PublishedAt = JalaliToUtc("۱۴۰۵/۳/۲۵"),
            Author = "هورامان بهرامی",
            Category = catEducation,
            Image = "/images/news/news-2.png",
            Featured = false
        };

        // Old id 6 — linked from all three "tariff" tab items.
        var newsTariff = new KurdnezamNews
        {
            Title = "تعرفه خدمات مهندسی در بخش‌های خدمات آزمایشگاهی، نظارت گازرسانی، خدمات تفکیک آپارتمان، نظارت بر پایداری گود و سازه نگهبان، نظارت بر تخریب و خدمات شهرسازی در سال ۱۴۰۵",
            Summary = "تعرفه خدمات مهندسی سال ۱۴۰۵ در بخش‌های تخصصی ابلاغ شد.",
            Body = "تعرفه خدمات مهندسی در بخش‌های خدمات آزمایشگاهی، نظارت گازرسانی، خدمات تفکیک آپارتمان، نظارت بر پایداری گود و سازه نگهبان، نظارت بر تخریب و خدمات شهرسازی در سال ۱۴۰۵ ابلاغ گردید.\n\nجداول کامل تعرفه از طریق واحد خدمات مهندسی سازمان در دسترس اعضا قرار دارد.",
            DateJalali = "۱۴۰۵/۳/۲۵",
            PublishedAt = JalaliToUtc("۱۴۰۵/۳/۲۵"),
            Author = "هورامان بهرامی",
            Category = catNews,
            Image = "/images/news/news-1.png",
            Featured = false
        };

        var newsBoardMinutes = new KurdnezamNews
        {
            Title = "مصوبات جلسه مورخ ۱۴۰۵/۳/۱۰ هیئت مدیره سازمان",
            Summary = "خلاصه مصوبات جلسه خردادماه هیئت مدیره سازمان منتشر شد.",
            Body = "در جلسه مورخ ۱۴۰۵/۳/۱۰ هیئت مدیره سازمان نظام مهندسی ساختمان استان کردستان، موارد زیر به تصویب رسید:\n\n- تصویب تفاهم‌نامه همکاری با بانک ملت جهت ارائه تسهیلات قرض‌الحسنه به اعضا\n\n- تصویب برنامه زمان‌بندی امور رفاهی تابستان ۱۴۰۵\n\n- بررسی و تصویب بودجه پیشنهادی دفاتر نمایندگی شهرستان‌ها",
            DateJalali = "۱۴۰۵/۳/۱۲",
            PublishedAt = JalaliToUtc("۱۴۰۵/۳/۱۲"),
            Author = "دبیرخانه هیئت مدیره",
            Category = catResolutions,
            Image = "/images/news/news-1.png",
            Featured = false
        };

        var newsPhotoReport = new KurdnezamNews
        {
            Title = "گزارش تصویری بازدید هیئت مدیره از پروژه‌های نهضت ملی مسکن سنندج",
            Summary = "گزارش تصویری بازدید اعضای هیئت مدیره از پروژه‌های در حال اجرای نهضت ملی مسکن.",
            Body = "اعضای هیئت مدیره سازمان نظام مهندسی ساختمان استان کردستان از پروژه‌های در حال اجرای نهضت ملی مسکن در شهر سنندج بازدید کردند.\n\nدر این بازدید بر رعایت مقررات ملی ساختمان و کیفیت اجرای پروژه‌ها تاکید شد.",
            DateJalali = "۱۴۰۵/۲/۳۰",
            PublishedAt = JalaliToUtc("۱۴۰۵/۲/۳۰"),
            Author = "روابط عمومی",
            Category = catGallery,
            Image = "/images/news/news-4.jpg",
            Featured = false
        };

        context.KurdnezamNews.AddRange(
            newsPool,
            newsEarnings,
            newsInsurance,
            newsLoanSignup,
            newsLoanAgreement,
            newsMembersByField,
            newsBoardPerformance,
            newsLicenceGuide,
            newsTrainingProviders,
            newsTariff,
            newsBoardMinutes,
            newsPhotoReport);

        await context.SaveChangesAsync(ct);

        // ── Slides (target article wired by navigation property) ─────────────────────────────
        context.KurdnezamSlides.AddRange(
            new KurdnezamSlide
            {
                Title = "درج کارکرد ریالی مهندسان در بخش‌های طراحی و نظارت در سال ۱۴۰۴ در سامانه خدمات مهندسی",
                Subtitle = "روابط عمومی سازمان نظام مهندسی ساختمان استان کردستان",
                Image = "/images/news/news-2.png",
                News = newsEarnings,
                Badge = "اخبار و اطلاعیه",
                SortOrder = 1
            },
            new KurdnezamSlide
            {
                Title = "توافق‌نامه بیمه مسئولیت حرفه‌ای سازمان نظام مهندسی ساختمان استان کردستان",
                Subtitle = "ویژه مهندسین ناظر، طراح، محاسب و مجریان ساختمان (حقیقی و حقوقی)",
                Image = "/images/news/news-1.png",
                News = newsInsurance,
                Badge = "اخبار و اطلاعیه",
                SortOrder = 2
            },
            new KurdnezamSlide
            {
                Title = "ثبت نام وام قرض‌الحسنه ۵۰ میلیونی بانک ملت ویژه اعضای سازمان",
                Subtitle = "با نرخ کارمزد ۴ درصد و بازپرداخت ۱۲ ماهه",
                Image = "/images/news/news-4.jpg",
                News = newsLoanSignup,
                Badge = "تسهیلات اعضا",
                SortOrder = 3
            },
            new KurdnezamSlide
            {
                Title = "برنامه زمان‌بندی استخر ویژه اعضای سازمان نظام مهندسی ساختمان استان کردستان",
                Subtitle = "امور رفاهی سازمان",
                Image = "/images/news/news-3.jpg",
                News = newsPool,
                Badge = "امور رفاهی",
                SortOrder = 4
            },
            new KurdnezamSlide
            {
                Title = "راهنمای کلیه مراحل عضویت، صدور و ارتقا پروانه اشتغال",
                Subtitle = "از ثبت‌نام و مدارک مورد نیاز تا صدور و ارتقای پایه پروانه",
                Image = "/images/forms/form-1.png",
                News = newsLicenceGuide,
                Badge = "عضویت و پروانه",
                SortOrder = 5
            });

        // ── Tab groups ───────────────────────────────────────────────────────────────────────
        // The "units" group is intentionally item-less: the UI renders KurdnezamUnits for it.
        // Item hrefs into news are built from the ids EF just generated, not the legacy /news/{n}.
        context.KurdnezamTabGroups.AddRange(
            new KurdnezamTabGroup
            {
                Slug = "units",
                Title = "واحدهای سازمان",
                SortOrder = 1
            },
            new KurdnezamTabGroup
            {
                Slug = "offices",
                Title = "دفاتر نمایندگی",
                SortOrder = 2,
                Items = new List<KurdnezamTabItem>
                {
                    new() { Title = "دفتر نمایندگی سقز", SortOrder = 1 },
                    new() { Title = "دفتر نمایندگی مریوان", SortOrder = 2 },
                    new() { Title = "دفتر نمایندگی بانه", SortOrder = 3 },
                    new() { Title = "دفتر نمایندگی قروه", SortOrder = 4 },
                    new() { Title = "دفتر نمایندگی بیجار", SortOrder = 5 },
                    new() { Title = "دفتر نمایندگی کامیاران", SortOrder = 6 },
                    new() { Title = "دفتر نمایندگی دیواندره", SortOrder = 7 },
                    new() { Title = "دفتر نمایندگی دهگلان", SortOrder = 8 }
                }
            },
            new KurdnezamTabGroup
            {
                Slug = "groups",
                Title = "گروه‌های تخصصی",
                SortOrder = 3,
                Items = new List<KurdnezamTabItem>
                {
                    new() { Title = "گروه تخصصی عمران", SortOrder = 1 },
                    new() { Title = "گروه تخصصی معماری", SortOrder = 2 },
                    new() { Title = "گروه تخصصی برق", SortOrder = 3 },
                    new() { Title = "گروه تخصصی مکانیک", SortOrder = 4 },
                    new() { Title = "گروه تخصصی شهرسازی", SortOrder = 5 },
                    new() { Title = "گروه تخصصی نقشه‌برداری", SortOrder = 6 },
                    new() { Title = "گروه تخصصی ترافیک", SortOrder = 7 }
                }
            },
            new KurdnezamTabGroup
            {
                Slug = "education",
                Title = "آموزش و ترویج",
                SortOrder = 4,
                Items = new List<KurdnezamTabItem>
                {
                    new() { Title = "دوره‌های ارتقای پایه", Href = NewsHref(newsTrainingProviders), SortOrder = 1 },
                    new() { Title = "سمینارها و همایش‌ها", SortOrder = 2 },
                    new() { Title = "مقررات ملی ساختمان", SortOrder = 3 }
                }
            },
            new KurdnezamTabGroup
            {
                Slug = "statistics",
                Title = "آمار و اطلاعات",
                SortOrder = 5,
                Items = new List<KurdnezamTabItem>
                {
                    new() { Title = "لیست اعضا به تفکیک رشته", Href = NewsHref(newsMembersByField), SortOrder = 1 },
                    new() { Title = "عملکرد هیئت مدیره ۱۴۰۴", Href = NewsHref(newsBoardPerformance), SortOrder = 2 },
                    new() { Title = "آمار پروانه‌های صادره", SortOrder = 3 }
                }
            },
            new KurdnezamTabGroup
            {
                Slug = "tariff",
                Title = "تعرفه خدمات مهندسی",
                SortOrder = 6,
                Items = new List<KurdnezamTabItem>
                {
                    new() { Title = "تعرفه خدمات مهندسی ۱۴۰۵", Href = NewsHref(newsTariff), SortOrder = 1 },
                    new() { Title = "تعرفه خدمات آزمایشگاهی", Href = NewsHref(newsTariff), SortOrder = 2 },
                    new() { Title = "تعرفه نظارت گازرسانی", Href = NewsHref(newsTariff), SortOrder = 3 }
                }
            });

        await context.SaveChangesAsync(ct);
    }

    /// <summary>Builds the frontend route for a saved article (its id is generated by the database).</summary>
    private static string NewsHref(KurdnezamNews news) => $"/news/{news.Id}";

    /// <summary>
    /// Converts a Jalali date written in Persian numerals (e.g. <c>۱۴۰۵/۴/۲۱</c>) to the
    /// corresponding UTC midnight instant, so news can be ordered without parsing Jalali.
    /// </summary>
    private static DateTimeOffset JalaliToUtc(string dateJalali)
    {
        var parts = dateJalali.Split('/');
        var year = ParsePersianDigits(parts[0]);
        var month = ParsePersianDigits(parts[1]);
        var day = ParsePersianDigits(parts[2]);

        var gregorian = Jalali.ToDateTime(year, month, day, 0, 0, 0, 0);

        return new DateTimeOffset(DateTime.SpecifyKind(gregorian, DateTimeKind.Utc));
    }

    /// <summary>Parses a run of Persian (U+06F0–U+06F9) or ASCII digits into an integer.</summary>
    private static int ParsePersianDigits(string value)
    {
        var result = 0;

        foreach (var c in value)
        {
            var digit = c switch
            {
                >= '۰' and <= '۹' => c - '۰',
                >= '0' and <= '9' => c - '0',
                _ => -1
            };

            if (digit >= 0)
            {
                result = (result * 10) + digit;
            }
        }

        return result;
    }
}
