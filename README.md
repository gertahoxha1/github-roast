# github-roast
A web page where someone types a GitHub username and gets a friendly, accurate roast based on their public repos.

# 🚀 What it does

- Takes a GitHub username as input
- Fetches public repositories using the GitHub API
- Analyzes repo data (languages, stars, activity, etc.)
- Generates a roast using an LLM (OpenAI / Claude / Gemini if API key is provided)
- If no API key is available, it uses a fallback roast system

  # 🧠 Key Features

- GitHub API integration
- LLM-powered roast generation (optional)
- Demo mode (works without any API keys)
- Multiple roast styles
- Error handling


# ▶️ How to run locally

### 1. Install dependencies
```bash
npm install