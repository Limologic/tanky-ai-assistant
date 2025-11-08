import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// Resolve path
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve static (for tanky.html etc.)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "../")));

// Rate limiter (5 requests per 15 seconds per IP)
const limiter = rateLimit({
  windowMs: 15 * 1000,
  max: 5,
  message: { error: "Too many requests, please wait a few seconds." }
});
app.use("/tanky-chat", limiter);

// Logs file
const logFilePath = path.join(__dirname, "tanky_logs.txt");

// Helper: append conversation
function logConversation(entry) {
  try {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] ${entry}\n`;
    fs.appendFileSync(logFilePath, logLine, "utf8");
  } catch (err) {
    console.error("Failed to write log:", err.message);
  }
}

// --- MAIN CHAT ENDPOINT ---
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
        ? "أنت تانكي، مساعد ذكي من MyTankScape. أجب بالعربية بإجابات قصيرة وعملية لهواة أحواض الأسماك. إذا أُرسلت صورة، حللها لتحديد نوع السمك أو حالة الماء أو نظافة الحوض."
        : "You are Tanky, a friendly aquarium assistant for MyTankScape. Respond in English with concise, practical answers for aquarium hobbyists. If an image is included, analyze it for fish species, water clarity, or tank cleanliness.";

    const chatInput = [
      { role: "system", content: systemPrompt },
      hasImage
        ? {
            role: "user",
            content: [
              { type: "text", text: userMessage },
              { type: "image_url", image_url: image }
            ]
          }
        : { role: "user", content: userMessage }
    ];

    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatInput,
      max_completion_tokens: 500
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      (hasImage
        ? "I received your image but couldn’t analyze it this time. Please try again."
        : "I'm here, but I couldn’t generate a proper answer this time. Please try again.");

    // Log to file
    logConversation(
      `User (${lang || "en"}):\n${userMessage}\n${
        hasImage ? "[+ image attached]" : ""
      }\nTanky:\n${reply}\n--------------------------------------------------`
    );

    res.json({ reply });
  } catch (err) {
    console.error("OpenAI Error:", err.message || err);
    logConversation(`ERROR: ${err.message || err}`);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// --- READ LOGS ENDPOINT ---
app.get("/logs", (req, res) => {
  const key = req.query.key;
  const secret = process.env.TANKY_LOG_KEY || "tanky123";
  if (key !== secret) {
    return res.status(403).json({ error: "Unauthorized" });
  }
  try {
    const data = fs.readFileSync(logFilePath, "utf8");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(data);
  } catch (err) {
    res.status(500).send("Error reading log file.");
  }
});

// Start server
app.listen(3000, () => {
  console.log("✅ Tanky API running on port 3000");
  console.log(`Logs at: ${logFilePath}`);
});
