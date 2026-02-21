/**
 * Gemini API レシピ抽出テストスクリプト
 *
 * 使い方:
 * 1. .env.local に GEMINI_API_KEY を設定
 * 2. npx tsx scripts/test-gemini-recipe.ts <画像パス>
 *
 * API Keyの取得: https://aistudio.google.com/app/apikey
 */

import { GoogleGenerativeAI } from "@google/generative-ai";
import * as fs from "fs";
import * as path from "path";
import sharp from "sharp";

// .env.local から環境変数を読み込む
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
  console.error("❌ GEMINI_API_KEY が設定されていません");
  console.error("");
  console.error("設定方法:");
  console.error("1. https://aistudio.google.com/app/apikey でAPI Keyを取得");
  console.error("2. .env.local ファイルを作成し、以下を追加:");
  console.error("   GEMINI_API_KEY=your-api-key-here");
  process.exit(1);
}

// 画像を最適化してBase64に変換
async function imageToBase64(
  imagePath: string,
  options: { maxWidth?: number; quality?: number } = {}
): Promise<{ data: string; mimeType: string; originalSize: number; optimizedSize: number }> {
  const { maxWidth = 1600, quality = 80 } = options;

  const absolutePath = path.resolve(imagePath);

  if (!fs.existsSync(absolutePath)) {
    throw new Error(`画像ファイルが見つかりません: ${absolutePath}`);
  }

  const originalBuffer = fs.readFileSync(absolutePath);
  const originalSize = originalBuffer.length;

  const ext = path.extname(imagePath).toLowerCase();
  const isHeic = ext === ".heic" || ext === ".heif";

  let outputBuffer: Buffer;
  let mimeType: string;

  if (isHeic) {
    // HEIC/HEIFはsharpで処理できないのでそのまま使用
    outputBuffer = originalBuffer;
    mimeType = getMimeType(imagePath);
  } else {
    // JPEG/PNG等はsharpで最適化（リサイズ + JPEG圧縮）
    try {
      outputBuffer = await sharp(originalBuffer)
        .resize(maxWidth, undefined, {
          withoutEnlargement: true,
          fit: "inside"
        })
        .jpeg({ quality })
        .toBuffer();
      mimeType = "image/jpeg";
    } catch (err) {
      // sharpで処理できない場合はそのまま使用
      console.log(`   ⚠️  画像最適化をスキップ: ${err instanceof Error ? err.message.split('\n')[0] : 'unknown error'}`);
      outputBuffer = originalBuffer;
      mimeType = getMimeType(imagePath);
    }
  }

  const base64 = outputBuffer.toString("base64");

  return {
    data: base64,
    mimeType,
    originalSize,
    optimizedSize: outputBuffer.length
  };
}

function getMimeType(imagePath: string): string {
  const ext = path.extname(imagePath).toLowerCase();
  const mimeTypes: Record<string, string> = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".heic": "image/heic",
    ".heif": "image/heif",
  };
  return mimeTypes[ext] || "image/jpeg";
}

// レシピ抽出のプロンプト
const RECIPE_EXTRACTION_PROMPT = `
この画像は料理のレシピ（料理本のページ、手書きメモ、印刷されたレシピカードなど）です。
画像からレシピ情報を抽出して、以下のJSON形式で出力してください。

{
  "title": "料理名",
  "servings": "何人分か（わかれば）",
  "prepTime": "準備時間（わかれば）",
  "cookTime": "調理時間（わかれば）",
  "ingredients": [
    {
      "name": "材料名",
      "amount": "分量",
      "unit": "単位",
      "note": "備考（あれば）"
    }
  ],
  "steps": [
    {
      "order": 1,
      "instruction": "手順の説明",
      "tip": "コツやポイント（あれば）"
    }
  ],
  "notes": "その他のメモや注意点",
  "confidence": "抽出の確信度 (high/medium/low)",
  "issues": ["読み取りにくかった部分や不明点があれば記載"]
}

注意事項:
- 読み取れない文字は [不明] と記載
- 手書きの場合、解釈が曖昧な部分は複数の候補を記載
- JSONのみを出力し、他の説明は不要
`;

// モデル選択肢
const MODELS = {
  flash: "gemini-2.5-flash",      // 高精度（デフォルト）
  lite: "gemini-2.5-flash-lite",  // 高速・軽量
  "2.0": "gemini-2.0-flash",      // 旧バージョン
} as const;

type ModelKey = keyof typeof MODELS;

