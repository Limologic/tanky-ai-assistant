import express from "express";
import bodyParser from "body-parser";
import OpenAI from "openai";

const app = express();
app.use(bodyParser.json());

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

const SYSTEM_PROMPT = {
  role: "system",
  content:
    "You are Tanky, a friendly aquarium assistant for MyTankScape. Respond in Arabic or English based on user input. Give short, practical answers about fishkeeping, aquarium gear, and water care."
};

app.post("/tanky-chat", async (req, res) => {
  try {
    const { messages } = req.body;
    const chatMessages = [SYSTEM_PROMPT, ...messages];

    const completion = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: chatMessages,
      max_tokens: 250,
      temperature: 0.4,
      presence_penalty: 0.2,
      frequency_penalty: 0.3
    });

    res.json({ reply: completion.choices[0].message });
  } catch (err) {
    console.error("OpenAI Error:", err.message || err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.listen(3000, () => console.log("Tanky API running on port 3000"));
