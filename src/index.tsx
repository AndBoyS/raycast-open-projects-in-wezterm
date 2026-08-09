import { List, showToast, Toast, Action, ActionPanel, closeMainWindow, getPreferenceValues } from "@raycast/api";
import type { KeyboardShortcut } from "@raycast/api";
import { useEffect, useState } from "react";
import { execFile } from "child_process";
import fs from "fs";
import path from "path";

interface Project {
  name: string;
  path: string;
}

interface HerdrPane {
  workspace_id: string;
  cwd?: string;
}

interface IDEOption {
  name: string;
  appName: string;
  shortcut?: KeyboardShortcut;
}

interface Preferences {
  workspacePath: string;
  herdrPath: string;
}

const IDE_OPTIONS: IDEOption[] = [
  {
    name: "Herdr",
    appName: "Herdr",
    shortcut: {
      modifiers: ["cmd"],
      key: "return",
    },
  },
];

function Command() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { workspacePath = "~/Projects", herdrPath = "herdr" } = getPreferenceValues<Preferences>();

  useEffect(() => {
    const resolvedPath = workspacePath.replace(/^~/, process.env.HOME || "");
    findProjectDirs(resolvedPath)
      .then(setProjects)
      .catch(async (error) => {
        console.error("Error finding projects:", error);
        await showToast({
          style: Toast.Style.Failure,
          title: "Failed to load projects",
          message: error.message,
        });
      })
      .finally(() => setIsLoading(false));
  }, []);

  async function findProjectDirs(dir: string): Promise<Project[]> {
    try {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      let projects: Project[] = [];

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          if (await isProjectDir(fullPath)) {
            projects.push({ name: entry.name, path: fullPath });
          } else {
            projects = projects.concat(await findProjectDirs(fullPath));
          }
        }
      }

      return projects;
    } catch (error) {
      console.error(`Error reading directory ${dir}:`, error);
      throw error;
    }
  }

  async function isProjectDir(dir: string): Promise<boolean> {
    const indicators = [".git", "package.json", "Cargo.toml", "go.mod", "pyproject.toml", "requirements.txt"];
    for (const indicator of indicators) {
      try {
        await fs.promises.access(path.join(dir, indicator));
        return true;
      } catch {
        // File doesn't exist, continue checking
      }
    }
    return false;
  }

  function runHerdr(args: string[]): Promise<string> {
    return new Promise((resolve, reject) => {
      execFile(herdrPath, args, (error, stdout) => {
        if (error) {
          reject(error);
        } else {
          resolve(stdout);
        }
      });
    });
  }

  async function openInHerdr(project: Project) {
    try {
      const paneList = JSON.parse(await runHerdr(["pane", "list"]));
      const panes = paneList.result.panes as HerdrPane[];
      const projectPath = path.resolve(project.path);
      const existingPane = panes.find((pane) => {
        if (!pane.cwd) {
          return false;
        }

        return path.resolve(pane.cwd) === projectPath;
      });

      if (existingPane) {
        await runHerdr(["workspace", "focus", existingPane.workspace_id]);
        await showToast({
          style: Toast.Style.Success,
          title: "Workspace focused in Herdr",
        });
      } else {
        await runHerdr(["workspace", "create", "--cwd", projectPath, "--label", project.name, "--focus"]);
        await showToast({
          style: Toast.Style.Success,
          title: "Workspace created in Herdr",
        });
      }
    } catch (error) {
      console.error("Error opening project in Herdr:", error);
      await showToast({
        style: Toast.Style.Failure,
        title: "Failed to open project",
        message: "Make sure Herdr is installed and try again.",
      });
    }
    closeMainWindow({ clearRootSearch: true });
  }

  return (
    <List isLoading={isLoading}>
      {projects.map((project) => (
        <List.Item
          key={project.path}
          title={project.name}
          subtitle={project.path}
          actions={
            <ActionPanel>
              <ActionPanel.Section>
                {IDE_OPTIONS.map((ide) => (
                  <Action
                    key={ide.name}
                    title={`Open in ${ide.name}`}
                    onAction={() => openInHerdr(project)}
                    shortcut={ide.shortcut}
                  />
                ))}
              </ActionPanel.Section>
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

export default Command;
