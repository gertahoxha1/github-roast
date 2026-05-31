import express from "express";
import { existsSync, readFileSync } from "node:fs";

/* ---------------- ENV LOADER ---------------- */
function loadLocalEnv() {
  if (!existsSync(".env")) return;

  const lines = readFileSync(".env", "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const equalsAt = trimmed.indexOf("=");
    const colonAt = trimmed.indexOf(":");
    const separatorAt =
      equalsAt === -1
        ? colonAt
        : colonAt === -1
          ? equalsAt
          : Math.min(equalsAt, colonAt);

    if (separatorAt === -1) continue;

    const key = trimmed.slice(0, separatorAt).trim();
    let value = trimmed.slice(separatorAt + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (key) {
      process.env[key] = value;
    }
  }
}

loadLocalEnv();

/* ---------------- APP SETUP ---------------- */
const app = express();
const port = process.env.PORT || 3000;

const OPENAI_MODEL = process.env.OPENAI_MODEL || "gpt-4o-mini";
const ANTHROPIC_MODEL = process.env.ANTHROPIC_MODEL || "claude-3-5-haiku-latest";
const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const DEMO_MODE = ["1", "true", "yes", "on"].includes(
  String(process.env.DEMO_MODE || "").toLowerCase()
);
const DEBUG_LLM = ["1", "true", "yes", "on"].includes(
  String(process.env.DEBUG_LLM || "").toLowerCase()
);

app.use(express.json({ limit: "1mb" }));
app.use(express.static("public"));

/* ---------------- HELPERS ---------------- */
function cleanUsername(username) {
  return String(username || "").trim().replace(/^@/, "");
}

function isValidGithubUsername(username) {
  return /^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/.test(username);
}

function repoSummary(repo) {
  return {
    name: repo.name,
    description: repo.description,
    language: repo.language,
    stars: repo.stargazers_count,
    forks: repo.forks_count,
    openIssues: repo.open_issues_count,
    archived: repo.archived,
    fork: repo.fork,
    createdAt: repo.created_at,
    updatedAt: repo.updated_at,
    topics: repo.topics || []
  };
}

function summarizeRepos(repos) {
  const languages = new Map();
  let forks = 0;
  let archived = 0;
  let stars = 0;

  for (const repo of repos) {
    if (repo.language) {
      languages.set(repo.language, (languages.get(repo.language) || 0) + 1);
    }
    if (repo.fork) forks++;
    if (repo.archived) archived++;
    stars += repo.stars || 0;
  }

  return {
    publicRepoCount: repos.length,
    totalStars: stars,
    forks,
    archived,
    topLanguages: [...languages.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
  };
}

function makeDemoGithubData(username) {
  const login = cleanUsername(username) || "demo-dev";
  const repos = [
    {
      name: "portfolio-v7-final-final",
      description: "A personal portfolio with suspiciously confident CSS.",
      language: "JavaScript",
      stars: 3,
      forks: 0,
      openIssues: 7,
      archived: false,
      fork: false,
      createdAt: "2024-02-11T10:00:00Z",
      updatedAt: "2026-05-21T14:22:00Z",
      topics: ["portfolio", "css", "please-hire-me"]
    },
    {
      name: "todo-app-but-this-time",
      description: "A task app bravely entering a crowded field.",
      language: "TypeScript",
      stars: 1,
      forks: 1,
      openIssues: 2,
      archived: false,
      fork: false,
      createdAt: "2023-11-08T09:30:00Z",
      updatedAt: "2026-04-04T18:12:00Z",
      topics: ["productivity", "react"]
    },
    {
      name: "ai-wrapper-wrapper",
      description: "A wrapper around a wrapper around an API call.",
      language: "Python",
      stars: 12,
      forks: 2,
      openIssues: 4,
      archived: false,
      fork: false,
      createdAt: "2025-06-01T12:00:00Z",
      updatedAt: "2026-05-29T11:05:00Z",
      topics: ["ai", "cli", "automation"]
    },
    {
      name: "old-school-project",
      description: null,
      language: "HTML",
      stars: 0,
      forks: 0,
      openIssues: 0,
      archived: true,
      fork: false,
      createdAt: "2021-03-16T08:00:00Z",
      updatedAt: "2022-01-02T08:00:00Z",
      topics: []
    }
  ];

  return {
    ok: true,
    profile: {
      login,
      name: `${login} Demo`,
      avatarUrl: `https://github.com/identicons/${encodeURIComponent(login)}.png`,
      htmlUrl: `https://github.com/${encodeURIComponent(login)}`,
      bio: "Demo profile generated locally.",
      publicRepos: repos.length,
      followers: 42,
      createdAt: "2021-01-01T00:00:00Z"
    },
    repos,
    summary: summarizeRepos(repos)
  };
}

/* ---------------- GITHUB FETCH ---------------- */
async function fetchGithubJson(url) {
  const headers = {
    Accept: "application/vnd.github+json",
    "User-Agent": "github-roast-lab"
  };

  if (process.env.GITHUB_TOKEN) {
    headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  }

  const response = await fetch(url, { headers });

  if (response.status === 404) {
    return { status: 404, data: null };
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text;

    try {
      message = JSON.parse(text).message || text;
    } catch {
      // GitHub usually returns JSON errors, but keep the raw text if it does not.
    }

    return { status: response.status, data: null, error: message };
  }

  return { status: 200, data: await response.json() };
}

async function getPublicRepos(username) {
  const userUrl = `https://api.github.com/users/${encodeURIComponent(username)}`;
  const userResult = await fetchGithubJson(userUrl);

  if (userResult.status === 404) {
    return { ok: false, status: 404, message: "User not found." };
  }

  if (!userResult.data) {
    if (DEMO_MODE) {
      return {
        ...makeDemoGithubData(username),
        githubSource: "demo-fallback",
        githubError: userResult.error || "GitHub user fetch failed."
      };
    }

    return {
      ok: false,
      status: userResult.status || 500,
      message: userResult.error || "GitHub user fetch failed."
    };
  }

  const repoUrl = `https://api.github.com/users/${encodeURIComponent(
    username
  )}/repos?per_page=100&sort=updated&type=public`;

  const repoResult = await fetchGithubJson(repoUrl);

  if (!repoResult.data) {
    if (DEMO_MODE) {
      return {
        ...makeDemoGithubData(username),
        githubSource: "demo-fallback",
        githubError: repoResult.error || "Repo fetch failed."
      };
    }

    return {
      ok: false,
      status: repoResult.status || 500,
      message: repoResult.error || "Repo fetch failed."
    };
  }

  const repos = repoResult.data.map(repoSummary);

  return {
    ok: true,
    profile: {
      login: userResult.data.login,
      name: userResult.data.name,
      avatarUrl: userResult.data.avatar_url,
      htmlUrl: userResult.data.html_url,
      bio: userResult.data.bio,
      publicRepos: userResult.data.public_repos,
      followers: userResult.data.followers,
      createdAt: userResult.data.created_at
    },
    repos,
    summary: summarizeRepos(repos),
    githubSource: "github-api"
  };
}

/* ---------------- PROMPT ---------------- */
function buildPrompt({ profile, repos, summary, style }) {
  const selectedRepos = repos
    .sort((a, b) => (b.stars || 0) - (a.stars || 0))
    .slice(0, 20);

  return [
    {
      role: "system",
      content:
        "You write playful, accurate roasts of GitHub profiles. Never invent data. Keep it light and not harmful. Write complete sentences only and never stop mid-sentence. Return 2 short paragraphs plus one final short compliment."
    },
    {
      role: "user",
      content: JSON.stringify({
        style,
        profile,
        summary,
        repos: selectedRepos
      })
    }
  ];
}

/* ---------------- LLM CALLS ---------------- */
function requireCompleteText(text, provider) {
  const normalized = String(text || "").trim();

  if (!normalized || normalized.length < 10) {
    throw new Error(`${provider}_EMPTY_RESPONSE`);
  }

  return normalized;
}

async function callOpenAI(messages) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      messages,
      temperature: 0.9,
      max_tokens: 400
    })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = JSON.stringify(data);

    if (
      msg.includes("insufficient_quota") ||
      msg.includes("billing") ||
      msg.includes("429")
    ) {
      throw new Error("OPENAI_NO_QUOTA");
    }

    throw new Error("OPENAI_ERROR");
  }

  return requireCompleteText(data.choices?.[0]?.message?.content, "OPENAI");
}

