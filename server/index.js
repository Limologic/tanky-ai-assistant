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

    const userMessage =
      messages && messages.length
        ? messages[messages.length - 1].content
        : "Hello Tanky!";

    const prompt = `You are Tanky, a friendly aquarium assistant for MyTankScape.
Answer clearly and helpfully in Arabic or English depending on the user message.
Question: ${userMessage}`;

    const completion = await client.chat.completions.create({
      model: "gpt-5-nano",
      messages: [{ role: "user", content: prompt }],
      max_completion_tokens: 400
    });

    const reply =
      completion.choices?.[0]?.message?.content?.trim() ||
      "I'm here, but I couldn’t generate a proper answer this time. Please try again!";

    res.json({ reply });
  } catch (err) {
    console.error("OpenAI Error:", err.message || err);
    res.status(500).json({ error: err.message || "Server error" });
  }
});

app.listen(3000, () => console.log("Tanky API running on port 3000"));
