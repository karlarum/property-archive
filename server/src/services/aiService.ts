import OpenAI from 'openai';
import fs from 'fs';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/* Analyze image and generate a description */
export async function generateImageDescription(imagePath: string): Promise<string> {
  try {
    // Read the image file and convert to base64
    const imageBuffer = fs.readFileSync(imagePath);
    const base64Image = imageBuffer.toString('base64');
    
    // Determine media type
    const ext = imagePath.toLowerCase().split('.').pop();
    let mimeType = 'image/jpeg';
    if (ext === 'png') mimeType = 'image/png';
    else if (ext === 'gif') mimeType = 'image/gif';
    else if (ext === 'webp') mimeType = 'image/webp';

    // Call OpenAI Vision API
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: `data:${mimeType};base64,${base64Image}`
              }
            },
            {
              type: "text",
              text: "Describe this item in 1-2 sentences for a home inventory system. Focus on: what the item is, its color, material, size/type, and any distinctive features. Be concise and factual."
            }
          ]
        }
      ],
      max_tokens: 300
    });

    return response.choices[0]?.message?.content || 'Unable to generate description';
    
  } catch (error) {
    console.error('AI description error:', error);
    return ''; // Return empty string if error
  }
}