import { List, showToast, Toast, Action, ActionPanel, closeMainWindow, getPreferenceValues } from "@raycast/api";
import type { KeyboardShortcut } from "@raycast/api";
import { useEffect, useState } from "react";
import { exec } from "child_process";
import fs from "fs";
import path from "path";

interface Project {
  name: string;
  path: string;
}

interface IDEOption {
  name: string;
  appName: string;
  shortcut?: KeyboardShortcut;
}

interface Preferences {
  workspacePath: string;
}

const IDE_OPTIONS: IDEOption[] = [
  { 
    name: "Cursor", 
    appName: "cursor",
    shortcut: {
      modifiers: [],
      key: "return"
    }
  },
  { 
    name: "VSCode", 
    appName: "visual studio code",
    shortcut: {
      modifiers: ["cmd"],
      key: "return"
    }
  },
  { 
    name: "Windsurf", 
    appName: "windsurf",
    shortcut: {
      modifiers: ["opt"],
      key: "return"
    }
  }
];

function Command() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const { workspacePath = "~/Projects" } = getPreferenceValues<Preferences>();

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
    const indicators = [".git", "package.json", "Cargo.toml", "go.mod", "requirements.txt"];
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

  function openInIDE(projectPath: string, ide: IDEOption) {
    exec(`open -a "${ide.appName}" "${projectPath}"`, async (error) => {
      if (error) {
        console.error(`Error opening ${ide.name}:`, error);
        await showToast({
          style: Toast.Style.Failure,
          title: `Failed to open project`,
          message: `Make sure ${ide.name} is installed and try again.`,
        });
      } else {
        await showToast({
          style: Toast.Style.Success,
          title: `Project opened in ${ide.name}`,
        });
      }
    });
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
                    onAction={() => openInIDE(project.path, ide)}
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