import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

/**
 * Git author information for commits
 */
export interface GitAuthor {
  name: string;
  email: string;
}

function quotePath(pathspec: string): string {
  return `"${pathspec}"`;
}

export async function gitAdd(paths: string | string[]): Promise<void> {
  const pathList = Array.isArray(paths) ? paths : [paths];
  const quoted = pathList.map(quotePath).join(" ");
  await execAsync(`git add ${quoted}`);
}

export async function gitRemove(paths: string | string[]): Promise<void> {
  const pathList = Array.isArray(paths) ? paths : [paths];
  const quoted = pathList.map(quotePath).join(" ");
  await execAsync(`git rm ${quoted}`);
}

export async function hasStagedChanges(): Promise<boolean> {
  try {
    await execAsync("git diff --staged --quiet");
    return false;
  } catch {
    return true;
  }
}

function escapeCommitMessage(message: string): string {
  return message.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\$/g, "\\$");
}

export async function commitStagedChanges(
  commitMessage: string,
  author: GitAuthor
): Promise<void> {
  const escapedMessage = escapeCommitMessage(commitMessage);
  const authorString = `${author.name} <${author.email}>`;
  await execAsync(`git commit -m "${escapedMessage}" --author="${authorString}"`);
}

export async function getHeadSha(): Promise<string> {
  const { stdout } = await execAsync("git rev-parse HEAD");
  return stdout.trim();
}

export async function commitStagedChangesIfAny(
  commitMessage: string,
  author: GitAuthor
): Promise<string | null> {
  if (!(await hasStagedChanges())) {
    return null;
  }

  await commitStagedChanges(commitMessage, author);
  return getHeadSha();
}

export async function getFileHistory(
  filepath: string,
  limit = 10
): Promise<Array<{
  sha: string;
  author: string;
  email: string;
  date: string;
  message: string;
}>> {
  try {
    const { stdout } = await execAsync(
      `git log -n ${limit} --format='%H|%an|%ae|%aI|%s' -- "${filepath}"`
    );

    if (!stdout.trim()) {
      return [];
    }

    return stdout
      .trim()
      .split("\n")
      .map((line) => {
        const [sha, author, email, date, message] = line.split("|");
        return { sha, author, email, date, message };
      });
  } catch {
    return [];
  }
}

export async function getFileDiff(
  filepath: string,
  fromCommit: string,
  toCommit = "HEAD"
): Promise<string> {
  try {
    const { stdout } = await execAsync(
      `git diff ${fromCommit} ${toCommit} -- "${filepath}"`
    );
    return stdout;
  } catch {
    return "";
  }
}

export async function isRepoClean(): Promise<boolean> {
  try {
    await execAsync("git diff --quiet && git diff --staged --quiet");
    return true;
  } catch {
    return false;
  }
}

export async function isPathClean(pathspec: string): Promise<boolean> {
  try {
    await execAsync(
      `git diff --quiet -- "${pathspec}" && git diff --staged --quiet -- "${pathspec}"`
    );
    return true;
  } catch {
    return false;
  }
}

export async function getCurrentBranch(): Promise<string> {
  const { stdout } = await execAsync("git branch --show-current");
  return stdout.trim();
}

export async function pushToRemote(
  remote = "origin",
  branch?: string
): Promise<void> {
  const branchName = branch || (await getCurrentBranch());
  await execAsync(`git push ${remote} ${branchName}`);
}
