import { chmod, readdir } from "node:fs/promises";
import path from "node:path";

if (process.platform !== "win32") {
  const pnpmStore = path.resolve("node_modules", ".pnpm");
  const packages = await readdir(pnpmStore, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  });
  const enginePackages = packages.filter(
    (entry) => entry.isDirectory() && entry.name.startsWith("@prisma+engines@"),
  );

  const engineDirectories = [path.resolve("node_modules", "@prisma", "engines")];
  engineDirectories.push(...enginePackages.map((enginePackage) => path.join(
    pnpmStore,
    enginePackage.name,
    "node_modules",
    "@prisma",
    "engines",
  )));

  let prepared = 0;
  for (const engineDirectory of engineDirectories) {
    const engineFiles = await readdir(engineDirectory, { withFileTypes: true }).catch((error) => {
      if (error.code === "ENOENT") return [];
      throw error;
    });
    for (const engineFile of engineFiles) {
      if (engineFile.isFile() && engineFile.name.startsWith("schema-engine-")) {
        await chmod(path.join(engineDirectory, engineFile.name), 0o755);
        prepared += 1;
      }
    }
  }

  if (!prepared) {
    throw new Error("Prisma schema engine was not found after dependency installation.");
  }

  console.log(`Prepared ${prepared} Prisma schema engine executable${prepared === 1 ? "" : "s"}.`);
}
