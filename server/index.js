import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.post("/tanky-chat", async (req, res) => {
  try {
    const { messages } = req.body;

const completion = await client.chat.completions.create({
  model: "gpt-5-nano",               // ✅ أرخص وأسرع موديل
  messages: chatMessages,            // بيشمل الرسائل السابقة
  max_tokens: 250,                   // ⛔ أقصى طول للرد
  temperature: 0.4,                  // استقرار أكتر وأقل تكلفة
  presence_penalty: 0.2,             // يقلل الحشو
  frequency_penalty: 0.3             // يمنع التكرار
});
        {
          role: "system",
          content: "You are Tanky, a friendly aquarium assistant for MyTankScape. Respond in Arabic or English based on user input. Give short, practical answers about fishkeeping, aquarium gear, and water care."
        },
        ...messages
      ],
      max_tokens: 400,
      temperature: 0.6
    });

    res.json({ reply: completion.choices[0].message });
    } catch (err) {
    console.error("❌ OpenAI Error:", err.message || err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.listen(3000, () => console.log("✅ Tanky API running on port 3000"));
