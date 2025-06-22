import { GoogleGenAI } from '@google/genai';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

let contents = `
必ず日本語で回答してください。
あなたは優秀なプログラマーであり、コードの説明を行います。
コードの内容は回答に出力せず、必要な場合にのみ引用してください。
`;

contents += `
以下のHTTPレスポンスボディの内容について、簡潔に説明してください。
`;
//以下のHTTP Archive Fileの内容について、簡潔に説明してください。

async function explainCode(code: string) {
  const req = {
    model: 'gemini-2.0-flash',
    contents: contents + code,
  };

  const countTokensResponse = await ai.models.countTokens(req);
  console.log(countTokensResponse.totalTokens);
  if (
    countTokensResponse?.totalTokens &&
    countTokensResponse.totalTokens > 1048575
  ) {
    console.error(`The code is too long: ${countTokensResponse.totalTokens}`);
  } else {
    //const result = await ai.models.generateContent(req);
    //console.log(result.text);
  }
  return;
}

export default explainCode;
