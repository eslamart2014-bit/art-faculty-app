/**
 * مولد استمارة تسجيل الدولاب الرسمية وتنزيلها كملف PDF
 * جامعة قنا - كلية التربية النوعية - قسم التربية الفنية
 * م/ إسلام عبداللطيف
 */

import { isAndroidAppClient } from "@/lib/deviceFingerprint";

export interface LockerReceiptData {
  bookingId?: string;
  lockerCode: string;
  cohort: string;
  phone: string;
  studentNames: string[];
  studentCodes?: string[];
  date?: string;
  supervisorName?: string;
  status?: string;
}

/**
 * توليد كود HTML الأنيق والمتجاوب لاستمارة الدولاب
 * مصمم ليتناسب تماماً مع طباعة A4 وشاشات الموبايل بدون أي تشوه
 */
export function generateLockerReceiptHtml(data: LockerReceiptData, isForPdfExport = false): string {
  const dateStr = data.date || new Date().toLocaleDateString('ar-EG', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
  const supervisor = data.supervisorName || 'م/ إسلام عبداللطيف';
  const names = data.studentNames || [];
  const capacity = Math.max(names.length, 4);

  // توليد صفوف جدول الأسماء
  const rowsHtml = names
    .map((name, idx) => `
    <tr>
      <td style="width: 10%; padding: 8px 4px; border: 1px solid #000; text-align: center; font-weight: bold;">${idx + 1}</td>
      <td style="width: 60%; padding: 8px 12px; border: 1px solid #000; text-align: right; font-weight: bold; font-size: 15px;">${name}</td>
      <td style="width: 30%; padding: 8px 6px; border: 1px solid #000; text-align: center; color: #555; font-size: 13px;">................................</td>
    </tr>
  `)
    .join('');

  // توليد محتوى مستطيل الأسماء للقص واللصق على الدولاب
  const namesBoxHtml = names
    .map((name) => `<div style="border-bottom: 2px solid #000; height: calc(100% / ${capacity}); display: flex; align-items: center; justify-content: center; padding: 0 8px; font-weight: bold; font-size: 15px; color: #000; overflow: hidden; white-space: nowrap; text-overflow: ellipsis;">${name}</div>`)
    .join('');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no"/>
  <title>استمارة تسجيل دولاب - ${data.lockerCode}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; }
    body {
      font-family: "Cairo", system-ui, -apple-system, sans-serif;
      direction: rtl;
      text-align: center;
      margin: 0;
      padding: ${isForPdfExport ? '0' : '20px 14px'};
      color: #000;
      background: ${isForPdfExport ? '#ffffff' : '#0f172a'};
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: flex-start;
      min-height: 100vh;
    }

    .paper-container {
      width: 100%;
      max-width: 800px;
      background: #ffffff;
      color: #000;
      padding: ${isForPdfExport ? '25px 35px' : '30px 24px'};
      border-radius: ${isForPdfExport ? '0' : '16px'};
      box-shadow: ${isForPdfExport ? 'none' : '0 20px 45px rgba(0,0,0,0.5)'};
      border: ${isForPdfExport ? 'none' : '1px solid #334155'};
      box-sizing: border-box;
    }

    h2, h3, h4 { margin: 0; }
    h3 { font-weight: 800; font-size: 20px; color: #000; }
    h4 { font-weight: 700; font-size: 16px; color: #222; }

    table {
      width: 100%;
      border-collapse: collapse;
      margin-top: 14px;
      font-size: 14px;
      font-weight: bold;
    }

    th, td {
      border: 1px solid #000;
      padding: 8px 6px;
      text-align: center;
    }

    th {
      background-color: #f1f5f9;
      color: #000;
      font-size: 14px;
    }

    .divider {
      border-top: 2px dashed #000;
      margin: 22px 0 16px 0;
      position: relative;
    }

    .small-pledge {
      font-size: 13.5px;
      margin-top: 14px;
      margin-bottom: 6px;
      font-weight: bold;
      color: #111;
      line-height: 1.6;
    }

    .cutline {
      margin: 8px 0 14px 0;
      font-size: 13px;
      font-weight: 800;
      color: #0284c7;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
    }

    /* مربع كود الدولاب للقص */
    .codeBox {
      border: 3px double #000;
      width: 145px;
      height: 145px;
      font-size: 42px;
      font-weight: 900;
      display: flex;
      align-items: center;
      justify-content: center;
      background: #fafafa;
      color: #000;
      flex-shrink: 0;
    }

    /* مستطيل الأسماء للقص واللصق على الدولاب */
    .namesBox {
      border: 3px double #000;
      flex: 1;
      min-width: 240px;
      height: 145px;
      background: #fafafa;
      display: flex;
      flex-direction: column;
    }

    .boxes-wrapper {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 14px;
      margin-top: 10px;
      flex-wrap: wrap;
    }

    /* الطباعة على الورق A4 */
    @page { size: A4 portrait; margin: 10mm; }
    @media print {
      body { margin: 0; padding: 0; background: #fff; }
      .no-print { display: none !important; }
      .paper-container { box-shadow: none; border: none; padding: 0; max-width: 100%; }
    }
  </style>
</head>
<body>

  <!-- شريط الأدوات العلوي للشاشة (يختفي عند الطباعة) -->
  ${!isForPdfExport ? `
  <div class="no-print" style="width: 100%; max-width: 800px; background: #1e293b; border: 1px solid #334155; padding: 14px 18px; border-radius: 14px; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; box-sizing: border-box;">
    <div style="font-size: 14px; font-weight: bold; color: #38bdf8; display: flex; align-items: center; gap: 8px;">
      <span>📄</span>
      <span>استمارة تسجيل الدولاب (${data.lockerCode})</span>
    </div>
    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
      <button id="btnDownloadDirect" style="background: linear-gradient(135deg, #10b981, #059669); color: #fff; border: none; padding: 9px 18px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 13.5px; display: flex; align-items: center; gap: 6px; box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);">
        <span>💾</span>
        <span>تحميل ملف PDF مباشر</span>
      </button>
      <button onclick="window.print()" style="background: #2563eb; color: #fff; border: none; padding: 9px 16px; border-radius: 8px; font-weight: bold; cursor: pointer; font-family: inherit; font-size: 13.5px; display: flex; align-items: center; gap: 6px;">
        <span>🖨️</span>
        <span>طباعة</span>
      </button>
    </div>
  </div>
  ` : ''}

  <div class="paper-container" id="printable-locker-form">
    <!-- الترويسة العليا -->
    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 10px; margin-bottom: 14px;">
      <div style="text-align: right;">
        <h4 style="font-size: 14px;">جامعة قنا</h4>
        <h4 style="font-size: 14px;">كلية التربية النوعية</h4>
        <h4 style="font-size: 14px;">قسم التربية الفنية</h4>
      </div>
      <div style="text-align: center;">
        <div style="width: 48px; height: 48px; border: 2px solid #000; border-radius: 12px; display: inline-flex; align-items: center; justify-content: center; font-size: 24px; font-weight: 900; background: #f8fafc;">
          🎨
        </div>
      </div>
      <div style="text-align: left; font-size: 12.5px; font-weight: bold; line-height: 1.6;">
        <div>تاريخ التسجيل: <span style="direction: ltr; display: inline-block;">${dateStr}</span></div>
        <div>مشرف النظام: ${supervisor}</div>
      </div>
    </div>

    <h3 style="margin: 12px 0 16px 0; text-decoration: underline; font-size: 21px; letter-spacing: 0.5px;">
      استمارة تسجيل وتخصيص دولاب طلاب
    </h3>

    <!-- جدول بيانات الدولاب الأساسية -->
    <table>
      <thead>
        <tr>
          <th style="width: 33%;">الفرقة الدراسية</th>
          <th style="width: 34%; background: #e0f2fe; color: #0369a1;">كود الدولاب</th>
          <th style="width: 33%;">رقم هاتف المندوب</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="font-size: 15px;">${data.cohort || 'عام'}</td>
          <td style="font-size: 26px; font-weight: 900; color: #0284c7; padding: 10px 4px;">${data.lockerCode}</td>
          <td dir="ltr" style="font-size: 15px; font-weight: bold;">${data.phone}</td>
        </tr>
      </tbody>
    </table>

    <!-- جدول أسماء الطلاب المشتركين والتوقيعات -->
    <table>
      <thead>
        <tr>
          <th style="width: 10%;">م</th>
          <th style="width: 60%; text-align: right; padding-right: 12px;">اسم الطالب المشترك</th>
          <th style="width: 30%;">التوقيع بالاستلام</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <p class="small-pledge">
      ⚠️ <strong>إقرار وتعهد:</strong> نقر نحن الطلاب المذكورة أسماؤنا أعلاه باستلام الدولاب الموضح كوده بحالة سليمة ونلتزم بالمحافظة التامة عليه ونظافته، وفي حالة حدوث أي تلفيات نتحمل كامل تكاليف الإصلاح.
    </p>

    <div class="divider"></div>

    <div class="cutline">
      <span>✂️</span>
      <span>يتم قص هذا الجزء ولصقه على باب الدولاب من الخارج لتعريف أصحابه</span>
    </div>

    <!-- بطاقة القص واللصق على الدولاب -->
    <div class="boxes-wrapper">
      <div class="codeBox">
        ${data.lockerCode}
      </div>
      <div class="namesBox">
        ${namesBoxHtml}
      </div>
    </div>

    <!-- تذييل الاستمارة وتوقيع المشرف -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 24px; padding-top: 14px; border-top: 1px solid #ccc; font-size: 13px; font-weight: bold;">
      <div>تاريخ التسجيل: <span style="direction: ltr; display: inline-block;">${dateStr}</span></div>
      <div>توقيع مشرف المنظومة: ...........................................</div>
    </div>
  </div>

  ${!isForPdfExport ? `
  <script src="https://cdnjs.cloudflare.com/ajax/libs/html2pdf.js/0.10.1/html2pdf.bundle.min.js"></script>
  <script>
    document.getElementById('btnDownloadDirect')?.addEventListener('click', function() {
      const btn = this;
      btn.innerText = '⏳ جاري تنزيل الـ PDF...';
      btn.disabled = true;
      const element = document.getElementById('printable-locker-form');
      const opt = {
        margin: [8, 8, 8, 8],
        filename: 'استمارة_دولاب_${data.lockerCode}.pdf',
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      html2pdf().set(opt).from(element).save().then(function() {
        btn.innerText = '✅ تم التنزيل بنجاح!';
        setTimeout(function() {
          btn.innerHTML = '<span>💾</span><span>تحميل ملف PDF مباشر</span>';
          btn.disabled = false;
        }, 3000);
      }).catch(function(err) {
        alert('حدث خطأ أثناء إنشاء ملف PDF');
        btn.innerText = '💾 تحميل ملف PDF مباشر';
        btn.disabled = false;
      });
    });
  </script>
  ` : ''}

</body>
</html>`;
}

/**
 * الوظيفة الرئيسية: تنزيل استمارة الدولاب كملف PDF تلقائياً ومباشرة
 * تدعم تطبيق الأندرويد (DownloadManager) والمتصفحات العادية بسلاسة تامة وبدون أي تشوه في التنسيق
 */
export async function downloadLockerReceiptPdf(
  data: LockerReceiptData,
  onStatusChange?: (status: string) => void
): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  const notify = (msg: string) => {
    if (onStatusChange) onStatusChange(msg);
  };

  notify('جاري إعداد استمارة الـ PDF...');

  try {
    // 1. إنشاء حاوية مؤقتة لتنسيق A4 القياسي
    const container = document.createElement('div');
    container.id = 'locker-pdf-render-temp';
    container.style.position = 'fixed';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '794px'; // 210mm at 96 DPI
    container.style.background = '#ffffff';
    container.style.color = '#000000';
    container.style.direction = 'rtl';
    container.style.zIndex = '-9999';

    // حقن كود الـ HTML النقي المجهز للـ PDF
    container.innerHTML = generateLockerReceiptHtml(data, true);
    document.body.appendChild(container);

    // 2. تحميل مكتبة html2pdf ديناميكياً
    notify('جاري توليد ملف الـ PDF عالي الدقة...');
    const html2pdf = (await import('html2pdf.js')).default;
    const safeFilename = `استمارة_دولاب_${data.lockerCode}.pdf`;

    const opt = {
      margin: 6,
      filename: safeFilename,
      image: { type: 'jpeg' as const, quality: 0.98 },
      html2canvas: {
        scale: 2,
        useCORS: true,
        letterRendering: true,
        logging: false,
        windowWidth: 800
      },
      jsPDF: {
        unit: 'mm' as const,
        format: 'a4' as const,
        orientation: 'portrait' as const
      }
    };

    const worker = html2pdf().set(opt).from(container);

    // 3. فحص بيئة التشغيل: هل نحن داخل تطبيق الأندرويد أم متصفح ويب عادي؟
    const isApp = isAndroidAppClient();

    if (isApp) {
      notify('جاري معالجة التحميل لتطبيق الأندرويد...');
      // استخراج الـ PDF كـ Base64 لنقله للمخزن المؤقت والسماح لـ Android DownloadManager بتنزيله
      const pdfBase64 = await worker.outputPdf('datauristring');

      // محاولة الحفظ المباشر إذا كان NativeBridge متوفراً
      const nativeBridge = (window as any).ArtEduNativeBridge;
      if (nativeBridge && typeof nativeBridge.saveBase64File === 'function') {
        try {
          nativeBridge.saveBase64File(pdfBase64, safeFilename, 'application/pdf');
          notify('تم بدء تنزيل الملف بنجاح!');
          if (document.body.contains(container)) document.body.removeChild(container);
          return true;
        } catch (e) {}
      }

      // إرسال الـ Base64 إلى مسار التنزيل السحابي ليقوم نظام أندرويد بتحميله عبر DownloadManager
      const res = await fetch('/api/students/lockers/receipt-download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          filename: safeFilename,
          pdfBase64: pdfBase64,
          lockerCode: data.lockerCode
        })
      });

      const resJson = await res.json();
      if (resJson?.downloadUrl) {
        // توجيه المتصفح/الويب فيو للرابط المباشر، مما يُطلق Android DownloadManager فوراً
        window.location.href = resJson.downloadUrl;
        notify('تم بدء تنزيل الاستمارة بنجاح!');
      } else {
        // بديل احتياطي: الحفظ عبر المتصفح
        await worker.save();
      }
    } else {
      // متصفح عادي (كمبيوتر / آيفون): حفظ وتنزيل مباشر وفوري
      notify('جاري التنزيل...');
      await worker.save();
      notify('تم تنزيل الاستمارة بنجاح!');
    }

    // تنظيف الحاوية المؤقتة
    if (document.body.contains(container)) {
      document.body.removeChild(container);
    }
    return true;
  } catch (err: any) {
    console.error('[downloadLockerReceiptPdf] Failed:', err);
    notify('حدث خطأ أثناء تنزيل الاستمارة');
    const container = document.getElementById('locker-pdf-render-temp');
    if (container && document.body.contains(container)) {
      document.body.removeChild(container);
    }
    // في حالة الفشل نفتح المعاينة كحل أخير
    previewLockerReceipt(data);
    return false;
  }
}

/**
 * فتح الاستمارة في نافذة جديدة للمعاينة والطباعة (بديل عند الحاجة)
 */
export function previewLockerReceipt(data: LockerReceiptData) {
  if (typeof window === 'undefined') return;
  const html = generateLockerReceiptHtml(data, false);
  const printWindow = window.open('', '_blank');
  if (printWindow) {
    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
  }
}

/**
 * الدالة الافتراضية المتوافقة مع الكود السابق:
 * تنفذ التنزيل التلقائي لملف الـ PDF فوراً
 */
export function printLockerReceipt(data: LockerReceiptData) {
  return downloadLockerReceiptPdf(data);
}
