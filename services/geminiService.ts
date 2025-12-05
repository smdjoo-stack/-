import { GoogleGenAI } from "@google/genai";
import { FileData } from "../types.ts";

const getClient = () => {
  // Safe access to process.env.API_KEY to prevent ReferenceError in browser
  const apiKey = process.env.API_KEY;
                 
  if (!apiKey) {
    console.warn("API Key is missing in process.env. The app will load, but generation will fail.");
  }
  return new GoogleGenAI({ apiKey: apiKey || '' });
};

export const generateProposalFromGemini = async (prompt: string, file?: FileData): Promise<string> => {
  try {
    const ai = getClient();
    
    // Check if key exists before making the call
    if (!ai.apiKey) {
       throw new Error("API Key가 설정되지 않았습니다. 환경 변수를 확인해주세요.");
    }

    const parts: any[] = [{ text: prompt }];

    if (file) {
      parts.push({
        inlineData: {
          mimeType: file.mimeType,
          data: file.data
        }
      });
    }

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts },
      config: {
        thinkingConfig: { thinkingBudget: 4096 },
        temperature: 0.7,
      }
    });

    return response.text || "생성된 내용이 없습니다.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("결과 생성 중 오류가 발생했습니다. (API Key 또는 네트워크 상태를 확인해주세요)");
  }
};