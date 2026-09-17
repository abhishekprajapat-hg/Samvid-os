// Only explicit DOB labels qualify; agreement dates and year-only birth years do not.
export const extractBirthDate = (text, now = new Date()) => {
 const candidates = new Set();
 const pattern = /(?:date\s*of\s*birth|d\.?o\.?b\.?|birth\s*date)\s*[:-]?\s*(\d{1,4})[\s/.-](\d{1,2}|[A-Za-z]{3,9})[\s/.-](\d{2,4})/gi;
 for (const match of String(text || "").matchAll(pattern)) {
  let [, first, middle, last] = match;
  const year = Number(first.length === 4 ? first : last);
  const day = Number(first.length === 4 ? last : first);
  const names = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
  const month = /^\d+$/.test(middle) ? Number(middle) : names.indexOf(middle.slice(0, 3).toLowerCase()) + 1;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (year >= 1900 && month >= 1 && month <= 12 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day && date <= now) candidates.add(date.toISOString().slice(0, 10));
 }
 return candidates.size === 1 ? [...candidates][0] : "";
};
export async function readDocumentBirthDate(file) {
 let worker;
 const recognize = async image => {
  worker ||= await (await import("tesseract.js")).createWorker("eng");
  return (await worker.recognize(image)).data.text;
 };
 try {
  if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
   const pdfjs = await import("pdfjs-dist");
   const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
   pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
   const pdf = await pdfjs.getDocument({ data: await file.arrayBuffer(), isEvalSupported: false }).promise;
   try {
    let text = "";
    for (let i = 1; i <= Math.min(pdf.numPages, 10); i++) {
     const page = await pdf.getPage(i);
     const content = (await page.getTextContent()).items.map(item => item.str || "").join(" ");
     text += " " + content;
     if (content.trim().length < 40) {
      const viewport = page.getViewport({ scale: 1.5 });
      const canvas = document.createElement("canvas"); canvas.width = viewport.width; canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext("2d"), viewport }).promise;
      text += " " + await recognize(canvas);
      canvas.width = 0; canvas.height = 0;
     }
    }
    return extractBirthDate(text);
   } finally { await pdf.destroy(); }
  }
  if (/^image\/(png|jpeg)$/.test(file.type)) return extractBirthDate(await recognize(file));
  return "";
 } finally { if (worker) await worker.terminate(); }
}
