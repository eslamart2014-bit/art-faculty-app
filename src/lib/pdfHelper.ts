export const generatePrintableHtml = (
  courseName: string, 
  title: string, 
  subtitle: string, 
  tableHtml: string,
  instructorName: string = "........................",
  isDownload: boolean = false
) => {
  return `
    <html dir="rtl" lang="ar">
      <head>
        <title>${title} - ${courseName}</title>
        <style>
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
          
          /* Master Layout */
          .master-table { width: 100%; border: none !important; border-collapse: collapse; }
          .master-table > thead > tr > td { border: none !important; padding: 0; }
          .master-table > tbody > tr > td { border: none !important; padding: 0; }
          .master-table > tfoot > tr > td { border: none !important; padding: 0; }
          
          /* Header */
          .report-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; font-weight: bold; font-size: 15px; line-height: 1.5; border-bottom: 2px solid #000; padding-bottom: 10px; padding-top: 15px; }
          .title-container { text-align: center; margin: 15px 0; }
          .title { font-size: 22px; font-weight: bold; display: inline-block; }
          .subtitle { font-size: 14px; margin-top: 5px; color: #333; }
          
          /* Fix for inner tables (from reports) */
          table { width: 100%; border-collapse: collapse; page-break-inside: auto; }
          tr { page-break-inside: avoid; page-break-after: auto; }
          th, td { border: 1px solid #000; padding: 6px; text-align: center; font-size: 13px; }
          th { background-color: #f0f0f0; font-weight: bold; }
          
          /* Footer */
          .page-footer { font-size: 11px; text-align: center; padding-top: 8px; color: #444; border-top: 1px dashed #999; margin-top: 20px; font-weight: bold; }
          
          @media print {
            @page { margin: 10mm; }
            body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          }
        </style>
      </head>
      <body>
        <table class="master-table">
          <thead style="display: table-header-group;">
            <tr>
              <td>
                <div class="report-header">
                  <div>
                    جامعة قنا<br/>
                    كلية التربية النوعية<br/>
                    قسم التربية الفنية
                  </div>
                  <div style="text-align: left;">
                    ${instructorName}<br/>
                    ${courseName ? `مقرر: ${courseName}` : ''}
                  </div>
                </div>
                <div class="title-container">
                  <div class="title">${title}</div>
                  ${subtitle ? `<div class="subtitle">${subtitle}</div>` : ''}
                </div>
              </td>
            </tr>
          </thead>
          
          <tbody>
            <tr>
              <td>
                ${tableHtml}
              </td>
            </tr>
          </tbody>
          
          <tfoot style="display: table-footer-group;">
            <tr>
              <td>
                <div class="page-footer">
                  تاريخ الاستخراج: ${new Date().toLocaleString('ar-EG')} &nbsp;&nbsp;|&nbsp;&nbsp; مطور ومبرمج النظام: <span style="font-size: 12px; color: #000;">إسلام عبداللطيف</span>
                </div>
              </td>
            </tr>
          </tfoot>
        </table>
        
        ${!isDownload ? `
        <script>
          window.onload = function() { window.print(); window.close(); }
        </script>
        ` : ''}
      </body>
    </html>
  `;
};
