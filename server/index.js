import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";
import path from "path";
import { fileURLToPath } from "url";

const app = express();
app.use(bodyParser.json({ limit: "15mb" })); // لدعم الصور base64 لحد 15MB

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

// مسار التشغيل
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// تقديم الملفات الثابتة (زي tanky.html)
app.use(express.static(__dirname));
app.use(express.static(path.join(__dirname, "../")));

// ✨ نقطة الاتصال الرئيسية مع دعم الصور
app.post("/tanky-chat", async (req, res) => {
  try {
    const { messages, image } = req.body;

    // لو المستخدم بعت رسالة بس
    const userMessage =
      messages && messages.length
        ? messages[messages.length - 1].content
        : "Hello Tanky!";

    // لو فيه صورة أُرسلت مع الرسالة
    const hasImage = !!image;

    // إعداد الرسائل المرسلة للـAPI
    const promptMessages = [
      {
        role: "system",
        content:
          "You are Tanky, a friendly aquarium assistant for MyTankScape. Respond in Arabic or English based on the user’s message. Give short, practical answers about fishkeeping, aquarium care, and tank setup. If an image is provided, analyze it visually to detect fish species, water clarity, or tank issues."
      },
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

    // استدعاء OpenAI API
    const completion = await client.chat.completions.create({
      model: "gpt-4o-mini", // يدعم تحليل الصور
      messages: promptMessages,
      max_completion_tokens: 500
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      (hasImage
        ? "📷 I received the image but couldn’t analyze it this time. Please try again."
        : "I'm here, but I couldn’t generate a proper answer this time. Please try again!");

    res.json({ reply });
  } catch (err) {
    console.error("❌ OpenAI Error:", err.message || err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

// ✅ تشغيل الخادم
app.listen(3000, () =>
  console.log("✅ Tanky API running on port 3000 and ready for image analysis!")
);
