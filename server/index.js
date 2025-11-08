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

// Path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Static serving for frontend (tanky.html)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "../")));

// --- Rate Limiter (anti spam)
const limiter = rateLimit({
  windowMs: 15 * 1000, // 15 seconds
  max: 5,
  message: { error: "Too many requests, please wait a few seconds." }
});
app.use("/tanky-chat", limiter);

// --- Logs setup
const logFilePath = path.join(__dirname, "tanky_logs.txt");
function logConversation(entry) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(logFilePath, `[${timestamp}] ${entry}\n`, "utf8");
  } catch (err) {
    console.error("Log error:", err.message);
  }
}

// --- MAIN ENDPOINT ---
app.post("/tanky-chat", async (req, res) => {
  try {
    const { messages, image } = req.body;

    const userMessage =
      messages && messages.length
        ? messages[messages.length - 1].content
        : "Hello Tanky!";

    const hasImage = !!image;
    const isArabic = /[\u0600-\u06FF]/.test(userMessage);

    const systemPrompt = `You are Tanky, a friendly aquarium assistant for MyTankScape.
You always respond briefly, clearly, and practically.
If the user's message is in Arabic, reply in Arabic.
If it's in English, reply in English.
If an image is attached, analyze it visually and describe what's seen — 
identify fish species, water clarity, tank cleanliness, or visible issues.`;

    const chatInput = [
      { role: "system", content: systemPrompt },
    ];

    if (hasImage) {
      chatInput.push({
        role: "user",
        content: [
          { type: "text", text: userMessage },
          { type: "image_url", image_url: image }
        ]
      });
    } else {
      chatInput.push({ role: "user", content: userMessage });
    }

    // --- Call OpenAI ---
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatInput,
      max_completion_tokens: 500
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      (hasImage
        ? (isArabic
            ? "لم أتمكن من تحليل الصورة حالياً، حاول مجدداً لاحقاً."
            : "I couldn’t analyze the image right now. Please try again later.")
        : (isArabic
            ? "لم أتمكن من توليد رد حالياً. حاول مرة أخرى لاحقاً."
            : "I couldn’t generate a response this time. Please try again."));

    // --- Log Conversation
    logConversation(
      `User (${isArabic ? "ar" : "en"}): ${userMessage}\n${
        hasImage ? "[+ image attached]" : ""
      }\nTanky: ${reply}\n--------------------------------------------------`
    );

    res.json({ reply });
  } catch (err) {
    console.error("OpenAI Error:", err.message || err);
    logConversation(`ERROR: ${err.message || err}`);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// --- Logs Viewer ---
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
  } catch {
    res.status(500).send("Error reading log file.");
  }
});

// --- Server ---
app.listen(3000, () => {
  console.log("✅ Tanky API running on port 3000");
  console.log(`🪶 Logs saved at: ${logFilePath}`);
});