async function extractRecipeFromImage(imagePath: string, modelKey: ModelKey = "flash") {
  const modelName = MODELS[modelKey];

  console.log("🍳 Gemini API レシピ抽出テスト");
  console.log("=".repeat(50));
  console.log(`📸 画像: ${imagePath}`);
  console.log(`🤖 モデル: ${modelName}`);
  console.log("");

  try {
    // Gemini クライアントの初期化
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY!);

    const model = genAI.getGenerativeModel({ model: modelName,
      // ここで思考プロセスを最小化する設定を入れる
      generationConfig: {
      temperature: 0.1, // 低いほど計算が速く、出力が安定する
      // @ts-ignore: 最新パラメータの場合
      thinkingConfig: { includeThoughts: false } // 推論をスキップ
    }
    });

    // 画像を読み込み・最適化
    console.log("📖 画像を読み込み・最適化中...");
    const imageData = await imageToBase64(imagePath);
    const compressionRatio = ((1 - imageData.optimizedSize / imageData.originalSize) * 100).toFixed(0);
    console.log(`   元サイズ: ${(imageData.originalSize / 1024).toFixed(0)} KB`);
    console.log(`   最適化後: ${(imageData.optimizedSize / 1024).toFixed(0)} KB (${compressionRatio}% 削減)`);
    console.log(`   MIME Type: ${imageData.mimeType}`);
    console.log("");

    // APIリクエスト
    console.log("🤖 Gemini API にリクエスト中...");
    const startTime = Date.now();

    const result = await model.generateContent([
      {
        inlineData: {
          mimeType: imageData.mimeType,
          data: imageData.data,
        },
      },
      { text: RECIPE_EXTRACTION_PROMPT },
    ]);

    const elapsed = Date.now() - startTime;
    console.log(`   完了! (${elapsed}ms)`);
    console.log("");

    // レスポンスを取得
    const response = result.response;
    const text = response.text();

    // JSONを抽出（マークダウンコードブロックを考慮）
    let jsonText = text;
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonText = jsonMatch[1].trim();
    }

    // JSONをパース
    console.log("📋 抽出結果:");
    console.log("-".repeat(50));

    try {
      const recipe = JSON.parse(jsonText);
      console.log(JSON.stringify(recipe, null, 2));

      // サマリーを表示
      console.log("");
      console.log("-".repeat(50));
      console.log("📊 サマリー:");
      console.log(`   料理名: ${recipe.title || "不明"}`);
      console.log(`   材料数: ${recipe.ingredients?.length || 0} 品目`);
      console.log(`   手順数: ${recipe.steps?.length || 0} ステップ`);
      console.log(`   確信度: ${recipe.confidence || "不明"}`);

      if (recipe.issues && recipe.issues.length > 0) {
        console.log(`   ⚠️  注意点: ${recipe.issues.join(", ")}`);
      }

      return recipe;
    } catch {
      console.log("⚠️  JSONパースに失敗。生のレスポンス:");
      console.log(text);
      return null;
    }
  } catch (error) {
    console.error("❌ エラーが発生しました:");
    if (error instanceof Error) {
      console.error(`   ${error.message}`);

      // よくあるエラーのヘルプ
      if (error.message.includes("API_KEY")) {
        console.error("");
        console.error("💡 API Keyが無効な可能性があります。");
        console.error("   https://aistudio.google.com/app/apikey で確認してください。");
      }
    }
    throw error;
  }
}

// メイン実行
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.log("使い方: npx tsx scripts/test-gemini-recipe.ts <画像パス> [モデル]");
    console.log("");
    console.log("モデル:");
    console.log("  flash  - Gemini 2.5 Flash（高精度、デフォルト）");
    console.log("  lite   - Gemini 2.5 Flash-Lite（高速）");
    console.log("  2.0    - Gemini 2.0 Flash");
    console.log("");
    console.log("例:");
    console.log("  npx tsx scripts/test-gemini-recipe.ts ./recipe.jpg");
    console.log("  npx tsx scripts/test-gemini-recipe.ts ./recipe.jpg lite");
    console.log("");
    console.log("対応フォーマット: JPEG, PNG, GIF, WebP, HEIC");
    process.exit(0);
  }

  const imagePath = args[0];
  const modelKey = (args[1] || "flash") as ModelKey;

  if (!MODELS[modelKey]) {
    console.error(`❌ 不明なモデル: ${args[1]}`);
    console.error(`   利用可能: ${Object.keys(MODELS).join(", ")}`);
    process.exit(1);
  }

  await extractRecipeFromImage(imagePath, modelKey);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
