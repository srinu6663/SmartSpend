import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = "AIzaSyBVhcJw4VTVQD21ZFGWHWsjlZGZnnGilgU"; // From their .env.local
const genAI = new GoogleGenerativeAI(apiKey);

async function run() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result = await model.generateContent("Hello");
    console.log("gemini-pro works!", result.response.text());
  } catch (e: any) {
    console.error("gemini-pro failed:", e.message);
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.0-pro" });
    const result = await model.generateContent("Hello");
    console.log("gemini-1.0-pro works!", result.response.text());
  } catch (e: any) {
    console.error("gemini-1.0-pro failed:", e.message);
  }
}

run();
