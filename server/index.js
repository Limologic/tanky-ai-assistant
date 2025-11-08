import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import rateLimit from "express-rate-limit";
import fetch from "node-fetch"; // ✅ required for server-side webhook calls

const app = express();
app.use(bodyParser.json({ limit: "15mb" }));

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// === Path setup ===
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const logsDir = path.join(__dirname, "logs");
const mainLogFile = path.join(logsDir, "tanky_logs.txt");

// Ensure logs folder exists
if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });

// === Serve static frontend (Tanky HTML) ===
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "../")));

// === Rate limiter (5 requests / 15s per IP) ===
const limiter = rateLimit({
  windowMs: 15 * 1000,
  max: 5,
  message: { error: "Too many requests, please wait a few seconds." }
});
app.use("/tanky-chat", limiter);

// === Helper: Save text log ===
function logText(entry) {
  try {
    const timestamp = new Date().toISOString();
    fs.appendFileSync(mainLogFile, `[${timestamp}] ${entry}\n`, "utf8");
  } catch (err) {
    console.error("Log write error:", err.message);
  }
}

// === Helper: Save structured conversation (last 5 only) ===
function saveConversationJSON(userMsg, reply, lang, hasImage) {
  try {
    const timestamp = new Date().toISOString();
    const file = path.join(logsDir, "tanky_conversations.json");
    let history = [];

    if (fs.existsSync(file)) {
      history = JSON.parse(fs.readFileSync(file, "utf8"));
    }

    // --- Send log to Google Sheets via webhook (n8n / Make / Apps Script) ---
    fetch("https://script.google.com/macros/s/AKfycbzX7NYKBPueLXErk7U7gnnLAGl0MWH6TtUK5k4IHfnBu-uUz4JclVSmWqL59t6pcHuTkw/exec", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        timestamp,
        lang,
        message: userMsg,
        reply,
        hasImage
      })
    }).catch(() => {});

    // --- Save locally (keep last 5 only) ---
    history.unshift({ timestamp, lang, user: userMsg, hasImage, reply });
    if (history.length > 5) history = history.slice(0, 5);

    fs.writeFileSync(file, JSON.stringify(history, null, 2), "utf8");
  } catch (err) {
    console.error("Failed to save JSON conversation:", err.message);
  }
}

// === MAIN API ENDPOINT ===
app.post("/tanky-chat", async (req, res) => {
  try {
    const { messages, image } = req.body;

    const userMessage =
      messages && messages.length
        ? messages[messages.length - 1].content
        : "Hello Tanky!";

    const hasImage = !!image;
    const isArabic = /[\u0600-\u06FF]/.test(userMessage);

    const systemPrompt = `
You are Tanky, a friendly aquarium assistant for MyTankScape.
Respond concisely, helpfully, and practically for aquarium hobbyists.
If the user's message is Arabic, reply in Arabic.
If it's English, reply in English.
If an image is included, analyze it visually (fish species, water clarity, tank cleanliness, visible issues).
`;

    const chatInput = [{ role: "system", content: systemPrompt }];

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

    // === GPT-4o call ===
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: chatInput,
      max_completion_tokens: 500
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      (hasImage
        ? (isArabic
            ? "لم أتمكن من تحليل الصورة حالياً. حاول مجدداً لاحقاً."
            : "I couldn’t analyze the image right now. Please try again later.")
        : (isArabic
            ? "لم أتمكن من الرد حالياً. حاول مرة أخرى لاحقاً."
            : "I couldn’t generate a response this time. Please try again."));

    // === Logging ===
    logText(
      `User (${isArabic ? "ar" : "en"}): ${userMessage}\n${
        hasImage ? "[+ image attached]" : ""
      }\nTanky: ${reply}\n--------------------------------------------------`
    );

    saveConversationJSON(userMessage, reply, isArabic ? "ar" : "en", hasImage);

    res.json({ reply });
  } catch (err) {
    console.error("OpenAI Error:", err.message || err);
    logText(`ERROR: ${err.message || err}`);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// === Read all text logs ===
app.get("/logs", (req, res) => {
  const key = req.query.key;
  const secret = process.env.TANKY_LOG_KEY || "tanky123";
  if (key !== secret) return res.status(403).json({ error: "Unauthorized" });

  try {
    const data = fs.readFileSync(mainLogFile, "utf8");
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.send(data);
  } catch {
    res.status(500).send("Error reading text log file.");
  }
});

// === Read last 5 JSON conversations ===
app.get("/recent", (req, res) => {
  const key = req.query.key;
  const secret = process.env.TANKY_LOG_KEY || "tanky123";
  if (key !== secret) return res.status(403).json({ error: "Unauthorized" });

  try {
    const file = path.join(logsDir, "tanky_conversations.json");
    if (!fs.existsSync(file)) return res.json([]);
    const history = JSON.parse(fs.readFileSync(file, "utf8"));
    res.json(history);
 
