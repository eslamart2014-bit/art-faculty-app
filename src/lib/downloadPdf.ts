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

  // Import html2pdf dynamically to avoid SSR issues
  const html2pdf = (await import("html2pdf.js")).default;

  // Get the HTML string
  const htmlString = generatePrintableHtml(courseName, title, subtitle, tableHtml, instructorName, true);

  // Create a temporary container
  const container = document.createElement("div");
  container.innerHTML = htmlString;
  
  // Optional: style container to match print styles
  container.style.width = "210mm";
  container.style.padding = "10mm";
  container.style.background = "#fff";
  container.style.color = "#000";
  container.style.fontFamily = "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif";
  container.style.direction = "rtl";

  const opt = {
    margin: 10,
    filename: filename,
    image: { type: 'jpeg' as const, quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const }
  };

  await html2pdf().set(opt).from(container).save();
};