async function callAnthropic(messages) {
  const [system, user] = messages;

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      system: system.content,
      messages: [{ role: "user", content: user.content }],
      max_tokens: 400,
      temperature: 0.9
    })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const msg = JSON.stringify(data);

    if (msg.includes("credit") || msg.includes("quota")) {
      throw new Error("ANTHROPIC_NO_QUOTA");
    }

    throw new Error("ANTHROPIC_ERROR");
  }

  return requireCompleteText(
    data.content?.map((c) => c.text).join(""),
    "ANTHROPIC"
  );
}

async function callGemini(messages) {
  const [system, user] = messages;
  const model = GEMINI_MODEL.replace(/^models\//, "");
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: system.content }]
      },
      contents: [
        {
          role: "user",
          parts: [{ text: user.content }]
        }
      ],
      generationConfig: {
        temperature: 0.8,
        maxOutputTokens: 900,
        thinkingConfig: {
          thinkingBudget: 0
        }
      }
    })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    const apiMessage =
      data?.error?.message ||
      data?.error?.status ||
      JSON.stringify(data) ||
      `HTTP ${res.status}`;
    const msg = JSON.stringify(data);

    if (
      msg.includes("API_KEY_INVALID") ||
      msg.includes("quota") ||
      msg.includes("429") ||
      msg.includes("invalid authentication")
    ) {
      throw new Error(`GEMINI_AUTH_OR_QUOTA: ${apiMessage}`);
    }

    throw new Error(`GEMINI_ERROR: ${apiMessage}`);
  }

  const candidate = data.candidates?.[0];

  if (candidate?.finishReason && candidate.finishReason !== "STOP") {
    throw new Error(`GEMINI_FINISH_REASON: ${candidate.finishReason}`);
  }

  return requireCompleteText(
    candidate?.content?.parts?.map((part) => part.text || "").join(""),
    "GEMINI"
  );
}

