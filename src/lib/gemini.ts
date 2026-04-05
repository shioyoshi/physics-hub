import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.NEXT_PUBLIC_GEMINI_API_KEY || "" });

export async function summarizeText(text: string, maxLength = 300): Promise<string> {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `以下のテキストを日本語で${maxLength}文字以内に要約してください。要点を箇条書きではなく自然な文章で述べてください。\n\n${text}`,
    });
    return response.text || "要約を生成できませんでした。";
  } catch (error) {
    console.error("Gemini API error:", error);
    return "AI要約の生成に失敗しました。";
  }
}

export async function generateWikiMap(pages: { title: string; content: string; tags: string[] }[]): Promise<string> {
  try {
    const pageList = pages.map((p) => `タイトル: ${p.title}\nタグ: ${p.tags.join(", ")}\n内容（先頭200文字）: ${p.content.substring(0, 200)}`).join("\n---\n");
    const response = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `以下のWikiページ群の構造を分析し、ページ間の関連性をJSON形式で出力してください。
出力フォーマット: { "nodes": [{"id": "タイトル", "group": "カテゴリ"}], "links": [{"source": "タイトル1", "target": "タイトル2", "relation": "関係性"}] }

ページ一覧:
${pageList}`,
    });
    return response.text || "{}";
  } catch (error) {
    console.error("Gemini API error:", error);
    return "{}";
  }
}
