import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "../")));

const logFilePath = path.join(__dirname, "tanky_logs.txt");

function logConversation(entry) {
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${entry}\n`;
    fs.appendFileSync(logFilePath, logLine, "utf8");
  } catch (err) {
    console.error("Failed to write log:", err.message);
  }
}

app.post("/tanky-chat", async (req, res) => {
  try {
    const { messages, image, lang } = req.body;

    const userMessage =
      messages && messages.length
        ? messages[messages.length - 1].content
        : "Hello Tanky!";

    const hasImage = !!image;

    const systemPrompt =
      lang === "ar"
        ? "أنت تانكي، مساعد ذكي من MyTankScape. أجب بالعربية بإجابات قصيرة وعملية لهواة أحواض الأسماك. إذا استقبلت صورة، حلّلها لتحديد نوع السمك أو حالة الماء."
        : "You are Tanky, a friendly aquarium assistant for MyTankScape. Respond in English with short, practical answers for aquarium hobbyists. If an image is provided, analyze it for fish species, water clarity, or tank conditions.";

    const promptMessages = [
      { role: "system", content: systemPrompt },
      {
        role: "user",
        content: hasImage
          ? [
              { type: "text", text: userMessage },
              { type: "image_url", image_url: image }
            ]
          : userMessage
      }
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: promptMessages,
      max_completion_tokens: 500
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      (hasImage
        ? "I received the image but couldn’t analyze it this time. Please try again."
        : "I'm here, but I couldn’t generate a proper answer this time. Please try again.");

    logConversation(`
User (${lang || "en"}):
${userMessage}
${hasImage ? "[+ image attached]" : ""}
Tanky:
${reply}
--------------------------------------------------`);

    res.json({ reply });
  } catch (err) {
    console.error("OpenAI Error:", err.message || err);
    logConversation(`ERROR: ${err.message || err}`);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.listen(3000, () => {
  console.log("Tanky API running on port 3000");
  console.log(`Logs are saved at: ${logFilePath}`);
});
