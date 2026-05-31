# github-roast
A web page where someone types a GitHub username and gets a friendly, accurate roast based on their public repos.

# 🚀 What it does

- Takes a GitHub username as input
- Fetches public repositories using the GitHub API
- Analyzes repo data (languages, stars, activity, etc.)
- Generates a roast using an LLM (OpenAI / Claude / Gemini if API key is provided)
- If no API key is available, it uses a fallback roast system

  # 📝 Prompts

- make sure express is installed, package.json, the project runs w npm start and dont break any excisting code
-install missing npm dependencies
-confirm the app runs successfully after installation
-fix the server.js file so it adds the gemini api key code
-find the error thats coming from the server.js file
-the llm is not generating full sentences, check out other files and find out the problem
-check if the app is working also on the demo mode
-the demo mode is not working :3000/api/roast:1  Failed to load resource: the server responded with a status of 500 (Internal Server Error) check here
-fetch the repos via github api correctly so the demo mode works
-check whats making the llm crash and generate the same roast over and over again



# ▶️ How to run locally

### 1. Install dependencies
```bash
npm install
npm start