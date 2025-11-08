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
      model: "gpt-4o-mini",
      messages: [
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
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

app.listen(3000, () => console.log("✅ Tanky API running on port 3000"));
