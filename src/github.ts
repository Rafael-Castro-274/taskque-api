const GITHUB_TOKEN = process.env.GITHUB_TOKEN || "";

function headers() {
  return {
    Authorization: `Bearer ${GITHUB_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export function isGithubConfigured(): boolean {
  return !!GITHUB_TOKEN;
}

export interface GithubRepoSummary {
  owner: string;
  name: string;
  fullName: string;
  defaultBranch: string;
  private: boolean;
}

export async function listUserRepos(): Promise<
  { success: true; repos: GithubRepoSummary[] } | { success: false; error: string }
> {
  if (!GITHUB_TOKEN) {
    return { success: false, error: "GITHUB_TOKEN não configurado no .env" };
  }

  const repos: GithubRepoSummary[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `https://api.github.com/user/repos?per_page=100&page=${page}&sort=updated&affiliation=owner,collaborator,organization_member`,
        { headers: headers() },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: `GitHub API ${res.status}: ${(errData as Record<string, string>).message || "erro desconhecido"}`,
        };
      }
      const data = (await res.json()) as Array<{
        name: string;
        full_name: string;
        default_branch: string;
        private: boolean;
        owner: { login: string };
      }>;
      for (const r of data) {
        repos.push({
          owner: r.owner.login,
          name: r.name,
          fullName: r.full_name,
          defaultBranch: r.default_branch,
          private: r.private,
        });
      }
      if (data.length < 100) break;
    }
    return { success: true, repos };
  } catch (err) {
    console.error("Erro ao listar repos do GitHub:", err);
    return { success: false, error: "Erro de conexão com o GitHub" };
  }
}

export async function listRepoBranches(
  owner: string,
  repo: string,
): Promise<{ success: true; branches: string[] } | { success: false; error: string }> {
  if (!GITHUB_TOKEN) {
    return { success: false, error: "GITHUB_TOKEN não configurado no .env" };
  }

  const branches: string[] = [];
  try {
    for (let page = 1; page <= 10; page++) {
      const res = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/branches?per_page=100&page=${page}`,
        { headers: headers() },
      );
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        return {
          success: false,
          error: `GitHub API ${res.status}: ${(errData as Record<string, string>).message || "erro desconhecido"}`,
        };
      }
      const data = (await res.json()) as Array<{ name: string }>;
      for (const b of data) {
        branches.push(b.name);
      }
      if (data.length < 100) break;
    }
    return { success: true, branches };
  } catch (err) {
    console.error(`Erro ao listar branches de ${owner}/${repo}:`, err);
    return { success: false, error: "Erro de conexão com o GitHub" };
  }
}

export async function createBranch(
  owner: string,
  repo: string,
  baseBranch: string,
  branchName: string,
): Promise<{ success: boolean; error?: string }> {
  if (!GITHUB_TOKEN) {
    return { success: false, error: "GITHUB_TOKEN não configurado no .env" };
  }

  const apiBase = `https://api.github.com/repos/${owner}/${repo}`;

  try {
    // Get the SHA of the base branch
    const refRes = await fetch(`${apiBase}/git/ref/heads/${baseBranch}`, { headers: headers() });
    if (!refRes.ok) {
      return { success: false, error: `Não foi possível obter a branch "${baseBranch}" em ${owner}/${repo}: ${refRes.status}` };
    }
    const refData = await refRes.json();
    const sha = refData.object.sha;

    // Create the new branch
    const createRes = await fetch(`${apiBase}/git/refs`, {
      method: "POST",
      headers: { ...headers(), "Content-Type": "application/json" },
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha,
      }),
    });

    if (createRes.status === 422) {
      return { success: false, error: `Branch "${branchName}" já existe em ${owner}/${repo}` };
    }

    if (!createRes.ok) {
      const errData = await createRes.json().catch(() => ({}));
      return { success: false, error: `Erro ao criar branch em ${owner}/${repo}: ${(errData as Record<string, string>).message || createRes.status}` };
    }

    console.log(`✔ Branch criada: ${branchName} em ${owner}/${repo}`);
    return { success: true };
  } catch (err) {
    console.error(`Erro ao criar branch no GitHub (${owner}/${repo}):`, err);
    return { success: false, error: `Erro de conexão com o GitHub para ${owner}/${repo}` };
  }
}
