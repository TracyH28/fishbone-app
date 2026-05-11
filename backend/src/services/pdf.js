import puppeteer from "puppeteer";

export async function generateSessionPDF(sessionUrl) {
  const browser = await puppeteer.launch({
    executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(sessionUrl, { waitUntil: "networkidle0", timeout: 30000 });
  const pdf = await page.pdf({
    format: "A3",
    landscape: true,
    printBackground: true,
    margin: { top: "20mm", bottom: "20mm", left: "15mm", right: "15mm" },
  });
  await browser.close();
  return pdf;
}