/* ---------------- LOCAL DEMO ROAST ---------------- */
function fallbackRoast({ profile, repos, summary, style }) {
  const name = profile.login;

  if (!repos.length) {
    return `${name} has no repos... either extremely private or spiritually minimalist. Tiny compliment: discipline is rare.`;
  }

  const top = [...repos].sort((a, b) => (b.stars || 0) - (a.stars || 0))[0];
  const topLanguage = summary.topLanguages[0]?.[0] || "mystery language";
  const archivedLine = summary.archived
    ? `${summary.archived} archived repo${summary.archived === 1 ? "" : "s"} ${summary.archived === 1 ? "sits" : "sit"} there like museum exhibits with commit history.`
    : "Nothing is archived, which is bold confidence from a codebase still making promises.";

  if (style === "haiku") {
    return `
${top.name} waits
${top.stars || 0} stars blink in ${topLanguage}
Issues bloom softly

Tiny compliment: the repo garden has signs of life.
    `.trim();
  }

  if (style === "pirate") {
    return `
Arrr, ${name} sails with ${repos.length} public repos and a treasure chest led by "${top.name}" with ${top.stars || 0} stars. The main tongue be ${topLanguage}, which means the ship is either well rigged or held together with hopeful comments.

${archivedLine} Still, the deck is public, the code is afloat, and that counts.

Tiny compliment: there is real builder energy under the sea spray.
    `.trim();
  }

  if (style === "corporate jargon") {
    return `
${name}'s GitHub portfolio shows ${repos.length} public repo deliverables, with "${top.name}" currently leading stakeholder engagement at ${top.stars || 0} stars. The dominant technology vertical appears to be ${topLanguage}, suggesting a focused strategy or one very persistent comfort zone.

${archivedLine} Overall, the repo ecosystem is giving "Q3 prototype that accidentally became production."

Tiny compliment: the execution velocity is visible.
    `.trim();
  }

  if (style === "overly dramatic movie trailer") {
    return `
In a world with ${repos.length} public repositories, one developer dared to ship "${top.name}" and collect ${top.stars || 0} stars. Armed with ${topLanguage}, open issues, and the quiet bravery of README-driven development, ${name} steps into the commit history.

${archivedLine} This summer: one profile, many repos, no guarantee the demo branch survived.

Tiny compliment: the plot has momentum.
    `.trim();
  }

  return `
${name} has ${repos.length} repos - enough to look busy but not enough to start a tech revolution.

Their top repo "${top.name}" has ${top.stars || 0} stars, which is either hidden genius or very supportive friends.

Tiny compliment: at least something runs.
  `.trim();
}

/* ---------------- SMART LLM ROUTER ---------------- */
async function generateRoast(payload) {
  const providerErrors = [];
  const messages = buildPrompt(payload);

  // 1. DEMO MODE (hard override only)
  if (DEMO_MODE) {
    return {
      roast: fallbackRoast(payload),
      source: "demo",
      providerErrors
    };
  }

  // 2. OpenAI
  if (process.env.OPENAI_API_KEY) {
    try {
      return {
        roast: await callOpenAI(messages),
        source: "openai"
      };
    } catch (e) {
      providerErrors.push(`openai: ${e.message}`);
    }
  }

  // 3. Anthropic
  if (process.env.ANTHROPIC_API_KEY) {
    try {
      return {
        roast: await callAnthropic(messages),
        source: "anthropic"
      };
    } catch (e) {
      providerErrors.push(`anthropic: ${e.message}`);
    }
  }

  // 4. Gemini
  if (process.env.GEMINI_API_KEY) {
    try {
      return {
        roast: await callGemini(messages),
        source: "gemini"
      };
    } catch (e) {
      providerErrors.push(`gemini: ${e.message}`);
    }
  }

  // 5. FINAL FALLBACK (only if ALL fail or no keys)
  console.warn("LLM errors:", providerErrors);

  return {
    roast: fallbackRoast(payload),
    source: "local-fallback",
    providerErrors
  };
}

/* ---------------- ROUTE ---------------- */
app.post("/api/roast", async (req, res) => {
  const username = cleanUsername(req.body.username);
  const style = String(req.body.style || "friendly chaos").slice(0, 80);

  if (!isValidGithubUsername(username)) {
    return res.status(400).json({ error: "Invalid GitHub username." });
  }

  try {
    const github = await getPublicRepos(username);

    if (!github.ok) {
      return res.status(github.status).json({ error: github.message });
    }

    const generated = await generateRoast({ ...github, style });

    res.json({
      ...github,
      roast: generated.roast,
      roastSource: generated.source,
      demoMode: DEMO_MODE,
      ...(DEBUG_LLM ? { providerErrors: generated.providerErrors } : {})
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({
      error: "Something went wrong generating the roast."
    });
  }
});

/* ---------------- START ---------------- */
app.listen(port, () => {
  console.log(`GitHub Roast Lab running on port ${port}`);
});
