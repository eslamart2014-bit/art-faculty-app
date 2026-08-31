import { generatePrintableHtml } from "./pdfHelper";

export const downloadPdf = async (
  filename: string,
  courseName: string,
  title: string,
  subtitle: string,
  tableHtml: string,
  instructorName: string = "........................"
) => {
  if (typeof window === "undefined") return;

  return new Promise<void>((resolve) => {
    // Create overlay
    const overlay = document.createElement("div");
    overlay.style.position = "fixed";
    overlay.style.top = "0";
    overlay.style.left = "0";
    overlay.style.width = "100%";
    overlay.style.height = "100%";
    overlay.style.backgroundColor = "rgba(0,0,0,0.8)";
    overlay.style.zIndex = "10000";
    overlay.style.display = "flex";
    overlay.style.justifyContent = "center";
    overlay.style.alignItems = "center";
    overlay.style.direction = "rtl";

    const modal = document.createElement("div");
    modal.style.background = "#222";
    modal.style.padding = "25px";
    modal.style.borderRadius = "15px";
    modal.style.width = "90%";
    modal.style.maxWidth = "400px";
    modal.style.textAlign = "center";
    modal.style.border = "1px solid #555";
    modal.style.boxShadow = "0 10px 25px rgba(0,0,0,0.5)";

    const titleEl = document.createElement("h3");
    titleEl.innerText = "خيارات التقرير";
    titleEl.style.color = "#fff";
    titleEl.style.marginTop = "0";
    titleEl.style.marginBottom = "20px";

    const btnContainer = document.createElement("div");
    btnContainer.style.display = "flex";
    btnContainer.style.flexDirection = "column";
    btnContainer.style.gap = "12px";

    const btnPrint = document.createElement("button");
    btnPrint.innerText = "🖨️ فتح للطباعة (أو المشاركة)";
    btnPrint.style.padding = "15px";
    btnPrint.style.background = "#2196F3";
    btnPrint.style.color = "#fff";
    btnPrint.style.border = "none";
    btnPrint.style.borderRadius = "10px";
    btnPrint.style.fontSize = "16px";
    btnPrint.style.fontWeight = "bold";
    btnPrint.style.cursor = "pointer";

    const btnDownload = document.createElement("button");
    btnDownload.innerText = "💾 تحميل كملف PDF";
    btnDownload.style.padding = "15px";
    btnDownload.style.background = "#4CAF50";
    btnDownload.style.color = "#fff";
    btnDownload.style.border = "none";
    btnDownload.style.borderRadius = "10px";
    btnDownload.style.fontSize = "16px";
    btnDownload.style.fontWeight = "bold";
    btnDownload.style.cursor = "pointer";

    const btnCancel = document.createElement("button");
    btnCancel.innerText = "❌ إلغاء";
    btnCancel.style.padding = "10px";
    btnCancel.style.background = "transparent";
    btnCancel.style.color = "#aaa";
    btnCancel.style.border = "1px solid #555";
    btnCancel.style.borderRadius = "10px";
    btnCancel.style.fontSize = "14px";
    btnCancel.style.cursor = "pointer";
    btnCancel.style.marginTop = "10px";

    btnContainer.appendChild(btnPrint);
    btnContainer.appendChild(btnDownload);
    btnContainer.appendChild(btnCancel);

    modal.appendChild(titleEl);
    modal.appendChild(btnContainer);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);

    const cleanup = () => {
      if (document.body.contains(overlay)) {
        document.body.removeChild(overlay);
      }
      resolve();
    };

    btnCancel.onclick = cleanup;

    btnPrint.onclick = () => {
      const htmlString = generatePrintableHtml(courseName, title, subtitle, tableHtml, instructorName, false);
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(htmlString);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => {
          printWindow.print();
        }, 500);
      }
      cleanup();
    };

    btnDownload.onclick = async () => {
      btnDownload.innerText = "⏳ جاري التحميل...";
      btnDownload.disabled = true;
      btnPrint.disabled = true;
      btnCancel.disabled = true;
      btnDownload.style.opacity = "0.7";

      try {
        const html2pdf = (await import("html2pdf.js")).default;
        const htmlString = generatePrintableHtml(courseName, title, subtitle, tableHtml, instructorName, true);
        
        const container = document.createElement("div");
        container.innerHTML = htmlString;
        
        // A4 width is 210mm. If margin is 10mm (all sides), 210 - 20 = 190mm
        container.style.width = "190mm";
        container.style.maxWidth = "190mm";
        // Override padding so we don't add extra size that causes clipping
        container.style.padding = "0"; 
        container.style.background = "#fff";
        container.style.color = "#000";
        container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
        container.style.direction = "rtl";

        const opt = {
          margin: 10,
          filename: filename,
          image: { type: 'jpeg' as const, quality: 0.98 },
          // Force a desktop-like windowWidth to prevent mobile responsive clipping/wrapping
          html2canvas: { scale: 2, useCORS: true, windowWidth: 1024 },
          jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
        };

        await html2pdf().set(opt).from(container).save();
      } catch (e) {
        console.error("PDF generation failed:", e);
        alert("حدث خطأ أثناء إنشاء ملف PDF");
      }
      cleanup();
    };
  });
};
