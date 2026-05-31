const form = document.querySelector("#roast-form");
const result = document.querySelector("#result");
const button = form.querySelector("button");

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function setError(message) {
  result.innerHTML = `<p class="error">${escapeHtml(message)}</p>`;
}

function setLoading(username) {
  result.innerHTML = `
    <div class="empty-state">
      <span>@</span>
      <p>Inspecting ${escapeHtml(username)}'s public repos with a tiny clipboard and a lot of opinions...</p>
    </div>
  `;
}

function renderResult(data) {
  const repos = data.repos
    .slice(0, 10)
    .map((repo) => {
      const language = repo.language ? ` - ${escapeHtml(repo.language)}` : "";
      return `<span class="repo-chip">${escapeHtml(repo.name)}${language}</span>`;
    })
    .join("");

  result.innerHTML = `
    <div class="profile">
      <img class="avatar" src="${escapeHtml(data.profile.avatarUrl)}" alt="">
      <div>
        <h2>${escapeHtml(data.profile.name || data.profile.login)}</h2>
        <a href="${escapeHtml(data.profile.htmlUrl)}" target="_blank" rel="noreferrer">@${escapeHtml(data.profile.login)}</a>
      </div>
    </div>

    <div class="stats">
      <div class="stat"><strong>${data.summary.publicRepoCount}</strong><span>public repos</span></div>
      <div class="stat"><strong>${data.summary.totalStars}</strong><span>stars</span></div>
      <div class="stat"><strong>${data.summary.forks}</strong><span>forks</span></div>
      <div class="stat"><strong>${data.summary.archived}</strong><span>archived</span></div>
    </div>

    <div class="roast">${escapeHtml(data.roast)}</div>
    <div class="repos">${repos}</div>
  `;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = new FormData(form);
  const username = formData.get("username");
  const style = formData.get("style");

  button.disabled = true;
  button.textContent = "Roasting";
  setLoading(username);

  try {
    const response = await fetch("/api/roast", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, style })
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || "Something went sideways.");
      return;
    }

    renderResult(data);
  } catch (error) {
    setError("Could not reach the app server. Is it awake?");
  } finally {
    button.disabled = false;
    button.textContent = "Roast";
  }
});
