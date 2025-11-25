import { GoogleGenAI } from "@google/genai";

// Initialize the Gemini API client
// Note: We create a new instance per request in the component to ensure we capture the latest key if it changes,
// but for static usage we can export a helper.

export const generateStyledImage = async (
  imageBase64: string,
  prompt: string,
  mimeType: string
): Promise<string> => {
  if (!process.env.API_KEY) {
    throw new Error("API Key is missing.");
  }

  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

  // Remove the data URL prefix (e.g., "data:image/png;base64,")
  const base64Data = imageBase64.split(',')[1];

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [
          {
            inlineData: {
              data: base64Data,
              mimeType: mimeType,
            },
          },
          {
            text: `Transform this image based on the following instruction: ${prompt}. Return ONLY the transformed image.`,
          },
        ],
      },
      // Note: gemini-2.5-flash-image does not support responseMimeType or responseSchema 
      // for direct image output in the same way simple text models do, 
      // but it returns an image in the parts.
    });

    // Iterate through parts to find the image
    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) {
      throw new Error("No content generated.");
    }

    for (const part of parts) {
      if (part.inlineData && part.inlineData.data) {
        return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
      }
    }

    throw new Error("No image data found in response.");

  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};
