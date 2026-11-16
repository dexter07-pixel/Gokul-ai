const express = require('express');
const path = require('path');
require('dotenv').config();

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const ACCESS_PIN = process.env.ACCESS_PIN || '1234';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const TAVILY_API_KEY = process.env.TAVILY_API_KEY;

// Search the web autonomously
async function searchWeb(query) {
  try {
    const res = await fetch('https://api.tavily.com/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: query,
        search_depth: 'basic',
        max_results: 5
      })
    });
    const data = await res.json();
    return (data.results || [])
      .map((r, i) => `[${i + 1}] ${r.title}: ${r.content} (Source: ${r.url})`)
      .join('\n\n');
  } catch (err) {
    return '';
  }
}

app.post('/api/chat', async (req, res) => {
  const { message, history = [], pin } = req.body;

  if (pin !== ACCESS_PIN) {
    return res.status(401).json({ error: 'Invalid Private Access PIN' });
  }

  try {
    // 1. Perform live web search automatically
    const webContext = await searchWeb(message);

    // 2. Construct prompt for Gokul AI
    const systemPrompt = `You are Gokul AI, an advanced, all-capable AI assistant built to handle any command (coding, writing, math, analysis, real-time facts). 
Answer directly, clearly, and thoroughly using the live web search context below when relevant. Never tell the user to search Google—you have already searched the web for them.

LIVE WEB SEARCH RESULTS:
${webContext || 'No live search results needed or returned.'}`;

    const contents = [
      ...history.map(m => ({
        role: m.role === 'user' ? 'user' : 'model',
        parts: [{ text: m.text }]
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { parts: [{ text: systemPrompt }] },
          contents
        })
      }
    );

    const data = await response.json();
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || 'No response generated.';
    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process command.' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Gokul AI running on port ${PORT}`));