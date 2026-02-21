/**
 * 利用可能なGeminiモデル一覧を取得
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const content = fs.readFileSync(envPath, "utf-8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith("#")) {
        const [key, ...valueParts] = trimmed.split("=");
        const value = valueParts.join("=").replace(/^["']|["']$/g, "");
        process.env[key] = value;
      }
    }
  }
}

loadEnvFile();

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

if (!GEMINI_API_KEY) {
  console.error("GEMINI_API_KEY が設定されていません");
  process.exit(1);
}

async function listModels() {
  const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

  // REST APIで直接モデル一覧を取得
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`
  );

  const data = await response.json();

  console.log("利用可能なモデル一覧:\n");

  if (data.models) {
    for (const model of data.models) {
      if (model.supportedGenerationMethods?.includes("generateContent")) {
        console.log(`- ${model.name.replace("models/", "")}`);
        console.log(`  表示名: ${model.displayName}`);
        console.log(`  対応: ${model.supportedGenerationMethods.join(", ")}`);
        console.log("");
      }
    }
  } else {
    console.log("エラー:", data);
  }
}

listModels().catch(console.error);
