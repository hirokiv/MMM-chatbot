import { Sandbox } from "@e2b/code-interpreter";

export async function runPython(
  code: string,
  contextData?: string
): Promise<{ output: string; error?: string }> {
  const sandbox = await Sandbox.create({
    apiKey: process.env.E2B_API_KEY,
  });

  try {
    let fullCode = code;
    if (contextData) {
      // Inject context data as a variable
      fullCode = `import json\ncontext_data = '''${contextData}'''\n${code}`;
    }

    const execution = await sandbox.runCode(fullCode, {
      timeoutMs: 30000,
    });

    const stdout = execution.logs.stdout.join("\n");
    const stderr = execution.logs.stderr.join("\n");

    return {
      output: stdout || "(no output)",
      error: stderr || undefined,
    };
  } finally {
    await sandbox.kill();
  }
}
